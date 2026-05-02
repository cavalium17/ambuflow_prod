
import React from 'react';
import { Clock, Calendar, AlertTriangle } from 'lucide-react';

interface PlanningSummaryProps {
  darkMode: boolean;
  totalHours: string;
  totalCp: number;
  modulationHours?: number;
}

export const PlanningSummary: React.FC<PlanningSummaryProps> = ({
  darkMode,
  totalHours,
  totalCp,
  modulationHours
}) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className={`p-4 rounded-[32px] border ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
        <div className="flex items-center gap-2 mb-1">
          <Clock size={14} className="text-indigo-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Heures</span>
        </div>
        <p className="text-xl font-black tabular-nums">{totalHours}</p>
      </div>
      <div className={`p-4 rounded-[32px] border ${darkMode ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-100'}`}>
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={14} className="text-orange-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Congés</span>
        </div>
        <p className="text-xl font-black tabular-nums">{totalCp} j</p>
      </div>
      {modulationHours !== undefined && (
        <div className={`col-span-2 p-4 rounded-[32px] border flex items-center justify-between ${darkMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-100'}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Solde Modulation</span>
          </div>
          <p className="text-xl font-black tabular-nums">{modulationHours > 0 ? '+' : ''}{modulationHours}h</p>
        </div>
      )}
    </div>
  );
};
