
import React, { useRef, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Play, Square, Volume2, VolumeX, Radio, Mic, AlertCircle, 
  Settings, X, Loader2, RadioTower, Trash2, Sun, Moon, Palette
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'wavetuner_pro_v2';
const THEME_KEY = 'wavetuner_theme';
const QUALITY_STORAGE_KEY = 'wavetuner_quality_pref_v2';

declare const lamejs: any;

const Visualizer = ({ isPlaying }) => (
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

const RadioPlayer = ({ station, onThemeToggle, currentTheme }) => {
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const mp3EncoderRef = useRef(null);
  const mp3DataRef = useRef([]);
  const processorNodeRef = useRef(null);
  const mediaSourceNodeRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recordingQuality, setRecordingQuality] = useState(() => {
    return parseInt(localStorage.getItem(QUALITY_STORAGE_KEY)) || 192;
  });

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

  const togglePlay = () => {
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => setError("Stream no disponible."));
  };

  const startRecording = () => {
    if (!audioRef.current || audioRef.current.paused) return;
    try {
      if (!audioCtxRef.current) {
          const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          audioCtxRef.current = new AudioCtx();
          mediaSourceNodeRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
          mediaSourceNodeRef.current.connect(audioCtxRef.current.destination);
      }
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
      mediaSourceNodeRef.current.connect(processorNodeRef.current);
      processorNodeRef.current.connect(audioCtxRef.current.destination);
      setIsRecording(true);
    } catch(e) {
      setError("Error al iniciar grabación");
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
