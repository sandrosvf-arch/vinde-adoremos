import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Music, Settings, Clock, Check, X, ChevronLeft, ChevronRight, SkipBack, ChevronDown, Play, Pause } from 'lucide-react';
import { tablaturas } from '@/mocks/products';
import Navbar from '@/components/feature/Navbar';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const syncStorageKey = (id: number) => `va-sync-${id}`;

// Pixels per second of video duration on the tablature strip
const PX_PER_SECOND = 80;
// Total strip width for a tablature with no video (fallback: pages × 600px)
const pxForTab = (pages: number, duration: number | null) =>
  duration ? Math.round(duration * PX_PER_SECOND) : pages * 600;

// ─── Horizontal tablature strip ─────────────────────────────────────────────
const NOTE_SPACING = 48; // px between beats
const MEASURE_BEATS = 8;
const MEASURE_WIDTH = NOTE_SPACING * MEASURE_BEATS; // 384px

// Step size for frame-by-frame navigation (one measure width in px)
const FRAME_STEP = MEASURE_WIDTH;

function HorizontalTablatura({
  tabId,
  totalWidth,
  scrollX,
  playheadX,
  lyrics,
  scale,
  onDragStart,
}: {
  tabId: number;
  totalWidth: number;
  scrollX: number;
  playheadX: number;
  lyrics: { beat: number; text: string }[];
  scale: number;
  onDragStart: (clientX: number) => void;
}) {
  const STRING_COUNT = 6;
  const STRING_GAP = Math.round(20 * scale);
  const LYRICS_HEIGHT = lyrics.length > 0 ? Math.round(44 * scale) : 0;
  const PADDING_TOP = Math.round(12 * scale);
  const PADDING_BOTTOM = Math.round(20 * scale);
  const STRING_TOP = LYRICS_HEIGHT + PADDING_TOP;
  const totalHeight = STRING_TOP + STRING_GAP * (STRING_COUNT - 1) + PADDING_BOTTOM;
  const totalMeasures = Math.ceil(totalWidth / MEASURE_WIDTH);
  const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];
  const LABEL_OFFSET = Math.round(28 * scale);
  const lyricsFontSize = Math.round(12 * scale);
  const noteFontSize = Math.round(11 * scale);
  const labelFontSize = Math.round(13 * scale);

  const note = (measure: number, beat: number, string: number) => {
    const seed = (tabId * 31 + measure * 17 + beat * 7 + string * 13) % 100;
    if (seed < 45) return null;
    return (tabId * 7 + measure * 5 + beat * 3 + string * 11) % 13;
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl bg-stone-950 border border-stone-800/60 select-none cursor-grab active:cursor-grabbing"
      style={{ height: totalHeight + 'px' }}
      onMouseDown={(e) => onDragStart(e.clientX)}
      onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
    >
      {/* Scrollable inner */}
      <div
        className="absolute top-0 left-0"
        style={{ transform: `translateX(${-scrollX}px)`, width: totalWidth + 'px', height: '100%' }}
      >
        {/* ── Lyrics row ── */}
        {lyrics.map(({ beat, text }) => (
          <span
            key={beat}
            className="absolute text-stone-200 font-medium leading-none whitespace-nowrap"
            style={{
              fontSize: lyricsFontSize + 'px',
              left: LABEL_OFFSET + beat * NOTE_SPACING + 'px',
              top: PADDING_TOP + 6 + 'px',
            }}
          >
            {text}
          </span>
        ))}


        {/* ── String lines ── */}
        {Array.from({ length: STRING_COUNT }, (_, s) => (
          <div
            key={s}
            className="absolute left-0 right-0 h-px bg-stone-700/50"
            style={{ top: STRING_TOP + s * STRING_GAP + 'px' }}
          />
        ))}

        {/* ── Measures + notes ── */}
        {Array.from({ length: totalMeasures }, (_, m) => (
          <div key={m}>
            <div
              className="absolute top-0 bottom-0 w-px bg-stone-700/25"
              style={{ left: LABEL_OFFSET + m * MEASURE_WIDTH + 'px' }}
            />
            {Array.from({ length: MEASURE_BEATS }, (_, b) => {
              const x = LABEL_OFFSET + m * MEASURE_WIDTH + b * NOTE_SPACING;
              return Array.from({ length: STRING_COUNT }, (_, s) => {
                const n = note(m, b, s);
                if (n === null) return null;
                return (
                  <span
                    key={`${m}-${b}-${s}`}
                    className="absolute font-mono text-stone-400 leading-none -translate-x-1/2 -translate-y-1/2"
                    style={{ fontSize: noteFontSize + 'px', left: x + 'px', top: STRING_TOP + s * STRING_GAP + 'px' }}
                  >
                    {n}
                  </span>
                );
              });
            })}
          </div>
        ))}

        {/* ── String labels (sticky to visible left edge) ── */}
        {STRING_LABELS.map((label, s) => (
          <span
            key={label}
            className="absolute font-mono font-semibold text-stone-500 -translate-y-1/2"
            style={{ fontSize: labelFontSize + 'px', left: scrollX + 10 + 'px', top: STRING_TOP + s * STRING_GAP + 'px' }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* ── Playhead ── */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-amber-400/70 pointer-events-none transition-[left] duration-200"
        style={{ left: Math.max(0, playheadX - scrollX) + 'px' }}
      >
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-400 rounded-full" />
      </div>
    </div>
  );
}

// ─── Full tablature (all rows stacked) ─────────────────────────────────────────────
function FullTablatura({
  tabId,
  totalWidth,
  lyrics,
  scale,
}: {
  tabId: number;
  totalWidth: number;
  lyrics: { beat: number; text: string }[];
  scale: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    setContainerWidth(containerRef.current.offsetWidth);
    const obs = new ResizeObserver(([entry]) =>
      setContainerWidth(entry.contentRect.width)
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const STRING_COUNT = 6;
  const STRING_GAP = Math.round(20 * scale);
  const PADDING_TOP = Math.round(12 * scale);
  const PADDING_BOTTOM = Math.round(20 * scale);
  const LABEL_OFFSET = Math.round(28 * scale);
  const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];
  const LYRICS_H = lyrics.length > 0 ? Math.round(44 * scale) : 0;
  const STRING_TOP = LYRICS_H + PADDING_TOP;
  const rowHeight = STRING_TOP + STRING_GAP * (STRING_COUNT - 1) + PADDING_BOTTOM;
  const scaledNoteSpacing = Math.round(NOTE_SPACING * scale);
  const scaledMeasureWidth = scaledNoteSpacing * MEASURE_BEATS;
  const lyricsFontSize = Math.round(12 * scale);
  const noteFontSize = Math.round(11 * scale);
  const labelFontSize = Math.round(13 * scale);

  const totalMeasures = Math.ceil(totalWidth / MEASURE_WIDTH);
  const measuresPerRow = Math.max(1, Math.floor(containerWidth / scaledMeasureWidth));
  const totalRows = Math.ceil(totalMeasures / measuresPerRow);

  const note = (measure: number, beat: number, string: number) => {
    const seed = (tabId * 31 + measure * 17 + beat * 7 + string * 13) % 100;
    if (seed < 45) return null;
    return (tabId * 7 + measure * 5 + beat * 3 + string * 11) % 13;
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-3">
      {Array.from({ length: totalRows }, (_, row) => {
        const startMeasure = row * measuresPerRow;
        const endMeasure = Math.min(startMeasure + measuresPerRow, totalMeasures);
        const startBeat = startMeasure * MEASURE_BEATS;
        const endBeat = endMeasure * MEASURE_BEATS;
        const rowLyrics = lyrics
          .filter((l) => l.beat >= startBeat && l.beat < endBeat)
          .map((l) => ({ ...l, beat: l.beat - startBeat }));
        const rowMeasures = endMeasure - startMeasure;

        return (
          <div
            key={row}
            className="relative overflow-hidden rounded-xl bg-stone-950 border border-stone-800/60"
            style={{ height: rowHeight + 'px' }}
          >
            {/* String lines — span full container width */}
            {Array.from({ length: STRING_COUNT }, (_, s) => (
              <div
                key={s}
                className="absolute left-0 right-0 h-px bg-stone-700/50"
                style={{ top: STRING_TOP + s * STRING_GAP + 'px' }}
              />
            ))}

            {/* Row number */}
            <span className="absolute top-1.5 right-2 font-mono text-stone-700" style={{ fontSize: Math.round(9 * scale) + 'px' }}>
              {row + 1}/{totalRows}
            </span>

            {/* Content (notes, lyrics, labels, measure bars) */}
            <div
              className="absolute top-0 left-0"
              style={{ width: (rowMeasures * scaledMeasureWidth) + 'px', height: '100%' }}
            >
              {/* Lyrics */}
              {rowLyrics.map(({ beat, text }) => (
                <span
                  key={beat}
                  className="absolute text-stone-200 font-medium leading-none whitespace-nowrap"
                  style={{
                    fontSize: lyricsFontSize + 'px',
                    left: LABEL_OFFSET + beat * scaledNoteSpacing + 'px',
                    top: PADDING_TOP + 6 + 'px',
                  }}
                >
                  {text}
                </span>
              ))}

              {/* Measures + notes */}
              {Array.from({ length: rowMeasures }, (_, mi) => {
                const m = startMeasure + mi;
                const localX = LABEL_OFFSET + mi * scaledMeasureWidth;
                return (
                  <div key={m}>
                    <div
                      className="absolute top-0 bottom-0 w-px bg-stone-700/25"
                      style={{ left: localX + 'px' }}
                    />
                    {Array.from({ length: MEASURE_BEATS }, (_, b) => {
                      const x = localX + b * scaledNoteSpacing;
                      return Array.from({ length: STRING_COUNT }, (_, s) => {
                        const n = note(m, b, s);
                        if (n === null) return null;
                        return (
                          <span
                            key={`${m}-${b}-${s}`}
                            className="absolute font-mono text-stone-400 leading-none -translate-x-1/2 -translate-y-1/2"
                            style={{ fontSize: noteFontSize + 'px', left: x + 'px', top: STRING_TOP + s * STRING_GAP + 'px' }}
                          >
                            {n}
                          </span>
                        );
                      });
                    })}
                  </div>
                );
              })}

              {/* String labels */}
              {STRING_LABELS.map((label, s) => (
                <span
                  key={label}
                  className="absolute font-mono font-semibold text-stone-500 -translate-y-1/2"
                  style={{ fontSize: labelFontSize + 'px', left: '10px', top: STRING_TOP + s * STRING_GAP + 'px' }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const AprenderPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const tab = tablaturas.find((t) => t.id === Number(id));

  // ─── State ──────────────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [showSyncEditor, setShowSyncEditor] = useState(false);
  const [showFullTab, setShowFullTab] = useState(false);
  const [tabScale, setTabScale] = useState<1 | 1.3 | 1.6>(1);

  // Auto-scroll independent of video
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState<0.5 | 1 | 1.5 | 2>(1); // px/frame at 60fps
  const autoScrollRef = useRef<number | null>(null);

  // Duration timestamps stored per-tab (seconds). Loaded from localStorage or mock pageTimes.
  const [syncTimes, setSyncTimes] = useState<(number | null)[]>(() => {
    if (!tab) return [];
    try {
      const stored = localStorage.getItem(syncStorageKey(tab.id));
      if (stored) return JSON.parse(stored);
    } catch {}
    return Array.from({ length: tab.pages }, (_, i) => tab.pageTimes?.[i] ?? null);
  });

  useEffect(() => {
    if (!tab) return;
    localStorage.setItem(syncStorageKey(tab.id), JSON.stringify(syncTimes));
  }, [syncTimes, tab]);

  const hasSyncData = syncTimes.some((t) => t !== null);

  const markTime = useCallback((pageIndex: number) => {
    setSyncTimes((prev) => {
      const next = [...prev];
      next[pageIndex] = Math.floor(currentTime);
      return next;
    });
  }, [currentTime]);

  const clearTime = useCallback((pageIndex: number) => {
    setSyncTimes((prev) => {
      const next = [...prev];
      next[pageIndex] = null;
      return next;
    });
  }, []);

  // ─── Horizontal tablature scroll state ──────────────────────────────────────
  const stripWidth = tab ? pxForTab(tab.pages, videoDuration) : 600;
  const [scrollX, setScrollX] = useState(0);
  const dragRef = useRef<{ startClientX: number; startScrollX: number } | null>(null);

  // Playhead x = time proportion of strip width
  const playheadX = videoDuration
    ? Math.round((currentTime / videoDuration) * stripWidth)
    : 0;

  // Auto-scroll to keep playhead visible (centering it)
  const stripContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!syncEnabled || !isPlaying) return;
    const containerWidth = stripContainerRef.current?.offsetWidth ?? 600;
    const target = playheadX - containerWidth / 2;
    setScrollX(Math.max(0, Math.min(target, stripWidth - containerWidth)));
  }, [playheadX, syncEnabled, isPlaying, stripWidth]);

  // ─── Auto-scroll loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
    if (!autoScroll) return;

    const step = () => {
      const containerWidth = stripContainerRef.current?.offsetWidth ?? 600;
      setScrollX((x) => {
        const next = x + scrollSpeed;
        if (next >= stripWidth - containerWidth) {
          setAutoScroll(false);
          return stripWidth - containerWidth;
        }
        return next;
      });
      autoScrollRef.current = requestAnimationFrame(step);
    };
    autoScrollRef.current = requestAnimationFrame(step);

    return () => { if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current); };
  }, [autoScroll, scrollSpeed, stripWidth]);


  const handleDragStart = useCallback((clientX: number) => {
    setSyncEnabled(false);
    setAutoScroll(false);
    dragRef.current = { startClientX: clientX, startScrollX: scrollX };

    const onMove = (e: MouseEvent | TouchEvent) => {
      const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const delta = dragRef.current!.startClientX - x;
      const containerWidth = stripContainerRef.current?.offsetWidth ?? 600;
      setScrollX(Math.max(0, Math.min(dragRef.current!.startScrollX + delta, stripWidth - containerWidth)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  }, [scrollX, stripWidth]);

  // ─── YouTube IFrame API ─────────────────────────────────────────────────────
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!tab?.videoId) return;

    const initPlayer = () => {
      if (!iframeRef.current) return;
      playerRef.current = new (window as any).YT.Player(iframeRef.current, {
        events: {
          onStateChange: (e: any) => setIsPlaying(e.data === 1),
          onReady: (e: any) => {
            const dur = e.target.getDuration?.();
            if (dur) setVideoDuration(dur);
          },
        },
      });
    };

    if ((window as any).YT?.Player) {
      initPlayer();
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [tab?.videoId]);

  // Poll & advance page
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    if (isPlaying) {
      pollRef.current = setInterval(() => {
        const time: number = playerRef.current?.getCurrentTime?.() ?? 0;
        const dur: number = playerRef.current?.getDuration?.() ?? 0;
        setCurrentTime(time);
        if (dur > 0) setVideoDuration(dur);
      }, 250);
    }

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isPlaying, syncEnabled, hasSyncData, syncTimes]);

  if (!tab) {
    return (
      <div className="min-h-screen bg-[#060607] flex flex-col items-center justify-center gap-4">
        <p className="text-stone-400">Tablatura não encontrada.</p>
        <button onClick={() => navigate('/tablaturas')} className="text-white underline text-sm">
          Voltar à biblioteca
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060607]">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-stone-500 hover:text-white text-sm transition-colors duration-200 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {/* Title */}
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-1">
            {tab.title}
          </h1>
          <p className="text-stone-400 text-sm">{tab.composer}</p>
        </div>

        {/* ── Video ──────────────────────────────────────────────────────────── */}
        <div className="relative w-full aspect-video bg-stone-950 rounded-2xl overflow-hidden border border-stone-800/60 shadow-2xl shadow-black/60 mb-2">
          {tab.videoId ? (
            <iframe
              ref={iframeRef}
              id={`yt-${tab.id}`}
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${tab.videoId}?rel=0&modestbranding=1&enablejsapi=1`}
              title={tab.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-950">
              <img
                src={tab.image}
                alt={tab.title}
                className="absolute inset-0 w-full h-full object-cover opacity-20"
              />
              <div className="relative z-10 flex flex-col items-center gap-3 text-center px-8">
                <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                  <Music className="w-7 h-7 text-stone-300" />
                </div>
                <p className="text-stone-300 font-semibold text-sm">Vídeo aula em breve</p>
                <p className="text-stone-500 text-xs max-w-xs">
                  A gravação desta aula está sendo finalizada e estará disponível em breve.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Tablature strip ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Row 1: label + back-to-start + sync + auto-scroll + size + timer */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 border border-stone-700 text-stone-400 text-xs font-medium tracking-widest uppercase px-3 py-1.5 rounded-full">
                Tablatura
              </div>
              {/* Back to start */}
              <button
                onClick={() => { setSyncEnabled(false); setAutoScroll(false); setScrollX(0); }}
                title="Voltar ao início"
                className="p-1.5 rounded-full border border-stone-800 text-stone-500 hover:border-stone-600 hover:text-white transition-all duration-200"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              {/* Sync with video */}
              <button
                onClick={() => setSyncEnabled((v) => !v)}
                title="Sincronizar com o vídeo"
                className={`p-1.5 rounded-full border transition-all duration-200 ${
                  syncEnabled
                    ? 'border-amber-500/60 text-amber-400'
                    : 'border-stone-800 text-stone-500 hover:border-amber-500/60 hover:text-amber-400'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
              </button>

              {/* Auto-scroll controls */}
              <div className="flex items-center gap-1 border border-stone-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => {
                    setSyncEnabled(false);
                    setAutoScroll((v) => !v);
                  }}
                  title={autoScroll ? 'Pausar rolagem' : 'Rolar automaticamente'}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                    autoScroll
                      ? 'bg-stone-700 text-white'
                      : 'text-stone-500 hover:text-white hover:bg-stone-800'
                  }`}
                >
                  {autoScroll
                    ? <Pause className="w-3 h-3" />
                    : <Play className="w-3 h-3" />}
                  <span>Rolar</span>
                </button>
                <div className="w-px h-4 bg-stone-800" />
                {([0.5, 1, 1.5, 2] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setScrollSpeed(v)}
                    title={`Velocidade ${v}x`}
                    className={`px-2 py-1 text-[10px] font-mono transition-all duration-150 ${
                      scrollSpeed === v
                        ? 'bg-stone-700 text-white'
                        : 'text-stone-600 hover:text-stone-400'
                    }`}
                  >
                    {v}x
                  </button>
                ))}
              </div>

              {/* Tab zoom */}
              <div className="flex items-center gap-1 border border-stone-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setTabScale(tabScale === 1.6 ? 1.3 : 1)}
                  disabled={tabScale === 1}
                  title="Diminuir tablatura"
                  className="px-2 py-1 text-stone-500 hover:text-white hover:bg-stone-800 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed text-base leading-none select-none"
                >
                  −
                </button>
                <span className="text-[10px] font-mono text-stone-500 tabular-nums w-7 text-center select-none">
                  {tabScale === 1 ? '1×' : tabScale === 1.3 ? '1.3×' : '1.6×'}
                </span>
                <button
                  onClick={() => setTabScale(tabScale === 1 ? 1.3 : 1.6)}
                  disabled={tabScale === 1.6}
                  title="Aumentar tablatura"
                  className="px-2 py-1 text-stone-500 hover:text-white hover:bg-stone-800 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed text-base leading-none select-none"
                >
                  +
                </button>
              </div>
            </div>
            <span className="font-mono text-xs text-stone-500 tabular-nums">
              {formatTime(currentTime)}
            </span>
          </div>

          {/* Row 2: left arrow + full-width strip + right arrow (desktop) / full-width strip (mobile) */}
          <div className="flex items-center gap-2">
            {/* Left arrow — desktop only */}
            <button
              onClick={() => { setSyncEnabled(false); setScrollX((x) => Math.max(0, x - FRAME_STEP)); }}
              title="Compasso anterior"
              className="hidden sm:flex p-2 rounded-full border border-stone-800 text-stone-500 hover:border-stone-600 hover:text-white transition-all duration-200 shrink-0 items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div ref={stripContainerRef} className="flex-1 min-w-0">
              <HorizontalTablatura
                tabId={tab.id}
                totalWidth={stripWidth}
                scrollX={scrollX}
                playheadX={playheadX}
                lyrics={tab.lyrics}
                scale={tabScale}
                onDragStart={handleDragStart}
              />
            </div>

            {/* Right arrow — desktop only */}
            <button
              onClick={() => {
                setSyncEnabled(false);
                const containerWidth = stripContainerRef.current?.offsetWidth ?? 600;
                setScrollX((x) => Math.min(x + FRAME_STEP, stripWidth - containerWidth));
              }}
              title="Próximo compasso"
              className="hidden sm:flex p-2 rounded-full border border-stone-800 text-stone-500 hover:border-stone-600 hover:text-white transition-all duration-200 shrink-0 items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile nav row — below strip, only on small screens */}
          <div className="flex sm:hidden items-center justify-center gap-6">
            <button
              onClick={() => { setSyncEnabled(false); setScrollX((x) => Math.max(0, x - FRAME_STEP)); }}
              title="Compasso anterior"
              className="p-3 rounded-full border border-stone-800 text-stone-400 hover:border-stone-600 hover:text-white transition-all duration-200"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setSyncEnabled(false);
                const containerWidth = stripContainerRef.current?.offsetWidth ?? 600;
                setScrollX((x) => Math.min(x + FRAME_STEP, stripWidth - containerWidth));
              }}
              title="Próximo compasso"
              className="p-3 rounded-full border border-stone-800 text-stone-400 hover:border-stone-600 hover:text-white transition-all duration-200"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Scrubber / progress bar */}
          <div
            className="relative h-1 bg-stone-800 rounded-full cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              const containerWidth = stripContainerRef.current?.offsetWidth ?? 600;
              setSyncEnabled(false);
              setScrollX(Math.max(0, Math.min(ratio * stripWidth - containerWidth / 2, stripWidth - containerWidth)));
            }}
          >
            <div
              className="absolute left-0 top-0 h-full bg-amber-500/40 rounded-full transition-all duration-200"
              style={{
                width: stripWidth > 0
                  ? `${Math.min(100, ((scrollX + (stripContainerRef.current?.offsetWidth ?? 0) / 2) / stripWidth) * 100)}%`
                  : '0%',
              }}
            />
          </div>

          {/* Re-enable sync hint — shown below only when sync is off */}
          {!syncEnabled && tab.videoId && (
            <p className="text-center text-xs text-stone-600">
              Rolagem pausada — clique em{' '}
              <button
                onClick={() => setSyncEnabled(true)}
                className="text-amber-500/80 hover:text-amber-400 transition-colors duration-200 inline-flex items-center gap-1"
              >
                <Clock className="w-3 h-3" /> sincronizar
              </button>{' '}
              para retomar
            </p>
          )}
        </div>

        {/* Video meta + sync controls */}
        <div className="flex items-center justify-between text-xs text-stone-500 mt-8">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            {tab.pages} páginas · {videoDuration ? formatTime(videoDuration) : '--:--'}
          </span>

          {tab.videoId && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSyncEnabled((v) => !v)}
                className={`flex items-center gap-1.5 transition-colors duration-200 ${
                  syncEnabled && hasSyncData
                    ? 'text-amber-500/90 hover:text-amber-400'
                    : 'text-stone-600 hover:text-stone-400'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {syncEnabled ? 'Sync ativo' : 'Sync pausado'}
              </button>
              <button
                onClick={() => setShowSyncEditor((v) => !v)}
                className={`flex items-center gap-1.5 transition-colors duration-200 ${
                  showSyncEditor ? 'text-white' : 'text-stone-600 hover:text-stone-400'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                Configurar sync
              </button>
            </div>
          )}
        </div>

        {/* ── Sync editor panel ────────────────────────────────────────────── */}
        {showSyncEditor && tab.videoId && (
          <div className="mt-6 bg-stone-900/60 border border-stone-800/80 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800/60">
              <div>
                <p className="text-white text-sm font-semibold">Configurar sincronização</p>
                <p className="text-stone-500 text-xs mt-0.5">
                  Reproduza o vídeo e clique em{' '}
                  <span className="text-stone-300">Marcar</span> no instante em que cada página começa.
                </p>
              </div>
              <span className="font-mono text-sm text-amber-400/90 bg-stone-800/60 px-3 py-1 rounded-full tabular-nums">
                {formatTime(currentTime)}
              </span>
            </div>

            <div className="divide-y divide-stone-800/40">
              {Array.from({ length: tab.pages }, (_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <span className="text-stone-300 text-sm">Página {i + 1}</span>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-xs tabular-nums ${syncTimes[i] !== null ? 'text-amber-500/80' : 'text-stone-600'}`}>
                      {syncTimes[i] !== null ? formatTime(syncTimes[i]!) : '--:--'}
                    </span>
                    <button
                      onClick={() => markTime(i)}
                      className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full transition-all duration-200"
                    >
                      <Check className="w-3 h-3" />
                      Marcar
                    </button>
                    {syncTimes[i] !== null && (
                      <button
                        onClick={() => clearTime(i)}
                        className="text-stone-600 hover:text-stone-400 transition-colors duration-200"
                        aria-label="Limpar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-stone-800/60">
              <p className="text-stone-600 text-xs">
                Os tempos ficam salvos neste navegador. Para usar em outro dispositivo, copie os
                valores para o campo <code className="text-stone-500">pageTimes</code> no mock de dados.
              </p>
            </div>
          </div>
        )}

        {/* ── Tablatura Completa ── */}
        <div className="rounded-xl border border-stone-800 overflow-hidden mt-2">
          <button
            onClick={() => setShowFullTab((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-900/40 transition-colors duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-stone-900 border border-stone-800 flex items-center justify-center shrink-0">
                <Music className="w-4 h-4 text-stone-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-300">Tablatura Completa</p>
                <p className="text-xs text-stone-600">Ver todas as linhas</p>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-stone-500 transition-transform duration-300 ${
                showFullTab ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showFullTab && (
            <div className="border-t border-stone-800 p-4">
              <FullTablatura
                tabId={tab.id}
                totalWidth={stripWidth}
                lyrics={tab.lyrics}
                scale={tabScale}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AprenderPage;
