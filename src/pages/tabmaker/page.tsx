import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { Play, Pause, Trash2, ArrowLeft, Loader2, Timer, SkipBack, SkipForward, ChevronLeft, ChevronRight, Download, Upload, Save, Plus, Minus, Undo2, Redo2, Columns2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

// Standard guitar tuning — open string MIDI (string 0 = high e)
const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];
const OPEN_MIDI = [64, 59, 55, 50, 45, 40];
const STRING_COUNT = 6;
const DEFAULT_BEATS = 16;
const STORAGE_KEY = 'tabmaker-autosave-v1';

// ── BPM estimation: onset-strength autocorrelation ──────────────────────────
function estimateBPM(pcm: Float32Array, sampleRate: number): number {
  // 10ms hops for better temporal resolution
  const hop = Math.round(sampleRate * 0.01);
  const fps = sampleRate / hop;

  // Step 1: RMS energy per frame
  const energy: number[] = [];
  for (let i = 0; i + hop < pcm.length; i += hop) {
    let s = 0;
    for (let j = i; j < i + hop; j++) s += pcm[j] * pcm[j];
    energy.push(Math.sqrt(s / hop));
  }

  // Step 2: Onset strength = half-wave rectified 1st derivative of energy
  const onset: number[] = new Array(energy.length).fill(0);
  for (let i = 1; i < energy.length; i++)
    onset[i] = Math.max(0, energy[i] - energy[i - 1]);

  // Step 3: Normalized autocorrelation on onset (up to 30s of signal)
  const nFrames = Math.min(onset.length, Math.round(fps * 30));
  const minLag = Math.round(fps * 60 / 210); // 210 BPM max
  const maxLag = Math.round(fps * 60 / 50);  // 50  BPM min

  let bestLag = minLag, bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0, count = 0;
    for (let i = 0; i < nFrames && i + lag < onset.length; i++) {
      sum += onset[i] * onset[i + lag];
      count++;
    }
    const score = count > 0 ? sum / count : 0;
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }

  let bpm = fps * 60 / bestLag;

  // Fold into 60-180 range sensibly — prefer doubling over halving
  // (guitars tend to play at quarter-note pulse, not half)
  while (bpm < 60)  bpm *= 2;
  while (bpm > 180) bpm /= 2;

  // Check if double is still reasonable (handles the 66→132 ambiguity)
  if (bpm < 90 && bpm * 2 <= 180) bpm *= 2;

  return Math.round(bpm);
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}
// Fret numbers are ABSOLUTE from the nut — capo is visual only
function noteAtFret(stringIdx: number, fret: number): string {
  return midiToNoteName(OPEN_MIDI[stringIdx] + fret);
}

type Technique = 'slide-up' | 'slide-down' | 'hammer' | 'pull' | 'arpeggio' | 'mute';
type CellData = { fret: number; tech?: Technique; slideTo?: number; muteAfter?: number } | null;
type Grid = CellData[][];
type ChordLabel = { name: string; shape?: string };
function emptyGrid(beats = DEFAULT_BEATS): Grid {
  return Array.from({ length: beats }, () => Array(STRING_COUNT).fill(null));
}

// ── Guitar neck visual ──────────────────────────────────────────────────────
const OPEN_W  = 38;   // width of open string (fret 0) section
const NUT_W   = 9;    // nut bar width
const SECT_W  = 46;   // width of each fret section 1-12
const NECK_H  = 86;
const STR_TOP = 16;   // y of string e
const STR_GAP = 10;   // gap between strings
const STR_THICK = [0.7, 0.9, 1.15, 1.5, 1.9, 2.5];
const DOT_FRETS  = [5, 7, 9, 15, 17];
const NECK_FRETS = 19;
const MAX_FRET   = 19;

const sectionLeft = (f: number) =>
  f === 0 ? 0 : OPEN_W + NUT_W + (f - 1) * SECT_W;
const sectionWidth = (f: number) =>
  f === 0 ? OPEN_W + NUT_W : SECT_W;
const sectionCenterX = (f: number) =>
  f === 0 ? OPEN_W / 2 : OPEN_W + NUT_W + (f - 0.5) * SECT_W;

function GuitarNeck({
  selectedFret,
  capo,
  onFretClick,
}: {
  selectedFret: number;
  capo: number;
  onFretClick: (f: number) => void;
}) {
  const totalW = OPEN_W + NUT_W + NECK_FRETS * SECT_W;
  const dotY   = STR_TOP + STR_GAP * 2.5;
  const strBottom = STR_TOP + STR_GAP * 5;

  return (
    <div className="overflow-x-auto pb-1">
      <div style={{ minWidth: totalW + 'px' }}>
        <svg width={totalW} height={NECK_H} className="block" style={{ borderRadius: 8 }}>
          {/* Neck wood background */}
          <rect x={0} y={0} width={totalW} height={NECK_H} fill="#1c1917" rx={8} />
          <rect x={OPEN_W + NUT_W} y={0} width={totalW - OPEN_W - NUT_W} height={NECK_H} fill="#1a1714" />

          {/* Fret section highlight (selected) */}
          <rect
            x={sectionLeft(selectedFret)}
            y={0}
            width={sectionWidth(selectedFret)}
            height={NECK_H}
            fill="#78716c"
            opacity={0.22}
            rx={selectedFret === 0 ? 6 : 0}
          />

          {/* Nut */}
          <rect
            x={OPEN_W}
            y={STR_TOP - 7}
            width={NUT_W}
            height={strBottom - STR_TOP + 14}
            fill="#e7e5e4"
            rx={3}
          />

          {/* Fret wires 1-12 */}
          {Array.from({ length: NECK_FRETS }, (_, i) => {
            const x = OPEN_W + NUT_W + (i + 1) * SECT_W;
            return (
              <rect
                key={i}
                x={x - 2}
                y={STR_TOP - 4}
                width={4}
                height={strBottom - STR_TOP + 8}
                fill="#78716c"
                rx={2}
              />
            );
          })}

          {/* Strings e→E (thin→thick) */}
          {Array.from({ length: 6 }, (_, s) => (
            <line
              key={s}
              x1={0} y1={STR_TOP + s * STR_GAP}
              x2={totalW} y2={STR_TOP + s * STR_GAP}
              stroke="#a8a29e"
              strokeWidth={STR_THICK[s]}
              strokeOpacity={0.65}
            />
          ))}

          {/* Open string label */}
          <text
            x={OPEN_W / 2}
            y={NECK_H - 6}
            textAnchor="middle"
            fontSize={9}
            fill="#57534e"
            fontFamily="monospace"
          >
            solta
          </text>

          {/* Position dots — 5, 7, 9 */}
          {DOT_FRETS.map((f) => (
            <circle key={f} cx={sectionCenterX(f)} cy={dotY} r={4} fill="#44403c" />
          ))}

          {/* Double dot — 12 */}
          <circle cx={sectionCenterX(12)} cy={dotY - STR_GAP * 1.2} r={4} fill="#44403c" />
          <circle cx={sectionCenterX(12)} cy={dotY + STR_GAP * 1.2} r={4} fill="#44403c" />
          {/* Double dot — 19 */}
          <circle cx={sectionCenterX(19)} cy={dotY - STR_GAP * 1.2} r={4} fill="#44403c" />
          <circle cx={sectionCenterX(19)} cy={dotY + STR_GAP * 1.2} r={4} fill="#44403c" />

          {/* Capo bar */}
          {capo > 0 && (
            <>
              <rect
                x={OPEN_W + NUT_W + (capo - 1) * SECT_W - 5}
                y={STR_TOP - 10}
                width={12}
                height={strBottom - STR_TOP + 20}
                fill="#f59e0b"
                rx={5}
                opacity={0.92}
              />
              {/* Capo label */}
              <text
                x={OPEN_W + NUT_W + (capo - 0.5) * SECT_W}
                y={NECK_H - 5}
                textAnchor="middle"
                fontSize={8}
                fill="#f59e0b"
                fontFamily="monospace"
                fontWeight="bold"
              >
                capo
              </text>
            </>
          )}

          {/* Selected fret indicator strip at bottom */}
          <rect
            x={sectionLeft(selectedFret) + 2}
            y={NECK_H - 4}
            width={sectionWidth(selectedFret) - 4}
            height={3}
            fill="#d6d3d1"
            opacity={0.7}
            rx={1.5}
          />

          {/* Invisible clickable areas per fret */}
          {Array.from({ length: NECK_FRETS + 1 }, (_, f) => (
            <rect
              key={f}
              x={sectionLeft(f)}
              y={0}
              width={sectionWidth(f)}
              height={NECK_H}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onFretClick(f)}
            />
          ))}
        </svg>

        {/* Fret number labels below neck */}
        <div className="flex mt-1" style={{ paddingLeft: OPEN_W + NUT_W + 'px' }}>
          {Array.from({ length: NECK_FRETS }, (_, i) => {
            const f = i + 1;
            return (
              <div
                key={f}
                style={{ width: SECT_W + 'px' }}
                className={`text-center text-xs font-mono select-none ${
                  selectedFret === f ? 'text-stone-300 font-bold' : 'text-stone-700'
                }`}
              >
                {f}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
// ── Music theory helpers ────────────────────────────────────────────────────
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];
const KEY_ROOTS: Record<string, number> = {
  C:0, 'C#':1, D:2, 'D#':3, E:4, F:5, 'F#':6, G:7, 'G#':8, A:9, 'A#':10, B:11,
};
function scaleNotes(root: string, mode: 'major' | 'minor'): Set<number> {
  const r = KEY_ROOTS[root] ?? 0;
  const intervals = mode === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS;
  return new Set(intervals.map((i) => (r + i) % 12));
}

// ── Best string/fret for a MIDI note ────────────────────────────────────────
function bestStringFret(
  midi: number,
  capo: number,
  keyNotes: Set<number>,
): { string: number; fret: number } | null {
  const candidates: { string: number; fret: number; score: number }[] = [];
  for (let s = 0; s < STRING_COUNT; s++) {
    const fret = midi - OPEN_MIDI[s];
    // fret must be reachable and at or above capo (below capo is physically blocked)
    if (fret < capo || fret > MAX_FRET) continue;
    let score = fret - capo; // prefer frets close to capo (natural hand position)
    // Prefer notes in the key scale
    if (keyNotes.size > 0 && !keyNotes.has(midi % 12)) score += 4;
    // Zone preference: bass notes on low strings, treble on high strings
    if (midi <= 52)      score += (5 - s) * 3;
    else if (midi <= 59) score += Math.abs(s - 3.5) * 2;
    else                 score += s * 2;
    candidates.push({ string: s, fret, score });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0];
}
// ────────────────────────────────────────────────────────────────────────────

const TabmakerPage = () => {
  // ── Undo / Redo history ──────────────────────────────────────────────────
  type Snapshot = { grid: Grid; beats: number; lyrics: Record<number, string>; chords: Record<number, ChordLabel> };
  const historyRef  = useRef<Snapshot[]>([]);
  const futureRef   = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [beats, setBeats] = useState(DEFAULT_BEATS);
  const [startBeat, setStartBeat] = useState(0);
  const startBeatRef = useRef(0);
  startBeatRef.current = startBeat;
  const [subdivMode, setSubdivMode] = useState(false);
  const subdivModeRef = useRef(false);
  subdivModeRef.current = subdivMode;
  const [lyrics, setLyrics] = useState<Record<number, string>>({});
  const [chords, setChords] = useState<Record<number, ChordLabel>>({});
  const [selectedBeat, setSelectedBeat] = useState<number | null>(null); // keyboard nav cursor
  const [selectedString, setSelectedString] = useState<number>(0); // 0=e, 5=E (keyboard nav)
  const [selAnchor, setSelAnchor] = useState<number | null>(null); // shift-select anchor beat
  const clipboardRef = useRef<{ cells: CellData[][]; lyrics: Record<number, string>; chords: Record<number, ChordLabel> } | null>(null);
  const [, setFretInputBuffer] = useState<string>('');
  const fretInputTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideInputRef = useRef<{ from: number; tech: 'slide-up' | 'slide-down' } | null>(null);
  const [slideEditValue, setSlideEditValue] = useState<string>('');
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
  const [cifraText, setCifraText] = useState<string>('');
  const [cifraEdited, setCifraEdited] = useState(false);
  const [tabPreviewOpen, setTabPreviewOpen] = useState(false);
  const [cifraOpen, setCifraOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const [bpm, setBpm] = useState(80);
  const [bpmInput, setBpmInput] = useState('80');
  const [selectedFret, setSelectedFret] = useState(0);
  const [selectedTech, setSelectedTech] = useState<Technique | null>(null);
  const [slideToValue, setSlideToValue] = useState<number>(0); // target fret for slides
  const [muteAfterValue, setMuteAfterValue] = useState<number>(2); // beats until mute
  const [capo, setCapo] = useState(0);
  const [hoveredCell, setHoveredCell] = useState<{ b: number; s: number } | null>(null);
  const [keyRoot, setKeyRoot] = useState<string>('E');
  const [keyMode, setKeyMode] = useState<'major' | 'minor'>('minor');
  const keyRootRef = useRef(keyRoot);
  keyRootRef.current = keyRoot;
  const keyModeRef = useRef(keyMode);
  keyModeRef.current = keyMode;

  // Continuous drag-to-scroll — only activate if mouse moved > 4px
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const scrollbarRef = useRef<HTMLInputElement>(null);

  const onDragStart = useCallback((clientX: number) => {
    dragRef.current = { startX: clientX, startScrollLeft: scrollRef.current?.scrollLeft ?? 0, moved: false };
  }, []);

  const onDragMove = useCallback((clientX: number) => {
    if (!dragRef.current || !scrollRef.current) return;
    const dx = dragRef.current.startX - clientX;
    if (!dragRef.current.moved && Math.abs(dx) < 5) return;
    dragRef.current.moved = true;
    scrollRef.current.scrollLeft = dragRef.current.startScrollLeft + dx;
  }, []);

  const onDragEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ── Undo / Redo ────────────────────────────────────────────────
  // Call commit() BEFORE applying a mutation to save the current state
  const commit = useCallback(() => {
    historyRef.current = [
      ...historyRef.current.slice(-49),
      { grid: gridRef.current.map(c => [...c]), beats: beatsRef.current, lyrics: { ...lyricsRef.current }, chords: { ...chordsRef.current } },
    ];
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    const past = historyRef.current;
    if (!past.length) return;
    const prev = past[past.length - 1];
    futureRef.current = [
      { grid: gridRef.current.map(c => [...c]), beats: beatsRef.current, lyrics: { ...lyricsRef.current }, chords: { ...chordsRef.current } },
      ...futureRef.current.slice(0, 49),
    ];
    historyRef.current = past.slice(0, -1);
    setGrid(prev.grid);
    setBeats(prev.beats);
    setLyrics(prev.lyrics);
    setChords(prev.chords ?? {});
    setCanUndo(past.length > 1);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (!future.length) return;
    const next = future[0];
    historyRef.current = [
      ...historyRef.current.slice(-49),
      { grid: gridRef.current.map(c => [...c]), beats: beatsRef.current, lyrics: { ...lyricsRef.current }, chords: { ...chordsRef.current } },
    ];
    futureRef.current = future.slice(1);
    setGrid(next.grid);
    setBeats(next.beats);
    setLyrics(next.lyrics);
    setChords(next.chords ?? {});
    setCanUndo(true);
    setCanRedo(future.length > 1);
  }, []);

  // Toggle 16th-note subdivision
  const toggleSubdiv = useCallback(() => {
    setSubdivMode((prev) => {
      if (!prev) {
        // Enable: expand grid — each existing column → 2 columns (original at even index)
        setBeats((b) => b * 2);
        setGrid((g) => {
          const doubled: Grid = Array.from({ length: g.length * 2 }, () =>
            Array(STRING_COUNT).fill(null)
          );
          g.forEach((col, i) => { doubled[i * 2] = [...col]; });
          return doubled;
        });
        // Expand lyrics: remap beat b → b*2
        setLyrics((prev) => {
          const next: Record<number, string> = {};
          Object.entries(prev).forEach(([k, v]) => { if (v) next[Number(k) * 2] = v; });
          return next;
        });
      } else {
        // Disable: collapse grid — keep only even-indexed columns
        setBeats((b) => Math.max(DEFAULT_BEATS, Math.round(b / 2)));
        setGrid((g) => g.filter((_, i) => i % 2 === 0).map((col) => [...col]));
        // Collapse lyrics: remap beat b → b/2 (even beats stay, odd beats drop)
        setLyrics((prev) => {
          const next: Record<number, string> = {};
          Object.entries(prev).forEach(([k, v]) => {
            const beat = Number(k);
            if (beat % 2 === 0 && v) next[beat / 2] = v;
          });
          return next;
        });
      }
      return !prev;
    });
  }, []);

  // Audio transcription
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeStatus, setTranscribeStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  const handleTranscribe = async () => {
    if (!audioFile) return;
    setTranscribing(true);
    setTranscribeProgress(0);
    setTranscribeStatus('Decodificando áudio…');
    try {
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioCtx = new AudioContext({ sampleRate: 22050 });
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      // Detect BPM from audio before closing context
      let monoForBpm: Float32Array;
      if (audioBuffer.numberOfChannels >= 2) {
        const c0 = audioBuffer.getChannelData(0);
        const c1 = audioBuffer.getChannelData(1);
        monoForBpm = new Float32Array(c0.length);
        for (let i = 0; i < c0.length; i++) monoForBpm[i] = (c0[i] + c1[i]) / 2;
      } else {
        monoForBpm = audioBuffer.getChannelData(0);
      }
      const foundBpm = estimateBPM(monoForBpm, 22050);
      audioCtx.close();

      // Mixdown to mono Float32Array at 22050 Hz
      let pcm: Float32Array;
      if (audioBuffer.numberOfChannels >= 2) {
        const ch0 = audioBuffer.getChannelData(0);
        const ch1 = audioBuffer.getChannelData(1);
        pcm = new Float32Array(ch0.length);
        for (let i = 0; i < ch0.length; i++) pcm[i] = (ch0[i] + ch1[i]) / 2;
      } else {
        pcm = audioBuffer.getChannelData(0);
      }

      setTranscribeStatus('Carregando modelo de IA (pode demorar na 1ª vez)…');
      // Dynamic import keeps TF.js out of initial bundle
      const bp = await import('@spotify/basic-pitch');
      // Model served from /public/basic-pitch-model — no external fetch needed
      const model = new bp.BasicPitch('/basic-pitch-model/model.json');

      const frames: number[][] = [];
      const onsets: number[][] = [];
      const contours: number[][] = [];

      setTranscribeStatus('Analisando pitches com IA…');
      await model.evaluateModel(
        pcm,
        (f: number[][], o: number[][], c: number[][]) => {
          frames.push(...f);
          onsets.push(...o);
          contours.push(...c);
        },
        (progress: number) => setTranscribeProgress(Math.round(progress * 100))
      );

      setTranscribeStatus('Mapeando notas para o braço…');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawNotes = bp.outputToNotesPoly(frames, onsets, 0.5, 0.3, 5, true, null, null);
      const noteEvents: { startTimeSeconds: number; pitchMidi: number }[] =
        bp.noteFramesToTime(bp.addPitchBendsToNoteEvents(contours, rawNotes));

      const secPerEighth = (60 / bpmRef.current) / 2;
      // Compute how many beats the detected notes span
      const maxSec = Math.max(...noteEvents.map((n) => (n as any).startTimeSeconds ?? 0));
      const neededBeats = Math.max(DEFAULT_BEATS, Math.ceil(maxSec / secPerEighth) + 4);
      // Round up to nearest multiple of 4 (full bars)
      const totalBeats = Math.ceil(neededBeats / 4) * 4;
      const newGrid = emptyGrid(totalBeats);
      const currentCapo = capoRef.current;
      const keyNotes = scaleNotes(keyRootRef.current, keyModeRef.current);

      for (const note of noteEvents) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const startSec: number = (note as any).startTimeSeconds ?? (note as any)[0] ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pitchMidi: number = (note as any).pitchMidi ?? (note as any)[2] ?? 0;
        const col = Math.round(startSec / secPerEighth);
        if (col < 0 || col >= totalBeats) continue;
        const placement = bestStringFret(Math.round(pitchMidi), currentCapo, keyNotes);
        if (!placement) continue;
        const { string, fret } = placement;
        if (newGrid[col][string] === null) newGrid[col][string] = { fret };
      }

      stop();
      setBeats(totalBeats);
      if (scrollRef.current) scrollRef.current.scrollLeft = 0;
      setBpm(foundBpm);
      setDetectedBpm(foundBpm);
      setGrid(newGrid);
      setTranscribeStatus(`✓ ${noteEvents.length} notas · ${totalBeats} batidas · BPM detectado: ${foundBpm}`);
    } catch (err) {
      console.error('BasicPitch error:', err);
      setTranscribeStatus('⚠ Erro: ' + (err instanceof Error ? err.message : 'falha na transcrição'));
    } finally {
      setTranscribing(false);
    }
  };

  // ── Auto-save to localStorage ──────────────────────────────────────────────
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [structureMode, setStructureMode] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);

  // Load on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.beats)   setBeats(s.beats);
      if (s.bpm)     setBpm(s.bpm);
      if (s.capo !== undefined) setCapo(s.capo);
      if (s.keyRoot) setKeyRoot(s.keyRoot);
      if (s.keyMode) setKeyMode(s.keyMode);
      if (s.subdivMode !== undefined) setSubdivMode(s.subdivMode);
      if (s.lyrics)  setLyrics(s.lyrics);
      if (s.chords)  setChords(s.chords);
      if (s.grid)    setGrid(s.grid);
      if (s.detectedBpm !== undefined) setDetectedBpm(s.detectedBpm);
      if (s.cifraText) { setCifraText(s.cifraText); setCifraEdited(true); }
      setLastSaved(new Date(s.savedAt));
    } catch { /* ignore corrupted data */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save whenever content changes (debounced 600ms)
  useEffect(() => {
    const tid = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          grid, beats, bpm, capo, keyRoot, keyMode, subdivMode, lyrics, chords,
          detectedBpm, ...(cifraEdited ? { cifraText } : {}), savedAt: new Date().toISOString(),
        }));
        setLastSaved(new Date());
      } catch { /* storage full — ignore */ }
    }, 600);
    return () => clearTimeout(tid);
  }, [grid, beats, bpm, capo, keyRoot, keyMode, subdivMode, lyrics, chords, detectedBpm, cifraText, cifraEdited]);

  const exportTab = () => {
    const data = { grid, beats, bpm, capo, keyRoot, keyMode, subdivMode, lyrics, chords, detectedBpm, ...(cifraEdited ? { cifraText } : {}) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tablatura-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTab = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const s = JSON.parse(e.target?.result as string);
        stop();
        if (s.beats)   setBeats(s.beats);
        if (s.bpm)     setBpm(s.bpm);
        if (s.capo !== undefined) setCapo(s.capo);
        if (s.keyRoot) setKeyRoot(s.keyRoot);
        if (s.keyMode) setKeyMode(s.keyMode);
        if (s.subdivMode !== undefined) setSubdivMode(s.subdivMode);
        if (s.lyrics)  setLyrics(s.lyrics);
        if (s.chords)  setChords(s.chords);
        if (s.grid)    setGrid(s.grid);
        if (s.detectedBpm !== undefined) setDetectedBpm(s.detectedBpm);
        if (s.cifraText) { setCifraText(s.cifraText); setCifraEdited(true); } else { setCifraEdited(false); setCifraText(''); }
        if (scrollRef.current) scrollRef.current.scrollLeft = 0;
      } catch { alert('Arquivo inválido'); }
    };
    reader.readAsText(file);
  };

  // Metronome
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [metroBeat, setMetroBeat] = useState(-1);
  const [, setTapTimes] = useState<number[]>([]);
  const metroSeqRef = useRef<Tone.Sequence<number> | null>(null);
  const metroSynthRef = useRef<Tone.Synth | null>(null);
  const metronomeOnRef = useRef(metronomeOn);
  metronomeOnRef.current = metronomeOn;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Native scrollbar <-> scroll container sync (bypasses React batching for zero latency)
  useEffect(() => {
    const bar = scrollbarRef.current;
    const container = scrollRef.current;
    if (!bar || !container) return;
    let dragging = false;

    const onBarInput = () => {
      const ratio = parseFloat(bar.value);
      const max = container.scrollWidth - container.clientWidth;
      container.scrollLeft = ratio * max;
    };
    const onContainerScroll = () => {
      if (dragging) return;
      const max = container.scrollWidth - container.clientWidth;
      bar.value = String(max > 0 ? container.scrollLeft / max : 0);
    };
    const onDown = () => { dragging = true; };
    const onUp   = () => { dragging = false; };

    bar.addEventListener('input', onBarInput);
    bar.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    container.addEventListener('scroll', onContainerScroll, { passive: true });
    return () => {
      bar.removeEventListener('input', onBarInput);
      bar.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      container.removeEventListener('scroll', onContainerScroll);
    };
  }, []);

  // Auto-scroll to keep playhead visible
  useEffect(() => {
    if (currentBeat === null || !scrollRef.current) return;
    const cellW = 40;
    const containerW = scrollRef.current.clientWidth;
    const beatX = currentBeat * cellW + 40; // +40 for label column
    const scrollLeft = scrollRef.current.scrollLeft;
    // Keep beat within the middle third of the visible area
    if (beatX < scrollLeft + containerW * 0.25 || beatX > scrollLeft + containerW * 0.75) {
      scrollRef.current.scrollLeft = Math.max(0, beatX - containerW * 0.35);
    }
  }, [currentBeat]);

  // Selection range helper (full columns)
  const getSelRange = () => {
    if (selectedBeat === null || selAnchor === null) return null;
    return { b1: Math.min(selAnchor, selectedBeat), b2: Math.max(selAnchor, selectedBeat) };
  };
  const selRange = getSelRange();
  const isInSelection = (b: number) =>
    selRange ? b >= selRange.b1 && b <= selRange.b2 : false;

  const samplerRef = useRef<Tone.Sampler | null>(null);     // treble (G, B, e)
  const samplerBassRef = useRef<Tone.Sampler | null>(null); // bass   (E, A, D)
  const seqRef = useRef<Tone.Sequence<number> | null>(null);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const beatsRef = useRef(beats);
  beatsRef.current = beats;
  const lyricsRef = useRef(lyrics);
  lyricsRef.current = lyrics;
  const chordsRef = useRef(chords);
  chordsRef.current = chords;
  const capoRef = useRef(capo);
  capoRef.current = capo;

  // Sync slide edit value when navigating to a slide cell
  useEffect(() => {
    if (selectedBeat === null) { setSlideEditValue(''); return; }
    const cell = gridRef.current[selectedBeat]?.[selectedString];
    if (cell?.tech === 'slide-up' || cell?.tech === 'slide-down') {
      const sep = cell.tech === 'slide-up' ? '/' : '\\';
      setSlideEditValue(`${cell.slideTo ?? ''}${sep}${cell.fret}`);
    } else {
      setSlideEditValue('');
    }
  }, [selectedBeat, selectedString]);

  // Load FluidR3_GM nylon guitar soundfont (one sample per chromatic note = zero pitch-shifting)
  useEffect(() => {
    let disposed = false;
    let samplerInstance: Tone.Sampler | null = null;

    // ── Cadeia mínima: Sampler → Reverb sutil → Volume → Out ──────────────
    // Sem EQ — o FluidR3_GM já tem timbre equilibrado, como no tab-maker.com
    const reverb = new Tone.Reverb({ decay: 0.8, preDelay: 0.01, wet: 0.10 });
    const masterVol = new Tone.Volume(3);
    reverb.chain(masterVol, Tone.getDestination());

    // Cadeia para cordas graves (D, A, E) — mais corpo e escuridão
    const bassEq = new Tone.EQ3({ low: 6, mid: -3, high: -8 });
    const bassReverb = new Tone.Reverb({ decay: 1.0, preDelay: 0.01, wet: 0.12 });
    const bassVol = new Tone.Volume(4);
    bassEq.chain(bassReverb, bassVol, Tone.getDestination());

    // FluidR3_GM acoustic_guitar_nylon — soundfont padrão usado por tab editors
    // Cada nota cromática tem sua própria amostra = zero pitch-shifting = som mais natural possível
    const SOUNDFONT_URL =
      'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3.js';

    (async () => {
      try {
        const res = await fetch(SOUNDFONT_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (disposed) return;

        // Parse note → data URI pairs from the JS file
        // Format: "NoteName": "data:audio/mp3;base64,..."
        const urls: Record<string, string> = {};
        let pos = text.indexOf('= {');
        if (pos === -1) throw new Error('Invalid soundfont format');
        pos += 3;

        while (pos < text.length) {
          // Find next key
          const kStart = text.indexOf('"', pos);
          if (kStart === -1) break;
          const kEnd = text.indexOf('"', kStart + 1);
          if (kEnd === -1) break;
          const key = text.substring(kStart + 1, kEnd);

          // Skip past key
          pos = kEnd + 1;

          // Check if this is a note name (A0-G#8)
          if (!/^[A-G][b#]?\d+$/.test(key)) continue;

          // Find value (data URI)
          const vStart = text.indexOf('"', pos);
          if (vStart === -1) break;
          let vEnd = vStart + 1;
          while (vEnd < text.length && text[vEnd] !== '"') vEnd++;
          if (vEnd >= text.length) break;

          urls[key] = text.substring(vStart + 1, vEnd);
          pos = vEnd + 1;
        }

        if (disposed) return;

        let loadCount = 0;
        const checkLoaded = () => { loadCount++; if (loadCount >= 2 && !disposed) setIsLoaded(true); };

        const sampler = new Tone.Sampler({
          urls,
          release: 1,
          onload: checkLoaded,
        }).connect(reverb);

        // Sampler separado para cordas graves (D=3, A=4, E=5) com detune -15 cents
        const bassSampler = new Tone.Sampler({
          urls,
          release: 1.2,
          onload: checkLoaded,
        });
        bassSampler.set({ detune: -30 } as never);
        bassSampler.connect(bassEq);

        if (disposed) {
          sampler.dispose();
          bassSampler.dispose();
          return;
        }

        samplerInstance = sampler;
        samplerRef.current = sampler;
        samplerBassRef.current = bassSampler;
      } catch (e) {
        console.error('Failed to load soundfont:', e);
      }
    })();

    return () => {
      disposed = true;
      Tone.getTransport().stop();
      seqRef.current?.dispose();
      samplerInstance?.dispose();
      samplerBassRef.current?.dispose();
      reverb.dispose(); masterVol.dispose();
      bassEq.dispose(); bassReverb.dispose(); bassVol.dispose();
      metroSeqRef.current?.dispose();
      metroSynthRef.current?.dispose();
    };
  }, []);

  // Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y redo, arrow keys navigate, number keys set fret
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) { e.preventDefault(); redo(); return; }
      // Arrow left/right — move 1 beat; with Shift — extend selection
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setFretInputBuffer('');
        if (e.shiftKey) {
          // If no cell selected yet, start from startBeat (playback cursor)
          if (selectedBeat === null) {
            setSelectedBeat(startBeatRef.current);
            setSelAnchor(startBeatRef.current);
          } else if (selAnchor === null) {
            setSelAnchor(selectedBeat);
          }
        } else {
          setSelAnchor(null);
        }
        setSelectedBeat((prev) => {
          const cur = prev ?? startBeatRef.current;
          const next = e.key === 'ArrowLeft'
            ? Math.max(0, cur - 1)
            : Math.min(beatsRef.current - 1, cur + 1);
          if (scrollRef.current) {
            const targetX = next * 40 + 40 - scrollRef.current.clientWidth / 2;
            scrollRef.current.scrollLeft = Math.max(0, targetX);
          }
          return next;
        });
      }
      // Arrow up/down — move between strings
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFretInputBuffer('');
        if (selectedBeat === null) setSelectedBeat(startBeatRef.current);
        setSelectedString((prev) => {
          return e.key === 'ArrowUp' ? Math.max(0, prev - 1) : Math.min(STRING_COUNT - 1, prev + 1);
        });
      }
      // Ctrl+C — copy selection or single column (including lyrics & chords)
      if (e.ctrlKey && e.key === 'c' && selectedBeat !== null) {
        e.preventDefault();
        const b1 = selAnchor !== null ? Math.min(selAnchor, selectedBeat) : selectedBeat;
        const b2 = selAnchor !== null ? Math.max(selAnchor, selectedBeat) : selectedBeat;
        const copiedCells: CellData[][] = [];
        const copiedLyrics: Record<number, string> = {};
        const copiedChords: Record<number, ChordLabel> = {};
        for (let b = b1; b <= b2; b++) {
          const col: CellData[] = [];
          for (let s = 0; s < STRING_COUNT; s++) {
            const cell = gridRef.current[b]?.[s] ?? null;
            col.push(cell ? { ...cell } : null);
          }
          copiedCells.push(col);
          const idx = b - b1;
          if (lyricsRef.current[b]) copiedLyrics[idx] = lyricsRef.current[b];
          if (chordsRef.current[b]) copiedChords[idx] = { ...chordsRef.current[b] };
        }
        clipboardRef.current = { cells: copiedCells, lyrics: copiedLyrics, chords: copiedChords };
      }
      // Ctrl+V — paste at current beat (including lyrics & chords), auto-expand grid if needed
      if (e.ctrlKey && e.key === 'v' && selectedBeat !== null && clipboardRef.current) {
        e.preventDefault();
        commit();
        const clip = clipboardRef.current;
        const needed = selectedBeat + clip.cells.length;
        const cpb = subdivModeRef.current ? 8 : 4;
        if (needed > beatsRef.current) {
          const extra = Math.ceil((needed - beatsRef.current) / cpb) * cpb;
          setBeats((b) => b + extra);
          setGrid((prev) => [
            ...prev,
            ...Array.from({ length: extra }, () => Array(STRING_COUNT).fill(null)),
          ]);
        }
        setGrid((prev) => {
          const next = prev.map((b) => [...b]);
          for (let db = 0; db < clip.cells.length; db++) {
            const tb = selectedBeat + db;
            if (tb >= next.length) break;
            for (let s = 0; s < clip.cells[db].length; s++) {
              if (s >= STRING_COUNT) break;
              next[tb][s] = clip.cells[db][s] ? { ...clip.cells[db][s]! } : null;
            }
          }
          return next;
        });
        setLyrics((prev) => {
          const next = { ...prev };
          for (const [idx, text] of Object.entries(clip.lyrics)) {
            const tb = selectedBeat + Number(idx);
            next[tb] = text;
          }
          return next;
        });
        setChords((prev) => {
          const next = { ...prev };
          for (const [idx, chord] of Object.entries(clip.chords)) {
            const tb = selectedBeat + Number(idx);
            next[tb] = { ...chord };
          }
          return next;
        });
      }
      // Escape — clear selection
      if (e.key === 'Escape') {
        setSelAnchor(null);
        slideInputRef.current = null;
      }
      // '/' → slide-up, '\' → slide-down  — notação: 5/7 ou 7\5
      if ((e.key === '/' || e.key === '\\') && selectedBeat !== null) {
        e.preventDefault();
        setFretInputBuffer((prevBuf) => {
          const fromFret = prevBuf.length > 0
            ? parseInt(prevBuf, 10)
            : (gridRef.current[selectedBeat]?.[selectedString]?.fret ?? null);
          if (fromFret === null || isNaN(fromFret)) return prevBuf;
          const tech: Technique = e.key === '/' ? 'slide-up' : 'slide-down';
          slideInputRef.current = { from: fromFret, tech };
          commit();
          setGrid((prev) => {
            const next = prev.map((b) => [...b]);
            const existing = next[selectedBeat][selectedString];
            next[selectedBeat][selectedString] = {
              fret: existing?.fret ?? fromFret,
              tech,
              slideTo: fromFret,
            };
            return next;
          });
          setSelectedTech(tech);
          setSlideToValue(fromFret);
          if (fretInputTimer.current) clearTimeout(fretInputTimer.current);
          fretInputTimer.current = setTimeout(() => {
            slideInputRef.current = null;
            setFretInputBuffer('');
          }, 2000);
          return `${fromFret}${e.key}`;
        });
      }
      // Number keys (0-9) — set fret or muteAfter on selected cell
      if (/^[0-9]$/.test(e.key) && selectedBeat !== null) {
        e.preventDefault();
        // Se estiver em modo slide-notation (ex: digitou "5/"), próximos dígitos são o frete destino
        if (slideInputRef.current) {
          const { from, tech } = slideInputRef.current;
          setFretInputBuffer((prevBuf) => {
            const sepChar = tech === 'slide-up' ? '/' : '\\';
            const sepIdx = prevBuf.indexOf(sepChar);
            const afterSep = sepIdx >= 0 ? prevBuf.slice(sepIdx + 1) : '';
            const newAfter = afterSep + e.key;
            let toFret = parseInt(newAfter, 10);
            if (toFret > MAX_FRET) {
              toFret = parseInt(e.key, 10);
              setGrid((prev) => {
                const next = prev.map((b) => [...b]);
                next[selectedBeat][selectedString] = { fret: toFret, tech, slideTo: from };
                return next;
              });
              setSlideToValue(from);
              if (fretInputTimer.current) clearTimeout(fretInputTimer.current);
              fretInputTimer.current = setTimeout(() => { slideInputRef.current = null; setFretInputBuffer(''); }, 800);
              return `${from}${sepChar}${e.key}`;
            }
            setGrid((prev) => {
              const next = prev.map((b) => [...b]);
              next[selectedBeat][selectedString] = { fret: toFret, tech, slideTo: from };
              return next;
            });
            setSlideToValue(from);
            if (fretInputTimer.current) clearTimeout(fretInputTimer.current);
            fretInputTimer.current = setTimeout(() => { slideInputRef.current = null; setFretInputBuffer(''); }, 800);
            return `${from}${sepChar}${newAfter}`;
          });
          return;
        }
        // Check if selected cell has mute technique — edit muteAfter instead
        const existingCell = gridRef.current[selectedBeat]?.[selectedString];
        if (existingCell && existingCell.tech === 'mute') {
          setFretInputBuffer((prevBuf) => {
            const newBuf = prevBuf + e.key;
            const num = parseInt(newBuf, 10);
            if (num > 32 || num < 1) {
              const single = parseInt(e.key, 10);
              if (single >= 1) {
                commit();
                setGrid((prev) => {
                  const next = prev.map((b) => [...b]);
                  next[selectedBeat][selectedString] = { ...existingCell, muteAfter: single };
                  return next;
                });
              }
              return e.key;
            }
            commit();
            setGrid((prev) => {
              const next = prev.map((b) => [...b]);
              next[selectedBeat][selectedString] = { ...existingCell, muteAfter: num };
              return next;
            });
            if (fretInputTimer.current) clearTimeout(fretInputTimer.current);
            fretInputTimer.current = setTimeout(() => setFretInputBuffer(''), 800);
            return newBuf;
          });
        } else {
          setFretInputBuffer((prevBuf) => {
            const newBuf = prevBuf + e.key;
            const fretNum = parseInt(newBuf, 10);

            // If fret exceeds max, start fresh with just this digit
            if (fretNum > MAX_FRET) {
              const singleFret = parseInt(e.key, 10);
              applyFretToCell(selectedBeat, selectedString, singleFret);
              return e.key;
            }

            applyFretToCell(selectedBeat, selectedString, fretNum);

            // Clear buffer after 800ms of no typing
            if (fretInputTimer.current) clearTimeout(fretInputTimer.current);
            fretInputTimer.current = setTimeout(() => setFretInputBuffer(''), 800);

            return newBuf;
          });
        }
      }
      // Delete/Backspace — clear selected cell or selection
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBeat !== null) {
        e.preventDefault();
        setFretInputBuffer('');
        commit();
        if (selAnchor !== null) {
          const b1 = Math.min(selAnchor, selectedBeat);
          const b2 = Math.max(selAnchor, selectedBeat);
          setGrid((prev) => {
            const next = prev.map((b) => [...b]);
            for (let b = b1; b <= b2; b++) {
              for (let s = 0; s < STRING_COUNT; s++) {
                next[b][s] = null;
              }
            }
            return next;
          });
          setSelAnchor(null);
        } else {
          setGrid((prev) => {
            const next = prev.map((b) => [...b]);
            next[selectedBeat][selectedString] = null;
            return next;
          });
        }
      }
      // Enter — set startBeat to selectedBeat (only if slide input isn't focused)
      if (e.key === 'Enter') {
        if (document.activeElement?.tagName === 'INPUT') return;
        setSelectedBeat((cur) => {
          if (cur !== null && !isPlayingRef.current) setStartBeat(cur);
          return cur;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedBeat, selectedString]);

  // Sync BPM live
  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  const toggleMetronome = useCallback(async () => {
    await Tone.start();
    if (metronomeOnRef.current) {
      // Turn off
      metroSeqRef.current?.stop();
      metroSeqRef.current?.dispose();
      metroSeqRef.current = null;
      setMetroBeat(-1);
      setMetronomeOn(false);
      if (!isPlayingRef.current) Tone.getTransport().stop();
    } else {
      // Create click synth once
      if (!metroSynthRef.current) {
        const s = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.01 },
        }).toDestination();
        s.volume.value = -6;
        metroSynthRef.current = s;
      }
      let beatCount = 0;
      const seq = new Tone.Sequence<number>(
        (time, _b) => {
          const beat = beatCount % 4;
          beatCount++;
          const isDown = beat === 0;
          metroSynthRef.current?.triggerAttackRelease(isDown ? 'A5' : 'D5', '64n', time);
          // Schedule visual update at audio time
          Tone.getDraw().schedule(() => setMetroBeat(beat), time);
        },
        [0, 1, 2, 3],
        '4n'
      );
      metroSeqRef.current = seq;
      seq.start(0);
      Tone.getTransport().start();
      setMetronomeOn(true);
    }
  }, []);

  const handleTap = useCallback(() => {
    const now = performance.now();
    setTapTimes((prev) => {
      const recent = [...prev, now].slice(-6);
      if (recent.length >= 2) {
        const intervals = recent.slice(1).map((t, i) => t - recent[i]);
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const newBpm = Math.round(60000 / avg);
        if (newBpm >= 40 && newBpm <= 200) { setBpm(newBpm); setBpmInput(String(newBpm)); }
      }
      return recent;
    });
  }, []);

  const toggleCell = (beat: number, string: number) => {
    commit();
    setGrid((prev) => {
      const next = prev.map((b) => [...b]);
      const isSlide = selectedTech === 'slide-up' || selectedTech === 'slide-down';
      next[beat][string] = next[beat][string] !== null ? null : {
        fret: selectedFret,
        tech: selectedTech ?? undefined,
        ...(isSlide ? { slideTo: slideToValue } : {}),
        ...(selectedTech === 'mute' ? { muteAfter: muteAfterValue } : {}),
      };
      return next;
    });
  };

  const applyFretToCell = (beat: number, string: number, fret: number) => {
    commit();
    setGrid((prev) => {
      const next = prev.map((b) => [...b]);
      const isSlide = selectedTech === 'slide-up' || selectedTech === 'slide-down';
      next[beat][string] = {
        fret,
        tech: selectedTech ?? undefined,
        ...(isSlide ? { slideTo: slideToValue } : {}),
        ...(selectedTech === 'mute' ? { muteAfter: muteAfterValue } : {}),
      };
      return next;
    });
  };

  const play = async () => {
    if (!samplerRef.current || !isLoaded) return;
    await Tone.start();

    const transport = Tone.getTransport();
    transport.bpm.value = bpm;

    const from = startBeatRef.current;
    const beatIndices = Array.from({ length: grid.length - from }, (_, i) => from + i);

    // Precompute per-string natural sustain durations (in beats).
    // A note rings until the next note on the same string — exactly like a real guitar.
    const snapshot = gridRef.current;
    const totalBeats = snapshot.length;
    const beatUnit = subdivModeRef.current ? '16n' : '8n';
    const beatSecs = Tone.Time(beatUnit).toSeconds();

    // sustainBeats[beat][string] = seconds until next note on that string (or 8s cap)
    const sustainSecs: number[][] = Array.from({ length: totalBeats }, () => Array(STRING_COUNT).fill(0));
    for (let s = 0; s < STRING_COUNT; s++) {
      for (let b = from; b < totalBeats; b++) {
        if (snapshot[b][s] !== null) {
          let next = totalBeats;
          for (let nb = b + 1; nb < totalBeats; nb++) {
            if (snapshot[nb][s] !== null) { next = nb; break; }
          }
          // Clamp: ring at most 5 seconds (realistic nylon guitar sustain)
          sustainSecs[b][s] = Math.min((next - b) * beatSecs, 5.0);
        }
      }
    }

    const seq = new Tone.Sequence<number>(
      (time, beat) => {
        setCurrentBeat(beat);
        const col = gridRef.current[beat];
        // Detect if any cell in this beat has arpeggio technique
        const hasArpeggio = col.some((c) => c !== null && c.tech === 'arpeggio');
        col.forEach((cell, s) => {
          // Use bass sampler for low strings (D=3, A=4, E=5)
          const sampler = s >= 3 ? samplerBassRef.current : samplerRef.current;
          if (cell !== null && sampler?.loaded) {
            // Natural sustain: ring until next note on same string
            const rawDuration = sustainSecs[beat]?.[s] ?? beatSecs;
            // Mute technique: force sustain to exactly muteAfter beats
            const duration = cell.tech === 'mute' && cell.muteAfter
              ? cell.muteAfter * beatSecs
              : rawDuration;
            const note = noteAtFret(s, cell.fret);
            // Micro-jitter aleatório: evita cancelamento de fase sem criar arpejo artificial
            const jitter = hasArpeggio ? (STRING_COUNT - 1 - s) * 0.020 : Math.random() * 0.005;
            const t = time + jitter;
            switch (cell.tech) {
              case 'arpeggio':
                sampler.triggerAttackRelease(note, duration, t, 0.65 + Math.random() * 0.10);
                break;
              case 'mute':
                sampler.triggerAttackRelease(note, duration, t, 0.75 + Math.random() * 0.10);
                break;
              case 'hammer':
                sampler.triggerAttackRelease(note, duration, t, 0.45 + Math.random() * 0.08);
                break;
              case 'pull':
                sampler.triggerAttackRelease(note, duration, t, 0.35 + Math.random() * 0.07);
                break;
              case 'slide-up':
              case 'slide-down': {
                const targetFret = cell.fret;
                const fromFret = cell.tech === 'slide-up'
                  ? (cell.slideTo !== undefined ? cell.slideTo : Math.max(0, targetFret - 2))
                  : (cell.slideTo !== undefined ? cell.slideTo : targetFret + 2);
                const steps = Math.abs(targetFret - fromFret);
                if (steps === 0) {
                  sampler.triggerAttackRelease(note, duration, t, 0.78);
                } else {
                  const dir = targetFret > fromFret ? 1 : -1;
                  // Slide ocorre nos primeiros ~50% da batida (máx 40ms por casa)
                  const slideWindow = Math.min(beatSecs * 0.5, steps * 0.04);
                  // Nota de origem: ataque normal, curta (dedo já desliza)
                  const originNote = noteAtFret(s, fromFret);
                  sampler.triggerAttackRelease(originNote, '32n', t, 0.75);
                  // Fretes intermediários: ghost notes quase inaudíveis (simulam o deslizamento)
                  for (let i = 1; i < steps; i++) {
                    const slideFret = fromFret + dir * i;
                    const slideNote = noteAtFret(s, slideFret);
                    const stepT = t + (slideWindow * i) / steps;
                    sampler.triggerAttackRelease(slideNote, '256n', stepT, 0.06);
                  }
                  // Nota destino: chega após o slide e sustenta normalmente
                  sampler.triggerAttackRelease(note, duration, t + slideWindow, 0.85);
                }
                break;
              }
              default:
                sampler.triggerAttackRelease(note, duration, t, 0.75 + Math.random() * 0.10);
            }
          }
        });
      },
      beatIndices,
      beatUnit
    );

    seqRef.current = seq;
    seq.start(0);
    transport.start();
    setIsPlaying(true);
  };

  const stop = () => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    seqRef.current?.stop();
    seqRef.current?.dispose();
    seqRef.current = null;
    setIsPlaying(false);
    setCurrentBeat(null);
    // Restart transport if metronome is still on
    if (metronomeOnRef.current) Tone.getTransport().start();
  };

  const handlePlayPause = () => {
    if (isPlaying) stop();
    else play();
  };

  const colsPerBarNow = subdivMode ? 8 : 4;

  const addBars = (n = 1) => {
    commit();
    const add = n * colsPerBarNow;
    setBeats((b) => b + add);
    setGrid((g) => [
      ...g,
      ...Array.from({ length: add }, () => Array(STRING_COUNT).fill(null)),
    ]);
  };

  const removeBars = (n = 1) => {
    commit();
    const remove = n * colsPerBarNow;
    setBeats((b) => {
      const next = Math.max(colsPerBarNow, b - remove);
      setGrid((g) => g.slice(0, next).map((col) => [...col]));
      return next;
    });
  };

  // Prepend N empty bars at the very beginning — shifts all notes, lyrics and chords forward
  const prependBars = (n = 1) => {
    commit();
    const add = n * colsPerBarNow;
    const emptyBars: Grid = Array.from({ length: add }, () => Array(STRING_COUNT).fill(null));
    setGrid((g) => [...emptyBars, ...g]);
    setBeats((b) => b + add);
    setStartBeat((s) => s + add);
    setLyrics((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => { if (v) next[Number(k) + add] = v; });
      return next;
    });
    setChords((prev) => {
      const next: Record<number, ChordLabel> = {};
      Object.entries(prev).forEach(([k, v]) => { next[Number(k) + add] = v; });
      return next;
    });
  };

  // Insert a single empty beat column before beat `atBeat`
  const insertBeat = (atBeat: number) => {
    commit();
    const empty: CellData[] = Array(STRING_COUNT).fill(null);
    setGrid((g) => [...g.slice(0, atBeat), empty, ...g.slice(atBeat)]);
    setBeats((b) => b + 1);
    setStartBeat((s) => (s >= atBeat ? s + 1 : s));
    setLyrics((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const beat = Number(k);
        next[beat >= atBeat ? beat + 1 : beat] = v;
      });
      return next;
    });
    setChords((prev) => {
      const next: Record<number, ChordLabel> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const beat = Number(k);
        next[beat >= atBeat ? beat + 1 : beat] = v;
      });
      return next;
    });
  };

  // Delete beat column at `atBeat`
  const deleteBeat = (atBeat: number) => {
    if (beats <= 1) return;
    commit();
    setGrid((g) => g.filter((_, i) => i !== atBeat));
    setBeats((b) => Math.max(1, b - 1));
    setStartBeat((s) => (s > atBeat ? s - 1 : Math.min(s, beats - 2)));
    setLyrics((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const beat = Number(k);
        if (beat === atBeat) return;
        next[beat > atBeat ? beat - 1 : beat] = v;
      });
      return next;
    });
    setChords((prev) => {
      const next: Record<number, ChordLabel> = {};
      Object.entries(prev).forEach(([k, v]) => {
        if (Number(k) === atBeat) return;
        const beat = Number(k);
        next[beat > atBeat ? beat - 1 : beat] = v;
      });
      return next;
    });
  };

  const reset = () => {
    stop();
    historyRef.current = [];
    futureRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setBeats(DEFAULT_BEATS);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    setDetectedBpm(null);
    setGrid(emptyGrid(DEFAULT_BEATS));
    setLyrics({});
    setChords({});
    setSubdivMode(false);
    setStartBeat(0);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="h-screen bg-[#060607] text-stone-200 flex flex-col overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

      {/* ═══ Navbar ═══ */}
      <div className="shrink-0 border-b border-stone-800 bg-stone-950">
        {/* Conteúdo da navbar em flex com scroll horizontal */}
        <div className="flex items-center gap-1.5 px-3 h-12 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>

          {/* — Esquerda: logo + título — */}
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/" className="flex items-center justify-center w-8 h-8 rounded-lg bg-stone-900 border border-stone-800 hover:border-stone-700 transition-colors">
              <ArrowLeft className="w-4 h-4 text-stone-400" />
            </Link>
            <div className="leading-none">
              <span className="text-sm font-semibold text-stone-100">Tabmaker</span>
              <span className="text-[10px] text-stone-600 ml-1.5">Violão Nylon</span>
            </div>
          </div>

          {/* — Centro: transport + BPM + metrônomo — */}
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            {/* Play / Parar */}
            <button onClick={handlePlayPause} disabled={!isLoaded}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 ${
                isPlaying ? 'bg-stone-700 text-stone-200 hover:bg-stone-600' : 'bg-stone-200 text-stone-950 hover:bg-white'
              }`}>
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? 'Parar' : 'Tocar'}
            </button>

            {/* Início */}
            <button onClick={() => { setStartBeat(0); if (scrollRef.current) scrollRef.current.scrollLeft = 0; }}
              title="Voltar ao início" disabled={isPlaying}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs text-stone-400 bg-stone-900 border border-stone-800 rounded-lg hover:border-stone-700 disabled:opacity-30 transition-colors">
              <SkipBack className="w-3.5 h-3.5" />
              Início
            </button>

            {/* Voltar 4 compassos */}
            <button onClick={() => { const cpb = subdivMode ? 8 : 4; const target = Math.max(0, startBeat - cpb * 4); setStartBeat(target); setSelectedBeat(target); if (scrollRef.current) { scrollRef.current.scrollLeft = Math.max(0, target * 40 - scrollRef.current.clientWidth / 2); } }}
              title="Voltar 4 compassos" disabled={isPlaying}
              className="shrink-0 flex items-center gap-1 px-2 py-1.5 text-xs text-stone-400 bg-stone-900 border-y border-l border-stone-800 rounded-l-lg hover:border-stone-700 disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {/* Ir para compasso específico */}
            <input
              type="number"
              min={1}
              max={subdivMode ? beats / 8 : beats / 4}
              value={Math.floor(startBeat / (subdivMode ? 8 : 4)) + 1}
              onChange={(e) => {
                const cpb = subdivMode ? 8 : 4;
                const maxBar = Math.floor((beatsRef.current - 1) / cpb) + 1;
                let bar = parseInt(e.target.value, 10);
                if (isNaN(bar)) return;
                bar = Math.max(1, Math.min(maxBar, bar));
                const target = (bar - 1) * cpb;
                setStartBeat(target);
                setSelectedBeat(target);
                if (scrollRef.current) { scrollRef.current.scrollLeft = Math.max(0, target * 40 - scrollRef.current.clientWidth / 2); }
              }}
              disabled={isPlaying}
              title="Ir para compasso"
              className="w-10 text-center text-xs text-stone-300 bg-stone-900 border-y border-stone-800 py-1.5 outline-none focus:bg-stone-800 disabled:opacity-30 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {/* Avançar 4 compassos */}
            <button onClick={() => { const cpb = subdivMode ? 8 : 4; const target = Math.min(beatsRef.current - 1, startBeat + cpb * 4); setStartBeat(target); setSelectedBeat(target); if (scrollRef.current) { scrollRef.current.scrollLeft = Math.max(0, target * 40 - scrollRef.current.clientWidth / 2); } }}
              title="Avançar 4 compassos" disabled={isPlaying}
              className="shrink-0 flex items-center gap-1 px-2 py-1.5 text-xs text-stone-400 bg-stone-900 border-y border-r border-stone-800 rounded-r-lg hover:border-stone-700 disabled:opacity-30 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Final (última nota tocada) */}
            <button onClick={() => { let last = 0; for (let b = gridRef.current.length - 1; b >= 0; b--) { if (gridRef.current[b].some(c => c !== null)) { last = b; break; } } setStartBeat(last); setSelectedBeat(last); if (scrollRef.current) { scrollRef.current.scrollLeft = Math.max(0, last * 40 - scrollRef.current.clientWidth / 2); } }}
              title="Ir ao final (última nota)" disabled={isPlaying}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs text-stone-400 bg-stone-900 border border-stone-800 rounded-lg hover:border-stone-700 disabled:opacity-30 transition-colors">
              Final
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            {/* Compassos */}
            <div className="shrink-0 flex items-center rounded-lg overflow-hidden border border-stone-800">
              <button onClick={() => removeBars(1)} disabled={isPlaying}
                className="flex items-center justify-center w-7 h-8 text-stone-400 bg-stone-900 hover:bg-stone-800 disabled:opacity-30 transition-colors">
                <Minus className="w-3 h-3" />
              </button>
              <span className="px-2 text-xs text-stone-500 bg-stone-900 select-none tabular-nums">
                {subdivMode ? beats / 8 : beats / 4}c
              </span>
              <button onClick={() => addBars(1)} disabled={isPlaying}
                className="flex items-center justify-center w-7 h-8 text-stone-400 bg-stone-900 hover:bg-stone-800 disabled:opacity-30 transition-colors">
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Inserir compasso no início */}
            <button
              onClick={() => prependBars(1)}
              disabled={isPlaying}
              title="Inserir compasso no início"
              className="shrink-0 flex items-center gap-1 px-2 h-8 rounded-lg border border-stone-800 bg-stone-900 text-stone-400 hover:bg-stone-800 hover:text-stone-300 disabled:opacity-30 transition-colors text-xs"
            >
              <ChevronLeft className="w-3 h-3" />
              <Plus className="w-2.5 h-2.5" />
            </button>

            {/* Desfazer / Refazer */}
            <div className="shrink-0 flex items-center rounded-lg overflow-hidden border border-stone-800">
              <button onClick={undo} disabled={!canUndo || isPlaying} title="Desfazer (Ctrl+Z)"
                className="flex items-center justify-center w-8 h-8 text-stone-400 bg-stone-900 hover:bg-stone-800 disabled:opacity-30 transition-colors">
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={redo} disabled={!canRedo || isPlaying} title="Refazer (Ctrl+Y)"
                className="flex items-center justify-center w-8 h-8 text-stone-400 bg-stone-900 hover:bg-stone-800 disabled:opacity-30 transition-colors border-l border-stone-800">
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-5 w-px bg-stone-800 shrink-0" />

            {/* BPM */}
            <div className="shrink-0 flex items-center gap-1">
              <button onClick={() => { const v = Math.max(40, bpm - 1); setBpm(v); setBpmInput(String(v)); }}
                className="w-6 h-6 rounded bg-stone-800 text-stone-400 hover:bg-stone-700 flex items-center justify-center font-bold text-sm leading-none">−</button>
              <input type="text" inputMode="numeric" value={bpmInput}
                onChange={(e) => setBpmInput(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => { const v = Math.round(Math.min(200, Math.max(40, Number(bpmInput) || bpm))); setBpm(v); setBpmInput(String(v)); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="w-11 text-center text-sm font-mono font-bold text-stone-200 tabular-nums bg-transparent border-b border-stone-700 focus:border-stone-400 outline-none"
              />
              <button onClick={() => { const v = Math.min(200, bpm + 1); setBpm(v); setBpmInput(String(v)); }}
                className="w-6 h-6 rounded bg-stone-800 text-stone-400 hover:bg-stone-700 flex items-center justify-center font-bold text-sm leading-none">+</button>
              <span className="text-[10px] text-stone-600 ml-0.5">BPM</span>
              <input type="range" min={40} max={200} value={bpm}
                onChange={(e) => { const v = Number(e.target.value); setBpm(v); setBpmInput(String(v)); }}
                className="w-20 accent-stone-400 cursor-pointer ml-1" />
            </div>

            <div className="h-5 w-px bg-stone-800 shrink-0" />

            {/* Metrônomo */}
            <div className="shrink-0 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-stone-600 shrink-0" />
              <button onClick={toggleMetronome}
                className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 transition-colors ${
                  metronomeOn ? 'border-stone-400 bg-stone-400' : 'border-stone-700 bg-stone-800'
                }`}>
                <span className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-stone-950 shadow transition-transform ${metronomeOn ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3].map((b) => {
                  const active = metroBeat === b && metronomeOn;
                  return <div key={b} className={`rounded-full transition-all duration-75 ${active ? (b === 0 ? 'bg-stone-100' : 'bg-stone-400') : (b === 0 ? 'bg-stone-700 border border-stone-600' : 'bg-stone-800')}`}
                    style={{ width: b === 0 ? 12 : 9, height: b === 0 ? 12 : 9 }} />;
                })}
              </div>
              <button onClick={handleTap}
                className="px-2 py-1 text-[11px] font-medium text-stone-300 bg-stone-800 border border-stone-700 rounded-lg hover:bg-stone-700 active:scale-95 select-none transition-all">
                Tap
              </button>
            </div>

            {detectedBpm !== null && (
              <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/40 border border-emerald-900/50">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[11px] text-emerald-400">BPM: <strong>{detectedBpm}</strong></span>
              </div>
            )}
          </div>

          {/* — Direita: utilitários — */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto pl-2">
            <button onClick={exportTab} title="Exportar"
              className="flex items-center justify-center w-8 h-8 text-stone-400 bg-stone-900 border border-stone-800 rounded-lg hover:border-stone-700 transition-colors">
              <Download className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => importInputRef.current?.click()} title="Importar"
              className="flex items-center justify-center w-8 h-8 text-stone-400 bg-stone-900 border border-stone-800 rounded-lg hover:border-stone-700 transition-colors">
              <Upload className="w-3.5 h-3.5" />
            </button>
            <input ref={importInputRef} type="file" accept=".json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importTab(f); e.target.value = ''; }}
            />
            <button onClick={reset} title="Limpar"
              className="flex items-center justify-center w-8 h-8 text-stone-400 bg-stone-900 border border-stone-800 rounded-lg hover:border-stone-700 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <div className="h-5 w-px bg-stone-800" />
            <button onClick={() => setShowAudioPanel((v) => !v)} title="Transcrição de áudio por IA"
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg border transition-colors ${
                showAudioPanel ? 'bg-stone-200 text-stone-950 border-stone-300 font-semibold' : 'text-stone-400 bg-stone-900 border-stone-800 hover:border-stone-700'
              }`}>
              IA
            </button>
            {lastSaved && (
              <span className="flex items-center gap-1 text-[10px] text-stone-600">
                <Save className="w-3 h-3" />
                {lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {!isLoaded ? (
              <div className="flex items-center gap-1 text-[11px] text-stone-500 bg-stone-900 border border-stone-800 px-2 py-1.5 rounded-lg">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              </div>
            ) : (
              <div className="w-2 h-2 rounded-full bg-emerald-400" title="Pronto para tocar" />
            )}
          </div>

        </div>
      </div>

      {/* ═══ Braço do violão ═══ */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-1.5 border-b border-stone-800 bg-stone-900/20 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Frete selecionado */}
        <span className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg font-mono text-sm font-bold border ${
          capo > 0 && selectedFret > 0 && selectedFret < capo
            ? 'bg-red-900/60 text-red-400 border-red-800'
            : 'bg-stone-200 text-stone-950 border-stone-300'
        }`} title={capo > 0 && selectedFret > 0 && selectedFret < capo ? 'Abaixo do capo — não soa' : `Frete ${selectedFret}`}>
          {selectedFret}
        </span>

        {/* Braço */}
        <GuitarNeck selectedFret={selectedFret} capo={capo} onFretClick={setSelectedFret} />

        <div className="h-5 w-px bg-stone-800 shrink-0" />

        {/* Capo */}
        <div className="shrink-0 flex items-center gap-1">
          <span className="text-[10px] text-stone-500 mr-0.5 shrink-0">Capo:</span>
          {Array.from({ length: 8 }, (_, i) => (
            <button key={i} onClick={() => setCapo(i)}
              className={`w-6 h-6 rounded font-mono text-[11px] transition-colors ${
                capo === i ? 'bg-amber-400 text-stone-950 font-bold' : 'bg-stone-800/80 text-stone-400 hover:bg-stone-700'
              }`}>{i === 0 ? '—' : i}</button>
          ))}
        </div>
      </div>

      {/* ═══ Técnicas ═══ */}
      <div className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 border-b border-stone-800 bg-stone-900/10 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <span className="text-[10px] text-stone-600 shrink-0 mr-0.5">Técnica:</span>
        {(
          [
            { value: null,         label: 'Normal',   short: '●', color: 'text-stone-400' },
            { value: 'slide-up',   label: 'Slide ↑',  short: '/', color: 'text-amber-400' },
            { value: 'slide-down', label: 'Slide ↓',  short: '\\', color: 'text-amber-400' },
            { value: 'hammer',     label: 'Hammer-on', short: 'h', color: 'text-blue-400'  },
            { value: 'pull',       label: 'Pull-off',  short: 'p', color: 'text-purple-400'},
            { value: 'arpeggio',   label: 'Arpejo',    short: '⫰', color: 'text-emerald-400'},
            { value: 'mute',       label: 'Abafar',    short: 'x', color: 'text-red-400'},
          ] as Array<{ value: Technique | null; label: string; short: string; color: string }>
        ).map((t) => (
          <button key={String(t.value ?? 'normal')} onClick={() => setSelectedTech(t.value)}
            className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
              selectedTech === t.value ? 'bg-stone-200 text-stone-950 font-semibold' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
            }`}>
            <span className={`font-mono font-bold ${selectedTech === t.value ? 'text-stone-950' : t.color}`}>{t.short}</span>
            <span>{t.label}</span>
          </button>
        ))}
        {(selectedTech === 'slide-up' || selectedTech === 'slide-down') && (
          <>
            <span className="text-[10px] text-stone-500 ml-1 shrink-0">de frete:</span>
            <input type="number" min={0} max={MAX_FRET} value={slideToValue}
              onChange={(e) => setSlideToValue(Math.max(0, Math.min(MAX_FRET, Number(e.target.value))))}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-12 px-1.5 py-1 rounded-lg text-[11px] bg-stone-800 border border-amber-700/50 text-amber-300 font-mono outline-none focus:border-amber-500 shrink-0"
            />
            <span className="text-[11px] font-mono text-amber-400 shrink-0">
              {selectedTech === 'slide-up'
                ? `${slideToValue} / ${selectedFret}`
                : `${slideToValue} \\ ${selectedFret}`}
            </span>
          </>
        )}
        {selectedTech === 'mute' && (
          <>
            <span className="text-[10px] text-stone-500 ml-1 shrink-0">casas até abafar:</span>
            <input type="number" min={1} max={32} value={muteAfterValue}
              onChange={(e) => setMuteAfterValue(Math.max(1, Math.min(32, Number(e.target.value))))}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-12 px-1.5 py-1 rounded-lg text-[11px] bg-stone-800 border border-red-700/50 text-red-300 font-mono outline-none focus:border-red-500 shrink-0"
            />
          </>
        )}

        <div className="h-4 w-px bg-stone-800 mx-1 shrink-0" />

        {/* Subdivisão */}
        <button onClick={toggleSubdiv} title="Ativa células 1/16"
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
            subdivMode ? 'bg-stone-200 text-stone-950 font-semibold' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
          }`}>
          <span className={`font-mono font-bold text-[10px] ${subdivMode ? 'text-stone-950' : 'text-stone-500'}`}>1/16</span>
          <span>Subdivisão</span>
        </button>

        {/* Estrutura */}
        <button onClick={() => setStructureMode((v) => !v)} disabled={isPlaying} title="Modo estrutura"
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-colors disabled:opacity-40 ${
            structureMode ? 'bg-amber-400 text-stone-950 font-semibold' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
          }`}>
          <Columns2 className="w-3 h-3" />
          <span>Estrutura</span>
        </button>

        {/* Status do compasso */}
        <span className="ml-auto shrink-0 text-[10px] text-stone-600 font-mono">
          {(() => {
            const cpb = subdivMode ? 8 : 4;
            const bar = currentBeat !== null ? Math.floor(currentBeat / cpb) + 1 : null;
            const total = Math.ceil(beats / cpb);
            return bar !== null ? `Compasso ${bar} / ${total}` : `${total} compassos`;
          })()}
        </span>
      </div>

      {/* ─── Painel de Áudio colapsável ─── */}
      {showAudioPanel && (
        <div className="shrink-0 px-4 py-2.5 border-b border-stone-800 bg-stone-900/20">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-stone-500">Tom:</span>
              <div className="flex gap-1 flex-wrap">
                {Object.keys(KEY_ROOTS).map((k) => (
                  <button key={k} onClick={() => setKeyRoot(k)}
                    className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                      keyRoot === k ? 'bg-stone-200 text-stone-950 font-bold' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                    }`}>{k}</button>
                ))}
              </div>
              <div className="flex rounded overflow-hidden border border-stone-700">
                {(['major', 'minor'] as const).map((m) => (
                  <button key={m} onClick={() => setKeyMode(m)}
                    className={`px-2.5 py-1 text-xs transition-colors ${
                      keyMode === m ? 'bg-stone-400 text-stone-950 font-semibold' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                    }`}>{m === 'major' ? 'Maior' : 'Menor'}</button>
                ))}
              </div>
              <span className="text-xs text-stone-600 font-medium">
                {keyRoot} {keyMode === 'major' ? 'Maior' : 'Menor'}{capo > 0 ? ` · capo ${capo}` : ''}
              </span>
            </div>
            <div className="w-full border-t border-stone-800/60" />
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0] ?? null; setAudioFile(f); setTranscribeStatus(''); }}
            />
            <button onClick={() => fileInputRef.current?.click()} disabled={transcribing}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-300 bg-stone-800 border border-stone-700 rounded-lg hover:bg-stone-700 disabled:opacity-40 transition-colors">
              Escolher arquivo
            </button>
            {audioFile && <span className="text-xs text-stone-400 truncate max-w-[180px]">{audioFile.name}</span>}
            <button onClick={handleTranscribe} disabled={!audioFile || transcribing}
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-stone-950 bg-stone-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {transcribing ? <><Loader2 className="w-3 h-3 animate-spin" />Analisando…</> : 'Transcrever'}
            </button>
            {transcribing && (
              <div className="w-full">
                <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                  <div className="h-full bg-stone-400 rounded-full transition-all duration-300" style={{ width: transcribeProgress + '%' }} />
                </div>
                <p className="mt-1 text-xs text-stone-500">{transcribeStatus}</p>
              </div>
            )}
            {!transcribing && transcribeStatus && (
              <p className={`text-xs ${transcribeStatus.startsWith('⚠') ? 'text-red-400' : 'text-emerald-400'}`}>{transcribeStatus}</p>
            )}
          </div>
        </div>
      )}

      {/* ─── Grade TAB — ocupa todo o espaço restante ─── */}
      <div className="shrink-0 flex flex-col overflow-hidden px-3 pt-2 pb-1" style={{ height: 'calc(100vh - 260px)', minHeight: 220 }}>

        {/* Strip rolável */}
        <div
          ref={scrollRef}
          className={`shrink-0 overflow-x-scroll overflow-y-visible select-none ${structureMode ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
          style={{ scrollbarWidth: 'none', willChange: 'transform' }}
          onMouseDown={(e) => { if (!structureMode) onDragStart(e.clientX); }}
          onMouseMove={(e) => { if (!structureMode && e.buttons === 1) onDragMove(e.clientX); }}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
          onTouchStart={(e) => { if (!structureMode) onDragStart(e.touches[0].clientX); }}
          onTouchMove={(e) => { if (!structureMode) onDragMove(e.touches[0].clientX); }}
          onTouchEnd={onDragEnd}
        >
          {(() => {
            const colsPerBar = subdivMode ? 8 : 4;
            return (
          <div style={{ width: beats * 40 + 40, willChange: 'transform' }}>

            {/* Linha de acordes — um campo por beat */}
            <div className="flex mb-0.5">
              <div className="w-10 shrink-0 flex items-center justify-end pr-2">
                <span className="text-[10px] text-stone-600 select-none" title="Acorde">♭</span>
              </div>
              {Array.from({ length: beats }, (_, b) => {
                const isBarStart = b % colsPerBar === 0;
                const chord = chords[b];
                return (
                  <div key={b} className={`w-10 shrink-0 relative ${isBarStart ? 'border-l border-stone-800/30' : ''}`}>
                    <input
                      value={chord?.name ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setChords((prev) =>
                          val
                            ? { ...prev, [b]: { ...(prev[b] ?? {}), name: val } }
                            : Object.fromEntries(Object.entries(prev).filter(([k]) => Number(k) !== b))
                        );
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      placeholder=""
                      title={`Beat ${b + 1} — acorde`}
                      className={`w-full text-[11px] bg-transparent border-none outline-none font-bold py-0.5 px-0.5 truncate focus:overflow-visible focus:relative focus:z-20 transition-colors ${
                        chord?.name
                          ? 'text-amber-400 placeholder:text-stone-800'
                          : 'text-stone-800 placeholder:text-stone-900 focus:text-amber-300'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Cabeçalho de beats */}
            <div className="flex mb-1">
              <div className="w-10 shrink-0 relative">
                {structureMode && (
                  <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); insertBeat(0); }}
                    title="Inserir beat antes do 1º"
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-30 w-5 h-5 flex items-center justify-center rounded-full bg-emerald-900 border border-emerald-700 text-emerald-300 hover:bg-emerald-700 transition-all text-[10px] leading-none">+</button>
                )}
              </div>
              {Array.from({ length: beats }, (_, b) => {
                const isBarStart = b % colsPerBar === 0;
                const isSubBeat  = subdivMode && b % 2 === 1;
                const isStart    = b === startBeat;
                const isSelected = b === selectedBeat;
                return (
                  <div key={b}
                    onClick={() => { if (!isPlaying && !structureMode) setStartBeat(b); }}
                    title={isPlaying || structureMode ? undefined : `Iniciar daqui (beat ${b + 1})`}
                    className={`w-10 shrink-0 relative text-center text-xs font-mono transition-colors ${
                      structureMode ? '' : isPlaying ? '' : 'cursor-pointer hover:text-stone-300'
                    } ${
                      currentBeat === b ? 'text-stone-200 font-bold'
                      : isBarStart ? 'text-stone-500'
                      : isSubBeat ? 'text-stone-800'
                      : 'text-stone-700'
                    } ${isSelected && !structureMode ? 'bg-sky-900/30 rounded' : ''}`}
                  >
                    {structureMode ? (
                      <>
                        <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); deleteBeat(b); }}
                          title={`Remover beat ${b + 1}`}
                          className="w-full h-full flex items-center justify-center text-red-400 hover:text-red-200 hover:bg-red-900/30 rounded transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                        <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); insertBeat(b + 1); }}
                          title={`Inserir beat após ${b + 1}`}
                          className="absolute -right-2.5 top-1/2 -translate-y-1/2 z-30 w-5 h-5 flex items-center justify-center rounded-full bg-emerald-900 border border-emerald-700 text-emerald-300 hover:bg-emerald-700 transition-all text-[10px] leading-none">+</button>
                      </>
                    ) : (
                      <>
                        {isStart && (
                          <span className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                            <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-emerald-400" />
                            <span className="w-0.5 h-2.5 bg-emerald-400/70 rounded-full" />
                          </span>
                        )}
                        {isSelected && !isStart && (
                          <span className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                            <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-sky-400" />
                            <span className="w-0.5 h-2.5 bg-sky-400/60 rounded-full" />
                          </span>
                        )}
                        {isBarStart ? b / colsPerBar + 1 : isSubBeat ? <span className="text-[9px] text-stone-800">+</span> : '·'}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Linhas de cordas */}
            {Array.from({ length: STRING_COUNT }, (_, s) => (
              <div key={s} className="flex items-center">
                <div className="w-10 shrink-0 text-right pr-3 font-mono text-sm font-semibold text-stone-500 select-none">
                  {STRING_LABELS[s]}
                </div>
                {Array.from({ length: beats }, (_, b) => {
                  const cell = grid[b]?.[s] ?? null;
                  const isActive    = currentBeat === b;
                  const isStartBeat = b === startBeat && !isPlaying;
                  const hasNote     = cell !== null;
                  const fret        = cell?.fret ?? null;
                  const tech        = cell?.tech;
                  const cpb         = subdivMode ? 8 : 4;
                  const isMeasureStart = b % cpb === 0;
                  const isSubBeat   = subdivMode && b % 2 === 1;
                  const belowCapo   = hasNote && capo > 0 && fret! > 0 && fret! < capo;
                  const isSelected  = selectedBeat === b && selectedString === s;
                  const isInSel     = isInSelection(b);

                  return (
                    <button key={b}
                      onClick={(e) => {
                        if (e.shiftKey && selectedBeat !== null) {
                          // Shift+click — extend selection from current position
                          setSelAnchor((prev) => prev ?? selectedBeat);
                          setSelectedBeat(b);
                          setSelectedString(s);
                          return;
                        }
                        setSelAnchor(null);
                        setSelectedBeat(b);
                        setSelectedString(s);
                        setFretInputBuffer('');
                        if (!structureMode) {
                          const isSlideTech = selectedTech === 'slide-up' || selectedTech === 'slide-down';
                          const existingCell = gridRef.current[b][s];
                          if (isSlideTech && existingCell && (existingCell.tech === 'slide-up' || existingCell.tech === 'slide-down')) {
                            // Cell already has slide note — just select for inline editing, don't toggle off
                            const sep = existingCell.tech === 'slide-up' ? '/' : '\\';
                            setSlideEditValue(`${existingCell.slideTo ?? ''}${sep}${existingCell.fret}`);
                          } else {
                            toggleCell(b, s);
                            if (isSlideTech && existingCell === null) {
                              // Just created a slide note — init edit value
                              const sep = selectedTech === 'slide-up' ? '/' : '\\';
                              setSlideEditValue(`${slideToValue}${sep}${selectedFret}`);
                            }
                          }
                        }
                      }}
                      onMouseEnter={() => { if (!structureMode) setHoveredCell({ b, s }); }}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`w-10 shrink-0 relative flex items-center justify-center transition-colors select-none
                        ${isSubBeat ? 'h-7' : 'h-10'}
                        ${isMeasureStart ? 'border-l-2 border-stone-700' : isSubBeat ? 'border-l border-stone-800/20' : 'border-l border-stone-800/40'}
                        ${structureMode ? (b % 2 === 0 ? 'bg-stone-900/30' : '') : isActive ? 'bg-amber-500/20' : isSubBeat ? 'bg-stone-950/60 hover:bg-stone-900/60' : 'hover:bg-stone-800/40'}
                      `}
                    >
                      {isSelected && <span className="absolute inset-0 ring-2 ring-amber-400/70 rounded-sm pointer-events-none z-30" />}
                      {isInSel && !isSelected && <span className="absolute inset-0 bg-sky-500/20 pointer-events-none z-20" />}
                      {isStartBeat && <span className="absolute inset-y-0 left-0 w-0.5 bg-emerald-400/60 pointer-events-none z-20" />}
                      {isSubBeat && !hasNote && <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px border-t border-dashed border-stone-800/60 pointer-events-none" />}
                      {!isSubBeat && <div className={`absolute left-0 right-0 h-px pointer-events-none ${isActive ? 'bg-stone-500' : 'bg-stone-700/60'}`} />}
                      {!hasNote && hoveredCell?.b === b && hoveredCell?.s === s && (
                        <span className={`relative z-10 font-mono font-bold px-1 py-0.5 rounded-sm leading-none bg-stone-800 text-stone-500 opacity-70 ${isSubBeat ? 'text-[10px]' : 'text-xs'}`}>
                          {selectedFret}
                        </span>
                      )}
                      {hasNote && (() => {
                          const isSlide = tech === 'slide-up' || tech === 'slide-down';
                          // Inline editable input for slide cells
                          if (isSlide && isSelected) {
                            return (
                              <input
                                autoFocus
                                value={slideEditValue}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSlideEditValue(val);
                                  const fwdIdx = val.indexOf('/');
                                  const bwdIdx = val.indexOf('\\');
                                  const sepIdx = fwdIdx !== -1 ? fwdIdx : bwdIdx;
                                  if (sepIdx > 0) {
                                    const fromN = parseInt(val.slice(0, sepIdx), 10);
                                    const toN   = parseInt(val.slice(sepIdx + 1), 10);
                                    const slideTech: Technique = fwdIdx !== -1 ? 'slide-up' : 'slide-down';
                                    if (!isNaN(fromN) && !isNaN(toN) && fromN >= 0 && fromN <= MAX_FRET && toN >= 0 && toN <= MAX_FRET) {
                                      setGrid((prev) => {
                                        const next = prev.map((row) => [...row]);
                                        next[b][s] = { fret: toN, tech: slideTech, slideTo: fromN };
                                        return next;
                                      });
                                      setSlideToValue(fromN);
                                      setSelectedTech(slideTech);
                                    }
                                  } else {
                                    const fretN = parseInt(val, 10);
                                    if (!isNaN(fretN) && fretN >= 0 && fretN <= MAX_FRET) {
                                      setGrid((prev) => {
                                        const next = prev.map((row) => [...row]);
                                        const ex = next[b][s];
                                        if (ex) next[b][s] = { ...ex, fret: fretN };
                                        return next;
                                      });
                                    }
                                  }
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === 'Enter' || e.key === 'Escape') {
                                    e.preventDefault(); // prevent button click trigger on Enter
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                onFocus={(e) => e.target.select()}
                                className="absolute inset-0 w-full h-full text-center text-[9px] font-mono font-bold bg-amber-100 text-stone-950 outline-none border-2 border-amber-500 rounded-sm z-40 p-0"
                              />
                            );
                          }
                          const slideFrom = cell?.slideTo;
                          const slideLabel = isSlide
                            ? (slideFrom !== undefined ? `${slideFrom}${tech === 'slide-up' ? '/' : '\\'}${fret}` : `${tech === 'slide-up' ? '/' : '\\'}${fret}`)
                            : null;
                          return (
                          <span className={`relative z-10 font-mono font-bold px-1 py-0.5 rounded-sm leading-none ${
                            isSlide ? 'text-[9px]' : isSubBeat ? 'text-[10px]' : 'text-xs'
                          } ${
                            belowCapo ? 'bg-red-900/70 text-red-400 line-through'
                            : isSubBeat && !tech ? 'bg-stone-700 text-stone-300'
                            : tech === 'hammer' ? 'bg-blue-200 text-stone-950'
                            : tech === 'pull'   ? 'bg-purple-200 text-stone-950'
                            : isSlide ? 'bg-amber-200 text-stone-950'
                            : tech === 'arpeggio' ? 'bg-emerald-200 text-stone-950'
                            : tech === 'mute' ? 'bg-red-200 text-stone-950'
                            : isActive ? 'bg-amber-400 text-stone-950'
                            : 'bg-stone-200 text-stone-950'
                          }`}>
                            {isSlide
                              ? slideLabel
                              : <>{tech === 'hammer' ? 'h' : tech === 'pull' ? 'p' : tech === 'arpeggio' ? '⫰' : ''}{fret}{tech === 'mute' ? <span className="text-[8px] text-red-400">x{cell?.muteAfter}</span> : ''}</>}
                          </span>
                          );
                        })()}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Linha de letras */}
            <div className="flex items-stretch mt-1 pt-1 border-t border-stone-800/40">
              <div className="w-10 shrink-0 flex items-center justify-end pr-2">
                <span className="text-[10px] text-stone-600 select-none" title="Letra">♩</span>
              </div>
              {Array.from({ length: beats }, (_, b) => {
                const cpb = subdivMode ? 8 : 4;
                const isMeasureStart = b % cpb === 0;
                const isActive = currentBeat === b;
                const syllable = lyrics[b] ?? '';
                // Shrink font so syllable always fits in 40px cell (usable ≈ 36px, bold italic serif char ≈ 8px@13px)
                const lyricFs = syllable.length <= 4 ? 13 : Math.max(7, Math.floor((36 / syllable.length) * 1.55));
                return (
                  <div key={b} className={`w-10 shrink-0 relative flex items-center overflow-hidden ${isMeasureStart ? 'border-l border-stone-800/40' : ''} ${isActive && syllable ? 'bg-amber-500/10' : ''}`}>
                    <input
                      value={syllable}
                      onChange={(e) => setLyrics((prev) => ({ ...prev, [b]: e.target.value }))}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      placeholder=""
                      title={`Beat ${b + 1} — clique para digitar a sílaba cantada aqui`}
                      className={`w-full bg-transparent border-none outline-none font-serif italic font-bold leading-none py-1 px-0.5 focus:z-20 focus:relative transition-colors ${
                        isActive && syllable ? 'text-amber-300' : syllable ? 'text-amber-500' : 'text-stone-800 placeholder:text-stone-900'
                      }`}
                      style={{ fontSize: `${lyricFs}px` }}
                    />
                    {isActive && syllable && <span className="absolute bottom-0 left-0 right-0 h-px bg-amber-500/50 pointer-events-none" />}
                  </div>
                );
              })}
            </div>
          </div>
            );
          })()}
        </div>

        {/* Scrollbar de navegação da tab */}
        <div className="flex items-center gap-2 px-1 pt-1.5 pb-1">
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-stone-500 hover:text-amber-400 hover:bg-stone-800 transition-colors"
          >
            <ArrowLeft size={13} />
          </button>
          <input
            ref={scrollbarRef}
            type="range"
            min={0}
            max={1}
            step="any"
            defaultValue={0}
            className="tab-scrollbar flex-1"
          />
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-stone-500 hover:text-amber-400 hover:bg-stone-800 transition-colors"
          >
            <ArrowLeft size={13} className="rotate-180" />
          </button>
        </div>
      </div>

      {/* ═══ Tablatura Completa (preview para PDF) ═══ */}
      {(() => {
        const COLS_PER_LINE = subdivMode ? 64 : 32;
        const techSymbol = (cell: CellData): string => {
          if (!cell) return '-';
          const fretStr = String(cell.fret);
          if (cell.tech === 'slide-up') {
            const from = cell.slideTo !== undefined ? String(cell.slideTo) : '?';
            return `${from}/${fretStr}`;
          }
          if (cell.tech === 'slide-down') {
            const from = cell.slideTo !== undefined ? String(cell.slideTo) : '?';
            return `${from}\\${fretStr}`;
          }
          let s = fretStr;
          if (cell.tech === 'hammer') s += 'h';
          if (cell.tech === 'pull') s += 'p';
          if (cell.tech === 'arpeggio') s = '⫰' + s;
          if (cell.tech === 'mute') s = 'x' + s;
          return s;
        };
        const pad = (s: string, w: number) => s.length >= w ? s : s + '-'.repeat(w - s.length);

        // Group syllables into full words: uppercase = new word, lowercase = continuation
        const wordAtBeat: Record<number, string> = {};
        const isContinuation = new Set<number>();
        {
          let curWord = '';
          let curStart = -1;
          for (let b = 0; b < beats; b++) {
            const ly = (lyrics[b] || '').trim();
            if (!ly) continue;
            const startsUpper = ly[0] === ly[0].toUpperCase() && ly[0] !== ly[0].toLowerCase();
            if (startsUpper || curStart < 0) {
              if (curStart >= 0) wordAtBeat[curStart] = curWord;
              curStart = b;
              curWord = ly;
            } else {
              curWord += ly;
              isContinuation.add(b);
            }
          }
          if (curStart >= 0) wordAtBeat[curStart] = curWord;
        }

        const lines: { chordLine: string; strings: string[]; lyricsLine: string }[] = [];

        for (let start = 0; start < beats; start += COLS_PER_LINE) {
          const end = Math.min(start + COLS_PER_LINE, beats);
          let chordLine = '   ';
          const strings = STRING_LABELS.map((l) => l + '|');

          // Compute column widths based only on fret content (not word lengths)
          const colW: number[] = [];
          for (let b = start; b < end; b++) {
            let maxW = 1;
            for (let s = 0; s < STRING_COUNT; s++) {
              const cell = grid[b]?.[s];
              if (cell) maxW = Math.max(maxW, techSymbol(cell).length);
            }
            colW.push(Math.max(maxW + 1, 3));
          }

          for (let i = 0; i < end - start; i++) {
            const b = start + i;
            const w = colW[i];
            const ch = chords[b]?.name || '';
            chordLine += ch ? ch + ' '.repeat(Math.max(0, w - ch.length)) : ' '.repeat(w);
            for (let s = 0; s < STRING_COUNT; s++) {
              const cell = grid[b]?.[s];
              strings[s] += pad(cell ? techSymbol(cell) : '-', w);
            }
          }

          // Build lyrics line using position cursor — words appear at their beat's column offset
          // and flow naturally over continuation beats (which are blank)
          let lyricsLine = '   ';
          let cursorPos = 3; // same prefix width
          for (let i = 0; i < end - start; i++) {
            const b = start + i;
            const w = colW[i];
            const word = wordAtBeat[b];
            if (word) {
              // Pad to cursor position then write word
              while (lyricsLine.length < cursorPos) lyricsLine += ' ';
              lyricsLine += word;
            }
            // continuation beats: just advance cursor, write nothing
            cursorPos += w;
          }

          lines.push({ chordLine, strings: strings.map((s) => s + '|'), lyricsLine });
        }

        return (
          <div className="shrink-0 border-t border-stone-800">
            <button
              onClick={() => setTabPreviewOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-stone-800/40 transition-colors group"
            >
              <span className="text-sm font-semibold text-stone-400 group-hover:text-stone-200 transition-colors">📋 Tablatura Completa</span>
              <ChevronRight size={16} className={`text-stone-500 transition-transform duration-200 ${tabPreviewOpen ? 'rotate-90' : ''}`} />
            </button>
            {tabPreviewOpen && (
            <div id="tab-preview" className="bg-stone-950 mx-4 mb-4 rounded-lg p-5 font-mono text-xs leading-[18px] text-stone-400 whitespace-pre overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
              {lines.map((line, i) => (
                <div key={i} className="mb-6">
                  {line.chordLine.trim() && <div className="text-amber-400 font-bold">{line.chordLine}</div>}
                  {line.strings.map((s, si) => <div key={si}>{s}</div>)}
                  {line.lyricsLine.trim() && <div className="text-emerald-400 italic mt-0.5">{line.lyricsLine}</div>}
                </div>
              ))}
            </div>
            )}
          </div>
        );
      })()}

      {/* ═══ Cifra (Letra + Acordes) para PDF ═══ */}
      {(() => {
        // Auto-generate cifra text from grid data
        const generateCifra = (): string => {
          type Token = { text: string; chord: string };
          const tokens: Token[] = [];
          let activeChord = '';

          // Collect raw syllables/lyrics per beat
          const rawParts: { text: string; chord: string }[] = [];
          for (let b = 0; b < beats; b++) {
            const ch = chords[b]?.name || '';
            const ly = lyrics[b] || '';
            if (ch) activeChord = ch;
            if (ly) {
              const trimmed = ly.trim();
              if (trimmed) {
                rawParts.push({ text: trimmed, chord: ch || (rawParts.length === 0 ? activeChord : '') });
              }
            } else if (ch) {
              rawParts.push({ text: '', chord: ch });
            }
          }

          // Join syllables into words: uppercase first letter = start of new word
          for (let i = 0; i < rawParts.length; i++) {
            const part = rawParts[i];
            const isWordStart = part.text.length > 0 && part.text[0] === part.text[0].toUpperCase() && part.text[0] !== part.text[0].toLowerCase();
            // If not a word start and previous token has text, merge into previous
            if (!isWordStart && part.text && tokens.length > 0 && tokens[tokens.length - 1].text) {
              tokens[tokens.length - 1].text += part.text;
              // If this part has a chord assigning, keep it on a merged token only if previous had none
              if (part.chord && !tokens[tokens.length - 1].chord) {
                tokens[tokens.length - 1].chord = part.chord;
              }
            } else {
              tokens.push({ text: part.text, chord: part.chord });
            }
          }

          const lines: string[] = [];
          let cLine = '';
          let lLine = '';
          let lastChordEmitted = '';

          const flush = () => {
            if (cLine || lLine) {
              if (cLine.trim()) lines.push(cLine.trimEnd());
              lines.push(lLine.trimEnd());
              lines.push('');
              cLine = '';
              lLine = '';
            }
          };

          for (const tk of tokens) {
            const word = tk.text || '';
            const chord = tk.chord;
            const needChord = chord && chord !== lastChordEmitted;
            const minWidth = Math.max(word.length, needChord ? chord.length : 0) + 1;
            if (lLine.length + minWidth > 80 && lLine.length > 0) flush();
            while (cLine.length < lLine.length) cLine += ' ';
            if (needChord) { cLine += chord; lastChordEmitted = chord; }
            lLine += word.padEnd(minWidth);
          }
          flush();

          return lines.join('\n').trimEnd();
        };

        // Auto-sync: regenerate when not manually edited
        const generated = generateCifra();
        if (!cifraEdited && generated !== cifraText) {
          // Schedule state update after render
          setTimeout(() => setCifraText(generated), 0);
        }

        const hasContent = cifraEdited ? cifraText.trim().length > 0 : generated.trim().length > 0;
        const displayText = cifraEdited ? cifraText : generated;

        return hasContent || cifraEdited ? (
          <div className="shrink-0 border-t border-stone-800">
            <button
              onClick={() => setCifraOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-stone-800/40 transition-colors group"
            >
              <span className="text-sm font-semibold text-stone-400 group-hover:text-stone-200 transition-colors">🎵 Cifra (Letra + Acordes)</span>
              <ChevronRight size={16} className={`text-stone-500 transition-transform duration-200 ${cifraOpen ? 'rotate-90' : ''}`} />
            </button>
            {cifraOpen && (
            <div className="px-4 pb-4">
              {cifraEdited && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => { setCifraEdited(false); setCifraText(generated); }}
                    className="text-xs px-3 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 transition-colors"
                  >
                    ↻ Regerar da tab
                  </button>
                </div>
              )}
              <textarea
                id="cifra-preview"
                value={displayText}
                onChange={(e) => { setCifraText(e.target.value); setCifraEdited(true); }}
                spellCheck={false}
                className="w-full bg-stone-950 rounded-lg p-5 font-mono text-sm leading-relaxed text-stone-300 overflow-x-auto resize-y outline-none border border-stone-800 focus:border-amber-500/50 transition-colors"
                style={{ scrollbarWidth: 'thin', minHeight: '200px', whiteSpace: 'pre', overflowWrap: 'normal' }}
                rows={Math.max(8, displayText.split('\n').length + 2)}
              />
            </div>
            )}
          </div>
        ) : null;
      })()}

    </div>
  );
};

export default TabmakerPage;
