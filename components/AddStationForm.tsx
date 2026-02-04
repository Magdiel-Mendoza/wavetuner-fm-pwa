
import React, { useState, useRef } from 'react';
import { PlusCircle, FileUp, FileDown } from 'lucide-react';
import { Station } from '../types.ts';

interface AddStationFormProps {
  onAdd: (name: string, url: string) => void;
  onImport?: (stations: { name: string; url: string }[]) => void;
  stations?: Station[];
}

const AddStationForm: React.FC<AddStationFormProps> = ({ onAdd, onImport, stations = [] }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && url.trim()) {
        let finalUrl = url.trim();
        
        if (!/^https?:\/\//i.test(finalUrl)) {
            finalUrl = 'https://' + finalUrl;
        }

        onAdd(name.trim(), finalUrl);
        setName('');
        setUrl('');
        setIsOpen(false);
    }
  };

  const handleExport = () => {
    if (stations.length === 0) return;

    let content = "#EXTM3U\n";
    stations.forEach(s => {
      content += `#EXTINF:-1,${s.name}\n${s.url}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const now = new Date();
    const d = now.getDate().toString().padStart(2, '0');
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const y = now.getFullYear();
    const dateStr = `${d}-${m}-${y}`;
    
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const ss = now.getSeconds().toString().padStart(2, '0');
    const timeStr = `${hh}-${mm}-${ss}`;

    a.href = url;
    a.download = `backupWaveTuner-${dateStr}-${timeStr}.m3u`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const lines = content.split(/\r?\n/);
      const imported: { name: string; url: string }[] = [];
      let currentName = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        if (line.startsWith('#EXTINF:')) {
          const match = line.match(/#EXTINF:.*?,(.*)/);
          if (match) currentName = match[1].trim();
        } else if (!line.startsWith('#')) {
          imported.push({
            name: currentName || `Radio ${imported.length + 1}`,
            url: line
          });
          currentName = '';
        }
      }

      if (imported.length > 0 && onImport) {
        onImport(imported);
        setIsOpen(false);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) {
    return (
        <button 
            onClick={() => setIsOpen(true)}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 border-dashed flex items-center justify-center gap-2 transition-all"
        >
            <PlusCircle size={20} />
            <span>Agregar Nueva Emisora o M3U</span>
        </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-6 animate-in fade-in slide-in-from-top-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-medium">Gestión de Emisoras</h3>
        <div className="flex gap-2">
            <button 
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 text-[10px] font-bold text-slate-300 hover:text-white bg-slate-800 py-1.5 px-3 rounded-lg border border-slate-700 transition-all uppercase tracking-wider"
            >
                <FileDown size={14} />
                Exportar M3U
            </button>
            <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-[10px] font-bold text-tuner-accent hover:text-white bg-tuner-accent/10 py-1.5 px-3 rounded-lg border border-tuner-accent/30 transition-all uppercase tracking-wider"
            >
                <FileUp size={14} />
                Importar M3U
            </button>
        </div>
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".m3u,.m3u8" 
            className="hidden" 
        />
      </div>
      
      <div className="space-y-3">
        <div>
            <label htmlFor="stationName" className="block text-xs text-slate-400 mb-1 ml-1">Nombre</label>
            <input
                id="stationName"
                type="text"
                placeholder="Ej: Radio Rock FM"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:border-tuner-accent text-white placeholder-slate-600"
                required
            />
        </div>
        <div>
            <label htmlFor="stationUrl" className="block text-xs text-slate-400 mb-1 ml-1">URL del Stream (mp3/aac)</label>
            <input
                id="stationUrl"
                type="url"
                placeholder="https://stream.example.com/radio.mp3"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:border-tuner-accent text-white placeholder-slate-600"
                required
            />
            <p className="text-[10px] text-slate-500 mt-1 ml-1 italic">Evita archivos .m3u en este campo, usa el enlace directo al audio.</p>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex-1 py-2 px-4 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition-colors text-sm"
        >
            Cancelar
        </button>
        <button
            type="submit"
            className="flex-1 py-2 px-4 bg-tuner-accent hover:bg-cyan-600 text-slate-900 font-semibold rounded-lg transition-colors text-sm"
        >
            Guardar Radio
        </button>
      </div>
    </form>
  );
};

export default AddStationForm;
