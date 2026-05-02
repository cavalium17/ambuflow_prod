
import React, { useState } from 'react';
import { 
  X, 
  Utensils, 
  Coffee, 
  Building2, 
  MapPin, 
  PlusCircle, 
  AlertTriangle,
  Edit,
  Trash2
} from 'lucide-react';
import { Shift, Break } from '../types';
import { calculateEndTimeFromDuration, toMinutes } from '../src/lib/dateUtils';

interface EditShiftModalProps {
  darkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
  shift: Shift | null;
  onUpdate: (updatedShift: Shift) => void;
}

export const EditShiftModal: React.FC<EditShiftModalProps> = ({
  darkMode,
  isOpen,
  onClose,
  shift,
  onUpdate
}) => {
  const [editingShift, setEditingShift] = useState<Shift | null>(shift);
  const [editingBreakId, setEditingBreakId] = useState<string | null>(null);
  const [tempBreak, setTempBreak] = useState({
    isActive: false,
    type: 'repas' as 'cafe' | 'repas',
    start: '12:00',
    duration: 30,
    location: 'Entreprise' as 'Entreprise' | 'Extérieur'
  });

  // Sync state if shift prop changes (e.g. when opening)
  React.useEffect(() => {
    setEditingShift(shift);
  }, [shift]);

  if (!isOpen || !editingShift) return null;

  const isShiftValid = (() => {
    if (editingShift.end === '--:--') return true;
    const sMin = toMinutes(editingShift.start);
    const eMin = toMinutes(editingShift.end);
    const breaks = editingShift.breaks || [];
    for (const b of breaks) {
      const bSMin = toMinutes(b.start);
      const bEMin = toMinutes(b.end);
      if (bSMin < sMin || bEMin > eMin) return false;
    }
    return true;
  })();

  const addOrUpdateBreak = () => {
    const breakEndTime = calculateEndTimeFromDuration(tempBreak.start, tempBreak.duration);
    const breakData: Break = {
      id: editingBreakId || Math.random().toString(36).substr(2, 9),
      start: tempBreak.start,
      end: breakEndTime,
      duration: tempBreak.duration,
      location: tempBreak.location,
      isMeal: tempBreak.type === 'repas'
    };

    setEditingShift(prev => {
      if (!prev) return null;
      const breaks = prev.breaks || [];
      if (editingBreakId) {
        return { ...prev, breaks: breaks.map(b => b.id === editingBreakId ? breakData : b) };
      }
      return { ...prev, breaks: [...breaks, breakData] };
    });
    
    setTempBreak(p => ({ ...p, isActive: false }));
    setEditingBreakId(null);
  };

  const startEditingBreak = (b: Break) => {
    setEditingBreakId(b.id);
    setTempBreak({
      isActive: true,
      type: b.isMeal ? 'repas' : 'cafe',
      start: b.start,
      duration: b.duration,
      location: b.location as any
    });
  };

  const inputClass = `w-full p-4 rounded-2xl border font-black outline-none transition-all placeholder:text-slate-400 ${
    darkMode 
      ? 'bg-[#0F1221] border-white/5 text-white focus:border-indigo-500' 
      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white'
  }`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-fadeIn">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={onClose} />
      <div className={`relative w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-popIn border ${darkMode ? 'bg-[#15192D] border-white/10 text-white' : 'bg-white text-slate-900'} max-h-[90vh] overflow-y-auto no-scrollbar`}>
        <div className="flex justify-between items-start mb-8">
          <div>
            <h3 className="text-2xl font-black tracking-tight capitalize">Édition</h3>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">{new Date(editingShift.day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button onClick={onClose} className={`p-3 rounded-2xl ${darkMode ? 'bg-slate-500/10' : 'bg-slate-100'}`}><X size={20} /></button>
        </div>
        
        <div className="space-y-6">
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-indigo-500 font-black uppercase text-[9px] tracking-widest px-1">Début</label>
                <input type="time" className={inputClass} value={editingShift.start} onChange={e => setEditingShift({...editingShift, start: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-indigo-500 font-black uppercase text-[9px] tracking-widest px-1">Fin</label>
                <input type="time" className={inputClass} value={editingShift.end === '--:--' ? '' : editingShift.end} onChange={e => setEditingShift({...editingShift, end: e.target.value})} />
              </div>
           </div>

           <div className={`space-y-4 pt-4 border-t ${darkMode ? 'border-white/10' : 'border-slate-500/10'}`}>
                <label className="text-indigo-500 font-black uppercase text-[9px] tracking-widest px-1 block">PAUSES & COUPURES</label>
                
                {editingShift.breaks && editingShift.breaks.length > 0 && (
                  <div className="space-y-2">
                    {editingShift.breaks.map(b => (
                      <div key={b.id} className={`flex items-center justify-between p-3 rounded-xl border ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${darkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                            {b.isMeal ? <Utensils size={14} className="text-indigo-400" /> : <Coffee size={14} className="text-amber-400" />}
                          </div>
                          <div className="flex flex-col text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black">{b.start} - {b.end}</span>
                              {b.isMeal && b.duration < 30 && (
                                <div className="flex items-center gap-1 text-amber-500" title="Moins de 30 min">
                                  <AlertTriangle size={10} />
                                </div>
                              )}
                            </div>
                            <span className="text-[8px] font-bold opacity-60 uppercase tracking-widest">{b.isMeal ? `REPAS (${b.location})` : 'CAFÉ'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEditingBreak(b)} className="p-1.5 text-slate-400 hover:text-indigo-500 transition-colors"><Edit size={14} /></button>
                          <button onClick={() => setEditingShift(p => p ? ({...p, breaks: p.breaks?.filter(br=>br.id!==b.id)}) : null)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!tempBreak.isActive ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => { setEditingBreakId(null); setTempBreak({ ...tempBreak, isActive: true, type: 'cafe', duration: 15, start: '10:00' }); }}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed text-[10px] font-black uppercase tracking-widest transition-all ${darkMode ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'} text-slate-400`}
                    >
                      <Coffee size={14} /> + PAUSE CAFÉ
                    </button>
                    <button 
                      onClick={() => { setEditingBreakId(null); setTempBreak({ ...tempBreak, isActive: true, type: 'repas', duration: 45, start: '12:00' }); }}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed text-[10px] font-black uppercase tracking-widest transition-all ${darkMode ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'} text-slate-400`}
                    >
                      <Utensils size={14} /> + COUPURE REPAS
                    </button>
                  </div>
                ) : (
                  <div className={`p-5 rounded-2xl border space-y-5 animate-slideUp ${darkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                    <div className="flex justify-between items-center text-left">
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{editingBreakId ? 'Modifier' : 'Ajouter'} {tempBreak.type === 'cafe' ? 'Pause Café' : 'Coupure Repas'}</span>
                      <button onClick={() => { setTempBreak({ ...tempBreak, isActive: false }); setEditingBreakId(null); }} className="p-1"><X size={14} /></button>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Début</label>
                        <input 
                          type="time" 
                          className={`bg-transparent font-black text-indigo-500 outline-none text-right cursor-pointer`} 
                          value={tempBreak.start} 
                          onChange={e => setTempBreak({ ...tempBreak, start: e.target.value })} 
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>Durée : {tempBreak.duration} min</span>
                          <span className="text-indigo-400">Fin : {calculateEndTimeFromDuration(tempBreak.start, tempBreak.duration)}</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="120" 
                          className="w-full h-1.5 accent-indigo-500" 
                          value={tempBreak.duration} 
                          onChange={e => setTempBreak({ ...tempBreak, duration: parseInt(e.target.value) })} 
                        />
                      </div>

                      {tempBreak.type === 'repas' && (
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => setTempBreak({ ...tempBreak, location: 'Entreprise' })}
                            className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-[8px] font-black uppercase transition-all ${tempBreak.location === 'Entreprise' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : (darkMode ? 'border-white/5 text-slate-400' : 'border-slate-200 text-slate-500')}`}
                          >
                            <Building2 size={12} /> Entreprise
                          </button>
                          <button 
                            onClick={() => setTempBreak({ ...tempBreak, location: 'Extérieur' })}
                            className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-[8px] font-black uppercase transition-all ${tempBreak.location === 'Extérieur' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : (darkMode ? 'border-white/5 text-slate-400' : 'border-slate-200 text-slate-500')}`}
                          >
                            <MapPin size={12} /> Extérieur
                          </button>
                        </div>
                      )}

                      <button 
                        onClick={addOrUpdateBreak}
                        className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
                      >
                        <PlusCircle size={14} /> {editingBreakId ? 'Mettre à jour' : 'Ajouter'}
                      </button>
                    </div>
                  </div>
                )}
             </div>

           <div className="space-y-3">
             <button 
               onClick={() => onUpdate(editingShift)} 
               disabled={!isShiftValid}
               className={`w-full py-5 rounded-[24px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all border border-white/10 ${!isShiftValid ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white'}`}
             >
               Mettre à jour
             </button>
             {!isShiftValid && (
               <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center animate-pulse">Amplitude invalide</p>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};
