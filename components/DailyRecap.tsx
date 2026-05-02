
import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Utensils, 
  Euro, 
  TrendingUp, 
  Trophy, 
  ChevronRight,
  Sparkles,
  Zap,
  Coffee,
  Edit,
  Trash2,
  X,
  MapPin,
  Building2
} from 'lucide-react';
import { Shift, UserStats } from '../types';
import { getFrenchPublicHolidays, isSundayOrHoliday, toMinutes } from '../src/lib/dateUtils';

interface DailyRecapProps {
  shift: Shift;
  userStats: UserStats;
  hourlyRate: string;
  onClose: () => void;
  darkMode: boolean;
  onUpdateShift: (updatedShift: Shift) => void;
}

const DailyRecap: React.FC<DailyRecapProps> = ({ 
  shift: initialShift, 
  userStats, 
  hourlyRate, 
  onClose, 
  darkMode,
  onUpdateShift 
}) => {
  const [shift, setShift] = React.useState(initialShift);
  const [editingItem, setEditingItem] = React.useState<{ type: 'shift' | 'break'; id?: string } | null>(null);
  const [editData, setEditData] = React.useState<{ start: string; end: string; location?: string }>({ start: '', end: '' });

  // Update local shift if prop changes (external update)
  React.useEffect(() => {
    setShift(initialShift);
  }, [initialShift]);

  const handleEdit = (type: 'shift' | 'break', id?: string) => {
    if (type === 'shift') {
      setEditData({ start: shift.start || '', end: shift.end || '' });
    } else {
      const b = shift.breaks?.find(breakItem => breakItem.id === id);
      if (b) {
        setEditData({ start: b.start, end: b.end, location: b.location });
      }
    }
    setEditingItem({ type, id });
  };

  const handleSave = () => {
    if (!editingItem) return;

    let updatedShift = { ...shift };

    if (editingItem.type === 'shift') {
      updatedShift.start = editData.start;
      updatedShift.end = editData.end;
    } else {
      updatedShift.breaks = shift.breaks?.map(b => {
        if (b.id === editingItem.id) {
          const startMin = toMinutes(editData.start);
          const endMin = toMinutes(editData.end);
          let duration = endMin - startMin;
          if (duration < 0) duration += 1440;
          
          return { ...b, start: editData.start, end: editData.end, location: editData.location, duration: duration };
        }
        return b;
      });
    }

    setShift(updatedShift);
    onUpdateShift(updatedShift);
    setEditingItem(null);
  };

  const handleDelete = (type: 'shift' | 'break', id?: string) => {
    if (type === 'shift') {
      // Pour le shift principal, on ne le supprime pas d'ici généralement, 
      // mais on peut le mettre à --:-- pour "annuler" la fin
      const updatedShift = { ...shift, end: '--:--' };
      setShift(updatedShift);
      onUpdateShift(updatedShift);
      onClose(); // On ferme car le rendu dépend de la fin du shift
    } else {
      const updatedShift = { ...shift, breaks: shift.breaks?.filter(b => b.id !== id) || [] };
      setShift(updatedShift);
      onUpdateShift(updatedShift);
    }
  };

  const calculateStats = () => {
    if (!shift.start || shift.end === '--:--') return null;

    const startMin = toMinutes(shift.start || "00:00");
    const endMin = toMinutes(shift.end || "00:00");
    
    let ampMin = endMin - startMin;
    if (ampMin < 0) ampMin += 1440;

    let breakMin = 0;
    const hasExternalBreak = shift.breaks?.some(b => b.location === 'Extérieur');
    shift.breaks?.forEach(b => {
      breakMin += Number(b.duration) || 0;
    });

    const effMin = Math.max(0, isNaN(ampMin) ? 0 : ampMin - (isNaN(breakMin) ? 0 : breakMin));
    const hourly = parseFloat(hourlyRate) || 11.65;
    
    // Nouvelles indemnités
    let totalAllowances = 0;
    
    // 1. Repas (15.54€)
    const safeAmpMin = isNaN(ampMin) ? 0 : ampMin;
    const safeEffMin = isNaN(effMin) ? 0 : effMin;

    // 1. Repas (15.54€)
    if (startMin <= 660 && endMin >= 870 && hasExternalBreak) {
      totalAllowances += 15.54;
    }

    // 2. Repas Unique (9.59€)
    const sStart = startMin;
    const sEnd = endMin < startMin ? endMin + 1440 : endMin;
    const nightOverlap = Math.min(sEnd, 1860) - Math.max(sStart, 1320);
    if (nightOverlap >= 240) {
      totalAllowances += 9.59;
    }

    // 3. Spéciale (4.34€)
    if (hasExternalBreak && (startMin < 300 || endMin > 1260)) {
      totalAllowances += 4.34;
    }

    // 4. Dimanche & Férié (23.90€ brut)
    if (isSundayOrHoliday(shift.day)) {
      totalAllowances += 23.90;
    }

    const gainsTotal = (safeEffMin / 60) * hourly + totalAllowances;

    return {
      amplitude: `${Math.floor(safeAmpMin / 60)}h ${safeAmpMin % 60}m`,
      effective: `${Math.floor(safeEffMin / 60)}h ${safeEffMin % 60}m`,
      allowanceAmount: totalAllowances.toFixed(2),
      gains: gainsTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    };
  };

  const stats = calculateStats();
  if (!stats) return null;

  return (
    <div className="fixed inset-0 z-[500] overflow-y-auto no-scrollbar">
      <div className={`fixed inset-0 transition-colors duration-700 ${darkMode ? 'bg-slate-950/95' : 'bg-slate-50/95'} backdrop-blur-3xl`} />
      
      <div className="relative min-h-full flex flex-col items-center p-4 sm:p-8">
        <div className="w-full max-w-md flex flex-col space-y-8 animate-slideUp py-12">
          <div className="text-center space-y-4">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-30 animate-pulse" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-[32px] mx-auto flex items-center justify-center shadow-2xl border border-white/20 animate-bounce-slow">
                <CheckCircle2 size={48} className="text-white" strokeWidth={2.5} />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className={`text-4xl font-black tracking-tighter ${darkMode ? 'text-white' : 'text-slate-900'}`}>Mission Terminée</h2>
              <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Indemnités conventionnelles incluses</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`p-6 rounded-[32px] border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'} space-y-2`}>
              <div className="flex items-center gap-2 text-indigo-500">
                <Clock size={16} />
                <span className="text-[9px] font-black uppercase tracking-widest">Amplitude</span>
              </div>
              <p className={`text-2xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>{stats.amplitude}</p>
            </div>

            <div className={`p-6 rounded-[32px] border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'} space-y-2`}>
              <div className="flex items-center gap-2 text-emerald-500">
                <TrendingUp size={16} />
                <span className="text-[9px] font-black uppercase tracking-widest">Gains Journée</span>
              </div>
              <p className={`text-2xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>{stats.gains}€</p>
            </div>

            <div className={`p-6 rounded-[32px] border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'} space-y-2 col-span-2`}>
              <div className="flex items-center gap-2 text-amber-500">
                <Euro size={16} />
                <span className="text-[9px] font-black uppercase tracking-widest">Total Ind.</span>
              </div>
              <p className={`text-2xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>{stats.allowanceAmount}€</p>
            </div>
          </div>

          <div className={`p-6 rounded-[32px] border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'} space-y-4`}>
            <div className="flex items-center gap-2 text-slate-400">
              <Clock size={16} />
              <span className="text-[9px] font-black uppercase tracking-widest">Détail de l'activité</span>
            </div>
            <div className="space-y-3">
              {/* Mission principale */}
              <div className={`flex items-center justify-between p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                    <Zap size={16} />
                  </div>
                  <div>
                    <p className={`text-xs font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>Mission Service</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{shift.start} - {shift.end}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 pr-1">
                  <button 
                    onClick={() => handleEdit('shift')}
                    className="p-1.5 text-slate-400 hover:text-indigo-500 transition-colors"
                  >
                    <Edit size={14} />
                  </button>
                  <button 
                    onClick={() => handleDelete('shift')}
                    className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Pauses */}
              {shift.breaks?.map(b => (
                <div key={b.id} className={`flex items-center justify-between p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${b.isMeal ? 'bg-emerald-500' : 'bg-amber-500'} flex items-center justify-center text-white`}>
                      {b.isMeal ? <Utensils size={16} /> : <Coffee size={16} />}
                    </div>
                    <div>
                      <p className={`text-xs font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>{b.isMeal ? 'Coupure Repas' : 'Pause Café'}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{b.start} - {b.end}</p>
                        {b.isMeal && <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">({b.location})</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 pr-1">
                    <button 
                      onClick={() => handleEdit('break', b.id)}
                      className="p-1.5 text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      <Edit size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete('break', b.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 pb-12">
            <button 
              onClick={onClose} 
              className="w-full py-6 rounded-[28px] bg-indigo-600 text-white font-black uppercase tracking-[0.25em] shadow-2xl shadow-indigo-500/40 active:scale-95 transition-all flex items-center justify-center gap-3 border border-indigo-400/50"
            >
              VALIDER LE SERVICE <ChevronRight size={20} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-fadeIn">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setEditingItem(null)} />
          <div className={`relative w-full max-w-sm rounded-[32px] p-8 shadow-2xl border ${darkMode ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'} animate-popIn`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black tracking-tight">{editingItem.type === 'shift' ? 'Modifier Heures' : 'Modifier Pause'}</h3>
              <button 
                onClick={() => setEditingItem(null)}
                className={`p-2 rounded-xl ${darkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block px-1">Début</label>
                  <input 
                    type="time" 
                    className={`w-full p-4 rounded-2xl border font-black outline-none ${darkMode ? 'bg-slate-950 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    value={editData.start}
                    onChange={(e) => setEditData({ ...editData, start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block px-1">Fin</label>
                  <input 
                    type="time" 
                    className={`w-full p-4 rounded-2xl border font-black outline-none ${darkMode ? 'bg-slate-950 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    value={editData.end}
                    onChange={(e) => setEditData({ ...editData, end: e.target.value })}
                  />
                </div>
              </div>

              {editingItem.type === 'break' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block px-1">Lieu</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setEditData({ ...editData, location: 'Entreprise' })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                        editData.location === 'Entreprise' 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                          : (darkMode ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500')
                      }`}
                    >
                      <Building2 size={14} /> Entreprise
                    </button>
                    <button
                      onClick={() => setEditData({ ...editData, location: 'Extérieur' })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                        editData.location === 'Extérieur' 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                          : (darkMode ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500')
                      }`}
                    >
                      <MapPin size={14} /> Extérieur
                    </button>
                  </div>
                </div>
              )}

              <button 
                onClick={handleSave}
                className="w-full py-5 rounded-[20px] bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-indigo-600/20 active:scale-95 transition-all mt-4"
              >
                ENREGISTRER
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes expandWidth { from { width: 0; } }
        .animate-expandWidth { animation: expandWidth 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-bounce-slow { animation: bounce 3s infinite ease-in-out; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `}</style>
    </div>
  );
};

export default DailyRecap;
