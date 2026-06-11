'use client';

import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/app/providers';
import { Sheet } from './ui';

const VIEW = 260; // sichtbarer Ausschnitt (px)
const OUT = 256; // exportierte Bildgröße

/**
 * Profilbild zuschneiden: Ziehen zum Verschieben, Slider (oder Pinch) zum
 * Zoomen, kreisförmige Vorschau. Export als 256×256-JPEG-Data-URL.
 */
export function PhotoCropper({
  file,
  onDone,
  onCancel,
}: {
  file: File | null;
  onDone: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number; pinch?: number; startZoom?: number } | null>(null);

  useEffect(() => {
    if (!file) {
      setImg(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      setImg(i);
      setZoom(1);
      setPos({ x: 0, y: 0 });
    };
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file) return null;

  // Basis-Skalierung: Bild füllt den Ausschnitt (cover)
  const base = img ? Math.max(VIEW / img.width, VIEW / img.height) : 1;
  const scale = base * zoom;

  function clampPos(x: number, y: number, z = zoom) {
    if (!img) return { x, y };
    const s = base * z;
    const maxX = Math.max(0, (img.width * s - VIEW) / 2);
    const maxY = Math.max(0, (img.height * s - VIEW) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }

  function applyZoom(z: number) {
    const nz = Math.min(4, Math.max(1, z));
    setZoom(nz);
    setPos((p) => clampPos(p.x, p.y, nz));
  }

  function crop() {
    if (!img) return;
    haptic(12);
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d')!;
    const f = OUT / VIEW;
    ctx.translate(OUT / 2 + pos.x * f, OUT / 2 + pos.y * f);
    ctx.scale(scale * f, scale * f);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    onDone(canvas.toDataURL('image/jpeg', 0.85));
  }

  return (
    <Sheet open onClose={onCancel} title="Foto zuschneiden">
      <div className="space-y-4 pb-2">
        <div className="flex justify-center">
          <div
            className="relative touch-none overflow-hidden rounded-[20px] bg-black/80"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setPos(clampPos(drag.current.px + (e.clientX - drag.current.x), drag.current.py + (e.clientY - drag.current.y)));
            }}
            onPointerUp={() => (drag.current = null)}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                drag.current = { x: 0, y: 0, px: pos.x, py: pos.y, pinch: Math.hypot(dx, dy), startZoom: zoom };
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2 && drag.current?.pinch) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                applyZoom((drag.current.startZoom ?? 1) * (Math.hypot(dx, dy) / drag.current.pinch));
              }
            }}
          >
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  width: img.width,
                  height: img.height,
                  transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${scale})`,
                }}
              />
            )}
            {/* Kreis-Maske */}
            <div
              className="pointer-events-none absolute inset-0 rounded-[20px]"
              style={{ boxShadow: `inset 0 0 0 ${VIEW}px rgba(0,0,0,0.45)`, clipPath: 'inset(0)' }}
            >
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90"
                style={{ width: VIEW - 24, height: VIEW - 24, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2">
          <span className="text-secondary text-lg">🔍</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-fill accent-[var(--primary)]"
          />
          <span className="text-secondary w-10 text-right text-[13px]">{zoom.toFixed(1)}×</span>
        </div>
        <p className="text-secondary text-center text-[12px]">Ziehen zum Verschieben · Slider oder zwei Finger zum Zoomen</p>

        <button
          onClick={crop}
          className="glass-shine pressable w-full rounded-[16px] bg-[var(--primary)] py-3.5 text-[17px] font-bold text-white"
        >
          Übernehmen
        </button>
        <button onClick={onCancel} className="text-secondary w-full py-1 text-[15px] font-medium">
          Abbrechen
        </button>
      </div>
    </Sheet>
  );
}
