
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ArrowLeft, 
  Car, 
  Calendar, 
  Utensils, 
  Coffee, 
  Building2, 
  MapPin, 
  PlusCircle, 
  AlertTriangle,
  Plane,
  Stethoscope,
  Briefcase
} from 'lucide-react';
import { Shift, Break } from '../types';
import { getLocalDateString, calculateEndTimeFromDuration, parseLocalDate } from '../src/lib/dateUtils';

interface AddPlanningModalProps {
  darkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
  onAddShift: (shift: Partial<Shift> & { isPast: boolean }) => void;
  onAddLeave: (leave: { day: string, endDate: string, type: 'CP' | 'Maladie' | 'Sans solde' | 'AT' | 'SOLIDARITE', hours?: number, isUnpaidButCounted?: boolean }) => void;
  availableVehicles: string[];
  todayStr: string;
  selectedDay?: string;
  leaveBalances: { cp: number };
  leaveDaysCount: number;
  calculateBusinessDays: (start: string, end: string) => number;
  primaryRole?: string;
  shifts: Shift[];
}

export const AddPlanningModal: React.FC<AddPlanningModalProps> = ({
  darkMode,
  isOpen,
  onClose,
  onAddShift,
  onAddLeave,
  availableVehicles,
  todayStr,
  selectedDay,
  leaveBalances,
  calculateBusinessDays,
  primaryRole,
  shifts
}) => {
  const [step, setStep] = useState<'choice' | 'shift' | 'leave' | 'solidarite' | 'ferie_chome'>('choice');
  
  const initialDate = selectedDay || todayStr;
  const isTaxiMode = primaryRole === 'taxi';

  // Shift state
  const [newShift, setNewShift] = useState({
    day: initialDate,
    start: '08:00',
    end: '',
    vehicle: isTaxiMode ? 'TAXI' : (availableVehicles[0] || 'ASSU'),
    breaks: [] as Break[]
  });

  // Leave state
  const [newLeave, setNewLeave] = useState({
    day: initialDate,
    endDate: initialDate,
    type: 'CP' as 'CP' | 'Maladie' | 'Sans solde' | 'AT' | 'SOLIDARITE',
    hours: 5
  });

  // Sync state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const initialDay = selectedDay || todayStr;
      setNewShift(prev => ({
        ...prev,
        day: initialDay
      }));
      setNewLeave(prev => ({
        ...prev,
        day: initialDay,
        endDate: initialDay,
        type: 'CP',
        hours: 5
      }));
      setStep('choice');
    }
  }, [isOpen, selectedDay, todayStr]);

  // Handle date change: reset or load data
  React.useEffect(() => {
    if (!isOpen) return;

    const existingShift = shifts.find(s => s.day === newShift.day);

    if (existingShift) {
      setNewShift(prev => ({
        ...prev,
        start: existingShift.start,
        end: existingShift.end,
        vehicle: existingShift.vehicle,
        breaks: [...(existingShift.breaks || [])]
      }));
    } else {
      setNewShift(prev => ({
        ...prev,
        start: '08:00',
        end: '',
        vehicle: isTaxiMode ? 'TAXI' : (availableVehicles[0] || 'ASSU'),
        breaks: [] // Explicitly clear breaks as requested
      }));
    }
  }, [newShift.day, isOpen, shifts, isTaxiMode, availableVehicles]);

  // Temp break state
  const [tempBreak, setTempBreak] = useState({
    isActive: false,
    type: 'repas' as 'cafe' | 'repas',
    start: '12:00',
    duration: 30,
    location: 'Entreprise' as 'Entreprise' | 'Extérieur'
  });

  const isNewShiftPast = newShift.day < todayStr;
  const leaveDaysCount = useMemo(() => calculateBusinessDays(newLeave.day, newLeave.endDate), [newLeave.day, newLeave.endDate, calculateBusinessDays]);
  const currentBalance = newLeave.type === 'CP' ? leaveBalances.cp : Infinity;
  const isBalanceInsufficient = leaveDaysCount > currentBalance;
  const estimatedNewBalance = currentBalance === Infinity ? Infinity : currentBalance - leaveDaysCount;

  const currentYear = new Date().getFullYear();
  const hasSolidariteThisYear = useMemo(() => {
    return shifts.some(s => 
      s.leaveType === 'SOLIDARITE' && 
      (s.day.startsWith(currentYear.toString()) || parseLocalDate(s.day).getFullYear() === currentYear)
    );
  }, [shifts, currentYear]);

  const inputClass = `w-full p-4 rounded-2xl border font-black outline-none transition-all placeholder:text-slate-400 ${
    darkMode 
      ? 'bg-[#0F1221] border-white/5 text-white focus:border-indigo-500' 
      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white'
  }`;

  const getVehicleConfig = (v: string) => {
    if (v.includes('ASSU')) return { bg: 'bg-[#FF4B5C]', text: 'text-[#FF4B5C]', icon: Stethoscope };
    if (v.includes('VSL')) return { bg: 'bg-indigo-500', text: 'text-indigo-500', icon: Briefcase };
    if (v.includes('TAXI')) return { bg: 'bg-amber-500', text: 'text-amber-500', icon: Car };
    return { bg: 'bg-emerald-500', text: 'text-emerald-500', icon: Car };
  };

  const addTempBreak = () => {
    const end = calculateEndTimeFromDuration(tempBreak.start, tempBreak.duration);
    const b: Break = {
      id: Math.random().toString(36).substr(2, 9),
      start: tempBreak.start,
      end,
      duration: tempBreak.duration,
      location: tempBreak.location,
      isMeal: tempBreak.type === 'repas'
    };
    setNewShift(prev => ({ ...prev, breaks: [...prev.breaks, b] }));
    setTempBreak(prev => ({ ...prev, isActive: false }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-fadeIn">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={onClose} />
      
      <AnimatePresence mode="wait">
        {step === 'choice' && (
          <motion.div 
            key="choice"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className={`relative w-full max-w-sm rounded-[40px] p-8 shadow-2xl border ${darkMode ? 'bg-[#15192D] border-white/10 text-white' : 'bg-white text-slate-900'}`}
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black tracking-tight">Que veux-tu ajouter ?</h3>
              <button onClick={onClose} className={`p-3 rounded-2xl ${darkMode ? 'bg-slate-500/5' : 'bg-slate-100'}`}><X size={20} /></button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => setStep('shift')}
                className={`flex items-center gap-6 p-6 rounded-[32px] border-2 transition-all group ${darkMode ? 'bg-white/5 border-white/5 hover:bg-indigo-600 hover:border-indigo-400' : 'bg-slate-50 border-slate-100 hover:bg-indigo-600 hover:border-indigo-400 hover:text-white'}`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${darkMode ? 'bg-white/10 group-hover:bg-white/20' : 'bg-indigo-100 group-hover:bg-white/20'}`}>
                  <Car size={32} className={darkMode ? 'text-indigo-400 group-hover:text-white' : 'text-indigo-600 group-hover:text-white'} />
                </div>
                <div className="text-left font-sans">
                  <p className="text-lg font-black leading-tight">Journée de travail</p>
                  <p className={`text-xs font-bold uppercase tracking-widest opacity-60 ${darkMode ? '' : 'group-hover:text-white/80'}`}>
                    {isTaxiMode ? "Taxi" : "Ambulance, VSL, ASSU"}
                  </p>
                </div>
              </button>

              <button 
                onClick={() => setStep('leave')}
                className={`flex items-center gap-6 p-6 rounded-[32px] border-2 transition-all group ${darkMode ? 'bg-white/5 border-white/5 hover:bg-orange-600 hover:border-orange-400' : 'bg-slate-50 border-slate-100 hover:bg-orange-600 hover:border-orange-400 hover:text-white'}`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${darkMode ? 'bg-white/10 group-hover:bg-white/20' : 'bg-orange-100 group-hover:bg-white/20'}`}>
                  <Calendar size={32} className={darkMode ? 'text-orange-400 group-hover:text-white' : 'text-orange-600 group-hover:text-white'} />
                </div>
                <div className="text-left font-sans">
                  <p className="text-lg font-black leading-tight">Absence / Congé</p>
                  <p className={`text-xs font-bold uppercase tracking-widest opacity-60 ${darkMode ? '' : 'group-hover:text-white/80'}`}>CP, Maladie...</p>
                </div>
              </button>

              <button 
                onClick={() => setStep('ferie_chome')}
                className={`flex items-center gap-6 p-6 rounded-[32px] border-2 transition-all group ${darkMode ? 'bg-white/5 border-white/5 hover:bg-violet-600 hover:border-violet-400' : 'bg-slate-50 border-slate-100 hover:bg-violet-600 hover:border-violet-400 hover:text-white'}`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${darkMode ? 'bg-white/10 group-hover:bg-white/20' : 'bg-violet-100 group-hover:bg-white/20'}`}>
                  <Calendar size={32} className={darkMode ? 'text-violet-400 group-hover:text-white' : 'text-violet-600 group-hover:text-white'} />
                </div>
                <div className="text-left font-sans">
                  <p className="text-lg font-black leading-tight">Jour férié chômé</p>
                  <p className={`text-xs font-bold uppercase tracking-widest opacity-60 ${darkMode ? '' : 'group-hover:text-white/80'}`}>Garantie 7h chômée</p>
                </div>
              </button>

              {!hasSolidariteThisYear && (
                <button 
                  onClick={() => { setStep('solidarite'); setNewLeave(prev => ({ ...prev, type: 'SOLIDARITE' })); }}
                  className={`flex items-center gap-6 p-6 rounded-[32px] border-2 transition-all group ${darkMode ? 'bg-[#1D2140]/60 border-indigo-500/20 text-indigo-300 hover:bg-indigo-700 hover:border-indigo-500 hover:text-white' : 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100'}`}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${darkMode ? 'bg-indigo-500/10 group-hover:bg-indigo-600' : 'bg-indigo-100 group-hover:bg-indigo-200'}`}>
                    <Calendar size={32} className="text-indigo-600" />
                  </div>
                  <div className="text-left font-sans">
                    <p className="text-lg font-black leading-tight">Solidarité</p>
                    <p className={`text-xs font-bold uppercase tracking-widest opacity-60 ${darkMode ? 'text-indigo-400/80' : 'text-indigo-700'}`}>Journée de Solidarité</p>
                  </div>
                </button>
              )}
            </div>
          </motion.div>
        )}

        {step === 'shift' && (
          <motion.div 
            key="shift"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className={`relative w-full max-w-sm rounded-[32px] p-8 shadow-2xl border ${darkMode ? 'bg-[#15192D] border-white/10 text-white' : 'bg-white text-slate-900'} max-h-[90vh] overflow-y-auto no-scrollbar`}
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep('choice')} className="p-2 bg-slate-500/5 rounded-xl hover:bg-slate-500/10 transition-colors"><ArrowLeft size={18} /></button>
                <h3 className="text-xl font-black tracking-tight">{isNewShiftPast ? "Fin de journée" : "Nouvelle mission"}</h3>
              </div>
              <button onClick={onClose} className={`p-3 rounded-2xl ${darkMode ? 'bg-slate-500/5' : 'bg-slate-100'}`}><X size={20} /></button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block px-1">Date</label>
                <input type="date" className={inputClass} value={newShift.day} onChange={(e) => setNewShift({...newShift, day: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block px-1">Début</label>
                  <input type="time" className={inputClass} value={newShift.start} onChange={(e) => setNewShift({...newShift, start: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block px-1">Fin</label>
                  <input type="time" className={inputClass} value={newShift.end === '--:--' ? '' : newShift.end} onChange={(e) => setNewShift({...newShift, end: e.target.value})} />
                </div>
              </div>

              {!isTaxiMode && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block px-1">Véhicule</label>
                  <div className="grid grid-cols-3 gap-2">
                    {availableVehicles.map((v) => {
                      const config = getVehicleConfig(v);
                      const isSelected = newShift.vehicle === v;
                      return (
                        <button 
                          key={v} 
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewShift({ ...newShift, vehicle: v });
                          }} 
                          className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1.5 ${
                            isSelected 
                              ? `${config.bg} border-white/20 text-white shadow-lg` 
                              : (darkMode ? 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100')
                          }`}
                        >
                          <config.icon size={20} />
                          <span className="text-[9px] font-black tracking-widest">{v}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isNewShiftPast && (
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block px-1">Pauses & Coupures</label>
                  
                  {newShift.breaks.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {newShift.breaks.map(b => (
                        <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                          <div className="flex items-center gap-2">
                            {b.isMeal ? <Utensils size={14} className="text-indigo-400" /> : <Coffee size={14} className="text-amber-400" />}
                            <span className="text-[10px] font-black">{b.start} - {b.end}</span>
                            {b.isMeal && <span className="text-[8px] opacity-60">({b.location})</span>}
                          </div>
                          <button onClick={() => setNewShift(prev => ({...prev, breaks: prev.breaks.filter(br => br.id !== b.id)}))}>
                            <X size={14} className="text-slate-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {!tempBreak.isActive ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setTempBreak({ ...tempBreak, isActive: true, type: 'cafe', duration: 20, start: '10:00' })}
                        className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all text-slate-400"
                      >
                        <Coffee size={14} /> Pause Café
                      </button>
                      <button 
                        onClick={() => setTempBreak({ ...tempBreak, isActive: true, type: 'repas', duration: 30, start: '12:00' })}
                        className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all text-slate-400"
                      >
                        <Utensils size={14} /> Coupure Repas
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{tempBreak.type === 'cafe' ? 'Pause Café' : 'Repas'}</span>
                        <button onClick={() => setTempBreak(p => ({...p, isActive: false}))}><X size={14} /></button>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <span className="text-[9px] font-bold text-slate-400 uppercase">Début</span>
                           <input type="time" className="bg-transparent font-black text-indigo-500" value={tempBreak.start} onChange={e => setTempBreak(p => ({...p, start: e.target.value}))} />
                        </div>
                        <div className="space-y-2">
                           <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                              <span>Durée : {tempBreak.duration} min</span>
                              <span className="text-indigo-400">Fin : {calculateEndTimeFromDuration(tempBreak.start, tempBreak.duration)}</span>
                           </div>
                           <input type="range" min="1" max="120" className="w-full h-1.5 accent-indigo-500" value={tempBreak.duration} onChange={e => setTempBreak(p => ({...p, duration: parseInt(e.target.value)}))} />
                        </div>
                        {tempBreak.type === 'repas' && (
                           <div className="grid grid-cols-2 gap-2">
                              <button onClick={() => setTempBreak(p => ({...p, location: 'Entreprise'}))} className={`p-2 rounded-lg text-[8px] font-black border transition-all ${tempBreak.location === 'Entreprise' ? 'bg-indigo-600 text-white' : 'border-white/5 text-slate-400'}`}>Entreprise</button>
                              <button onClick={() => setTempBreak(p => ({...p, location: 'Extérieur'}))} className={`p-2 rounded-lg text-[8px] font-black border transition-all ${tempBreak.location === 'Extérieur' ? 'bg-indigo-600 text-white' : 'border-white/5 text-slate-400'}`}>Extérieur</button>
                           </div>
                        )}
                        <button onClick={addTempBreak} className="w-full py-3 bg-indigo-600 rounded-xl text-[10px] font-black uppercase text-white shadow-lg">Ajouter</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button 
                onClick={() => {
                  const finalShift = {
                    ...newShift,
                    end: newShift.end && newShift.end !== '' ? newShift.end : '--:--',
                    isPast: isNewShiftPast
                  };
                  onAddShift(finalShift);
                }}
                className="w-full py-5 rounded-[24px] bg-indigo-600 text-white font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all mt-4"
              >
                Enregistrer
              </button>
            </div>
          </motion.div>
        )}

        {step === 'leave' && (
          <motion.div 
            key="leave"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className={`relative w-full max-w-sm rounded-[32px] p-8 shadow-2xl border ${darkMode ? 'bg-[#15192D] border-white/10 text-white' : 'bg-white text-slate-900'}`}
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep('choice')} className="p-2 bg-slate-500/5 rounded-xl hover:bg-slate-500/10 transition-colors"><ArrowLeft size={18} /></button>
                <h3 className="text-xl font-black tracking-tight">Absence / Congé</h3>
              </div>
              <button onClick={onClose} className={`p-3 rounded-2xl ${darkMode ? 'bg-slate-500/5' : 'bg-slate-100'}`}><X size={20} /></button>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest block px-1">Du (Inclus)</label>
                    <input 
                      type="date" 
                      className={inputClass.replace('indigo', 'orange')} 
                      value={newLeave.day} 
                      onChange={(e) => setNewLeave({...newLeave, day: e.target.value, endDate: e.target.value > newLeave.endDate ? e.target.value : newLeave.endDate})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest block px-1">Au (Inclus)</label>
                    <input 
                      type="date" 
                      className={inputClass.replace('indigo', 'orange')} 
                      value={newLeave.endDate} 
                      onChange={(e) => setNewLeave({...newLeave, endDate: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest block px-1">Type d'absence</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'CP', label: 'CP' },
                      { id: 'Maladie', label: 'Maladie' },
                      { id: 'Sans solde', label: 'Sans solde' },
                      { id: 'AT', label: 'AT' }
                    ].map(type => {
                      const isSelected = newLeave.type === type.id;
                      let btnClass = '';
                      if (isSelected) {
                        btnClass = 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-600/20';
                      } else {
                        btnClass = darkMode 
                          ? 'bg-slate-950/40 border-white/5 text-slate-500 hover:text-slate-300' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100';
                      }
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setNewLeave({...newLeave, type: type.id as any})}
                          className={`py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${btnClass}`}
                        >
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              <div className={`p-5 rounded-3xl border-2 transition-all ${isBalanceInsufficient ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Jours décomptés</span>
                  <span className="text-sm font-black">{leaveDaysCount} j</span>
                </div>
                {newLeave.type === 'CP' && (
                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Nouveau solde estimé</span>
                    <span className={`text-sm font-black ${isBalanceInsufficient ? 'text-red-500' : 'text-emerald-500'}`}>
                      {estimatedNewBalance} j
                    </span>
                  </div>
                )}
                {isBalanceInsufficient && (
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-3 animate-pulse">Solde insuffisant</p>
                )}
              </div>

              <button 
                onClick={() => onAddLeave({
                  ...newLeave,
                  isUnpaidButCounted: false,
                  hours: undefined
                })} 
                disabled={isBalanceInsufficient}
                className={`w-full py-5 rounded-[24px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all mt-4 border border-white/10 ${isBalanceInsufficient ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-[#2ECC71] text-white'}`}
              >
                Valider
              </button>
            </div>
          </motion.div>
        )}

        {step === 'solidarite' && (
          <motion.div 
            key="solidarite"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className={`relative w-full max-w-sm rounded-[32px] p-8 shadow-2xl border ${darkMode ? 'bg-[#15192D] border-white/10 text-white' : 'bg-white text-slate-900'}`}
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep('choice')} className="p-2 bg-slate-500/5 rounded-xl hover:bg-slate-500/10 transition-colors"><ArrowLeft size={18} /></button>
                <h3 className="text-xl font-black tracking-tight font-sans">Journée de Solidarité</h3>
              </div>
              <button onClick={onClose} className={`p-3 rounded-2xl ${darkMode ? 'bg-slate-500/5' : 'bg-slate-100'}`}><X size={20} /></button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black p-0 text-indigo-500 uppercase tracking-widest block px-1">Date de Solidarité</label>
                <input 
                  type="date" 
                  className={inputClass} 
                  value={newLeave.day} 
                  onChange={(e) => setNewLeave({...newLeave, day: e.target.value, endDate: e.target.value})} 
                />
              </div>

              <div className="space-y-2 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-left animate-fadeIn">
                <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block px-1">Heures effectuées</label>
                <div className="flex items-center justify-between gap-4">
                  <input 
                    type="number" 
                    min="1" 
                    max="24"
                    step="0.5"
                    placeholder="Ex: 5"
                    className={`w-full p-3 rounded-xl border text-center font-black outline-none transition-all ${
                      darkMode 
                        ? 'bg-[#0F1221] border-[#6366F1]/30 text-white focus:border-indigo-500' 
                        : 'bg-[#F8FAFC] border-indigo-200 text-slate-900 focus:border-indigo-500 focus:bg-white'
                    }`}
                    value={newLeave.hours} 
                    onChange={(e) => setNewLeave({...newLeave, hours: parseFloat(e.target.value) || 0})} 
                  />
                  <span className="text-[10px] font-black text-indigo-500 shrink-0 uppercase tracking-widest font-sans">Heures</span>
                </div>
                <p className={`text-[9px] font-bold italic leading-snug px-1 ${darkMode ? 'text-indigo-400/80 font-sans' : 'text-slate-500 font-sans'}`}>
                  * Les heures entrent dans le quota de modulation mensuelle mais ont un taux horaire égal à 0 pour le calcul du Net (isUnpaidButCounted).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setStep('choice')}
                  className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border ${
                    darkMode 
                      ? 'border-white/10 text-slate-300 hover:bg-white/5' 
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 font-sans'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => onAddLeave({
                    day: newLeave.day,
                    endDate: newLeave.day,
                    type: 'SOLIDARITE',
                    hours: newLeave.hours || 5, // default to 5h if not filled
                    isUnpaidButCounted: true
                  })}
                  className="py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-center font-sans"
                >
                  Valider
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'ferie_chome' && (
          <motion.div 
            key="ferie_chome"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className={`relative w-full max-w-sm rounded-[32px] p-8 shadow-2xl border ${darkMode ? 'bg-[#15192D] border-white/10 text-white' : 'bg-white text-slate-900'}`}
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setStep('choice')} className="p-2 bg-slate-500/5 rounded-xl hover:bg-slate-500/10 transition-colors"><ArrowLeft size={18} /></button>
                <h3 className="text-xl font-black tracking-tight font-sans">Jour férié chômé</h3>
              </div>
              <button type="button" onClick={onClose} className={`p-3 rounded-2xl ${darkMode ? 'bg-slate-500/5' : 'bg-slate-100'}`}><X size={20} /></button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black p-0 text-violet-500 uppercase tracking-widest block px-1">Date</label>
                <input 
                  type="date" 
                  className={inputClass.replace('indigo', 'violet').replace('orange', 'violet')} 
                  value={newShift.day} 
                  onChange={(e) => setNewShift({...newShift, day: e.target.value})} 
                />
              </div>

              <div className="p-5 rounded-3xl border-2 bg-violet-500/10 border-violet-500/30 font-sans">
                <p className="text-xs font-semibold leading-relaxed text-slate-300">
                  Conformément à la convention collective nationale des transports routiers (secteur sanitaire), le jour férié chômé non travaillé donne lieu à un maintien de rémunération et compte pour <strong>7h de Temps de Travail Effectif (TTE)</strong>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setStep('choice')}
                  className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border ${
                    darkMode 
                      ? 'border-white/10 text-slate-300 hover:bg-white/5' 
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 font-sans'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddShift({
                      day: newShift.day,
                      start: '00:00',
                      end: '00:00',
                      crew: 'Chômé',
                      vehicle: 'FÉRIÉ',
                      breaks: [],
                      isFerieChome: true,
                      isPast: true
                    });
                  }}
                  className="py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-violet-600/20 active:scale-95 transition-all text-center font-sans"
                >
                  Valider
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
