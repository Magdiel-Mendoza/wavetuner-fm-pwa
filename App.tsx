
import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { RadioTower, Sparkles, Smartphone, Download, User, Cpu, Info } from 'lucide-react';
import { Station } from './types.ts';
import RadioPlayer from './components/RadioPlayer.tsx';
import StationList from './components/StationList.tsx';
import AddStationForm from './components/AddStationForm.tsx';

const STORAGE_KEY = 'wavetuner_pro_v2';
const THEME_KEY = 'wavetuner_theme';

const DEFAULT_STATIONS: Station[] = [
  { id: '1', name: 'Radio Paradise', url: 'https://stream.radioparadise.com/mp3-128', addedAt: Date.now(), favorite: true },
  { id: '2', name: 'Classic FM UK', url: 'https://media-ssl.musicradio.com/ClassicFM', addedAt: Date.now() + 1 },
  { id: '3', name: 'SomaFM Groove Salad', url: 'https://ice1.somafm.com/groovesad-128-mp3', addedAt: Date.now() + 2 },
  { id: '4', name: 'FFH 80er', url: 'https://mp3.ffh.de/ffhchannels/hq80er.mp3', addedAt: Date.now() + 3 },
];

const App: React.FC = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [currentStation, setCurrentStation] = useState<Station | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const storedTheme = localStorage.getItem(THEME_KEY) as 'dark' | 'light';
      setStations(stored ? JSON.parse(stored) : DEFAULT_STATIONS);
      if (storedTheme) setTheme(storedTheme);
    } catch (e) {
      setStations(DEFAULT_STATIONS);
    } finally {
        setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stations));
      localStorage.setItem(THEME_KEY, theme);
      if (theme === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
    }
  }, [stations, isLoaded, theme]);

  const handleAddStation = useCallback((name: string, url: string) => {
    const newStation: Station = { id: uuidv4(), name, url, addedAt: Date.now(), favorite: false };
    setStations(prev => [newStation, ...prev]);
  }, []);

  const handleImportStations = useCallback((newStations: { name: string; url: string }[]) => {
    const prepared = newStations.map(s => ({
      id: uuidv4(),
      name: s.name,
      url: s.url,
      addedAt: Date.now(),
      favorite: false
    }));
    setStations(prev => [...prepared, ...prev]);
  }, []);

  const handleDeleteStation = useCallback((id: string) => {
    setStations(prev => prev.filter(s => s.id !== id));
    if (currentStation?.id === id) setCurrentStation(null);
  }, [currentStation]);

  const handleToggleFavorite = useCallback((id: string) => {
    setStations(prev => prev.map(s => s.id === id ? { ...s, favorite: !s.favorite } : s));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  return (
    <div className={`min-h-screen p-4 md:p-12 lg:p-16 flex justify-center items-start transition-colors duration-400`}>
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left: Player Section */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 lg:sticky lg:top-12">
            <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-tuner-accent rounded-2xl text-tuner-dark shadow-xl shadow-tuner-accent/20">
                    <RadioTower size={28} />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white leading-none">WaveTuner</h1>
                    <p className="text-tuner-accent text-xs font-bold tracking-[0.2em] mt-1 flex items-center gap-1">
                        <Sparkles size={10}/> PREMIUM FM v2.6
                    </p>
                </div>
            </div>

            <RadioPlayer 
                station={currentStation} 
                onThemeToggle={toggleTheme} 
                currentTheme={theme}
                allStations={stations}
                onStationSelect={setCurrentStation}
            />
            
            <div className="glass p-6 rounded-3xl text-xs text-slate-500 leading-relaxed border-white/5 space-y-4">
                <div className="flex items-center gap-3 text-tuner-accent font-bold uppercase tracking-wider">
                    <Smartphone size={16}/> Modo PWA Instalable
                </div>
                <p>WaveTuner ahora soporta instalación nativa y grabación en formato <code className="text-tuner-accent font-bold">MP3 (LameJS)</code>, optimizado para Android 15 con motor Keep-Alive.</p>
                <p className="text-[10px] text-slate-500 italic mt-2">Accede a la configuración (⚙️) para ver los detalles completos de la versión.</p>
            </div>
        </div>

        {/* Right: Management Section */}
        <div className="lg:col-span-7 xl:col-8 flex flex-col gap-8">
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-black text-white">Tu Dial Privado</h2>
                    <span className="px-4 py-1.5 bg-slate-900 rounded-full text-[10px] font-bold text-slate-400 border border-slate-800">
                        {stations.length} EMISORAS
                    </span>
                </div>
                
                <AddStationForm 
                    onAdd={handleAddStation} 
                    onImport={handleImportStations} 
                    stations={stations}
                />
            </div>

            <div className="mt-4">
                <StationList 
                    stations={stations}
                    currentStationId={currentStation?.id || null}
                    onSelect={setCurrentStation}
                    onDelete={handleDeleteStation}
                    onToggleFavorite={handleToggleFavorite}
                />
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
