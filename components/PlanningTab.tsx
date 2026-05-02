
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Car, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Stethoscope, 
  Briefcase, 
  Coffee, 
  Utensils, 
  Edit, 
  X,
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  Check,
  Trash2,
  RefreshCw,
  MapPin,
  Building2,
  PlusCircle,
  ArrowLeft,
  Calendar,
  Plane,
  AlertTriangle
} from 'lucide-react';
import { Shift, Break, ServiceStatus, AppTab } from '../types';
import { AddPlanningModal } from './AddPlanningModal';
import { EditShiftModal } from './EditShiftModal';
import { PlanningSummary } from './PlanningSummary';
import { 
  getLocalDateString, 
  getFrenchPublicHolidays, 
  calculateBusinessDays, 
  calculateTotalDuration,
  calculateTotalDurationMinutes,
  toMinutes
} from '../src/lib/dateUtils';

interface PlanningTabProps {
  darkMode?: boolean;
  status?: ServiceStatus;
  setStatus?: (status: ServiceStatus) => void;
  onAutoStartService?: (shiftId: string, startTime: string, shiftDay: string) => void;
  onEndServiceSilently?: () => void;
  appCurrentTime: Date;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  activeShiftId: string | null;
  setActiveShiftId: React.Dispatch<React.SetStateAction<string | null>>;
  availableVehicles: string[];
  hourlyRate: string;
  setActiveTab: (tab: AppTab) => void;
  workRegime?: string;
  cpCalculationMode: '25' | '30';
  modulationWeeks?: string;
  modulationStartDate?: string;
  contractStartDate?: string;
  leaveBalances: { cp: number };
  initialCpBalance: number;
  setInitialCpBalance: (val: number) => void;
  weekendDays: string[];
  setWeekendDays: React.Dispatch<React.SetStateAction<string[]>>;
}

type ViewType = 'week' | 'month';

const PlanningTab: React.FC<PlanningTabProps> = ({ 
  darkMode = false, 
  status = ServiceStatus.OFF, 
  setStatus,
  onAutoStartService,
  onEndServiceSilently,
  appCurrentTime,
  shifts,
  setShifts,
  activeShiftId,
  setActiveShiftId,
  availableVehicles,
  workRegime,
  cpCalculationMode,
  modulationWeeks,
  modulationStartDate,
  contractStartDate,
  leaveBalances,
  initialCpBalance,
  setInitialCpBalance,
  weekendDays,
  setWeekendDays
}) => {
  const [viewType, setViewType] = useState<ViewType>('week');
  const [pivotDate, setPivotDate] = useState(new Date(appCurrentTime));
  
  const todayStr = useMemo(() => getLocalDateString(appCurrentTime), [appCurrentTime]);

  const currentYearHolidaysMap = useMemo(() => {
    return getFrenchPublicHolidays(pivotDate.getFullYear());
  }, [pivotDate]);

  const currentYearHolidays = useMemo(() => {
    return Object.keys(currentYearHolidaysMap);
  }, [currentYearHolidaysMap]);

  const modulationEndDateStr = useMemo(() => {
    if (!modulationStartDate || !modulationWeeks) return null;
    try {
      const start = new Date(modulationStartDate);
      const weeks = parseInt(modulationWeeks) || 4;
      const end = new Date(start);
      end.setDate(start.getDate() + (weeks * 7) - 1);
      return getLocalDateString(end);
    } catch (e) {
      return null;
    }
  }, [modulationStartDate, modulationWeeks, getLocalDateString]);

  const [selectedDay, setSelectedDay] = useState<string>(todayStr);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  
  const toggleWeekend = (dateStr: string) => {
    setWeekendDays(prev => 
      prev.includes(dateStr) 
        ? prev.filter(d => d !== dateStr) 
        : [...prev, dateStr]
    );
  };

  const modulationPeriod = useMemo(() => {
    if (workRegime !== 'modulation' || !modulationWeeks) return null;
    
    const weeksCount = parseInt(modulationWeeks) || 4;
    const cycleDays = weeksCount * 7;
    const anchor = modulationStartDate ? new Date(modulationStartDate) : (contractStartDate ? new Date(contractStartDate) : new Date(2024, 0, 1));
    anchor.setHours(0, 0, 0, 0);
    
    const diffMs = pivotDate.getTime() - anchor.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const currentCycleIndex = Math.floor(diffDays / cycleDays);
    
    const start = new Date(anchor);
    start.setDate(anchor.getDate() + (currentCycleIndex * cycleDays));
    
    const end = new Date(start);
    end.setDate(start.getDate() + cycleDays - 1);

    // Calculate hours in this period
    const periodShifts = shifts.filter(s => {
      const d = s.day;
      return d >= getLocalDateString(start) && d <= getLocalDateString(end);
    });

    let totalMins = 0;
    periodShifts.forEach(s => {
      if (!s.isLeave && s.vehicle !== 'CONGÉ') {
        totalMins += calculateTotalDurationMinutes(s);
      }
    });

    const expectedHours = 35 * weeksCount; // Base for modulation

    return {
      start: start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
      end: end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
      total: totalMins,
      expected: expectedHours * 60
    };
  }, [workRegime, modulationStartDate, modulationWeeks, contractStartDate, pivotDate, shifts]);

  const navigate = (direction: number) => {
    const newDate = new Date(pivotDate);
    if (viewType === 'week') newDate.setDate(newDate.getDate() + (direction * 7));
    else if (viewType === 'month') newDate.setMonth(newDate.getMonth() + direction);
    setPivotDate(newDate);
  };

  const goToToday = () => {
    const now = new Date();
    setPivotDate(now);
    setSelectedDay(getLocalDateString(now));
  };

  const getVehicleConfig = (v: string) => {
    if (v?.includes('ASSU')) return { bg: 'bg-[#FF4B5C]', text: 'text-[#FF4B5C]', icon: Stethoscope, label: 'ASSU' };
    if (v?.includes('VSL')) return { bg: 'bg-indigo-500', text: 'text-indigo-500', icon: Briefcase, label: 'VSL' };
    return { bg: 'bg-emerald-500', text: 'text-emerald-500', icon: Car, label: 'AMBU' };
  };

  const handleDeleteShift = (id: string) => {
    setShifts(prev => prev.filter(s => s.id !== id));
    if (id === activeShiftId) onEndServiceSilently?.();
  };

  const handleUpdateShift = (updatedShift: Shift) => {
    if (updatedShift.id === activeShiftId && updatedShift.end !== '--:--') onEndServiceSilently?.();
    setShifts(prev => prev.map(s => s.id === updatedShift.id ? updatedShift : s));
    setShowEditModal(false);
  };

  const onAddShift = (data: Partial<Shift> & { isPast: boolean }) => {
    const shiftId = Math.random().toString(36).substr(2, 9);
    const shiftData: Shift = { 
      id: shiftId,
      day: data.day!,
      start: data.start!,
      end: data.isPast ? (data.end || '18:00') : '--:--', 
      crew: 'Équipage',
      vehicle: data.vehicle!,
      breaks: data.breaks || []
    };

    setShifts(prev => [shiftData, ...prev]);
    if (!data.isPast && onAutoStartService) onAutoStartService(shiftId, shiftData.start, shiftData.day);
    setShowAddModal(false);
  };

  const onAddLeave = (data: { day: string, endDate: string, type: 'CP' | 'Maladie' | 'Sans solde' | 'AT' }) => {
    const startDate = new Date(data.day);
    const endDate = new Date(data.endDate);
    const today = new Date().toLocaleDateString('fr-FR');
    
    const newShifts: Shift[] = [];
    const curDate = new Date(startDate);
    const yearHolidays: Record<number, Record<string, string>> = {};
    
    while (curDate <= endDate) {
      const dStr = getLocalDateString(curDate);
      const year = curDate.getFullYear();
      if (!yearHolidays[year]) {
        yearHolidays[year] = getFrenchPublicHolidays(year);
      }

      const isHoliday = !!yearHolidays[year][dStr];
      const isUserWeekend = weekendDays.includes(dStr);
      const dayOfWeek = curDate.getDay();

      let isBusinessDay = false;
      if (!isHoliday && !isUserWeekend) {
        if (cpCalculationMode === '30') isBusinessDay = dayOfWeek !== 0;
        else isBusinessDay = dayOfWeek !== 0 && dayOfWeek !== 6;
      }

      if (isBusinessDay) {
        const shiftId = Math.random().toString(36).substr(2, 9);
        newShifts.push({
          id: shiftId,
          day: dStr,
          start: '00:00',
          end: '00:00',
          crew: 'Personnel',
          vehicle: 'CONGÉ',
          isLeave: true,
          leaveType: data.type === 'Maladie' ? 'MAL' : data.type === 'Sans solde' ? 'CSS' : data.type as any,
          note: `Décompté le ${today}`
        });
      }
      curDate.setDate(curDate.getDate() + 1);
    }

    setShifts(prev => [...newShifts, ...prev]);
    setShowAddModal(false);
  };

  const bentoCardBase = (active: boolean = false) => `relative overflow-hidden transition-all duration-300 rounded-[32px] border ${darkMode ? (active ? 'bg-[#15192D] border-white/10 shadow-2xl' : 'bg-[#0F1221] border-white/5') : (active ? 'bg-white border-slate-200 shadow-xl shadow-slate-200/50' : 'bg-slate-50 border-slate-200 shadow-sm')}`;

  const renderShiftItem = (shift: Shift) => {
    const config = getVehicleConfig(shift.vehicle);
    const isLeave = shift.isLeave || shift.vehicle === 'CONGÉ';
    const isCompleted = shift.end !== '--:--' || isLeave;
    const duration = isLeave ? '7H 0M' : calculateTotalDuration(shift);

    return (
      <div key={shift.id} className={`p-4 pr-5 rounded-[28px] ${darkMode ? 'bg-[#1A1F36] border border-white/5' : 'bg-white border border-slate-100'} flex flex-col gap-4 group animate-fadeIn ${isLeave ? 'border-orange-500/30' : ''}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={`w-14 h-14 rounded-2xl ${isLeave ? 'bg-orange-500' : config.bg} flex items-center justify-center shadow-lg flex-shrink-0`}>
              {isLeave ? <Plane size={28} className="text-white" strokeWidth={2} /> : <config.icon size={28} className="text-white" strokeWidth={2} />}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {isLeave ? (
                  <span className="text-xl font-black text-orange-500 tracking-tight leading-none uppercase truncate">{shift.leaveType || 'CONGÉ'}</span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-slate-900'} tracking-tight tabular-nums leading-none`}>{shift.start}</span>
                    <span className={`font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>—</span>
                    <span className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-slate-900'} tracking-tight tabular-nums leading-none`}>{shift.end === '--:--' ? <span className="text-slate-400 animate-pulse">...</span> : shift.end}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className={`${isLeave ? 'text-orange-400' : 'text-[#FF4B5C]'} text-[10px] font-black uppercase tracking-[0.1em]`}>{isLeave ? 'ABSENCE' : config.label}</span>
                <span className={`${darkMode ? 'text-slate-800' : 'text-slate-300'} text-[10px]`}>•</span>
                <div className={`flex items-center gap-1.5 ${isLeave ? 'text-orange-400' : 'text-emerald-500'} font-black text-[10px] uppercase tracking-[0.1em]`}>
                  <span>{duration}</span>
                  {isCompleted && !isLeave && <Check size={10} strokeWidth={4} />}
                </div>
              </div>
              {shift.note && (
                <p className="text-[9px] font-bold text-slate-500 mt-1 italic truncate">{shift.note}</p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 flex-shrink-0">
            <button onClick={() => { setEditingShift({ ...shift }); setShowEditModal(true); }} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 border ${darkMode ? 'border-white/10 text-slate-400 bg-white/5 hover:text-indigo-400 hover:border-indigo-500/30' : 'border-slate-100 text-slate-400 bg-slate-50 hover:text-indigo-600'}`}><Edit size={16} /></button>
            <button onClick={() => handleDeleteShift(shift.id)} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 border ${darkMode ? 'border-white/10 text-slate-400 bg-white/5 hover:text-[#FF4B5C] hover:border-red-500/30' : 'border-slate-100 text-slate-400 bg-slate-50 hover:text-red-500'}`}><Trash2 size={16} /></button>
          </div>
        </div>
        {isCompleted && !isLeave && shift.breaks && shift.breaks.length > 0 && (
          <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-white/10' : 'border-slate-100'} animate-fadeIn`}>
            <p className="text-[10px] font-black uppercase opacity-40 tracking-widest mb-3">Détail des pauses</p>
            <div className="space-y-2">
              {shift.breaks.map((b) => (
                <div key={b.id} className={`flex items-center justify-between gap-3 ${darkMode ? 'bg-white/5 border border-white/5' : 'bg-slate-50 border border-slate-100'} p-3 rounded-xl`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${darkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                      {b.isMeal ? <Utensils size={16} className={`${darkMode ? 'text-indigo-300' : 'text-indigo-600'}`} /> : <Coffee size={16} className={`${darkMode ? 'text-amber-300' : 'text-amber-600'}`} />}
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className={`text-xs font-black ${darkMode ? 'text-white/90' : 'text-slate-900'}`}>{b.isMeal ? 'Coupure Repas' : 'Pause Café'}</span>
                      <span className={`text-[10px] font-medium ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>{b.start} - {b.end} ({b.duration} min)</span>
                    </div>
                    {b.isMeal && (
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${b.location === 'Extérieur' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>{b.location}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 pr-1">
                    <button onClick={() => { setEditingShift({...shift}); setShowEditModal(true); }} className="p-1.5 text-slate-400 hover:text-indigo-500 transition-colors"><Edit size={14} /></button>
                    <button onClick={() => {
                      const newShift = {...shift, breaks: shift.breaks?.filter(br => br.id !== b.id)};
                      handleUpdateShift(newShift);
                    }} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {isLeave && shift.note && (
          <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-white/10' : 'border-slate-100'} animate-fadeIn`}>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 italic">
              <Clock size={12} />
              <span>{shift.note}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getDayShifts = (dateStr: string) => shifts.filter(s => s.day === dateStr);
  
  const weekDays = useMemo(() => {
    const start = new Date(pivotDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [pivotDate]);

  const monthDays = useMemo(() => {
    const year = pivotDate.getFullYear();
    const month = pivotDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1);
    const days = [];
    for (let i = startPadding; i > 0; i--) days.push(new Date(year, month, 1 - i));
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    const endPadding = 42 - days.length;
    for (let i = 1; i <= endPadding; i++) days.push(new Date(year, month + 1, i));
    return days;
  }, [pivotDate]);

  const currentViewShifts = useMemo(() => {
    const days = viewType === 'week' ? weekDays : monthDays;
    const dayStrings = days.map(d => getLocalDateString(d));
    return shifts.filter(s => dayStrings.includes(s.day));
  }, [viewType, weekDays, monthDays, shifts]);

  const viewStats = useMemo(() => {
    let totalMins = 0;
    let cpDays = 0;
    currentViewShifts.forEach(s => {
      if (s.isLeave || s.vehicle === 'CONGÉ') {
        if (s.leaveType === 'CP') cpDays += 1;
      } else if (s.start && s.end && s.end !== '--:--') {
        totalMins += calculateTotalDurationMinutes(s);
      }
    });
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return {
      totalHours: `${h}h${m.toString().padStart(2, '0')}`,
      cpDays
    };
  }, [currentViewShifts]);

  return (
    <div className="p-4 space-y-6 animate-fadeIn pb-40">
      <PlanningSummary 
        darkMode={darkMode}
        totalHours={viewStats.totalHours}
        totalCp={viewStats.cpDays}
        modulationHours={modulationPeriod && (modulationPeriod.total > (modulationPeriod.expected || 0)) ? Math.floor((modulationPeriod.total - (modulationPeriod.expected || 0)) / 60) : undefined}
      />

      <div className={`p-1 rounded-2xl flex gap-1 ${darkMode ? 'bg-slate-950 border border-white/5' : 'bg-slate-200/50'}`}>
        {['week', 'month'].map((v) => (
          <button key={v} onClick={() => setViewType(v as ViewType)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewType === v ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
            {v === 'week' ? 'Semaine' : 'Mois'}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-3 bg-slate-500/5 rounded-2xl hover:bg-slate-500/10 transition-colors"><ChevronLeft size={20} /></button>
            <div className="flex flex-col">
              <h2 className="text-xl font-black tracking-tight capitalize leading-none">{viewType === 'week' ? 'Mon Agenda' : pivotDate.toLocaleDateString('fr-FR', {month:'long', year:'numeric'})}</h2>
              <div className="flex items-center gap-2">
                {getLocalDateString(pivotDate) !== todayStr && (
                  <button onClick={goToToday} className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1">Aujourd'hui</button>
                )}
                {workRegime === 'modulation' && modulationPeriod && (
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    Cycle : {modulationPeriod.start} - {modulationPeriod.end}
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => navigate(1)} className="p-3 bg-slate-500/5 rounded-2xl hover:bg-slate-500/10 transition-colors"><ChevronRight size={20} /></button>
          </div>
          <button onClick={() => setShowAddModal(true)} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/20 flex items-center justify-center active:scale-95 transition-all">
            <Plus size={24} strokeWidth={3} />
          </button>
      </div>

      {viewType === 'week' && (
        <div className="space-y-6 animate-slideUp">
          {weekDays.map((day, idx) => {
            const dStr = getLocalDateString(day);
            const isToday = dStr === todayStr;
            const ds = getDayShifts(dStr);
            const holidayName = currentYearHolidaysMap[dStr];
            return (
              <div key={idx} className={bentoCardBase(isToday) + " p-5"}>
                <div className="flex justify-between items-center mb-5">
                   <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-indigo-400' : 'text-slate-400'}`}>{day.toLocaleDateString('fr-FR', { weekday: 'long' })}</p>
                      {holidayName && (
                        <div className="flex items-center gap-1 bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded-md border border-rose-500/20">
                          <span className="text-[7px] font-black uppercase tracking-tighter">{holidayName}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xl font-black tracking-tight capitalize">{day.getDate()} {day.toLocaleDateString('fr-FR', { month: 'long' })}</h4>
                      {isToday && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />}
                      {dStr === modulationEndDateStr && (
                        <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-lg border border-amber-500/20">
                          <AlertTriangle size={10} />
                          <span className="text-[8px] font-black uppercase tracking-widest">Fin Modulation</span>
                        </div>
                      )}
                    </div>
                   </div>
                   {isToday && <div className="bg-indigo-600 px-4 py-1.5 rounded-full shadow-lg border border-white/10"><span className="text-[9px] font-black text-white uppercase tracking-widest">AUJOURD'HUI</span></div>}
                </div>
                {ds.length > 0 ? (<div className="space-y-3">{ds.map(s => renderShiftItem(s))}</div>) : (<div className={`py-8 border-2 border-dashed ${darkMode ? 'border-white/5' : 'border-slate-500/5'} rounded-3xl text-center opacity-30`}><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Repos</p></div>)}
              </div>
            );
          })}
        </div>
      )}

      {viewType === 'month' && (
        <div className="space-y-6 animate-slideUp">
          <div className={`${bentoCardBase(false)} p-5 shadow-2xl`}>
            <div className="grid grid-cols-7 mb-4 border-b border-slate-500/5 pb-4">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (<div key={idx} className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">{day}</div>))}
            </div>
            <div className="grid grid-cols-7 gap-y-2">
              {monthDays.map((day, idx) => {
                const dStr = getLocalDateString(day);
                const isToday = dStr === todayStr;
                const isSelected = dStr === selectedDay;
                const isModulationEnd = dStr === modulationEndDateStr;
                const isWeekend = weekendDays.includes(dStr);
                const dayShifts = getDayShifts(dStr);
                const hasShifts = dayShifts.length > 0;
                const hasCP = dayShifts.some(s => s.isLeave && (s.leaveType === 'CP' || s.leaveType === 'Congés Payés' || s.leaveType === 'Congé' || s.vehicle === 'CONGÉ'));
                const isHoliday = currentYearHolidays.includes(dStr);
                const hasWork = dayShifts.some(s => !s.isLeave && s.vehicle !== 'CONGÉ');

                return (
                  <button 
                    key={idx} 
                    onClick={() => setSelectedDay(dStr)} 
                    className={`relative aspect-square flex items-center justify-center text-xs font-black transition-all rounded-xl ${
                      isSelected 
                        ? (hasCP ? 'bg-orange-600 text-white shadow-xl scale-110 z-10 ring-2 ring-white/30' : 'bg-indigo-600 text-white shadow-xl scale-110 z-10')
                        : hasCP
                          ? 'bg-orange-50 text-orange-600 border border-orange-200'
                          : isToday 
                            ? 'text-indigo-600 ring-2 ring-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
                            : isHoliday
                              ? (darkMode ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-rose-50 text-rose-600 border border-rose-200')
                              : isModulationEnd
                                ? 'bg-amber-500/10 text-amber-500 ring-2 ring-amber-500/30'
                                : hasWork 
                                  ? (darkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600') 
                                  : isWeekend
                                    ? (darkMode ? 'bg-slate-800/40 text-slate-400 border border-white/5' : 'bg-slate-100 text-slate-500 border border-slate-200')
                                    : 'text-slate-400 hover:bg-slate-500/5'
                    }`}
                  >
                    {day.getDate()}
                    {isHoliday && !isSelected && (
                      <div className="absolute top-1 right-1 w-1 h-1 bg-rose-500 rounded-full" />
                    )}
                    {isModulationEnd && (
                      <div className="absolute -top-1 -right-1">
                        <div className={`w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center border-2 ${darkMode ? 'border-[#0F1221]' : 'border-white'}`}>
                          <AlertTriangle size={6} className="text-white" />
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-1.5 flex gap-0.5">
                      {hasWork && !isSelected && !hasCP && (
                        <div className="w-1 h-1 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                      )}
                      {hasCP && !isSelected && (
                        <div className="w-1 h-1 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-start px-1">
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{selectedDay === todayStr ? "AUJOURD'HUI" : new Date(selectedDay).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</h4>
                {currentYearHolidaysMap[selectedDay] && (
                  <div className="flex items-center gap-1.5 bg-rose-500/10 text-rose-500 px-2 py-1 rounded-lg border border-rose-500/20 mb-2 w-fit animate-fadeIn">
                    <Calendar size={10} strokeWidth={3} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{currentYearHolidaysMap[selectedDay]}</span>
                  </div>
                )}
              </div>
              <button 
                onClick={() => toggleWeekend(selectedDay)}
                className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${
                  weekendDays.includes(selectedDay)
                    ? (darkMode ? 'bg-slate-800 border-white/10 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600 shadow-sm')
                    : (darkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20' : 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100 shadow-sm')
                }`}
              >
                {weekendDays.includes(selectedDay) ? (
                  <>
                    <Calendar size={12} />
                    <span>Retirer Week-end</span>
                  </>
                ) : (
                  <>
                    <CalendarIcon size={12} />
                    <span>Marquer Week-end</span>
                  </>
                )}
              </button>
            </div>
            {getDayShifts(selectedDay).length > 0 ? (
              <div className="space-y-3 animate-slideUp">{getDayShifts(selectedDay).map(s => renderShiftItem(s))}</div>
            ) : (
              <div className={`p-12 rounded-[32px] border-2 border-dashed ${darkMode ? 'border-white/5' : 'border-slate-500/5'} flex flex-col items-center justify-center text-center opacity-30`}>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aucune mission</p>
              </div>
            )}
          </div>
        </div>
      )}

      <AddPlanningModal 
        darkMode={darkMode}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddShift={onAddShift}
        onAddLeave={onAddLeave}
        availableVehicles={availableVehicles}
        todayStr={todayStr}
        leaveBalances={leaveBalances}
        leaveDaysCount={0} // memoized inside modal
        calculateBusinessDays={(start, end) => calculateBusinessDays(start, end, weekendDays, cpCalculationMode)}
      />

      <EditShiftModal 
        darkMode={darkMode}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        shift={editingShift}
        onUpdate={handleUpdateShift}
      />
    </div>
  );
};
export default PlanningTab;
