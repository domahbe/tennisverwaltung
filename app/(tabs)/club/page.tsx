'use client';

import { apiFetch } from '@/lib/clientApi';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Avatar, PullToRefresh, Segmented, Sheet, SkeletonCard } from '@/components/ui';
import { NewsPost, SocialLinks } from '@/lib/types';
import { haptic, useToast, useUser } from '../../providers';

interface MemberView {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  photo?: string | null;
  statusText?: string;
  socials?: SocialLinks;
  email?: string | null;
  phone?: string | null;
  memberSince?: string;
  skillLevel: string;
  role: string;
  status: string;
  lookingForPartner: boolean;
  isFavorite: boolean;
}

const socialMeta: { key: keyof SocialLinks; label: string; emoji: string; url: (v: string) => string }[] = [
  { key: 'instagram', label: 'Instagram', emoji: '📸', url: (v) => `https://instagram.com/${v}` },
  { key: 'facebook', label: 'Facebook', emoji: '👤', url: (v) => `https://facebook.com/${v}` },
  { key: 'tiktok', label: 'TikTok', emoji: '🎵', url: (v) => `https://tiktok.com/@${v}` },
  { key: 'website', label: 'Website', emoji: '🌐', url: (v) => `https://${v}` },
];

interface TeamView {
  id: string;
  name: string;
  league: string;
  captain: string;
  position: number;
  matchesWon: number;
  matchesLost: number;
  nextMatch?: { opponent: string; date: string; home: boolean };
  results: { opponent: string; date: string; score: string; won: boolean }[];
  players: { id: string; name: string; initials: string; avatarColor: string; skillLevel: string }[];
}

interface TournamentView {
  id: string;
  name: string;
  type: string;
  startDate: string;
  registrationDeadline: string;
  maxParticipants: number;
  status: string;
  fee: number;
  registered: boolean;
  participants: { id: string; name: string; initials: string; avatarColor: string }[];
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

function ClubInner() {
  const params = useSearchParams();
  const { toast } = useToast();
  const { user } = useUser();
  const [tab, setTab] = useState(params.get('tab') ?? 'news');
  const [news, setNews] = useState<NewsPost[] | null>(null);
  const [members, setMembers] = useState<MemberView[] | null>(null);
  const [teams, setTeams] = useState<TeamView[] | null>(null);
  const [tournaments, setTournaments] = useState<TournamentView[] | null>(null);
  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState('all');
  const [detail, setDetail] = useState<MemberView | null>(null);

  const load = useCallback(async () => {
    const [n, m, t, tr] = await Promise.all([
      apiFetch('/api/news').then((r) => r.json()),
      apiFetch('/api/members').then((r) => r.json()),
      apiFetch('/api/teams').then((r) => r.json()),
      apiFetch('/api/tournaments').then((r) => r.json()),
    ]);
    setNews(n.news);
    setMembers(m.members);
    setTeams(t.teams);
    setTournaments(tr.tournaments);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFavorite(id: string) {
    haptic(10);
    setMembers((ms) => ms?.map((m) => (m.id === id ? { ...m, isFavorite: !m.isFavorite } : m)) ?? null);
    await apiFetch('/api/members/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: id }),
    });
  }

  async function tournamentAction(t: TournamentView) {
    haptic(12);
    const res = await apiFetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId: t.id, action: t.registered ? 'unregister' : 'register' }),
    });
    const data = await res.json();
    if (res.ok) {
      toast(t.registered ? 'Abgemeldet' : `Angemeldet für ${t.name} 🏆`);
      load();
    } else {
      toast(data.error, 'error');
    }
  }

  const filteredMembers = (members ?? []).filter((m) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.skillLevel.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (memberFilter === 'fav') return m.isFavorite;
    if (memberFilter === 'partner') return m.lookingForPartner && m.id !== user?.id;
    return true;
  });

  return (
    <PullToRefresh onRefresh={load}>
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+20px)]">
        <h1 className="mb-3 text-[32px] font-bold tracking-tight">Verein</h1>
        <div className="mb-4">
          <Segmented
            options={[
              { value: 'news', label: 'News' },
              { value: 'members', label: 'Mitglieder' },
              { value: 'teams', label: 'Teams' },
              { value: 'tournaments', label: 'Turniere' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>

        {/* ---- NEWS ---- */}
        {tab === 'news' &&
          (news === null ? (
            <div className="space-y-3">
              <SkeletonCard lines={3} />
              <SkeletonCard lines={3} />
            </div>
          ) : (
            <div className="space-y-3">
              {news.map((n, i) => (
                <motion.article
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="card p-4"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-2xl">{n.emoji}</span>
                    <div className="flex-1">
                      <p className="text-[16px] font-bold leading-tight">
                        {n.pinned && '📌 '}
                        {n.title}
                      </p>
                      <p className="text-secondary text-[12px]">
                        {n.category} · {fmtDate(n.date)}
                      </p>
                    </div>
                  </div>
                  <p className="text-secondary text-[14px] leading-relaxed">{n.body}</p>
                </motion.article>
              ))}
            </div>
          ))}

        {/* ---- MITGLIEDER ---- */}
        {tab === 'members' && (
          <div className="space-y-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Name oder LK suchen"
              className="bg-fill w-full rounded-[12px] px-4 py-2.5 text-[16px] outline-none placeholder:text-[var(--text-secondary)]"
            />
            <Segmented
              options={[
                { value: 'all', label: 'Alle' },
                { value: 'fav', label: '⭐ Favoriten' },
                { value: 'partner', label: 'Spielpartner' },
              ]}
              value={memberFilter}
              onChange={setMemberFilter}
            />
            {members === null ? (
              <SkeletonCard lines={4} />
            ) : (
              <div className="card overflow-hidden">
                {filteredMembers.length === 0 && (
                  <p className="text-secondary p-5 text-center text-[15px]">Keine Treffer</p>
                )}
                {filteredMembers.map((m, i) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      haptic(8);
                      setDetail(m);
                    }}
                    className={`pressable flex cursor-pointer items-center gap-3 px-4 py-2.5 ${
                      i < filteredMembers.length - 1 ? 'separator border-b' : ''
                    }`}
                  >
                    <Avatar initials={m.initials} color={m.avatarColor} photo={m.photo} size={42} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-semibold">
                        {m.name}
                        {m.id === user?.id && <span className="text-secondary font-normal"> (du)</span>}
                      </p>
                      <p className="text-secondary truncate text-[13px]">
                        {m.skillLevel}
                        {m.role === 'trainer' && ' · Trainer'}
                        {m.role === 'admin' && ' · Vorstand'}
                        {m.lookingForPartner && ' · 🤝 sucht Spielpartner'}
                      </p>
                      {m.statusText && <p className="truncate text-[13px] italic text-[var(--primary)]">„{m.statusText}"</p>}
                    </div>
                    {m.id !== user?.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(m.id);
                        }}
                        className="pressable p-1.5 text-xl"
                      >
                        {m.isFavorite ? '⭐' : '☆'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---- TEAMS ---- */}
        {tab === 'teams' &&
          (teams === null ? (
            <SkeletonCard lines={4} />
          ) : (
            <div className="space-y-3">
              {teams.map((t) => (
                <div key={t.id} className="card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-[18px] font-bold">{t.name}</p>
                      <p className="text-secondary text-[13px]">
                        {t.league} · Platz {t.position} · {t.matchesWon}–{t.matchesLost}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary-soft px-3 py-1 text-[13px] font-bold text-[var(--primary)]">
                      #{t.position}
                    </span>
                  </div>
                  {t.nextMatch && (
                    <div className="bg-fill mb-2 rounded-[12px] px-3 py-2 text-[13px]">
                      <span className="font-semibold">Nächstes Spiel:</span> {t.nextMatch.home ? 'vs.' : '@'}{' '}
                      {t.nextMatch.opponent} · {fmtDate(t.nextMatch.date)}
                    </div>
                  )}
                  <div className="mb-2 flex -space-x-2">
                    {t.players.map((p) => (
                      <div key={p.id} className="rounded-full ring-2 ring-[var(--card-opaque)]">
                        <Avatar initials={p.initials} color={p.avatarColor} size={32} />
                      </div>
                    ))}
                    <span className="text-secondary self-center pl-3 text-[12px]">MF: {t.captain}</span>
                  </div>
                  <div className="space-y-1">
                    {t.results.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-[13px]">
                        <span className="text-secondary">
                          {fmtDate(r.date)} · {r.opponent}
                        </span>
                        <span className={`font-bold ${r.won ? 'text-free' : 'text-busy'}`}>{r.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

        {/* ---- TURNIERE ---- */}
        {tab === 'tournaments' &&
          (tournaments === null ? (
            <SkeletonCard lines={4} />
          ) : (
            <div className="space-y-3">
              {tournaments.map((t) => (
                <div key={t.id} className="card p-4">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[17px] font-bold leading-tight">{t.name}</p>
                      <p className="text-secondary text-[13px]">
                        {t.type} · ab {fmtDate(t.startDate)} · {t.fee} € Startgeld
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                        t.status === 'anmeldung'
                          ? 'bg-free/15 text-free'
                          : t.status === 'beendet'
                            ? 'bg-fill text-secondary'
                            : 'bg-soon/15 text-soon'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {t.participants.slice(0, 6).map((p) => (
                        <div key={p.id} className="rounded-full ring-2 ring-[var(--card-opaque)]">
                          <Avatar initials={p.initials} color={p.avatarColor} size={28} />
                        </div>
                      ))}
                    </div>
                    <span className="text-secondary text-[12px]">
                      {t.participants.length}/{t.maxParticipants} angemeldet
                      {t.status === 'anmeldung' && ` · Meldeschluss ${fmtDate(t.registrationDeadline)}`}
                    </span>
                  </div>
                  {t.status === 'anmeldung' && (
                    <button
                      onClick={() => tournamentAction(t)}
                      className={`pressable w-full rounded-[14px] py-2.5 text-[15px] font-bold ${
                        t.registered ? 'bg-fill text-busy' : 'bg-[var(--primary)] text-white'
                      }`}
                    >
                      {t.registered ? 'Abmelden' : 'Jetzt anmelden'}
                    </button>
                  )}
                  {t.status === 'beendet' && (
                    <p className="text-secondary text-[13px]">🏆 Sieger: {t.participants[0]?.name ?? '–'}</p>
                  )}
                </div>
              ))}
            </div>
          ))}
      </div>

      {/* Mitglieder-Profil (zeigt nur freigegebene Daten) */}
      <Sheet open={detail !== null} onClose={() => setDetail(null)}>
        {detail && (
          <div className="space-y-4 pb-2">
            <div className="flex flex-col items-center gap-2 pt-2">
              <Avatar initials={detail.initials} color={detail.avatarColor} photo={detail.photo} size={88} />
              <div className="text-center">
                <p className="text-[22px] font-bold">{detail.name}</p>
                <p className="text-secondary text-[14px]">
                  {detail.skillLevel}
                  {detail.role === 'trainer' && ' · Trainer'}
                  {detail.role === 'admin' && ' · Vorstand'}
                </p>
                {detail.statusText && (
                  <p className="mt-1 text-[15px] italic text-[var(--primary)]">„{detail.statusText}"</p>
                )}
              </div>
            </div>

            {detail.lookingForPartner && (
              <div className="rounded-[14px] bg-free/12 px-4 py-3 text-center text-[14px] font-medium text-free">
                🤝 Sucht aktuell Spielpartner
              </div>
            )}

            {(detail.email || detail.phone) && (
              <div className="bg-fill space-y-1.5 rounded-[14px] p-4">
                {detail.email && (
                  <a href={`mailto:${detail.email}`} className="block text-[15px] text-[var(--primary)]">
                    ✉️ {detail.email}
                  </a>
                )}
                {detail.phone && (
                  <a href={`tel:${detail.phone}`} className="block text-[15px] text-[var(--primary)]">
                    📞 {detail.phone}
                  </a>
                )}
              </div>
            )}

            {detail.socials && Object.values(detail.socials).some(Boolean) && (
              <div>
                <p className="text-secondary mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide">Social Media</p>
                <div className="flex flex-wrap gap-2">
                  {socialMeta.map(({ key, label, emoji, url }) => {
                    const v = detail.socials?.[key];
                    if (!v) return null;
                    return (
                      <a
                        key={key}
                        href={url(v)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pressable bg-fill flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-medium"
                      >
                        {emoji} {label}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-secondary text-center text-[12px]">
              Es werden nur Daten angezeigt, die {detail.name.split(' ')[0]} freigegeben hat.
            </p>
          </div>
        )}
      </Sheet>
    </PullToRefresh>
  );
}

export default function ClubPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-16"><SkeletonCard lines={4} /></div>}>
      <ClubInner />
    </Suspense>
  );
}
