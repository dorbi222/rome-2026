import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { subscribe, save, onStatus } from './sync.js';
import { HOTEL, FLIGHTS, CATS, DAYS, TAXI_RULES, TAXI_DESTS, REMINDERS, BAR_LINES, DAILY } from './data.js';

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('roma30:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('roma30:' + k, JSON.stringify(v)); } catch {} },
};
function usePersist(key, init) {
  const [v, setV] = useState(() => store.get(key, init));
  useEffect(() => store.set(key, v), [key, v]);
  return [v, setV];
}

// Synced between phones via Firestore, cached locally.
function useShared(key, init) {
  const [v, setV] = useState(() => store.get(key, init));
  useEffect(() => subscribe(key, (remote) => { setV(remote); store.set(key, remote); }), [key]);
  const set = (next) => { setV(next); store.set(key, next); save(key, next); };
  return [v, set];
}
function useSyncStatus() {
  const [s, setS] = useState('local');
  useEffect(() => onStatus(setS), []);
  return s;
}

/* ---------- time ---------- */
const DEPART = Date.UTC(2026, 11, 18, 8, 45);   // 10:45 Israel
const LAND = Date.UTC(2026, 11, 18, 12, 30);    // 13:30 Rome
const FLY_HOME = Date.UTC(2026, 11, 21, 21, 10); // 22:10 Rome
const romeNow = (ms) => new Date(ms + 3600e3); // CET in December, read with UTC getters
function useNow() {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(i); }, []);
  return n;
}
function tripDayIndex(ms) {
  const r = romeNow(ms);
  if (r.getUTCFullYear() !== 2026 || r.getUTCMonth() !== 11) return -1;
  const d = r.getUTCDate();
  return d >= 18 && d <= 21 ? d - 18 : -1;
}
function parseRange(t) {
  const m = t.match(/(\d{1,2}):(\d{2})(?:–(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const s = +m[1] * 60 + +m[2];
  let e = m[3] ? +m[3] * 60 + +m[4] : s + 60;
  if (e <= s) e += 24 * 60;
  return [s, e];
}

/* ---------- bidi helpers ---------- */
const L = ({ children, className = '' }) => <bdi dir="ltr" className={className}>{children}</bdi>;
function Rich({ text }) {
  if (!text) return null;
  return text.split(/\{([^}]+)\}/).map((p, i) => (i % 2 ? <bdi key={i} dir="ltr" className={p.length < 28 ? 'whitespace-nowrap' : ''}>{p}</bdi> : <React.Fragment key={i}>{p}</React.Fragment>));
}
const mapsUrl = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

/* ---------- confetti ---------- */
let fireFx = () => {};
const COLORS = ['#D4AF37', '#F3E5AB', '#722F37', '#8B1E24', '#FFFFFF', '#E9C863'];
function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d');
    let parts = [], raf = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
    size(); addEventListener('resize', size);
    const heart = (s) => { ctx.beginPath(); ctx.moveTo(0, s * 0.3); ctx.bezierCurveTo(0, 0, -s, 0, -s, s * 0.35); ctx.bezierCurveTo(-s, s * 0.8, 0, s, 0, s * 1.3); ctx.bezierCurveTo(0, s, s, s * 0.8, s, s * 0.35); ctx.bezierCurveTo(s, 0, 0, 0, 0, s * 0.3); ctx.fill(); };
    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
      for (const p of parts) {
        p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g; p.x += p.vx + Math.sin(p.t) * p.sway; p.y += p.vy; p.t += 0.08; p.r += p.vr; p.life -= 1;
        ctx.save(); ctx.globalAlpha = Math.min(1, p.life / 40); ctx.translate(p.x * dpr, p.y * dpr); ctx.rotate(p.r); ctx.fillStyle = p.c;
        const s = p.s * dpr;
        if (p.shape === 'heart') heart(s * 0.6);
        else if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, s / 2.4, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.scale(1, Math.cos(p.t * 2)); ctx.fillRect(-s / 2, -s / 4, s, s / 2); }
        ctx.restore();
      }
      raf = parts.length ? requestAnimationFrame(loop) : 0;
    };
    const add = (o) => { parts.push(o); if (!raf) raf = requestAnimationFrame(loop); };
    fireFx = (opt = {}) => {
      if (opt.hearts) {
        const { x, y } = opt;
        for (let i = 0; i < 26; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 3 + Math.random() * 5;
          add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.14, s: 12 + Math.random() * 8, c: ['#8B1E24', '#D4AF37', '#E05A6A', '#F3E5AB'][i % 4], shape: 'heart', r: (Math.random() - 0.5) * 0.6, vr: (Math.random() - 0.5) * 0.05, t: Math.random() * 6, sway: 0.4, life: 120 }); }
        return;
      }
      const W = innerWidth, H = innerHeight;
      const cannon = (x, dir) => { for (let i = 0; i < 90; i++) { const a = -Math.PI / 2 + dir * (0.25 + Math.random() * 0.55), v = 11 + Math.random() * 10;
        add({ x, y: H + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.2, s: 8 + Math.random() * 7, c: COLORS[i % COLORS.length], shape: i % 3 === 0 ? 'circle' : 'rect', r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, t: Math.random() * 6, sway: 0.6, life: 260 }); } };
      cannon(0, 1); cannon(W, -1);
      for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 7;
        add({ x: W / 2, y: H * 0.32, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, g: 0.12, s: 7 + Math.random() * 6, c: COLORS[i % COLORS.length], shape: i % 5 === 0 ? 'heart' : 'rect', r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, t: Math.random() * 6, sway: 0.5, life: 240 }); }
    };
    return () => { removeEventListener('resize', size); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[100] h-full w-full" aria-hidden="true" />;
}

/* ---------- icons ---------- */
const I = {
  pin: <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  cal: <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />,
  bag: <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 7h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm4 4h8" />,
  compass: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z" />,
  sun: <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-13v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  swap: <path d="M7 7h11l-3-3M17 17H6l3 3" />,
  copy: <path d="M9 9h10v10H9zM5 15V5h10" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
};
const Icon = ({ n, className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{I[n]}</svg>
);

/* ---------- decorations ---------- */
function Lights({ className = '' }) {
  const bulbs = Array.from({ length: 15 });
  const cols = ['#D4AF37', '#B3262F', '#2F6B33', '#F3E5AB'];
  return (
    <svg viewBox="0 0 400 34" preserveAspectRatio="none" className={'h-7 w-full ' + className} aria-hidden="true">
      <path d="M0 6 Q 26 24 53 6 T 106 6 T 160 6 T 213 6 T 266 6 T 320 6 T 373 6 T 426 6" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.2" />
      {bulbs.map((_, i) => { const x = 13 + i * 26.6; const y = 6 + 11 * Math.abs(Math.sin(((x % 53.3) / 53.3) * Math.PI)); return (
        <g key={i} transform={`translate(${x} ${y})`}>
          <rect x="-1.6" y="0" width="3.2" height="3" rx=".6" fill="currentColor" fillOpacity=".5" />
          <ellipse cx="0" cy="8" rx="3.6" ry="5.4" fill={cols[i % 4]} className="bulb" style={{ animationDelay: `${(i * 0.37) % 2.4}s`, color: cols[i % 4] }} />
        </g>); })}
    </svg>
  );
}
function Sparkles({ n = 26 }) {
  const items = useRef(Array.from({ length: n }, () => ({ l: Math.random() * 100, d: 6 + Math.random() * 9, delay: -Math.random() * 14, s: 2 + Math.random() * 4, o: 0.3 + Math.random() * 0.6 })));
  return <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    {items.current.map((p, i) => <span key={i} className="snowflake" style={{ left: p.l + '%', width: p.s, height: p.s, opacity: p.o, animationDuration: p.d + 's', animationDelay: p.delay + 's' }} />)}
  </div>;
}

/* ---------- app context ---------- */
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

/* ---------- profile picker ---------- */
function Picker({ onPick }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-espresso text-cream">
      <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_0%,rgba(139,30,36,.55),transparent_60%),radial-gradient(80%_50%_at_50%_100%,rgba(30,70,32,.35),transparent_70%)]" />
      <Sparkles />
      <div className="relative pt-[env(safe-area-inset-top)] text-gold"><Lights /></div>
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10 pt-6">
        <div className="fade-up text-center">
          <p className="font-latin text-sm italic tracking-[.35em] text-gold/80"><L>ROMA · MMXXVI</L></p>
          <h1 className="mt-3 font-serif text-[2.6rem] font-black leading-[1.05]">
            <span className="gold-text">רומא</span> בסימן<br />כריסמס
          </h1>
          <p className="mt-3 text-sm text-cream/70">סופ״ש ארוך, ארבעה ימים ויום הולדת אחד גדול</p>
          <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border border-gold/30 bg-white/5 px-4 py-1.5 text-xs text-gold-light">
            <span>🎄</span><L>18–21.12.2026</L><span>🍷</span>
          </div>
        </div>

        <p className="fade-up mt-10 text-center text-sm text-cream/60" style={{ animationDelay: '.15s' }}>מי נכנס/ת?</p>
        <div className="mt-4 grid gap-4">
          <button onClick={() => onPick('bar')} className="fade-up press group relative overflow-hidden rounded-[28px] border border-gold/50 bg-gradient-to-l from-wine-deep to-wine p-5 text-right shadow-[0_20px_50px_-20px_rgba(212,175,55,.5)]" style={{ animationDelay: '.25s' }}>
            <span className="shine" />
            <div className="flex items-center gap-4">
              <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-light via-gold to-[#9C7A1E] font-serif text-3xl font-black text-wine-deep ring-4 ring-gold/20">
                ב<span className="absolute -top-4 text-2xl crown">👑</span>
              </div>
              <div className="flex-1">
                <div className="font-serif text-2xl font-bold">בר</div>
                <div className="text-sm text-gold-light">כלת יום ההולדת</div>
              </div>
              <span className="text-2xl transition-transform group-active:scale-125">🥂</span>
            </div>
          </button>
          <button onClick={() => onPick('dor')} className="fade-up press relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[.06] p-5 text-right backdrop-blur" style={{ animationDelay: '.35s' }}>
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fir to-[#0f2b11] font-serif text-3xl font-black text-gold-light ring-4 ring-white/5">ד</div>
              <div className="flex-1">
                <div className="font-serif text-2xl font-bold">דור</div>
                <div className="text-sm text-cream/60">המתכנן הראשי · טיסות, מוניות ותזכורות</div>
              </div>
              <span className="text-2xl">🧭</span>
            </div>
          </button>
        </div>
        <p className="mt-auto pt-10 text-center font-latin text-xs italic text-cream/35"><L>Tutte le strade portano a te</L></p>
      </div>
    </div>
  );
}

/* ---------- header ---------- */
function Header() {
  const { profile, setProfile, dark, setDark, now } = useApp();
  const sync = useSyncStatus();
  const [i, setI] = useState(0);
  const isBday = romeNow(now).getUTCMonth() === 11 && romeNow(now).getUTCDate() === 19 && romeNow(now).getUTCFullYear() === 2026;
  const lines = isBday ? ['היום זה היום! מזל טוב 🎂', ...BAR_LINES] : BAR_LINES;
  useEffect(() => { if (profile !== 'bar') return; const t = setInterval(() => setI((x) => x + 1), 3600); return () => clearInterval(t); }, [profile]);
  return (
    <header className="sticky top-0 z-40 bg-cream/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:bg-espresso/85">
      <div className="text-wine/60 dark:text-gold/70"><Lights className="-mb-1 h-6" /></div>
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 pb-3">
        <div className={'grid h-10 w-10 shrink-0 place-items-center rounded-full font-serif text-lg font-black ' + (profile === 'bar' ? 'bg-gradient-to-br from-gold-light to-gold text-wine-deep' : 'bg-fir text-gold-light')}>
          {profile === 'bar' ? 'ב' : 'ד'}
        </div>
        <div className="min-w-0 flex-1">
          {profile === 'bar' ? (
            <div className="relative h-6 overflow-hidden">
              <div key={i} className="banner-in truncate font-serif text-[15.5px] font-bold text-wine dark:text-gold-light"><Rich text={lines[i % lines.length]} /></div>
            </div>
          ) : (
            <div className="font-serif text-[17px] font-bold text-wine dark:text-gold-light"><L>Ciao</L> דור 🧭</div>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-espresso/50 dark:text-cream/45"><span className={'h-1.5 w-1.5 rounded-full ' + (sync === 'synced' ? 'bg-[#4CAF50]' : 'bg-gold')} title={sync === 'synced' ? 'מסונכרן' : 'מקומי'} />רומא · <L>18–21.12</L> · <L>Ruby Giulia</L></div>
        </div>
        <button onClick={() => setDark(!dark)} className="press grid h-9 w-9 shrink-0 place-items-center rounded-full border border-wine/10 text-wine dark:border-white/10 dark:text-gold-light" aria-label="מצב תצוגה"><Icon n={dark ? 'sun' : 'moon'} /></button>
        <button onClick={() => setProfile(null)} className="press grid h-9 w-9 shrink-0 place-items-center rounded-full border border-wine/10 text-wine dark:border-white/10 dark:text-gold-light" aria-label="החלפת פרופיל"><Icon n="swap" /></button>
      </div>
    </header>
  );
}

/* ---------- countdown hero ---------- */
function Countdown({ onJump }) {
  const { now, profile } = useApp();
  let phase = 'before', target = DEPART;
  if (now >= DEPART && now < LAND) { phase = 'air'; target = LAND; }
  else if (now >= LAND && now < FLY_HOME) phase = 'rome';
  else if (now >= FLY_HOME) phase = 'after';
  const diff = Math.max(0, target - now);
  const parts = [['ימים', Math.floor(diff / 864e5)], ['שעות', Math.floor(diff / 36e5) % 24], ['דקות', Math.floor(diff / 6e4) % 60], ['שניות', Math.floor(diff / 1e3) % 60]];
  const di = tripDayIndex(now);
  return (
    <section className="fade-up relative mx-4 mt-3 overflow-hidden rounded-[30px] bg-gradient-to-br from-wine-deep via-wine to-[#3d1418] p-5 text-cream shadow-[0_24px_60px_-28px_rgba(114,47,55,.9)]">
      <Sparkles n={14} />
      <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />
      <div className="relative">
        {phase === 'before' || phase === 'air' ? (<>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gold-light">{phase === 'before' ? (profile === 'bar' ? 'ההרפתקה שלך מתחילה בעוד' : 'ממריאים לרומא בעוד') : 'בדרך לרומא ✈️ נוחתים בעוד'}</p>
            <span className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] text-gold-light"><L>{phase === 'before' ? 'LY 383 · 10:45' : 'FCO · 13:30'}</L></span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2" dir="ltr">
            {parts.map(([lab, v]) => (
              <div key={lab} className="rounded-2xl border border-gold/25 bg-black/20 py-2.5 text-center">
                <div className="overflow-hidden font-serif text-[1.9rem] font-black leading-none tabular-nums text-gold-light">
                  <span key={v} className="tick inline-block">{String(v).padStart(2, '0')}</span>
                </div>
                <div className="mt-1 text-[11px] text-cream/70">{lab}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-cream/60">שישי <L>18.12</L> · תל אביב ← רומא</p>
        </>) : phase === 'rome' ? (
          <div className="text-center">
            <div className="text-4xl">🎄🍷✨</div>
            <h2 className="mt-2 font-serif text-3xl font-black gold-text">חוגגים עכשיו ברומא!</h2>
            {di >= 0 && <p className="mt-2 text-sm text-cream/80">יום {di + 1} מתוך 4 · {DAYS[di].title}</p>}
            {di >= 0 && <button onClick={() => onJump(di)} className="press mt-4 rounded-full bg-gold px-5 py-2 text-sm font-bold text-wine-deep">מה עכשיו בלו״ז? ←</button>}
          </div>
        ) : (
          <div className="text-center">
            <div className="text-4xl">❤️</div>
            <h2 className="mt-2 font-serif text-3xl font-black gold-text"><L>Grazie Roma</L></h2>
            <p className="mt-2 text-sm text-cream/80">30 נחגג כמו שצריך. נתראה בפעם הבאה.</p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- small pieces ---------- */
function Rating({ rating, reviews, text }) {
  if (!rating && !text) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-[12px] font-semibold text-[#8a6a12] dark:text-gold-light">
      <L>★ {text || rating.toFixed(1)}</L>{reviews && <span className="font-normal opacity-80">· <L>{reviews}</L> ביקורות</span>}
    </span>
  );
}
function CatChip({ cat }) {
  const c = CATS[cat]; if (!c) return null;
  return <span className="inline-flex items-center gap-1 rounded-full bg-wine/[.08] px-2.5 py-1 text-[12px] text-wine dark:bg-white/[.07] dark:text-cream/80">{c.emoji} {c.label}</span>;
}
function How({ how }) {
  if (!how?.length) return null;
  return (
    <div className="mt-3 space-y-1.5">
      {how.map((h, i) => (
        <div key={i} className="flex items-center gap-2 text-[13.5px]">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fir/10 text-sm dark:bg-fir/40">{h.mode === 'taxi' ? '🚕' : '🚶'}</span>
          <span className="flex-1 text-espresso/80 dark:text-cream/80"><Rich text={h.text} /></span>
          {h.price && <span className="shrink-0 rounded-full border border-gold/40 px-2 py-0.5 text-[12px] font-bold text-[#8a6a12] dark:text-gold-light"><L>{h.price}</L></span>}
        </div>
      ))}
    </div>
  );
}
function Section({ icon, label, children }) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold tracking-wide text-wine/70 dark:text-gold/80"><span>{icon}</span>{label}</div>
      <p className="text-[14.5px] leading-relaxed text-espresso/85 dark:text-cream/85"><Rich text={children} /></p>
    </div>
  );
}
function MapsBtn({ q, label = 'קח אותי לשם', small }) {
  return (
    <a href={mapsUrl(q)} target="_blank" rel="noopener noreferrer"
      className={'press inline-flex items-center justify-center gap-1.5 rounded-full font-bold ' + (small
        ? 'border border-wine/15 px-3 py-1.5 text-[12.5px] text-wine dark:border-gold/25 dark:text-gold-light'
        : 'bg-gradient-to-l from-gold to-[#c79a2a] px-4 py-2.5 text-[14px] text-wine-deep shadow-[0_8px_20px_-10px_rgba(212,175,55,.9)]')}>
      <Icon n="pin" className={small ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />{label}
    </a>
  );
}
function FixedChip() {
  const { profile } = useApp();
  if (profile !== 'dor') return null;
  return <span className="inline-flex items-center gap-1 rounded-full bg-fir/10 px-2.5 py-1 text-[11px] font-semibold text-fir dark:bg-fir/40 dark:text-[#9fd6a2]">📍 עודכן למיקום האמיתי של המלון</span>;
}

/* ---------- options carousel ---------- */
function Options({ opts }) {
  const { choices, setChoices } = useApp();
  const [idx, setIdx] = useState(0);
  const scroller = useRef(null);
  const chosen = choices[opts.key];
  const onScroll = () => {
    const el = scroller.current; if (!el || !el.children.length) return;
    const w = el.children[0].getBoundingClientRect().width + 12;
    setIdx(Math.min(opts.items.length - 1, Math.round(Math.abs(el.scrollLeft) / w)));
  };
  const go = (i) => { const el = scroller.current?.children[i]; el && scroller.current.scrollTo({ left: el.offsetLeft - (scroller.current.clientWidth - el.clientWidth) / 2, behavior: 'smooth' }); };
  const pick = (i, e) => {
    const next = { ...choices };
    if (chosen === i) delete next[opts.key];
    else { next[opts.key] = i; const r = e.currentTarget.getBoundingClientRect(); fireFx({ hearts: true, x: r.left + r.width / 2, y: r.top }); }
    setChoices(next);
  };
  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-bold text-wine/70 dark:text-gold/80">{opts.items.length} אופציות · מחליקים לצדדים</span>
        <div className="flex gap-1.5">
          {opts.items.map((_, i) => <button key={i} onClick={() => go(i)} aria-label={`אופציה ${i + 1}`} className={'h-2 rounded-full transition-all ' + (i === idx ? 'w-5 bg-wine dark:bg-gold' : 'w-2 bg-wine/20 dark:bg-white/20')} />)}
        </div>
      </div>
      <div ref={scroller} onScroll={onScroll} className="no-bar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
        {opts.items.map((o, i) => {
          const on = chosen === i;
          return (
            <div key={i} className={'relative w-[86%] shrink-0 snap-center rounded-3xl border p-4 transition-all ' + (on
              ? 'border-gold bg-gradient-to-b from-gold/15 to-transparent ring-2 ring-gold/60'
              : 'border-wine/10 bg-cream/60 dark:border-white/10 dark:bg-white/[.04]')}>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-wine px-2.5 py-1 text-[11px] font-bold text-cream dark:bg-wine-deep">{['א', 'ב', 'ג'][i]}׳ · {o.badge}</span>
                {on && <span className="pop text-[12px] font-bold text-wine dark:text-gold-light">הבחירה שלנו ❤️</span>}
              </div>
              <h4 className="mt-2.5 font-latin text-[19px] font-bold leading-tight text-espresso dark:text-cream"><L>{o.name}</L></h4>
              <div className="mt-2 flex flex-wrap gap-1.5">{o.cat && <CatChip cat={o.cat} />}<Rating rating={o.rating} reviews={o.reviews} text={o.ratingText} /></div>
              {o.eat && <Section icon="🍽️" label="מה אוכלים פה?">{o.eat}</Section>}
              {o.note && <p className="mt-2 text-[13px] text-espresso/65 dark:text-cream/60">💡 <Rich text={o.note} /></p>}
              <How how={o.how} />
              <div className="mt-4 flex items-center gap-2">
                <button onClick={(e) => pick(i, e)} className={'press flex-1 rounded-full px-3 py-2.5 text-[14px] font-bold transition-colors ' + (on ? 'bg-wine text-cream dark:bg-wine-deep' : 'border-2 border-wine/70 text-wine dark:border-gold/60 dark:text-gold-light')}>
                  {on ? 'בחרנו ❤️ (ביטול)' : 'בחרנו בזה! ❤️'}
                </button>
                <MapsBtn q={o.maps} label="מפה" small />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- stop card ---------- */
function Stop({ s, i, state }) {
  const { choices } = useApp();
  const cat = CATS[s.cat] || CATS.attraction;
  const chosenName = s.options && choices[s.options.key] != null ? s.options.items[choices[s.options.key]]?.name : null;
  return (
    <li className="fade-up relative pr-12" style={{ animationDelay: `${0.05 + i * 0.06}s` }}>
      <div className={'absolute right-0 top-3 z-10 grid h-10 w-10 place-items-center rounded-full text-lg shadow-sm ' + (state === 'now'
        ? 'now-ring bg-gold text-wine-deep'
        : s.special ? 'bg-gradient-to-br from-gold-light to-gold' : 'border border-gold/40 bg-cream dark:bg-[#2a2320]')}>{cat.emoji}</div>
      <article className={'rounded-[26px] border p-4 transition-opacity ' + (s.special
        ? 'border-gold/60 bg-gradient-to-b from-gold/[.12] to-white shadow-[0_18px_40px_-24px_rgba(212,175,55,.8)] dark:to-[#221c19]'
        : 'border-wine/[.08] bg-white shadow-[0_10px_30px_-22px_rgba(28,25,23,.45)] dark:border-white/[.07] dark:bg-[#221c19]') + (state === 'past' ? ' opacity-60' : '')}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-espresso px-2.5 py-1 font-latin text-[12.5px] font-bold tabular-nums text-gold-light dark:bg-black/40"><L>{s.t}</L></span>
          {state === 'now' && <span className="pulse-soft rounded-full bg-wine px-2.5 py-1 text-[11px] font-bold text-cream">עכשיו ✨</span>}
          {s.special && <span className="rounded-full bg-wine px-2.5 py-1 text-[11px] font-bold text-gold-light">🎂 ערב ה-30</span>}
        </div>
        <h3 className="mt-2.5 font-serif text-[21px] font-bold leading-snug text-espresso dark:text-cream">{s.title}</h3>
        {s.en && <p className="font-latin text-[14px] italic text-wine/80 dark:text-gold/80"><L>{s.en}</L></p>}
        <div className="mt-2.5 flex flex-wrap gap-1.5"><CatChip cat={s.cat} /><Rating rating={s.rating} reviews={s.reviews} />{s.fixed && <FixedChip />}</div>
        {chosenName && <p className="pop mt-2.5 rounded-2xl bg-wine/[.07] px-3 py-2 text-[13px] font-semibold text-wine dark:bg-gold/10 dark:text-gold-light">❤️ בחרנו: <L>{chosenName}</L></p>}
        {s.desc && <Section icon="✨" label="מה עושים">{s.desc}</Section>}
        {s.eat && <Section icon="🍽️" label="מה אוכלים פה?">{s.eat}</Section>}
        {s.note && <p className="mt-3 rounded-2xl bg-gold/10 px-3 py-2 text-[13px] leading-relaxed text-espresso/80 dark:text-cream/80">💡 <Rich text={s.note} /></p>}
        {s.how && <><div className="mt-3 text-[12px] font-bold text-wine/70 dark:text-gold/80">🧭 איך מגיעים</div><How how={s.how} /></>}
        {s.subs?.map((u, k) => (
          <div key={k} className="mt-3 rounded-2xl border border-dashed border-gold/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-wine/70 dark:text-gold/80">{CATS[u.cat]?.emoji} {u.label}</span>
              <MapsBtn q={u.maps} label="מפה" small />
            </div>
            <div className="mt-1 font-latin text-[16px] font-bold text-espresso dark:text-cream">{/^[A-Za-z]/.test(u.name) ? <L>{u.name}</L> : u.name}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5"><Rating rating={u.rating} reviews={u.reviews} /></div>
            {u.desc && <p className="mt-1.5 text-[13.5px] text-espresso/75 dark:text-cream/75"><Rich text={u.desc} /></p>}
            {u.eat && <Section icon="🍽️" label="מה אוכלים פה?">{u.eat}</Section>}
            <How how={u.how} />
          </div>
        ))}
        {s.options && <Options opts={s.options} />}
        {(s.maps && !s.options) || s.links ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {s.maps && !s.options && <MapsBtn q={s.maps} />}
            {s.links?.map((l) => <MapsBtn key={l.q} q={l.q} label={l.label} small />)}
          </div>
        ) : null}
      </article>
    </li>
  );
}

/* ---------- timeline ---------- */
function Timeline({ day, setDay }) {
  const { now } = useApp();
  const tabs = useRef(null);
  const di = tripDayIndex(now);
  const r = romeNow(now); const mins = r.getUTCHours() * 60 + r.getUTCMinutes();
  const D = DAYS[day];
  useEffect(() => { tabs.current?.children[day]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }, [day]);
  const stateOf = (s) => {
    if (di === -1) return now >= FLY_HOME ? 'past' : '';
    if (day < di) return 'past';
    if (day > di) return '';
    const rg = parseRange(s.t); if (!rg) return '';
    const m = mins < 300 && rg[1] > 1440 ? mins + 1440 : mins;
    return m >= rg[0] && m < rg[1] ? 'now' : m >= rg[1] ? 'past' : '';
  };
  return (
    <section className="mt-6">
      <div ref={tabs} className="no-bar flex gap-2 overflow-x-auto px-4 pb-1">
        {DAYS.map((d, i) => {
          const on = i === day;
          return (
            <button key={d.id} onClick={() => setDay(i)} className={'press relative shrink-0 rounded-2xl border px-4 py-2.5 text-right transition-all ' + (on
              ? (d.birthday ? 'border-gold bg-gradient-to-br from-gold to-[#b8901f] text-wine-deep shadow-lg' : 'border-wine bg-wine text-cream shadow-lg dark:border-wine-deep dark:bg-wine-deep')
              : 'border-wine/10 bg-white text-espresso/70 dark:border-white/10 dark:bg-white/[.04] dark:text-cream/70')}>
              {di === i && <span className="absolute -top-1.5 left-2 h-3 w-3 rounded-full border-2 border-cream bg-gold dark:border-espresso" />}
              <div className="text-[13px] font-bold">{d.emoji} יום {d.short}</div>
              <div className="font-latin text-[12px] opacity-75"><L>{d.date}</L></div>
            </button>
          );
        })}
      </div>
      <div key={D.id} className="px-4">
        <div className="fade-up mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold text-wine/60 dark:text-gold/70">יום {day + 1} מתוך 4 · {D.short} <L>{D.date}</L></p>
            <h2 className="mt-0.5 font-serif text-[25px] font-black leading-tight text-espresso dark:text-cream">{D.title}</h2>
          </div>
          {D.birthday && <span className="crown shrink-0 text-4xl">🎂</span>}
        </div>
        <div className="fade-up mt-4"><DaySummary day={day} /></div>
        {D.birthday && <div className="fade-up mt-3 rounded-2xl bg-gradient-to-l from-wine to-wine-deep px-4 py-3 text-center font-serif text-[16px] font-bold text-gold-light shine-wrap">היום בר בת 30! <L>Tanti auguri</L> 🥂</div>}
        <ol className="relative mt-5 space-y-4 pb-6">
          <span className="absolute bottom-6 right-5 top-2 w-px bg-gradient-to-b from-gold via-wine/30 to-transparent dark:via-gold/20" aria-hidden="true" />
          {D.stops.map((s, i) => <Stop key={D.id + i} s={s} i={i} state={stateOf(s)} />)}
        </ol>
      </div>
    </section>
  );
}


/* ---------- daily summary ---------- */
function DaySummary({ day, compact }) {
  const { choices } = useApp();
  const D = DAYS[day], S = DAILY[day];
  const decisions = D.stops.filter((s) => s.options).map((s) => {
    const c = choices[s.options.key];
    return { title: s.title, chosen: c != null ? s.options.items[c]?.name : null, n: s.options.items.length };
  });
  const open = decisions.filter((d) => !d.chosen).length;
  return (
    <div className={'relative overflow-hidden rounded-[26px] border p-4 ' + (D.birthday ? 'border-gold/60 bg-gradient-to-br from-gold/20 via-white to-white dark:via-[#2a221e] dark:to-[#221c19]' : 'border-wine/10 bg-gradient-to-br from-wine/[.06] to-white dark:border-white/10 dark:from-wine/25 dark:to-[#221c19]')}>
      <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-gold/20 blur-2xl" />
      <div className="relative">
        <p className="text-[11.5px] font-bold tracking-wide text-wine/60 dark:text-gold/70">הסיכום של היום ☀️</p>
        <h3 className="mt-1 font-latin text-[22px] font-bold leading-tight text-wine dark:text-gold-light"><Rich text={S.greet} /></h3>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-espresso/80 dark:text-cream/80">{S.intro}</p>
        <div className="mt-3 grid gap-1.5">
          {S.highlights.map((h, i) => <div key={i} className="fade-up rounded-xl bg-white/70 px-3 py-2 text-[13.5px] text-espresso/85 shadow-sm dark:bg-white/[.05] dark:text-cream/85" style={{ animationDelay: `${0.1 + i * 0.07}s` }}><Rich text={h} /></div>)}
        </div>
        {decisions.length > 0 && (
          <div className="mt-3 rounded-xl border border-dashed border-wine/20 px-3 py-2 dark:border-gold/25">
            <div className="text-[12px] font-bold text-wine/70 dark:text-gold/80">{open ? `❤️ ${open} החלטות פתוחות להיום` : '❤️ כל ההחלטות להיום סגורות'}</div>
            <ul className="mt-1 space-y-0.5 text-[13px] text-espresso/75 dark:text-cream/75">
              {decisions.map((d, i) => <li key={i}>{d.title}: {d.chosen ? <b className="text-wine dark:text-gold-light"><L>{d.chosen}</L></b> : <span className="opacity-70">עוד לא בחרנו ({d.n} אופציות)</span>}</li>)}
            </ul>
          </div>
        )}
        {!compact && S.remember?.length > 0 && (
          <div className="mt-3">
            <div className="text-[12px] font-bold text-wine/70 dark:text-gold/80">📌 לא לשכוח</div>
            <ul className="mt-1 space-y-0.5 text-[13px] text-espresso/75 dark:text-cream/75">{S.remember.map((r, i) => <li key={i}>• <Rich text={r} /></li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}
function MorningModal({ day, onClose }) {
  if (day == null) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="sheet-in w-full max-w-md rounded-[30px] bg-cream p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] dark:bg-espresso" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-center"><span className="text-3xl">☀️</span><p className="mt-1 text-[13px] text-espresso/60 dark:text-cream/60">בוקר טוב מרומא · יום {day + 1} מתוך 4</p></div>
        <DaySummary day={day} />
        <button onClick={onClose} className="press mt-4 w-full rounded-full bg-gradient-to-l from-wine-deep to-wine py-3 text-[15px] font-bold text-cream">יאללה ליום! ✨</button>
      </div>
    </div>
  );
}

/* ---------- birthday notes (one per day) ---------- */
const unlockAt = (d) => Date.UTC(2026, 11, 17 + d, 23, 0); // that day 00:00 Rome
const NOTE_LABELS = ['שישי', 'שבת', 'ראשון', 'שני'];
function notesOf(g) {
  const n = { ...(g?.notes || {}) };
  if (g?.text && !n[1]) n[1] = { title: '', text: g.text }; // old single greeting → birthday day
  return n;
}
function Thirty({ className = '' }) {
  return <span className={'inline-grid place-items-center rounded-full bg-gradient-to-br from-gold-light via-gold to-[#9C7A1E] font-serif font-black text-wine-deep shadow-[0_6px_18px_-6px_rgba(212,175,55,.9)] ' + className}>30</span>;
}
function Letter({ title, text, day, onClose }) {
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="letter-in relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-[28px] bg-[#FBF5E9] p-6 text-[#2b1a12] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-2 rounded-[22px] border border-[#D4AF37]/60" />
        <div className="text-center">
          <Thirty className="h-16 w-16 text-[26px]" />
          <h3 className="mt-3 font-hand text-[44px] font-bold leading-[1.05] text-[#8B1E24]">{title || 'פתק מדור'}</h3>
          <p className="mt-1 text-[13px] text-[#9C7A1E]">חוגגים 30 ברומא · יום {NOTE_LABELS[day]}</p>
        </div>
        <p className="mt-5 whitespace-pre-wrap text-[16.5px] leading-[1.85]">{text}</p>
        <p className="mt-6 text-left font-hand text-[30px] font-bold text-[#8B1E24]">שלך, דור ❤️</p>
        <button onClick={onClose} className="press mt-5 w-full rounded-full border-2 border-[#8B1E24] py-2.5 font-bold text-[#8B1E24]">סגירה</button>
      </div>
    </div>
  );
}
function Gift({ day }) {
  const { greeting, now } = useApp();
  const [opening, setOpening] = useState(false);
  const [show, setShow] = useState(false);
  const [shake, setShake] = useState(0);
  useEffect(() => { setShow(false); setOpening(false); }, [day]);
  const note = notesOf(greeting)[day];
  if (!note?.text?.trim()) return null;
  const locked = (greeting?.lock ?? true) && now < unlockAt(day);
  const left = unlockAt(day) - now;
  const tap = (e) => {
    if (locked) { setShake((x) => x + 1); return; }
    const r = e.currentTarget.getBoundingClientRect();
    setOpening(true); fireFx({ hearts: true, x: r.left + r.width / 2, y: r.top + 30 });
    setTimeout(() => { fireFx(); setShow(true); setOpening(false); }, 900);
  };
  return (
    <section className="mx-4 mb-8 mt-2">
      <div className="fade-up relative overflow-hidden rounded-[30px] border border-gold/50 bg-gradient-to-b from-wine-deep to-[#3d1418] p-6 text-center text-cream shadow-[0_24px_60px_-28px_rgba(139,30,36,.9)]">
        <Sparkles n={10} />
        <Thirty className="absolute left-4 top-4 h-11 w-11 rotate-[-10deg] text-[17px]" />
        <p className="relative text-[12px] font-bold tracking-wide text-gold">פתק יום הולדת 30 · יום {NOTE_LABELS[day]}</p>
        <p className="relative mt-1 text-[15px] text-gold-light">יש לך מתנה קטנה מדור</p>
        <button onClick={tap} aria-label="פתיחת המתנה" className={'gift relative mx-auto mt-4 block ' + (opening ? 'gift-open' : '')}>
          <span key={shake} className={'relative inline-block ' + (shake ? 'gift-shake' : 'gift-bob')}>
            <svg viewBox="0 0 120 120" className="h-32 w-32" aria-hidden="true">
              <defs><linearGradient id="gb" x1="0" x2="1"><stop offset="0" stopColor="#F3E5AB" /><stop offset=".5" stopColor="#D4AF37" /><stop offset="1" stopColor="#9C7A1E" /></linearGradient></defs>
              <rect x="18" y="52" width="84" height="58" rx="8" fill="#FDFBF7" />
              <rect x="52" y="52" width="16" height="58" fill="url(#gb)" />
              <g className="gift-lid">
                <rect x="12" y="38" width="96" height="18" rx="6" fill="#F7F1E3" />
                <rect x="52" y="38" width="16" height="18" fill="url(#gb)" />
                <path d="M60 38c-8-18-30-16-26-4 3 8 18 6 26 4Zm0 0c8-18 30-16 26-4-3 8-18 6-26 4Z" fill="url(#gb)" />
              </g>
            </svg>
          </span>
        </button>
        {locked ? (
          <p className="relative mt-3 text-[14px] text-cream/80">🔒 נפתח ביום {NOTE_LABELS[day]} · עוד <L>{Math.floor(left / 864e5)}</L> ימים ו-<L>{Math.floor(left / 36e5) % 24}</L> שעות</p>
        ) : (
          <p className="relative mt-3 text-[15px] font-bold text-gold-light">לחצי על המתנה 🎁</p>
        )}
      </div>
      {show && <Letter title={note.title} text={note.text} day={day} onClose={() => setShow(false)} />}
    </section>
  );
}
function GreetingEditor() {
  const { greeting, setGreeting } = useApp();
  const [d, setD] = useState(1);
  const stored = notesOf(greeting);
  const [title, setTitle] = useState(stored[1]?.title || '');
  const [text, setText] = useState(stored[1]?.text || '');
  const lock = greeting?.lock ?? true;
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const cur = stored[d] || { title: '', text: '' };
  useEffect(() => { setTitle(cur.title || ''); setText(cur.text || ''); }, [d, cur.title, cur.text]);
  const dirty = title !== (cur.title || '') || text !== (cur.text || '');
  const write = (patch) => setGreeting({ notes: stored, lock, ...patch });
  const doSave = () => { write({ notes: { ...stored, [d]: { title, text } } }); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  return (
    <Card delay={0.04} className="border-gold/50">
      <div className="flex items-center gap-3">
        <Thirty className="h-10 w-10 shrink-0 text-[15px]" />
        <div>
          <h3 className="font-serif text-[20px] font-bold leading-tight text-espresso dark:text-cream">פתקים לבר 🎁</h3>
          <p className="text-[12.5px] text-espresso/60 dark:text-cream/55">פתק אחר לכל יום. בר רואה מתנה בתחתית הלו״ז של אותו יום.</p>
        </div>
      </div>
      <div className="no-bar mt-3 flex gap-1.5 overflow-x-auto">
        {NOTE_LABELS.map((l, i) => (
          <button key={i} onClick={() => setD(i)} className={'press shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold ' + (d === i ? 'bg-wine text-cream dark:bg-gold dark:text-wine-deep' : 'bg-wine/[.07] text-espresso/70 dark:bg-white/[.06] dark:text-cream/70')}>
            {i === 1 ? '🎂 ' : ''}{l}{stored[i]?.text?.trim() ? ' ✓' : ''}
          </button>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={d === 1 ? 'למשל: מזל טוב לשלושים, אהובה שלי' : 'כותרת הפתק'} dir="rtl"
        className="mt-3 w-full rounded-2xl border border-wine/15 bg-cream px-3 py-2.5 text-[16px] font-bold text-espresso outline-none focus:border-gold dark:border-white/10 dark:bg-black/20 dark:text-cream" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder="בר שלי, ..." dir="rtl"
        className="mt-2 w-full resize-y rounded-2xl border border-wine/15 bg-cream p-3 text-[15px] leading-relaxed text-espresso outline-none focus:border-gold dark:border-white/10 dark:bg-black/20 dark:text-cream" />
      <button onClick={() => write({ lock: !lock })} className="press mt-1 flex w-full items-center gap-3 rounded-xl px-1 py-2 text-right">
        <span className={'relative h-6 w-11 shrink-0 rounded-full transition-colors ' + (lock ? 'bg-wine dark:bg-gold' : 'bg-black/15 dark:bg-white/15')}><span className={'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ' + (lock ? 'right-0.5' : 'right-[22px]')} /></span>
        <span className="text-[14px] text-espresso/85 dark:text-cream/85">כל פתק נפתח רק ביום שלו (בחצות)</span>
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={() => setPreview(true)} disabled={!text.trim()} className="press rounded-full border-2 border-wine/60 py-2.5 text-[14px] font-bold text-wine disabled:opacity-40 dark:border-gold/50 dark:text-gold-light">תצוגה מקדימה</button>
        <button onClick={doSave} disabled={!dirty} className="press rounded-full bg-gradient-to-l from-wine-deep to-wine py-2.5 text-[14px] font-bold text-cream disabled:opacity-50">{saved ? 'נשמר ✓' : `שמירת פתק ${NOTE_LABELS[d]}`}</button>
      </div>
      {preview && <Letter title={title} text={text} day={d} onClose={() => setPreview(false)} />}
    </Card>
  );
}

/* ---------- driver card ---------- */
function DriverCard({ dest, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!dest) return null;
  const text = `${dest.dest}, ${dest.sub}`;
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#FDFBF7] pt-[env(safe-area-inset-top)] text-[#1C1917]">
      <div className="flex items-center justify-between px-5 pt-4">
        <button onClick={onClose} className="press grid h-11 w-11 place-items-center rounded-full bg-black/5" aria-label="סגירה"><Icon n="x" /></button>
        <span className="text-sm text-black/50">מראים לנהג 🚕 · {dest.label}</span>
      </div>
      <div dir="ltr" className="flex flex-1 flex-col justify-center px-7 text-left">
        <p className="font-latin text-2xl italic text-[#722F37]">Buongiorno! 👋</p>
        <p className="mt-2 text-xl text-black/70">Per favore, mi porti a:</p>
        <p className="mt-5 font-latin text-[2.7rem] font-black leading-[1.05]">{dest.dest}</p>
        <p className="mt-3 text-[1.6rem] font-semibold leading-snug text-black/80">{dest.sub}</p>
        <p className="mt-8 font-latin text-2xl italic text-[#722F37]">Grazie mille! 🙏</p>
      </div>
      <div className="grid grid-cols-2 gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <button onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }} className="press flex items-center justify-center gap-2 rounded-full border-2 border-[#722F37] py-3 font-bold text-[#722F37]">
          <Icon n={copied ? 'check' : 'copy'} />{copied ? 'הועתק' : 'העתק כתובת'}
        </button>
        <a href={mapsUrl(text)} target="_blank" rel="noopener noreferrer" className="press flex items-center justify-center gap-2 rounded-full bg-[#722F37] py-3 font-bold text-[#FDFBF7]"><Icon n="pin" />Google Maps</a>
      </div>
    </div>
  );
}

/* ---------- hub ---------- */
function Card({ children, className = '', delay = 0 }) {
  return <section className={'fade-up rounded-[26px] border border-wine/[.08] bg-white p-4 shadow-[0_10px_30px_-22px_rgba(28,25,23,.45)] dark:border-white/[.07] dark:bg-[#221c19] ' + className} style={{ animationDelay: delay + 's' }}>{children}</section>;
}
function Pass({ f, delay }) {
  return (
    <div className="fade-up relative overflow-hidden rounded-[26px] bg-gradient-to-br from-espresso to-[#2b221e] text-cream shadow-xl dark:from-[#2a221f] dark:to-[#161210]" style={{ animationDelay: delay + 's' }}>
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="text-[12px] font-bold text-gold-light">{f.label} · {f.day} <L>{f.date}</L></span>
        <span className="rounded-full bg-gold px-2.5 py-0.5 font-latin text-[12px] font-black text-wine-deep"><L>EL AL · {f.no}</L></span>
      </div>
      <div dir="ltr" className="flex items-center justify-between px-5 py-4">
        <div className="text-left"><div className="font-latin text-[2.1rem] font-black leading-none">{f.from}</div><div className="mt-1 text-[22px] font-bold tabular-nums text-gold-light">{f.dep}</div></div>
        <div className="flex flex-1 items-center px-3 text-gold/60"><span className="h-px flex-1 border-t border-dashed border-gold/50" /><span className="plane mx-2 text-lg">✈</span><span className="h-px flex-1 border-t border-dashed border-gold/50" /></div>
        <div className="text-right"><div className="font-latin text-[2.1rem] font-black leading-none">{f.to}</div><div className="mt-1 text-[22px] font-bold tabular-nums text-gold-light">{f.arr}{f.arrPlus && <sup className="text-[11px]">{f.arrPlus}</sup>}</div></div>
      </div>
      <div className="relative border-t border-dashed border-white/15 px-4 py-2.5 text-[12px] text-cream/65">
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-cream dark:bg-espresso" /><span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-cream dark:bg-espresso" />
        {f.fromCity} ← {f.toCity} · <Rich text={f.note} />
      </div>
    </div>
  );
}
function Hub({ openDriver }) {
  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <h2 className="fade-up font-serif text-[26px] font-black text-espresso dark:text-cream">המלון והטיסות שלנו</h2>
      {FLIGHTS.map((f, i) => <Pass key={f.id} f={f} delay={0.05 + i * 0.07} />)}
      <Card delay={0.2} className="relative overflow-hidden">
        <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-wine/10 blur-2xl dark:bg-gold/10" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-wine text-2xl">🏨</div>
          <div className="min-w-0 flex-1">
            <h3 className="font-latin text-[20px] font-bold text-espresso dark:text-cream"><L>{HOTEL.name}</L></h3>
            <p className="text-[14px] text-espresso/70 dark:text-cream/70"><L>{HOTEL.address}, {HOTEL.city}</L></p>
            <p className="mt-1 text-[12.5px] text-espresso/55 dark:text-cream/50">שכונת מונטי, צמוד ל-<L>Via Nazionale</L>, כמה דקות מ-<L>Piazza Venezia</L></p>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 text-[13.5px] text-espresso/80 dark:text-cream/80">
          <li>✅ אושרה בקשה לצ׳ק-אין מוקדם במידת האפשר</li>
          <li>🧳 שמירת מזוודות חינם בקבלה, בהגעה וביום העזיבה</li>
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => openDriver(TAXI_DESTS[0])} className="press rounded-full bg-gradient-to-l from-gold to-[#c79a2a] px-3 py-2.5 text-[13.5px] font-bold text-wine-deep">🚕 הצג כתובת לנהג</button>
          <MapsBtn q={HOTEL.maps} label="פתח במפות" small />
        </div>
      </Card>
      <Card delay={0.27}>
        <h3 className="font-serif text-[20px] font-bold text-espresso dark:text-cream">כללי הברזל למוניות 🚖</h3>
        <div className="mt-3 space-y-3">
          {TAXI_RULES.map((r) => (
            <div key={r.title} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold/15 text-lg">{r.icon}</span>
              <div><div className="text-[14.5px] font-bold text-espresso dark:text-cream">{r.title}</div><p className="text-[13.5px] leading-relaxed text-espresso/75 dark:text-cream/75"><Rich text={r.text} /></p></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Dor's logistics ---------- */
function Logistics({ openDriver }) {
  const [done, setDone] = useShared('reminders', {});
  const [copied, setCopied] = useState('');
  const count = REMINDERS.filter((r) => done[r.id]).length;
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); setCopied(t); setTimeout(() => setCopied(''), 1400); } catch {} };
  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <h2 className="fade-up font-serif text-[26px] font-black text-espresso dark:text-cream">חמ״ל הלוגיסטיקה 🧭</h2>
      <GreetingEditor />
      <Card delay={0.05}>
        <h3 className="text-[13px] font-bold text-wine/70 dark:text-gold/80">מספרי טיסות</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {FLIGHTS.map((f) => (
            <button key={f.id} onClick={() => copy(f.no)} className="press rounded-2xl border border-wine/10 p-3 text-right dark:border-white/10">
              <div className="text-[11px] text-espresso/55 dark:text-cream/55">{f.label} · <L>{f.date.slice(0, 5)}</L></div>
              <div className="mt-0.5 flex items-center justify-between font-latin text-[20px] font-black text-wine dark:text-gold-light"><L>{f.no}</L><Icon n={copied === f.no ? 'check' : 'copy'} className="h-4 w-4 opacity-60" /></div>
              <div className="font-latin text-[12.5px] tabular-nums text-espresso/70 dark:text-cream/70"><L>{f.from} {f.dep} → {f.to} {f.arr}</L></div>
            </button>
          ))}
        </div>
      </Card>
      <Card delay={0.12}>
        <h3 className="font-serif text-[20px] font-bold text-espresso dark:text-cream">כתובות מהירות למונית</h3>
        <p className="mt-1 text-[12.5px] text-espresso/60 dark:text-cream/55">לוחצים ומראים לנהג מסך גדול באיטלקית</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {TAXI_DESTS.map((d) => (
            <button key={d.label} onClick={() => openDriver(d)} className="press rounded-2xl bg-cream px-3 py-2.5 text-right dark:bg-white/[.05]">
              <div className="text-[13.5px] font-bold text-espresso dark:text-cream">{d.label}</div>
              <div className="truncate font-latin text-[11.5px] text-espresso/55 dark:text-cream/50"><L>{d.dest}</L></div>
            </button>
          ))}
        </div>
      </Card>
      <Card delay={0.19}>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-[20px] font-bold text-espresso dark:text-cream">תזכורות והזמנות</h3>
          <span className="text-[13px] font-bold text-wine dark:text-gold-light"><L>{count}/{REMINDERS.length}</L></span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wine/10 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-l from-gold to-wine transition-all duration-500" style={{ width: `${(count / REMINDERS.length) * 100}%` }} /></div>
        <ul className="mt-3 space-y-1">
          {REMINDERS.map((r) => {
            const on = !!done[r.id];
            return (
              <li key={r.id}>
                <button onClick={() => setDone({ ...done, [r.id]: !on })} className="press flex w-full items-start gap-3 rounded-xl px-1 py-2 text-right">
                  <span className={'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition-colors ' + (on ? 'border-fir bg-fir text-cream' : 'border-wine/30 dark:border-gold/40')}>{on && <Icon n="check" className="pop h-4 w-4" />}</span>
                  <span className={'text-[14px] leading-relaxed ' + (on ? 'text-espresso/40 line-through dark:text-cream/35' : 'text-espresso/85 dark:text-cream/85')}><Rich text={r.text} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card delay={0.26}>
        <h3 className="font-serif text-[20px] font-bold text-espresso dark:text-cream">טיפים לתחבורה</h3>
        <ul className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-espresso/80 dark:text-cream/80">
          <li>🚕 מהשדה: רק מהתור הרשמי של המוניות הלבנות, תעריף קבוע <L>55 €</L>. מתעלמים ממי שמציע "טקסי" באולם הנוסעים.</li>
          <li>📱 בעיר: <L>FreeNow</L> או <L>Uber</L>, או תחנת מוניות בכיכר. לא עוצרים ביד.</li>
          <li>📍 המלון במונטי: הקולוסיאום, ונציה, טרווי ומונטי ברגל. לנאבונה, קמפו דה פיורי וטרסטוורה כדאי מונית כשהרגליים עייפות.</li>
        </ul>
      </Card>
    </div>
  );
}

/* ---------- bottom nav ---------- */
function Nav({ tab, setTab }) {
  const { profile } = useApp();
  const items = [['trip', 'הלו״ז', 'cal'], ['hub', 'מלון וטיסות', 'bag'], ...(profile === 'dor' ? [['dor', 'לוגיסטיקה', 'compass']] : [])];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto mb-3 flex max-w-[380px] gap-1 rounded-full border border-wine/10 bg-white/90 p-1.5 shadow-[0_18px_40px_-18px_rgba(28,25,23,.5)] backdrop-blur-xl dark:border-white/10 dark:bg-[#221c19]/90" style={{ width: 'calc(100% - 32px)' }}>
        {items.map(([k, label, ic]) => (
          <button key={k} onClick={() => setTab(k)} className={'press flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-bold transition-colors ' + (tab === k ? 'bg-wine text-cream dark:bg-gold dark:text-wine-deep' : 'text-espresso/60 dark:text-cream/60')}>
            <Icon n={ic} className="h-[18px] w-[18px]" />{label}
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ---------- root ---------- */
function App() {
  const [profile, setProfileRaw] = usePersist('profile', null);
  const [dark, setDark] = usePersist('dark', true);
  const [choices, setChoices] = useShared('choices', {});
  const [greeting, setGreeting] = useShared('greeting', { notes: {}, lock: true });
  const [morning, setMorning] = useState(null);
  const [tab, setTab] = useState('trip');
  const now = useNow();
  const [day, setDay] = useState(() => { const d = tripDayIndex(Date.now()); return d >= 0 ? d : 0; });
  const [driver, setDriver] = useState(null);

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#1C1917' : '#FDFBF7'); }, [dark]);
  useEffect(() => { if (profile === 'bar') setTimeout(() => fireFx(), 350); }, []); // Bar opens / refreshes → confetti
  const setProfile = (p) => { setProfileRaw(p); setTab('trip'); window.scrollTo(0, 0); if (p === 'bar') setTimeout(() => fireFx(), 250); };
  const jump = (d) => { setDay(d); setTab('trip'); setTimeout(() => document.querySelector('.now-ring')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400); };
  useEffect(() => { if (tab === 'dor' && profile !== 'dor') setTab('trip'); }, [profile, tab]);

  const ctx = { profile, setProfile, dark, setDark, choices, setChoices, greeting, setGreeting, now };
  // once per trip day per profile: morning summary
  useEffect(() => {
    if (!profile) return;
    const d = tripDayIndex(Date.now()); if (d < 0) return;
    const k = `morning-${profile}-${d}`;
    if (!store.get(k, false)) { store.set(k, true); setDay(d); setTimeout(() => setMorning(d), profile === 'bar' ? 2200 : 500); }
  }, [profile]);
  return (
    <Ctx.Provider value={ctx}>
      <Confetti />
      {!profile ? <Picker onPick={setProfile} /> : (
        <div className="min-h-[100dvh] bg-cream pb-28 text-espresso dark:bg-espresso dark:text-cream">
          <Header />
          <main className="mx-auto max-w-md">
            {tab === 'trip' && (<><Countdown onJump={jump} /><Timeline day={day} setDay={setDay} />{profile === 'bar' && <Gift day={day} />}</>)}
            {tab === 'hub' && <Hub openDriver={setDriver} />}
            {tab === 'dor' && <Logistics openDriver={setDriver} />}
            <p className="pb-4 text-center font-latin text-[12px] italic text-espresso/35 dark:text-cream/30"><L>Fatto con amore · D ❤ B</L></p>
          </main>
          <Nav tab={tab} setTab={(t) => { setTab(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          <DriverCard dest={driver} onClose={() => setDriver(null)} />
          <MorningModal day={morning} onClose={() => setMorning(null)} />
        </div>
      )}
    </Ctx.Provider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
