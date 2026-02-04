import React, { useRef, useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Play, Square, Volume2, VolumeX, Radio, Mic, AlertCircle, 
  Settings, X, Loader2, RadioTower, Trash2, Sun, Moon, Palette,
  FileDown, Check, Share2, PlusCircle, Star, PlayCircle, FileUp, Sparkles, CalendarClock, Clock
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// --- TYPES ---
interface Station {
  id: string;
  name: string;
  url: string;
  addedAt: number;
  favorite?: boolean;
}

// --- CONFIG & CONSTANTS ---
const STORAGE_KEY = 'wavetuner_final_v3';
const THEME_KEY = 'wavetuner_theme_v3';
const QUALITY_STORAGE_KEY = 'wavetuner_quality_v3';
const APP_VERSION = "2.6.8";

declare const lamejs: any;

const RECORDING_QUALITIES = [
    { id: 'std', label: 'Estándar (128 kbps)', bits: 128 },
    { id: 'high', label: 'Alta (192 kbps)', bits: 192 },
    { id: 'max', label: 'Máxima (320 kbps)', bits: 320 },
];

const DEFAULT_STATIONS: Station[] = [
  { id: '1', name: 'Radio Paradise', url: 'https://stream.radioparadise.com/mp3-128', addedAt: Date.now(), favorite: true },
  { id: '2', name: 'SomaFM Groove Salad', url: 'https://ice1.somafm.com/groovesad-128-mp3', addedAt: Date.now() + 1 },
];

// --- COMPONENTS ---

const Visualizer = ({ isPlaying }: { isPlaying: boolean }) => (
  <div className="flex items-end justify-center gap-1 h-8 w-24 mb-4">
      {[...Array(12)].map((_, i) => (
          <div 
              key={i} 
              className={`visualizer-bar ${isPlaying ? 'animate-bar-grow' : 'h-[10%]'}`}
              style={{ animationDelay: `${i * 0.1}s` }}
          />
      ))}
  </div>
);

const RadioPlayer = ({ station, onThemeToggle, currentTheme, allStations, onStationSelect }: { 
  station: Station | null; 
  onThemeToggle: () => void; 
  currentTheme: 'dark' | 'light';
  allStations: Station[];
  onStationSelect: (s: Station) => void;
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mp3EncoderRef = useRef<any>(null);
  const mp3DataRef = useRef<Int8Array[]>([]);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const mediaSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [recordingQuality, setRecordingQuality] = useState(() => {
    return parseInt(localStorage.getItem(QUALITY_STORAGE_KEY) || "192");
  });

  const timerRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem(QUALITY_STORAGE_KEY, recordingQuality.toString());
  }, [recordingQuality]);

  useEffect(() => {
    if (audioRef.current && station) {
        audioRef.current.src = station.url;
        audioRef.current.load();
        audioRef.current.play().catch(() => {});
    }
  }, [station?.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (!station || !audioRef.current) return;
    if (isPlaying) {
        audioRef.current.pause();
    } else {
        audioRef.current.play().catch(() => setError("Stream no disponible."));
    }
  };

  const startRecording = () => {
    if (!audioRef.current || audioRef.current.paused) {
        setError("Inicia la radio antes de grabar.");
        return;
    }
    try {
      if (!audioCtxRef.current) {
          const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          audioCtxRef.current = new AudioCtx();
          mediaSourceNodeRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current!);
          mediaSourceNodeRef.current.connect(audioCtxRef.current.destination);
      }
      
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

      mp3DataRef.current = [];
      mp3EncoderRef.current = new lamejs.Mp3Encoder(2, audioCtxRef.current.sampleRate, recordingQuality);
      processorNodeRef.current = audioCtxRef.current.createScriptProcessor(4096, 2, 2);
      
      processorNodeRef.current.onaudioprocess = (e) => {
          const left = e.inputBuffer.getChannelData(0);
          const right = e.inputBuffer.getChannelData(1);
          const l16 = new Int16Array(left.length);
          const r16 = new Int16Array(right.length);
          for(let i=0; i<left.length; i++){
              l16[i] = Math.max(-1, Math.min(1, left[i])) * 0x7FFF;
              r16[i] = Math.max(-1, Math.min(1, right[i])) * 0x7FFF;
          }
          const buf = mp3EncoderRef.current.encodeBuffer(l16, r16);
          if(buf.length > 0) mp3DataRef.current.push(new Int8Array(buf));
      };

      mediaSourceNodeRef.current?.connect(processorNodeRef.current);
      processorNodeRef.current.connect(audioCtxRef.current.destination);
      
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch(e) {
      setError("Error al iniciar grabación");
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    clearInterval(timerRef.current);
    if (processorNodeRef.current) processorNodeRef.current.disconnect();

    const final = mp3EncoderRef.current.flush();
    if(final.length > 0) mp3DataRef.current.push(new Int8Array(final));
    
    const blob = new Blob(mp3DataRef.current, { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${station?.name || 'Radio'}-${Date.now()}.mp3`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass p-8 rounded-3xl shadow-2xl relative overflow-hidden transition-all duration-500">
      <audio ref={audioRef} crossOrigin="anonymous" 
        onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)} onPlaying={() => setIsBuffering(false)}
        onError={() => setError("Error de conexión.")}
      />
      <div className="flex justify-between items-start mb-6 relative z-10">
        <button onClick={() => setShowSettings(!showSettings)} className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white transition-colors">
            <Settings size={20} />
        </button>
        <button onClick={onThemeToggle} className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white transition-colors">
            {currentTheme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}
        </button>
      </div>

      {showSettings && (
        <div className="absolute inset-4 z-40 glass p-6 rounded-2xl animate-in fade-in zoom-in-95 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between mb-6">
                <h4 className="font-black text-white">AJUSTES</h4>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="space-y-4
