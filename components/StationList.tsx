
import React from 'react';
import { Trash2, PlayCircle, Radio, Star } from 'lucide-react';
import { Station } from '../types.ts';

interface StationListProps {
  stations: Station[];
  currentStationId: string | null;
  onSelect: (station: Station) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

const StationList: React.FC<StationListProps> = ({ stations, currentStationId, onSelect, onDelete, onToggleFavorite }) => {
  if (stations.length === 0) {
    return (
        <div className="text-center py-20 px-4 glass rounded-3xl border-dashed border-slate-800">
            <Radio size={48} className="mx-auto mb-4 text-slate-700" />
            <p className="text-slate-400 font-medium">Tu dial está vacío</p>
            <p className="text-slate-600 text-sm mt-1">Agrega una URL de stream para comenzar.</p>
        </div>
    );
  }

  const sortedStations = [...stations].sort((a, b) => {
    if (a.favorite === b.favorite) return b.addedAt - a.addedAt;
    return a.favorite ? -1 : 1;
  });

  return (
    <div className="space-y-3">
      {sortedStations.map((station) => {
        const isActive = currentStationId === station.id;
        return (
          <div
            key={station.id}
            className={`group flex items-center gap-4 p-4 rounded-2xl transition-all border ${
              isActive
                ? 'bg-tuner-accent/10 border-tuner-accent/40 shadow-lg'
                : 'bg-slate-900/40 border-slate-800/50 hover:bg-slate-800/60 hover:border-slate-700'
            }`}
          >
            <button
                onClick={() => onSelect(station)}
                className="flex items-center gap-4 flex-1 min-w-0 text-left"
            >
                <div className={`p-3 rounded-xl shrink-0 ${isActive ? 'bg-tuner-accent text-tuner-dark' : 'bg-slate-800 text-slate-500 group-hover:text-slate-300'}`}>
                    {isActive ? <Radio size={20} className="animate-pulse" /> : <PlayCircle size={20} />}
                </div>
                <div className="truncate">
                    <h3 className={`font-bold truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                        {station.name}
                    </h3>
                    <p className="text-[10px] font-mono text-slate-600 truncate mt-0.5">
                        {station.url.replace(/^https?:\/\//, '')}
                    </p>
                </div>
            </button>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onToggleFavorite(station.id)}
                  className={`p-2 rounded-lg hover:bg-slate-700 transition-colors ${station.favorite ? 'text-yellow-500' : 'text-slate-500'}`}
                  title="Favorito"
                >
                  <Star size={18} fill={station.favorite ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={() => {
                    if(confirm(`¿Eliminar "${station.name}"?`)) onDelete(station.id);
                  }}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                  title="Eliminar"
                >
                  <Trash2 size={18} />
                </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StationList;
