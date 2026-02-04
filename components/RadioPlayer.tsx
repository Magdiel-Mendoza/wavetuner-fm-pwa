
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Square, Volume2, VolumeX, Radio, Mic, Download, AlertCircle, Settings, CalendarClock, Clock, Timer, X, Share2, Sun, Moon, Palette, Info, Cpu, User, Sparkles, Calendar, Check, Loader2 } from 'lucide-react';
import { Station } from '../types.ts';

// Declaración para lamejs (global vía CDN)
declare const lamejs: any;

interface RadioPlayerProps {
  station: Station | null;
  onThemeToggle?: () => void;
  currentTheme?: 'dark' | 'light';
  allStations?: Station[];
  onStationSelect?: (station: Station) => void;
}

const APP_VERSION = "2.6.0";
const VERSION_DATE = "04 de febrero de 2026";
const QUALITY_STORAGE_KEY = 'wavetuner_quality_pref_v260';

const RECORDING_QUALITIES = [
    { id: 'std', label: 'Estándar MP3 (128 kbps)', bits: 128 },
    { id: 'high', label: 'Alta MP3 (192 kbps)', bits: 192 },
    { id: 'max', label: 'Máxima MP3 (320 kbps)', bits: 320 },
];

type Schedule = {
    type: 'timer' | 'schedule' | 'date';
    start?: number;
    end?: number;
    duration?: number;
    stationId?: string;
    days?: number[];
};

const DAYS_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const Visualizer: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => {
    return (
        <div className="flex items-end justify-center gap-1 h-8 w-24 mb-4">
            {[...Array(12)].map((_, i) => (
                <div 
                    key={i} 
                    className={`visualizer-bar ${isPlaying ? 'animate-bar-grow' : 'h-[10%]'}`}
                    style={{ 
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: `${0.8 + Math.random()}s`
                    }}
                />
            ))}
        </div>
    );
};

const RadioPlayer: React.FC<RadioPlayerProps> = ({ station, onThemeToggle, currentTheme = 'dark', allStations = [], onStationSelect }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const heartbeatAudioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<any>(null);
  
  // Audio Context & Nodes para Heartbeat y MP3
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const mp3EncoderRef = useRef<any>(null);
  const mp3DataRef = useRef<Int8Array[]>([]);

  const activeScheduleRef = useRef<Schedule | null>(null);
  const isStoppingRef = useRef(false);
  const shouldAutoSaveRef = useRef(false);
  const recordingDurationRef = useRef(0);
  const isRecordingRef = useRef(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<number | null>(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  
  const [recordingQuality, setRecordingQuality] = useState(() => {
      const saved = localStorage.getItem(QUALITY_STORAGE_KEY);
      return saved ? parseInt(saved) : RECORDING_QUALITIES[1].bits;
  });
  
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);
  const [schedMode, setSchedMode] = useState<'duration' | 'time'>('duration');
  const [schedDurationInput, setSchedDurationInput] = useState('30');
  const [schedRecurrence, setSchedRecurrence] = useState<'daily' | 'date'>('daily');
  const [schedDate, setSchedDate] = useState(''); 
  const [schedStartTime, setSchedStartTime] = useState('');
  const [schedEndTime, setSchedEndTime] = useState('');
  const [schedStationId, setSchedStationId] = useState('');
  const [schedDays, setSchedDays] = useState<number[]>([1,2,3,4,5,6]); 

  // PERSISTENCIA
  useEffect(() => {
    localStorage.setItem(QUALITY_STORAGE_KEY, recordingQuality.toString());
  }, [recordingQuality]);

  useEffect(() => {
    recordingDurationRef.current = recordingDuration;
  }, [recordingDuration]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    activeScheduleRef.current = activeSchedule;
  }, [activeSchedule]);

  // HEARTBEAT & WAKE LOCK (Solución Android 15)
  const setupKeepAlive = useCallback(async (active: boolean) => {
    try {
        if (active) {
            // Heartbeat Audio (Inaudible 1Hz)
            if (!heartbeatAudioRef.current) {
                const audio = new Audio();
                audio.loop = true;
                // Pequeño WAV silencioso de un tono base inaudible
                audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFRm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=";
                heartbeatAudioRef.current = audio;
            }
            heartbeatAudioRef.current.play().catch(() => {});

            // Screen/CPU Wake Lock
            if ('wakeLock' in navigator && !wakeLockRef.current) {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            }
        } else {
            if (heartbeatAudioRef.current) {
                heartbeatAudioRef.current.pause();
            }
            if (wakeLockRef.current) {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            }
        }
    } catch (e) {
        console.warn("WakeLock/Heartbeat Error:", e);
    }
  }, []);

  const saveRecording = useCallback(() => {
    if (mp3DataRef.current.length === 0) return;
    
    // Finalizar encoding
    const mp3buf = mp3EncoderRef.current.flush();
    if (mp3buf.length > 0) {
        mp3DataRef.current.push(new Int8Array(mp3buf));
    }

    const blob = new Blob(mp3DataRef.current, { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const now = new Date();
    const d = now.getDate().toString().padStart(2, '0');
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const y = now.getFullYear();
    const dateStr = `${d}-${m}-${y}`;
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    
    const stName = station?.name || 'Radio';

    a.href = url;
    a.download = `${stName}-${dateStr}-${timeStr}.mp3`;
    a.click();
    
    URL.revokeObjectURL(url);
    mp3DataRef.current = [];
    setRecordingDuration(0);
    recordingDurationRef.current = 0;
  }, [station?.name]);

  const stopRecording = useCallback(() => {
    if (isStoppingRef.current) return;
    
    isStoppingRef.current = true; 
    setIsRecording(false);
    isRecordingRef.current = false;
    
    if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
    }
    
    // Desconectar nodos
    if (processorNodeRef.current) {
        processorNodeRef.current.disconnect();
        processorNodeRef.current.onaudioprocess = null;
    }

    saveRecording();
    isStoppingRef.current = false;
  }, [saveRecording]);

  const startRecording = useCallback(() => {
    if (!audioRef.current || isStoppingRef.current) return;
    if (audioRef.current.paused) {
        audioRef.current.play().catch(() => setError("Reproducción requerida para grabar."));
        return;
    }

    // Inicializar AudioContext para MP3 si no existe
    if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
        mediaSourceNodeRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
        mediaSourceNodeRef.current.connect(audioCtxRef.current.destination);
    }

    if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
    }

    mp3DataRef.current = [];
    mp3EncoderRef.current = new (lamejs as any).Mp3Encoder(2, audioCtxRef.current.sampleRate, recordingQuality);
    
    // ScriptProcessor para capturar PCM y enviar a LameJS
    processorNodeRef.current = audioCtxRef.current.createScriptProcessor(4096, 2, 2);
    
    processorNodeRef.current.onaudioprocess = (e) => {
        const left = e.inputBuffer.getChannelData(0);
        const right = e.inputBuffer.getChannelData(1);
        
        // Convertir float32 a int16 (PCM)
        const leftInt16 = new Int16Array(left.length);
        const rightInt16 = new Int16Array(right.length);
        for (let i = 0; i < left.length; i++) {
            leftInt16[i] = Math.max(-1, Math.min(1, left[i])) * 0x7FFF;
            rightInt16[i] = Math.max(-1, Math.min(1, right[i])) * 0x7FFF;
        }

        const mp3buf = mp3EncoderRef.current.encodeBuffer(leftInt16, rightInt16);
        if (mp3buf.length > 0) {
            mp3DataRef.current.push(new Int8Array(mp3buf));
        }
    };

    mediaSourceNodeRef.current?.connect(processorNodeRef.current);
    processorNodeRef.current.connect(audioCtxRef.current.destination);

    setIsRecording(true);
    isRecordingRef.current = true;
    recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
    }, 1000);

  }, [recordingQuality]);

  // Monitor del Programador
  useEffect(() => {
    const checkSchedule = () => {
        const schedule = activeScheduleRef.current;
        if (!schedule) return;

        const now = new Date();
        const nowMs = now.getTime();

        if (schedule.type === 'timer' && schedule.duration) {
            if (isRecordingRef.current && recordingDurationRef.current >= schedule.duration) {
                setActiveSchedule(null);
                activeScheduleRef.current = null;
                stopRecording();
                return;
            }
        }

        if ((schedule.type === 'schedule' || schedule.type === 'date') && schedule.start && schedule.end) {
            const isRightTime = nowMs >= schedule.start && nowMs < schedule.end;
            let isRightDay = true;
            if (schedule.type === 'schedule' && schedule.days) {
                isRightDay = schedule.days.includes(now.getDay());
            }

            if (isRightTime && isRightDay) {
                if (!isRecordingRef.current && !isLoading && !isStoppingRef.current) {
                    if (schedule.stationId && station?.id !== schedule.stationId && onStationSelect && allStations) {
                        const targetStation = allStations.find(s => s.id === schedule.stationId);
                        if (targetStation) onStationSelect(targetStation);
                    } else {
                        startRecording();
                    }
                }
            } else if (isRecordingRef.current && nowMs >= schedule.end) {
                setActiveSchedule(null);
                activeScheduleRef.current = null;
                stopRecording();
            }
        }
    };

    const intervalId = setInterval(checkSchedule, 1000);
    return () => clearInterval(intervalId);
  }, [station, allStations, onStationSelect, isLoading, startRecording, stopRecording]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => { 
        setIsPlaying(true); 
        setIsBuffering(false); 
        setupKeepAlive(true); 
    };
    const onPause = () => { 
        setIsPlaying(false); 
        setupKeepAlive(false); 
    };
    const onLoadStart = () => { setIsLoading(true); setIsBuffering(true); setError(null); };
    const onCanPlay = () => { setIsLoading(false); setIsBuffering(false); setError(null); };
    const onWaiting = () => { setIsBuffering(true); };
    const onPlaying = () => { setIsBuffering(false); };
    const onError = () => { 
        setIsLoading(false); 
        setIsPlaying(false); 
        setIsBuffering(false);
        setError("Error de Red / Buffer. Reintentando..."); 
        // Auto-reconnect logic para Android 15
        setTimeout(() => { if (station) audio.load(); }, 2000);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('error', onError);
    };
  }, [station, setupKeepAlive]);

  useEffect(() => {
    setError(null);
    if (audioRef.current && station) {
        const audio = audioRef.current;
        audio.pause();
        audio.src = station.url;
        audio.load();
        audio.play().catch(() => {});
    }
  }, [station?.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !station) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => setError("Stream no disponible temporalmente."));
    }
  }, [isPlaying, station]);

  const toggleDay = (day: number) => {
    setSchedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const applySchedule = () => {
      if (schedMode === 'duration') {
          const secs = parseInt(schedDurationInput) * 60;
          setActiveSchedule({ type: 'timer', duration: secs });
          setShowScheduler(false);
          setTimeout(() => startRecording(), 100);
      } else {
          if (!schedStartTime || !schedEndTime) return;
          const [sH, sM] = schedStartTime.split(':').map(Number);
          const [eH, eM] = schedEndTime.split(':').map(Number);
          let start = new Date();
          let end = new Date();
          if (schedRecurrence === 'date' && schedDate) {
              const [y, m, d] = schedDate.split('-').map(Number);
              start.setFullYear(y, m - 1, d);
              end.setFullYear(y, m - 1, d);
          }
          start.setHours(sH, sM, 0, 0);
          end.setHours(eH, eM, 0, 0);
          if (end < start) end.setDate(end.getDate() + 1);
          setActiveSchedule({
              type: schedRecurrence === 'date' ? 'date' : 'schedule',
              start: start.getTime(),
              end: end.getTime(),
              stationId: schedStationId || station?.id,
              days: schedRecurrence === 'daily' ? schedDays : undefined
          });
          setShowScheduler(false);
      }
  };

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass p-8 rounded-3xl shadow-2xl relative overflow-hidden transition-all duration-500">
      <audio ref={audioRef} crossOrigin="anonymous" hidden />
      
      {/* Background Pulse */}
      <div className={`absolute -top-24 -left-24 w-64 h-64 rounded-full blur-[100px] transition-all duration-1000 ${isPlaying ? 'bg-cyan-500/20' : 'bg-slate-500/10'}`}></div>

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex gap-2">
            <button onClick={() => { setShowScheduler(!showScheduler); setShowSettings(false); }} className={`relative p-2.5 rounded-xl transition-all ${showScheduler || activeSchedule ? 'bg-tuner-accent text-tuner-dark shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'bg-slate-800/50 text-slate-400 hover:text-white'}`}>
                <CalendarClock size={20} />
                {activeSchedule && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-slate-900 animate-pulse"></span>
                )}
            </button>
            <button onClick={() => { setShowSettings(!showSettings); setShowScheduler(false); }} className={`p-2.5 rounded-xl transition-all ${showSettings ? 'bg-slate-800 text-tuner-accent' : 'bg-slate-800/50 text-slate-400 hover:text-white'}`}>
                <Settings size={20} />
            </button>
        </div>
        <button className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white"><Share2 size={20} /></button>
      </div>

      {showSettings && (
        <div className="absolute inset-x-4 top-20 bottom-4 z-40 glass p-6 rounded-2xl animate-in fade-in zoom-in-95 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between mb-6 sticky top-0 bg-transparent backdrop-blur-md pb-2 z-10">
                <h4 className="font-bold text-white flex items-center gap-2"><Palette size={18} className="text-tuner-accent"/> Configuración</h4>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="space-y-6">
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">TEMA VISUAL</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => onThemeToggle && onThemeToggle()} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${currentTheme === 'dark' ? 'bg-slate-800 border-tuner-accent text-tuner-accent' : 'bg-slate-900/50 border-slate-700 text-slate-500'}`}><Moon size={20} /><span className="text-[10px] font-bold">OSCURO</span></button>
                        <button onClick={() => onThemeToggle && onThemeToggle()} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${currentTheme === 'light' ? 'bg-slate-200 border-tuner-accent text-tuner-accent' : 'bg-slate-900/50 border-slate-700 text-slate-500'}`}><Sun size={20} /><span className="text-[10px] font-bold">GRIS CLARO</span></button>
                    </div>
                </div>
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">CALIDAD GRABACIÓN MP3</p>
                    <div className="space-y-2">
                        {RECORDING_QUALITIES.map(q => (
                            <button key={q.id} onClick={() => setRecordingQuality(q.bits)} className={`w-full py-2 px-4 rounded-lg text-xs font-medium text-left transition-all ${recordingQuality === q.bits ? 'bg-tuner-accent/10 border border-tuner-accent/30 text-tuner-accent' : 'bg-slate-900/50 border-slate-700 text-slate-400'}`}>{q.label}</button>
                        ))}
                    </div>
                </div>
                <div className="pt-4 border-t border-slate-800 space-y-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acerca de WaveTuner</p>
                    <div className="text-[10px] space-y-1.5 font-mono">
                        <div className="flex justify-between gap-4"><span className="text-slate-500">Versión:</span><span className="text-white font-bold text-right">versión {APP_VERSION}</span></div>
                        <div className="flex justify-between gap-4"><span className="text-slate-500">Fecha de versión:</span><span className="text-white font-bold text-right">{VERSION_DATE}</span></div>
                        <div className="flex justify-between gap-4"><span className="text-slate-500">Desarrollador:</span><span className="text-white font-bold text-right">Magdiel Mendoza</span></div>
                        <div className="flex justify-between gap-4"><span className="text-slate-500">AI:</span><span className="text-white font-bold text-right">Gemini (Google)</span></div>
                        <div className="flex justify-between gap-4"><span className="text-slate-500">Optimización:</span><span className="text-cyan-400 font-bold text-right">Android 15 Keep-Alive</span></div>
                        <div className="flex justify-between gap-4"><span className="text-slate-500">Motor:</span><span className="text-white font-bold text-right">LameJS (MP3 Native)</span></div>
                    </div>
                    <p className="text-[10px] text-slate-400 italic leading-tight mt-2">
                        WaveTuner es un proyecto colaborativo enfocado en la simplicidad y potencia del streaming FM nativo.
                    </p>
                </div>
            </div>
        </div>
      )}

      {showScheduler && (
        <div className="absolute inset-x-4 top-20 z-40 glass p-6 rounded-2xl animate-in fade-in zoom-in-95 max-h-[440px] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between mb-4">
                <h4 className="font-bold text-white flex items-center gap-2"><Clock size={18} className="text-tuner-accent"/> Programar</h4>
                <button onClick={() => setShowScheduler(false)}><X size={20}/></button>
            </div>
            <div className="space-y-4">
                <div className="flex bg-slate-900/80 p-1 rounded-xl">
                    <button onClick={() => setSchedMode('duration')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${schedMode === 'duration' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>TEMPORIZADOR</button>
                    <button onClick={() => setSchedMode('time')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${schedMode === 'time' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>HORARIO</button>
                </div>
                
                {schedMode === 'duration' ? (
                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Duración (Minutos)</label>
                        <input type="number" value={schedDurationInput} onChange={e => setSchedDurationInput(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-tuner-accent" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase font-bold">Radio a Grabar</label>
                            <select value={schedStationId} onChange={(e) => setSchedStationId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white text-xs">
                                <option value="">Seleccionar emisora...</option>
                                {allStations && allStations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setSchedRecurrence('daily')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border ${schedRecurrence === 'daily' ? 'bg-tuner-accent/10 border-tuner-accent text-tuner-accent' : 'border-slate-800 text-slate-500'}`}>DIARIO</button>
                             <button onClick={() => setSchedRecurrence('date')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border ${schedRecurrence === 'date' ? 'bg-tuner-accent/10 border-tuner-accent text-tuner-accent' : 'border-slate-800 text-slate-500'}`}>FECHA</button>
                        </div>
                        {schedRecurrence === 'daily' && (
                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase font-bold">Días</label>
                                <div className="flex justify-between gap-1">
                                    {[0,1,2,3,4,5,6].map(d => (
                                        <button key={d} onClick={() => toggleDay(d)} className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all border ${schedDays.includes(d) ? 'bg-tuner-accent border-tuner-accent text-tuner-dark shadow-lg shadow-tuner-accent/20' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                                            {DAYS_SHORT[d]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <div className="flex-1 space-y-1"><label className="text-[10px] text-slate-500 uppercase font-bold">Inicio</label><input type="time" value={schedStartTime} onChange={e => setSchedStartTime(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white [color-scheme:dark] text-xs" /></div>
                            <div className="flex-1 space-y-1"><label className="text-[10px] text-slate-500 uppercase font-bold">Fin</label><input type="time" value={schedEndTime} onChange={e => setSchedEndTime(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white [color-scheme:dark] text-xs" /></div>
                        </div>
                    </div>
                )}
                <button onClick={applySchedule} className="w-full py-3 bg-tuner-accent text-tuner-dark font-black rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"><Check size={16} /> ACTIVAR</button>
            </div>
        </div>
      )}

      <div className="flex flex-col items-center mb-8">
        <div className={`relative w-40 h-40 rounded-full flex items-center justify-center border-4 mb-6 transition-all duration-700 ${isPlaying ? 'border-tuner-accent shadow-[0_0_50px_rgba(34,211,238,0.2)] scale-105' : 'border-slate-800'}`}>
            <Radio className={`w-16 h-16 ${isPlaying ? 'text-tuner-accent' : 'text-slate-700'}`} />
            {isPlaying && <div className="absolute inset-0 rounded-full border border-tuner-accent/30 animate-ping"></div>}
            {isBuffering && (
                <div className="absolute inset-0 rounded-full flex items-center justify-center bg-tuner-dark/60 z-20">
                    <Loader2 className="w-10 h-10 text-tuner-accent animate-spin" />
                </div>
            )}
        </div>
        <Visualizer isPlaying={isPlaying} />
        <h2 className="text-2xl font-black text-white text-center mb-1 truncate w-full px-2">{station ? station.name : 'Sintoniza una Radio'}</h2>
        <div className="flex flex-col items-center mt-1">
            <div className={`text-[10px] tracking-[0.2em] font-mono font-bold uppercase text-center ${isRecording ? 'text-red-500' : isPlaying ? 'text-tuner-accent' : 'text-slate-600'}`}>
                {isRecording ? (
                    `GRABANDO MP3 • ${formatDuration(recordingDuration)}`
                ) : isBuffering ? (
                    'BUFFERING...'
                ) : isPlaying ? (
                    'AL AIRE'
                ) : (
                    'LISTO'
                )}
            </div>
        </div>
      </div>

      {error && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-3"><AlertCircle size={16} className="shrink-0" /><span>{error}</span></div>}

      <div className={`space-y-6 transition-opacity ${!station ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center justify-center gap-8">
            <button onClick={togglePlay} className={`w-20 h-20 flex items-center justify-center rounded-3xl transition-all active:scale-90 ${isPlaying ? 'bg-transparent border-2 border-tuner-accent text-tuner-accent' : 'bg-tuner-accent text-tuner-dark shadow-xl shadow-tuner-accent/20'}`}>
                {isPlaying ? <Square size={28} fill="currentColor" /> : <Play size={36} fill="currentColor" className="ml-1" />}
            </button>
        </div>
        <div className="flex items-center gap-4 bg-slate-900/50 p-3 rounded-2xl border border-white/5">
            <button onClick={() => setIsMuted(!isMuted)} className="text-slate-500 hover:text-white">{isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
            <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }} className="w-full" />
        </div>
        <div className="flex gap-3">
            <button onClick={isRecording ? stopRecording : startRecording} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}><Mic size={18} />{isRecording ? 'Detener' : 'Grabar MP3'}</button>
        </div>
      </div>
    </div>
  );
};

export default RadioPlayer;
