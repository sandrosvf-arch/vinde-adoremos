import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { Play, Pause, Trash2, ArrowLeft, Loader2, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';

// Standard guitar tuning — open string MIDI (string 0 = high e)
const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];
const OPEN_MIDI = [64, 59, 55, 50, 45, 40];
const STRING_COUNT = 6;
const DEFAULT_BEATS = 16;

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

type Technique = 'slide-up' | 'slide-down' | 'hammer' | 'pull';
type CellData = { fret: number; tech?: Technique } | null;
type Grid = CellData[][];
function emptyGrid(beats = DEFAULT_BEATS): Grid {
  return Array.from({ length: beats }, () => Array(STRING_COUNT).fill(null));
}

const BASE_URL =
  'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_guitar_nylon-mp3/';

// ── Guitar neck visual ──────────────────────────────────────────────────────
const OPEN_W  = 38;   // width of open string (fret 0) section
const NUT_W   = 9;    // nut bar width
const SECT_W  = 46;   // width of each fret section 1-12
const NECK_H  = 86;
const STR_TOP = 16;   // y of string e
const STR_GAP = 10;   // gap between strings
const STR_THICK = [0.7, 0.9, 1.15, 1.5, 1.9, 2.5];
const DOT_FRETS  = [5, 7, 9];
const NECK_FRETS = 12;

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
    if (fret < capo || fret > 12) continue;
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
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [beats, setBeats] = useState(DEFAULT_BEATS);
  const [subdivMode, setSubdivMode] = useState(false);
  const subdivModeRef = useRef(false);
  subdivModeRef.current = subdivMode;
  const [lyrics, setLyrics] = useState<Record<number, string>>({});
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const [bpm, setBpm] = useState(80);
  const [selectedFret, setSelectedFret] = useState(0);
  const [selectedTech, setSelectedTech] = useState<Technique | null>(null);
  const [capo, setCapo] = useState(0);
  const [hoveredCell, setHoveredCell] = useState<{ b: number; s: number } | null>(null);
  const [keyRoot, setKeyRoot] = useState<string>('E');
  const [keyMode, setKeyMode] = useState<'major' | 'minor'>('minor');
  const keyRootRef = useRef(keyRoot);
  keyRootRef.current = keyRoot;
  const keyModeRef = useRef(keyMode);
  keyModeRef.current = keyMode;

  // Continuous drag-to-scroll on grid
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);

  const onDragStart = useCallback((clientX: number) => {
    dragRef.current = { startX: clientX, startScrollLeft: scrollRef.current?.scrollLeft ?? 0 };
  }, []);

  const onDragMove = useCallback((clientX: number) => {
    if (!dragRef.current || !scrollRef.current) return;
    const dx = dragRef.current.startX - clientX;
    scrollRef.current.scrollLeft = dragRef.current.startScrollLeft + dx;
  }, []);

  const onDragEnd = useCallback(() => {
    dragRef.current = null;
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

  // Metronome
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [metroBeat, setMetroBeat] = useState(-1);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const metroSeqRef = useRef<Tone.Sequence<number> | null>(null);
  const metroSynthRef = useRef<Tone.Synth | null>(null);
  const metronomeOnRef = useRef(metronomeOn);
  metronomeOnRef.current = metronomeOn;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

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

  const samplerRef = useRef<Tone.Sampler | null>(null);
  const seqRef = useRef<Tone.Sequence<number> | null>(null);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const capoRef = useRef(capo);
  capoRef.current = capo;

  // Load nylon guitar samples with soft audio chain
  useEffect(() => {
    // Lowpass filter — cuts harsh highs for a warmer nylon tone
    const filter = new Tone.Filter({
      frequency: 4000,
      type: 'lowpass',
      rolloff: -24,
    });

    // Subtle reverb — small room for natural resonance
    const reverb = new Tone.Reverb({ decay: 1.4, wet: 0.18 });

    // Volume — slightly attenuated
    const vol = new Tone.Volume(-3);

    // Chain: sampler → filter → reverb → vol → output
    filter.chain(reverb, vol, Tone.getDestination());

    const sampler = new Tone.Sampler({
      urls: {
        E2: 'E2.mp3',
        A2: 'A2.mp3',
        D3: 'D3.mp3',
        G3: 'G3.mp3',
        B3: 'B3.mp3',
        E4: 'E4.mp3',
        A4: 'A4.mp3',
      },
      baseUrl: BASE_URL,
      release: 2.5,   // slow natural decay, like a plucked nylon string
      onload: () => setIsLoaded(true),
    }).connect(filter);

    samplerRef.current = sampler;

    return () => {
      Tone.getTransport().stop();
      seqRef.current?.dispose();
      sampler.dispose();
      filter.dispose();
      reverb.dispose();
      vol.dispose();
      metroSeqRef.current?.dispose();
      metroSynthRef.current?.dispose();
    };
  }, []);

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
        if (newBpm >= 40 && newBpm <= 200) setBpm(newBpm);
      }
      return recent;
    });
  }, []);

  const toggleCell = (beat: number, string: number) => {
    setGrid((prev) => {
      const next = prev.map((b) => [...b]);
      next[beat][string] = next[beat][string] !== null ? null : { fret: selectedFret, tech: selectedTech ?? undefined };
      return next;
    });
  };

  const play = async () => {
    if (!samplerRef.current || !isLoaded) return;
    await Tone.start();

    const transport = Tone.getTransport();
    transport.bpm.value = bpm;

    const beatIndices = Array.from({ length: grid.length }, (_, i) => i);
    const seq = new Tone.Sequence<number>(
      (time, beat) => {
        setCurrentBeat(beat);
        const col = gridRef.current[beat];
        col.forEach((cell, s) => {
          if (cell !== null && samplerRef.current?.loaded) {
            const duration = s <= 2 ? '8n' : '4n';
            const note = noteAtFret(s, cell.fret);
            const sampler = samplerRef.current!;
            switch (cell.tech) {
              case 'hammer':
                // Hammer-on: softer attack — finger falls onto fret without pick
                sampler.triggerAttackRelease(note, duration, time, 0.45);
                break;
              case 'pull':
                // Pull-off: even softer, slight delay simulation
                sampler.triggerAttackRelease(note, duration, time, 0.35);
                break;
              case 'slide-up': {
                // Slide up: briefly sound 2 semitones below, then target note
                const slideOffset = Tone.Time('32n').toSeconds();
                const fromNote = noteAtFret(s, Math.max(0, cell.fret - 2));
                sampler.triggerAttackRelease(fromNote, '32n', time, 0.5);
                sampler.triggerAttackRelease(note, duration, time + slideOffset, 1.0);
                break;
              }
              case 'slide-down': {
                // Slide down: briefly sound 2 semitones above, then target note
                const slideOffset = Tone.Time('32n').toSeconds();
                const fromNote = noteAtFret(s, cell.fret + 2);
                sampler.triggerAttackRelease(fromNote, '32n', time, 0.5);
                sampler.triggerAttackRelease(note, duration, time + slideOffset, 1.0);
                break;
              }
              default:
                sampler.triggerAttackRelease(note, duration, time);
            }
          }
        });
      },
      beatIndices,
      subdivModeRef.current ? '16n' : '8n'
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

  const reset = () => {
    stop();
    setBeats(DEFAULT_BEATS);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    setDetectedBpm(null);
    setGrid(emptyGrid(DEFAULT_BEATS));
    setLyrics({});
    setSubdivMode(false);
  };

  return (
    <div className="min-h-screen bg-[#060607] text-stone-200 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/"
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-stone-900 border border-stone-800 hover:border-stone-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-stone-400" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-stone-100">Tabmaker</h1>
            <p className="text-xs text-stone-500">Violão de Nylon</p>
          </div>

          <div className="ml-auto">
            {!isLoaded ? (
              <div className="flex items-center gap-2 text-xs text-stone-500 bg-stone-900 border border-stone-800 px-3 py-1.5 rounded-lg">
                <Loader2 className="w-3 h-3 animate-spin" />
                Carregando samples…
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 px-3 py-1.5 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Pronto para tocar
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-stone-900/40 border border-stone-800 rounded-xl">

          {/* ── Importar Áudio ── */}
          <div className="mb-4 p-4 bg-stone-900/40 border border-stone-800 rounded-xl w-full">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium text-stone-400">Importar Áudio</span>
              <span className="text-xs text-stone-600">— a IA detecta as notas e preenche a grade automaticamente</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">

              {/* Key selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-stone-500">Tom:</span>
                <div className="flex gap-1 flex-wrap">
                  {Object.keys(KEY_ROOTS).map((k) => (
                    <button
                      key={k}
                      onClick={() => setKeyRoot(k)}
                      className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                        keyRoot === k
                          ? 'bg-stone-200 text-stone-950 font-bold'
                          : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="flex rounded overflow-hidden border border-stone-700">
                  {(['major', 'minor'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setKeyMode(m)}
                      className={`px-2.5 py-1 text-xs transition-colors ${
                        keyMode === m
                          ? 'bg-stone-400 text-stone-950 font-semibold'
                          : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                      }`}
                    >
                      {m === 'major' ? 'Maior' : 'Menor'}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-stone-600 font-medium">
                  {keyRoot} {keyMode === 'major' ? 'Maior' : 'Menor'}
                  {capo > 0 ? ` · capo ${capo}` : ''}
                </span>
              </div>

              <div className="w-full border-t border-stone-800/60 my-1" />

              {/* File picker */}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setAudioFile(f);
                  setTranscribeStatus('');
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={transcribing}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-300 bg-stone-800 border border-stone-700 rounded-lg hover:bg-stone-700 disabled:opacity-40 transition-colors"
              >
                <span>Escolher arquivo</span>
              </button>

              {audioFile && (
                <span className="text-xs text-stone-400 truncate max-w-[180px]">
                  {audioFile.name}
                </span>
              )}

              <button
                onClick={handleTranscribe}
                disabled={!audioFile || transcribing}
                className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-stone-950 bg-stone-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {transcribing ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Analisando…</>
                ) : (
                  'Transcrever'
                )}
              </button>
            </div>

            {/* Progress bar */}
            {transcribing && (
              <div className="mt-3">
                <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-stone-400 rounded-full transition-all duration-300"
                    style={{ width: transcribeProgress + '%' }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-stone-500">{transcribeStatus}</p>
              </div>
            )}

            {/* Status message when done */}
            {!transcribing && transcribeStatus && (
              <p className={`mt-2 text-xs ${
                transcribeStatus.startsWith('⚠') ? 'text-red-400' : 'text-emerald-400'
              }`}>{transcribeStatus}</p>
            )}
          </div>

          {/* Capo selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-stone-500 mr-1">Capotraste:</span>
            {Array.from({ length: 8 }, (_, i) => (
              <button
                key={i}
                onClick={() => setCapo(i)}
                className={`w-7 h-7 rounded font-mono text-xs transition-colors ${
                  capo === i
                    ? 'bg-amber-400 text-stone-950 font-bold'
                    : 'bg-stone-800/80 text-stone-400 hover:bg-stone-700'
                }`}
              >
                {i === 0 ? '—' : i}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-stone-400 bg-stone-900 border border-stone-800 rounded-lg hover:border-stone-700 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar
            </button>

            <button
              onClick={handlePlayPause}
              disabled={!isLoaded}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                isPlaying
                  ? 'bg-stone-700 text-stone-200 hover:bg-stone-600'
                  : 'bg-stone-200 text-stone-950 hover:bg-white'
              }`}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isPlaying ? 'Parar' : 'Tocar'}
            </button>
          </div>
        </div>

        {/* ── Metrônomo ── */}
        <div className="mb-4 p-4 bg-stone-900/40 border border-stone-800 rounded-xl">
          <div className="flex flex-wrap items-center gap-4">

            {/* Toggle */}
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-stone-500" />
              <span className="text-xs text-stone-500 font-medium">Metrônomo</span>
              <button
                onClick={toggleMetronome}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ${
                  metronomeOn ? 'border-stone-400 bg-stone-400' : 'border-stone-700 bg-stone-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-stone-950 shadow transition-transform duration-200 ${
                    metronomeOn ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="h-5 w-px bg-stone-800" />

            {/* Beat visualizer — 4 dots */}
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3].map((b) => {
                const isActive = metroBeat === b && metronomeOn;
                const isDown   = b === 0;
                return (
                  <div
                    key={b}
                    className={`rounded-full transition-all duration-75 ${
                      isActive
                        ? isDown
                          ? 'bg-stone-100 shadow-[0_0_8px_2px_rgba(255,255,255,0.3)]'
                          : 'bg-stone-400'
                        : isDown
                        ? 'bg-stone-700 border border-stone-600'
                        : 'bg-stone-800'
                    }`}
                    style={{
                      width:  isDown ? 18 : 14,
                      height: isDown ? 18 : 14,
                    }}
                  />
                );
              })}
            </div>

            <div className="h-5 w-px bg-stone-800" />

            {/* BPM counter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBpm((v) => Math.max(40, v - 1))}
                className="w-6 h-6 rounded bg-stone-800 text-stone-400 hover:bg-stone-700 flex items-center justify-center text-sm font-bold leading-none"
              >−</button>
              <span className="w-10 text-center text-lg font-mono font-bold text-stone-200 tabular-nums">
                {bpm}
              </span>
              <button
                onClick={() => setBpm((v) => Math.min(200, v + 1))}
                className="w-6 h-6 rounded bg-stone-800 text-stone-400 hover:bg-stone-700 flex items-center justify-center text-sm font-bold leading-none"
              >+</button>
              <span className="text-xs text-stone-600 ml-1">BPM</span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={40}
              max={200}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-28 accent-stone-400 cursor-pointer"
            />

            <div className="h-5 w-px bg-stone-800" />

            {/* Tap tempo */}
            <button
              onClick={handleTap}
              className="px-3 py-1.5 text-xs font-medium text-stone-300 bg-stone-800 border border-stone-700 rounded-lg hover:bg-stone-700 active:scale-95 transition-all select-none"
            >
              Tap Tempo
            </button>

            {/* Detected BPM badge */}
            {detectedBpm !== null && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-900/50">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs text-emerald-400">BPM detectado do áudio: <strong>{detectedBpm}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Guitar neck fret selector */}
        <div className="mb-4 p-4 bg-stone-900/40 border border-stone-800 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-stone-500">① Selecione o frete no braço</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-600">Frete selecionado:</span>
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded font-mono text-sm font-bold ${
                capo > 0 && selectedFret > 0 && selectedFret < capo
                  ? 'bg-red-900/60 text-red-400 border border-red-800'
                  : 'bg-stone-200 text-stone-950'
              }`}>
                {selectedFret}
              </span>
              {capo > 0 && selectedFret > 0 && selectedFret < capo && (
                <span className="text-xs text-red-400">abaixo do capo — não soa</span>
              )}
              {capo > 0 && (selectedFret === 0 || selectedFret >= capo) && (
                <span className="text-xs text-stone-600">
                  {selectedFret === 0 ? 'corda solta' : `casa ${selectedFret}`}
                </span>
              )}
            </div>
          </div>
          <GuitarNeck
            selectedFret={selectedFret}
            capo={capo}
            onFretClick={setSelectedFret}
          />
        </div>

        {/* Technique + subdivision selector */}
        <div className="mb-3 px-3 py-2 rounded-lg bg-stone-900/40 border border-stone-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-stone-500">Técnica:</span>
            {(
              [
                { value: null,          label: 'Normal',    short: '●', color: 'text-stone-400' },
                { value: 'slide-up',    label: 'Slide ↑',   short: '/', color: 'text-amber-400' },
                { value: 'slide-down',  label: 'Slide ↓',   short: '\\', color: 'text-amber-400' },
                { value: 'hammer',      label: 'Hammer-on', short: 'h', color: 'text-blue-400'  },
                { value: 'pull',        label: 'Pull-off',  short: 'p', color: 'text-purple-400'},
              ] as Array<{ value: Technique | null; label: string; short: string; color: string }>
            ).map((t) => (
              <button
                key={String(t.value ?? 'normal')}
                onClick={() => setSelectedTech(t.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  selectedTech === t.value
                    ? 'bg-stone-200 text-stone-950 font-semibold'
                    : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                }`}
              >
                <span className={`font-mono font-bold ${
                  selectedTech === t.value ? 'text-stone-950' : t.color
                }`}>{t.short}</span>
                <span>{t.label}</span>
              </button>
            ))}

            <div className="h-4 w-px bg-stone-800 mx-1" />

            {/* Subdivision toggle */}
            <button
              onClick={toggleSubdiv}
              title="Ativa células de semicolcheia (1/16) entre cada tempo — para notas de passagem, ornamentos e contratempos"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                subdivMode
                  ? 'bg-stone-200 text-stone-950 font-semibold'
                  : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
              }`}
            >
              <span className={`font-mono font-bold text-[10px] ${subdivMode ? 'text-stone-950' : 'text-stone-500'}`}>1/16</span>
              <span>Subdivisão</span>
            </button>
          </div>
          {subdivMode && (
            <p className="mt-1.5 text-[11px] text-stone-600">
              Células menores <span className="text-stone-500">(entre os tempos)</span> são as notas de passagem — semicolcheias.
              Perfeitas para ornamentos, ghost notes e contratempos do fingerstyle.
            </p>
          )}
        </div>

        {/* Step 2 hint */}
        <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-stone-900/40 border border-stone-800">
          <span className="text-xs text-stone-500 leading-relaxed">
            <strong className="text-stone-400">② Clique nas células da grade</strong> para colocar o frete {selectedFret} na corda e batida desejadas.
            Para um <strong className="text-stone-400">acorde ou pinçada</strong> (várias cordas juntas), clique em múltiplas células <em>da mesma coluna</em> (mesmo número de batida).
            Clique novamente para remover.
          </span>
        </div>

        {/* Tablature grid */}
        <div className="rounded-xl border border-stone-800 bg-stone-950 p-4">

          {/* Top bar: capo info + compass counter */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            {capo > 0 ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-xs text-amber-400 font-medium">Capotraste no frete {capo}</span>
              </div>
            ) : <div />}
            <span className="text-xs text-stone-600 font-mono">
              {(() => {
                const cpb = subdivMode ? 8 : 4;
                const bar = currentBeat !== null ? Math.floor(currentBeat / cpb) + 1 : null;
                const total = Math.ceil(beats / cpb);
                return bar !== null
                  ? `Compasso ${bar} / ${total}${subdivMode ? ' · 1/16' : ''}`
                  : `${total} compassos · arraste para navegar${subdivMode ? ' · modo 1/16' : ''}`;
              })()}
            </span>
          </div>

          {/* Scrollable continuous strip */}
          <div
            ref={scrollRef}
            className="overflow-x-hidden cursor-grab active:cursor-grabbing select-none"
            style={{ scrollbarWidth: 'none' }}
            onMouseDown={(e) => onDragStart(e.clientX)}
            onMouseMove={(e) => { if (e.buttons === 1) onDragMove(e.clientX); }}
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}
            onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
            onTouchMove={(e) => onDragMove(e.touches[0].clientX)}
            onTouchEnd={onDragEnd}
          >
            {/* colsPerBar: 8 cols in 16th mode, 4 cols in 8th mode */}
            {(() => {
              const colsPerBar = subdivMode ? 8 : 4;
              return (
            <div style={{ width: beats * 40 + 40 }}>
              {/* Beat header */}
              <div className="flex mb-1">
                <div className="w-10 shrink-0" />
                {Array.from({ length: beats }, (_, b) => {
                  const isBarStart  = b % colsPerBar === 0;
                  const isMainBeat  = !subdivMode || b % 2 === 0;
                  const isSubBeat   = subdivMode && b % 2 === 1;
                  return (
                    <div
                      key={b}
                      className={`w-10 shrink-0 text-center text-xs font-mono transition-colors ${
                        currentBeat === b
                          ? 'text-stone-200 font-bold'
                          : isBarStart
                          ? 'text-stone-500'
                          : isSubBeat
                          ? 'text-stone-800'
                          : 'text-stone-700'
                      }`}
                    >
                      {isBarStart
                        ? b / colsPerBar + 1
                        : isSubBeat
                        ? <span className="text-[9px] text-stone-800">+</span>
                        : '·'}
                    </div>
                  );
                })}
              </div>

              {/* String rows — full length */}
              {Array.from({ length: STRING_COUNT }, (_, s) => (
                <div key={s} className="flex items-center">
                  <div className="w-10 shrink-0 text-right pr-3 font-mono text-sm font-semibold text-stone-500 select-none">
                    {STRING_LABELS[s]}
                  </div>

                  {/* Cells — full continuous strip */}
                  {Array.from({ length: beats }, (_, b) => {
                    const cell = grid[b]?.[s] ?? null;
                    const isActive = currentBeat === b;
                    const hasNote = cell !== null;
                    const fret = cell?.fret ?? null;
                    const tech = cell?.tech;
                    const colsPerBar = subdivMode ? 8 : 4;
                    const isMeasureStart = b % colsPerBar === 0;
                    const isSubBeat = subdivMode && b % 2 === 1;
                    const belowCapo = hasNote && capo > 0 && fret! > 0 && fret! < capo;

                    return (
                      <button
                        key={b}
                        onClick={() => toggleCell(b, s)}
                        onMouseEnter={() => setHoveredCell({ b, s })}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`w-10 shrink-0 relative flex items-center justify-center transition-colors select-none
                          ${isSubBeat ? 'h-7' : 'h-10'}
                          ${isMeasureStart ? 'border-l-2 border-stone-700' : isSubBeat ? 'border-l border-stone-800/20' : 'border-l border-stone-800/40'}
                          ${isActive ? 'bg-stone-800/70' : isSubBeat ? 'bg-stone-950/60 hover:bg-stone-900/60' : 'hover:bg-stone-800/40'}
                        `}
                      >
                        {/* Sub-beat marker line */}
                        {isSubBeat && !hasNote && (
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px border-t border-dashed border-stone-800/60 pointer-events-none" />
                        )}
                        {!isSubBeat && (
                          <div className={`absolute left-0 right-0 h-px pointer-events-none ${
                            isActive ? 'bg-stone-500' : 'bg-stone-700/60'
                          }`} />
                        )}
                        {!hasNote && hoveredCell?.b === b && hoveredCell?.s === s && (
                          <span className={`relative z-10 font-mono font-bold px-1 py-0.5 rounded-sm leading-none bg-stone-800 text-stone-500 opacity-70 ${
                            isSubBeat ? 'text-[10px]' : 'text-xs'
                          }`}>
                            {selectedFret}
                          </span>
                        )}
                        {hasNote && (
                          <span className={`relative z-10 font-mono font-bold px-1 py-0.5 rounded-sm leading-none ${
                            isSubBeat ? 'text-[10px]' : 'text-xs'
                          } ${
                            belowCapo
                              ? 'bg-red-900/70 text-red-400 line-through'
                              : isSubBeat && !tech
                              ? 'bg-stone-700 text-stone-300'
                              : tech === 'hammer'
                              ? 'bg-blue-200 text-stone-950'
                              : tech === 'pull'
                              ? 'bg-purple-200 text-stone-950'
                              : tech === 'slide-up' || tech === 'slide-down'
                              ? 'bg-amber-200 text-stone-950'
                              : isActive
                              ? 'bg-stone-300 text-stone-950'
                              : 'bg-stone-200 text-stone-950'
                          }`}>
                            {tech === 'slide-up' ? '/' : tech === 'slide-down' ? '\\' : tech === 'hammer' ? 'h' : tech === 'pull' ? 'p' : ''}{fret}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              {/* ── Lyrics row — uma sílaba por coluna, alinhada ao beat ── */}
              <div className="flex items-stretch mt-1 pt-1 border-t border-stone-800/40">
                <div className="w-10 shrink-0 flex items-center justify-end pr-2">
                  <span className="text-[10px] text-stone-600 select-none" title="Letra">♩</span>
                </div>
                {Array.from({ length: beats }, (_, b) => {
                  const colsPerBar = subdivMode ? 8 : 4;
                  const isMeasureStart = b % colsPerBar === 0;
                  const isActive = currentBeat === b;
                  const syllable = lyrics[b] ?? '';
                  return (
                    <div
                      key={b}
                      className={`w-10 shrink-0 relative flex items-center overflow-visible
                        ${isMeasureStart ? 'border-l border-stone-800/40' : ''}
                        ${isActive && syllable ? 'bg-amber-500/10' : ''}
                      `}
                    >
                      <input
                        value={syllable}
                        onChange={(e) =>
                          setLyrics((prev) => ({ ...prev, [b]: e.target.value }))
                        }
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        placeholder=""
                        title={`Beat ${b + 1} — clique para digitar a sílaba cantada aqui`}
                        className={`w-full text-[11px] bg-transparent border-none outline-none font-serif italic leading-none py-1 px-0.5 truncate focus:overflow-visible focus:z-10 focus:relative transition-colors ${
                          isActive && syllable
                            ? 'text-amber-300 font-semibold'
                            : syllable
                            ? 'text-stone-400'
                            : 'text-stone-800 placeholder:text-stone-900'
                        }`}
                      />
                      {/* Active beat underline */}
                      {isActive && syllable && (
                        <span className="absolute bottom-0 left-0 right-0 h-px bg-amber-500/50 pointer-events-none" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
              );
            })()}
          </div>
        </div>

        <p className="mt-3 text-xs text-stone-600 text-center">
          Para <strong className="text-stone-500">acorde/pinçada</strong>: clique em várias cordas na <strong className="text-stone-500">mesma coluna</strong> (mesma batida)
        </p>
      </div>
    </div>
  );
};

export default TabmakerPage;
