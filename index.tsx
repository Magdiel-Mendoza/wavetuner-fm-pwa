
import React, { useRef, useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Play, Square, Volume2, VolumeX, Radio, Mic, AlertCircle, 
  Settings, X, Share2, Sun, Moon, Palette, Check, Loader2, 
  RadioTower, Trash2, CalendarClock, Clock, Sparkles, Smartphone
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// --- CONFIG ---
const STORAGE_KEY = 'wavetuner_pro_v2';
const THEME_KEY = 'wavetuner_theme';
const QUALITY_STORAGE_KEY = 'wavetuner_quality_pref_v260';

declare const lamejs: any;

// --- COMPONENTES ---

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

const RadioPlayer = ({ station, onThemeToggle, currentTheme, allStations, onStationSelect }) => {
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
      console.error(e);
      setError("Error al iniciar grabación");
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    processorNodeRef.current.disconnect();
    const final = mp3EncoderRef.current.flush();
    if(final.length > 0) mp3DataRef.current.push(new Int8Array(final));
    const blob = new Blob(mp3DataRef.current, { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${station?.name || 'Radio'}-${Date.now()}.mp3`;
    a.click();
    setIsRecording(false);
  };

  return (
    <div className="glass p-8 rounded-3xl shadow-2xl relative overflow-hidden">
      <audio ref={audioRef} crossOrigin="anonymous" 
        onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)} onPlaying={() => setIsBuffering(false)}
        onError={() => setError("Error de conexión.")}
      />
      <div className="flex justify-between items-start mb-6">
        <button onClick={() => setShowSettings(!showSettings)} className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400">
            <Settings size={20} />
        </button>
        <button onClick={onThemeToggle} className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400">
            {currentTheme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}
        </button>
      </div>
      {showSettings && (
        <div className="absolute inset-4 z-40 glass p-6 rounded-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between mb-4">
                <h4 className="font-bold text-white">Configuración</h4>
                <button onClick={() => setShowSettings(false)}><X size={20}/></button>
            </div>
            <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Calidad MP3</p>
                <div className="flex flex-col gap-2">
                  {[128, 192, 320].map(q => (
                      <button key={q} onClick={() => setRecordingQuality(q)} className={`w-full py-2 px-4 rounded-lg text-xs text-left ${recordingQuality === q ? 'bg-tuner-accent/20 text-tuner-accent border border-tuner-accent' : 'bg-slate-900 text-slate-400'}`}>{q} kbps</button>
                  ))}
                </div>
            </div>
        </div>
      )}
      <div className="flex flex-col items-center mb-8">
        <div className={`relative w-32 h-32 rounded-full flex items-center justify-center border-4 mb-4 transition-all ${isPlaying ? 'border-tuner-accent shadow-lg' : 'border-slate-800'}`}>
            <Radio className={`w-12 h-12 ${isPlaying ? 'text-tuner-accent' : 'text-slate-700'}`} />
            {isBuffering && <Loader2 className="absolute w-8 h-8 text-tuner-accent animate-spin" />}
        </div>
        <Visualizer isPlaying={isPlaying} />
        <h2 className="text-xl font-black text-white text-center truncate w-full">{station ? station.name : 'Sintoniza...'}</h2>
        <p className="text-[10px] text-tuner-accent font-bold mt-1 tracking-widest">{isRecording ? 'GRABANDO' : isPlaying ? 'AL AIRE' : 'STOP'}</p>
      </div>
      <div className="space-y-6">
        <div className="flex justify-center">
            <button onClick={togglePlay} className="w-16 h-16 flex items-center justify-center rounded-2xl bg-tuner-accent text-tuner-dark shadow-xl active:scale-95 transition-all">
                {isPlaying ? <Square size={24} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
            </button>
        </div>
        <div className="flex items-center gap-4 bg-slate-900/50 p-3 rounded-xl">
            <button onClick={() => setIsMuted(!isMuted)} className="text-slate-500">{isMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>
            <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
        </div>
        <button onClick={isRecording ? stopRecording : startRecording} className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl font-bold transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
            <Mic size={18} /> {isRecording ? 'Detener' : 'Grabar MP3'}
        </button>
      </div>
    </div>
  );
};

const AddStationForm = ({ onAdd }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (name && url) { onAdd(name, url); setName(''); setUrl(''); setIsOpen(false); }
  };
  return isOpen ? (
    <form onSubmit={handleSubmit} className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-6">
        <input placeholder="Nombre" value={name} onChange={e => setName(e.target.value)} className="w-full mb-2 p-2 bg-slate-950 border border-slate-800 rounded text-white text-sm" />
        <input placeholder="URL Stream (mp3)" value={url} onChange={e => setUrl(e.target.value)} className="w-full mb-4 p-2 bg-slate-950 border border-slate-800 rounded text-white text-sm" />
        <div className="flex gap-2">
            <button type="button" onClick={() => setIsOpen(false)} className="flex-1 p-2 text-slate-400 text-xs">Cerrar</button>
            <button type="submit" className="flex-1 p-2 bg-tuner-accent text-tuner-dark font-bold rounded text-xs">Guardar</button>
        </div>
    </form>
  ) : (
    <button onClick={() => setIsOpen(true)} className="w-full py-3 bg-slate-800 rounded-xl text-slate-400 text-sm border border-dashed border-slate-700 mb-6">+ Nueva Radio</button>
  );
};

const StationList = ({ stations, currentStationId, onSelect, onDelete }) => (
  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
    {stations.length === 0 && <p className="text-center text-slate-600 text-xs py-10">Lista vacía</p>}
    {stations.map(s => (
      <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${currentStationId === s.id ? 'bg-tuner-accent/10 border-tuner-accent' : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800'}`}>
        <button onClick={() => onSelect(s)} className="flex-1 text-left truncate">
            <h3 className="font-bold text-slate-200 text-sm truncate">{s.name}</h3>
            <p className="text-[9px] text-slate-600 truncate">{s.url}</p>
        </button>
        <button onClick={() => onDelete(s.id)} className="p-2 text-slate-600 hover:text-red-400"><Trash2 size={14}/></button>
      </div>
    ))}
  </div>
);

const App = () => {
  const [stations, setStations] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Radio Paradise', url: 'https://stream.radioparadise.com/mp3-128', addedAt: Date.now() }
    ];
  });
  const [currentStation, setCurrentStation] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || 'dark');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stations));
    localStorage.setItem(THEME_KEY, theme);
    document.body.className = theme === 'light' ? 'light-theme' : '';
  }, [stations, theme]);

  const handleAdd = (name, url) => {
    setStations([{ id: uuidv4(), name, url, addedAt: Date.now() }, ...stations]);
  };

  const handleDelete = (id) => {
    setStations(stations.filter(s => s.id !== id));
    if(currentStation?.id === id) setCurrentStation(null);
  };

  return (
    <div className="min-h-screen p-4 md:p-10 flex justify-center">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-tuner-accent rounded-xl text-tuner-dark"><RadioTower size={24} /></div>
                <h1 className="text-2xl font-black text-white">WaveTuner</h1>
            </div>
            <RadioPlayer 
                station={currentStation} 
                onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                currentTheme={theme}
                allStations={stations}
                onStationSelect={setCurrentStation}
            />
        </div>
        <div className="lg:col-span-7">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white">Tu Dial Privado</h2>
                <span className="text-[10px] bg-slate-900 px-2 py-1 rounded-full text-slate-500 uppercase">{stations.length} radios</span>
            </div>
            <AddStationForm onAdd={handleAdd} />
            <StationList stations={stations} currentStationId={currentStation?.id} onSelect={setCurrentStation} onDelete={handleDelete} />
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<App />);
