'use client';

import { weatherFor } from './store';
import { WeatherInfo } from './types';

/**
 * Live-Wetter für die Tennisanlage des TC Graben-Neudorf (Tullastr. 11, 76676)
 * über die Open-Meteo-API: kostenlos, ohne API-Key, CORS-offen und damit
 * direkt aus der statischen PWA nutzbar. Antworten werden 30 Minuten
 * gecacht (localStorage); ohne Netz fällt die App auf das deterministische
 * Demo-Wetter zurück.
 */
const LAT = 49.162;
const LON = 8.49;
const LS_KEY = 'tcgn_weather_v1';
const TTL_MS = 30 * 60 * 1000;

interface CacheShape {
  fetchedAt: number;
  days: Record<string, WeatherInfo>;
}

let memory: CacheShape | null = null;

function loadCache(): CacheShape | null {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) memory = JSON.parse(raw);
  } catch {}
  return memory;
}

function saveCache(cache: CacheShape) {
  memory = cache;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {}
}

type Condition = WeatherInfo['condition'];

/** WMO-Wettercode → App-Kategorie */
function condition(code: number): Condition {
  if (code >= 95) return 'gewitter';
  if ((code >= 51 && code <= 67) || (code >= 71 && code <= 77) || (code >= 80 && code <= 86)) return 'regen';
  if (code <= 1) return 'sonnig';
  return 'wolkig';
}

const icons: Record<Condition, string> = { sonnig: '☀️', wolkig: '⛅️', regen: '🌧', gewitter: '⛈' };

function buildDay(
  date: string,
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; weather_code: number[]; wind_speed_10m: number[] },
): WeatherInfo | null {
  const idx: number[] = [];
  for (let i = 0; i < hourly.time.length; i++) {
    if (hourly.time[i].startsWith(date)) idx.push(i);
  }
  if (idx.length < 20) return null;
  const at = (hour: number) => idx[Math.min(23, Math.max(0, Math.round(hour)))];

  const todayIso = new Date().toISOString().slice(0, 10);
  const refHour = date === todayIso ? Math.min(20, Math.max(8, new Date().getHours())) : 14;
  const ref = at(refHour);

  // Spielbarkeit über den Tenniszeitraum 8–21 Uhr bewerten
  let worst: Condition = 'sonnig';
  let maxRain = 0;
  const rank: Condition[] = ['sonnig', 'wolkig', 'regen', 'gewitter'];
  for (let h = Math.max(8, date === todayIso ? new Date().getHours() : 8); h <= 21; h++) {
    const c = condition(hourly.weather_code[at(h)]);
    if (rank.indexOf(c) > rank.indexOf(worst)) worst = c;
    maxRain = Math.max(maxRain, hourly.precipitation_probability[at(h)] ?? 0);
  }

  const cond = condition(hourly.weather_code[ref]);
  const playable = worst !== 'regen' && worst !== 'gewitter';
  return {
    temp: Math.round(hourly.temperature_2m[ref]),
    condition: cond,
    icon: icons[cond],
    rainProbability: Math.round(maxRain),
    windKmh: Math.round(hourly.wind_speed_10m[ref]),
    playable,
    warning:
      worst === 'gewitter'
        ? 'Gewitterwarnung – Außenplätze gesperrt'
        : worst === 'regen'
          ? 'Regen erwartet – Außenplätze ggf. nicht bespielbar'
          : null,
    hourly: [9, 11, 13, 15, 16, 17, 18, 19, 20].map((h) => {
      const i = at(h);
      return {
        hour: h,
        temp: Math.round(hourly.temperature_2m[i]),
        rain: Math.round(hourly.precipitation_probability[i] ?? 0),
        icon: icons[condition(hourly.weather_code[i])],
      };
    }),
  };
}

async function refresh(): Promise<CacheShape | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
    `&forecast_days=14&timezone=Europe%2FBerlin`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = await res.json();
  const days: Record<string, WeatherInfo> = {};
  const seen = new Set<string>();
  for (const t of data.hourly.time as string[]) seen.add(t.slice(0, 10));
  for (const d of Array.from(seen)) {
    const info = buildDay(d, data.hourly);
    if (info) days[d] = info;
  }
  const cache = { fetchedAt: Date.now(), days };
  saveCache(cache);
  return cache;
}

/** Wetter für ein Datum – live wenn möglich, sonst Cache, sonst Demo-Fallback. */
export async function getWeather(date: string): Promise<WeatherInfo> {
  if (typeof window === 'undefined') return weatherFor(date);
  let cache = loadCache();
  const stale = !cache || Date.now() - cache.fetchedAt > TTL_MS || !cache.days[date];
  if (stale) {
    try {
      cache = await refresh();
    } catch {
      // offline / blockiert → alter Cache oder Demo-Daten
    }
  }
  return cache?.days[date] ?? weatherFor(date);
}
