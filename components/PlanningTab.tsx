
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
  
  const getLocalDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getFrenchPublicHolidays = useCallback((year: number) => {
    const holidays: Record<string, string> = {
      [`${year}-01-01`]: "Nouvel An",
      [`${year}-05-01`]: "Fête du Travail",
      [`${year}-05-08`]: "Victoire 1945",
      [`${year}-07-14`]: "Fête Nationale",
      [`${year}-08-15`]: "Assomption",
      [`${year}-11-01`]: "Toussaint",
      [`${year}-11-11`]: "Armistice",
      [`${year}-12-25`]: "Noël",
    };

    const a = year % 19, b = Math.floor(year / 100), c = year % 100,
          d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
          g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
          i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
          m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114;
    const month = Math.floor(n / 31);
    const day = (n % 31) + 1;

    const easter = new Date(year, month - 1, day);
    const addDateInfo = (date: Date, days: number, name: string) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      holidays[`${yStr}-${mStr}-${dStr}`] = name;
    };

    addDateInfo(easter, 1, "Lundi de Pâques");
    addDateInfo(easter, 39, "Ascension");
    addDateInfo(easter, 50, "Lundi de Pentecôte");

    return holidays;
  }, []);

  const todayStr = useMemo(() => getLocalDateString(appCurrentTime), [appCurrentTime]);

  const currentYearHolidaysMap = useMemo(() => {
    return getFrenchPublicHolidays(pivotDate.getFullYear());
  }, [pivotDate, getFrenchPublicHolidays]);

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
  const [addFlowStep, setAddFlowStep] = useState<'choice' | 'shift' | 'leave'>('choice');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  
  const inputClass = `w-full p-4 rounded-2xl border font-black outline-none transition-all placeholder:text-slate-400 ${
    darkMode 
      ? 'bg-[#0F1221] border-white/5 text-white focus:border-indigo-500' 
      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white'
  }`;

  // État pour la nouvelle mission
  const [newShift, setNewShift] = useState<{
    day: string;
    start: string;
    end: string;
    vehicle: string;
    breaks: Break[];
  }>({
    day: todayStr,
    start: '08:00',
    end: '18:00',
    vehicle: availableVehicles[0] || 'ASSU',
    breaks: []
  });

  // État pour l'absence
  const [newLeave, setNewLeave] = useState<{
    day: string;
    endDate: string;
    type: 'CP' | 'Maladie' | 'Sans solde' | 'AT';
  }>({
    day: todayStr,
    endDate: todayStr,
    type: 'CP'
  });

  const calculateBusinessDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDateObj = new Date(end);
    if (endDateObj < startDate) return 0;
    
    let count = 0;
    const curDate = new Date(startDate);
    const yearHolidays: Record<number, Record<string, string>> = {};

    while (curDate <= endDateObj) {
      const dStr = getLocalDateString(curDate);
      const year = curDate.getFullYear();
      if (!yearHolidays[year]) {
        yearHolidays[year] = getFrenchPublicHolidays(year);
      }
      
      const isHoliday = !!yearHolidays[year][dStr];
      const isUserWeekend = weekendDays.includes(dStr);
      const dayOfWeek = curDate.getDay();

      let shouldExclude = false;
      if (isHoliday) {
        shouldExclude = true;
      } else if (isUserWeekend) {
        shouldExclude = true;
      } else if (cpCalculationMode === '30') {
        // Mode 30j ouvrables : on exclut uniquement les dimanches
        if (dayOfWeek === 0) shouldExclude = true;
      } else {
        // Mode 25j ouvrés : on exclut samedis et dimanches
        if (dayOfWeek === 0 || dayOfWeek === 6) shouldExclude = true;
      }

      if (!shouldExclude) {
        count++;
      }
      curDate.setDate(curDate.getDate() + 1);
    }
    return count;
  };

  const leaveDaysCount = useMemo(() => {
    return calculateBusinessDays(newLeave.day, newLeave.endDate);
  }, [newLeave.day, newLeave.endDate]);

  const currentBalance = useMemo(() => {
    if (newLeave.type === 'CP') return leaveBalances.cp;
    return Infinity;
  }, [newLeave.type, leaveBalances]);

  const isBalanceInsufficient = leaveDaysCount > currentBalance;
  const estimatedNewBalance = currentBalance - leaveDaysCount;

  // État pour la pause en cours d'ajout dans la modale
  const [tempBreak, setTempBreak] = useState<{
    isActive: boolean;
    type: 'cafe' | 'repas';
    start: string;
    duration: number;
    location: 'Entreprise' | 'Extérieur';
  }>({
    isActive: false,
    type: 'repas',
    start: '12:00',
    duration: 30,
    location: 'Entreprise'
  });

  const [editingBreakId, setEditingBreakId] = useState<string | null>(null);

  const removeBreakFromEditingShift = (id: string) => {
    if (editingShift) {
      setEditingShift({
        ...editingShift,
        breaks: (editingShift.breaks || []).filter(b => b.id !== id)
      });
    }
  };

  const handleDeleteBreak = (shiftId: string, breakId: string) => {
    setShifts(prev => prev.map(s => {
      if (s.id === shiftId) {
        return { ...s, breaks: s.breaks?.filter(b => b.id !== breakId) };
      }
      return s;
    }));
  };

  const handleEditBreak = (shift: Shift, breakItem: Break) => {
    setEditingShift({ ...shift });
    setEditingBreakId(breakItem.id);
    setTempBreak({
      isActive: true,
      start: breakItem.start,
      duration: breakItem.duration,
      location: breakItem.location as any,
      type: breakItem.isMeal ? 'repas' : 'pause'
    });
    setShowEditModal(true);
  };

  const addOrUpdateBreakInEditingShift = () => {
    if (!editingShift) return;
    const breakEndTime = calculateEndTimeFromDuration(tempBreak.start, tempBreak.duration);
    const breakData: Break = {
      id: editingBreakId || Math.random().toString(36).substr(2, 9),
      start: tempBreak.start,
      end: breakEndTime,
      duration: tempBreak.duration,
      location: tempBreak.location,
      isMeal: tempBreak.type === 'repas'
    };

    if (editingBreakId) {
      setEditingShift({
        ...editingShift,
        breaks: (editingShift.breaks || []).map(b => b.id === editingBreakId ? breakData : b)
      });
    } else {
      setEditingShift({
        ...editingShift,
        breaks: [...(editingShift.breaks || []), breakData]
      });
    }
    
    setTempBreak({ ...tempBreak, isActive: false });
    setEditingBreakId(null);
  };

  const startEditingBreakInEditModal = (b: Break) => {
    setEditingBreakId(b.id);
    setTempBreak({
      isActive: true,
      type: b.isMeal ? 'repas' : 'cafe',
      start: b.start,
      duration: b.duration,
      location: b.location as any
    });
  };

  const isShiftValid = useMemo(() => {
    if (!editingShift) return true;
    if (editingShift.end === '--:--') return true;
    
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    
    const sMin = toMin(editingShift.start);
    const eMin = toMin(editingShift.end);
    
    const breaks = editingShift.breaks || [];
    for (const b of breaks) {
      const bSMin = toMin(b.start);
      const bEMin = toMin(b.end);
      
      // Check if break is within shift
      if (bSMin < sMin || bEMin > eMin) return false;
    }
    
    return true;
  }, [editingShift]);

  const modulationPeriod = useMemo(() => {
    if (workRegime !== 'modulation' || !modulationWeeks) return null;
    
    const weeks = parseInt(modulationWeeks) || 4;
    const cycleDays = weeks * 7;
    const anchor = modulationStartDate ? new Date(modulationStartDate) : (contractStartDate ? new Date(contractStartDate) : new Date(2024, 0, 1));
    anchor.setHours(0, 0, 0, 0);
    
    const diffMs = pivotDate.getTime() - anchor.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const currentCycleIndex = Math.floor(diffDays / cycleDays);
    
    const start = new Date(anchor);
    start.setDate(anchor.getDate() + (currentCycleIndex * cycleDays));
    
    const end = new Date(start);
    end.setDate(start.getDate() + cycleDays - 1);
    
    return {
      start: start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
      end: end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    };
  }, [workRegime, modulationStartDate, modulationWeeks, contractStartDate, appCurrentTime]);

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

  const calculateEndTimeFromDuration = (startTime: string, durationMin: number) => {
    const [h, m] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + durationMin);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getVehicleConfig = useCallback((v: string) => {
    return v?.includes('ASSU') ? { bg: 'bg-[#FF4B5C]', text: 'text-[#FF4B5C]', icon: Stethoscope, label: 'ASSU' } :
           v?.includes('VSL') ? { bg: 'bg-indigo-500', text: 'text-indigo-500', icon: Briefcase, label: 'VSL' } :
           { bg: 'bg-emerald-500', text: 'text-emerald-500', icon: Car, label: 'AMBU' };
  }, []);

  const handleDeleteShift = useCallback((id: string) => {
    setShifts(prev => prev.filter(s => s.id !== id));
    if (id === activeShiftId) onEndServiceSilently?.();
  }, [setShifts, activeShiftId, onEndServiceSilently]);

  const handleUpdateShift = useCallback((updatedShift: Shift) => {
    if (updatedShift.id === activeShiftId && updatedShift.end !== '--:--') onEndServiceSilently?.();
    setShifts(prev => prev.map(s => s.id === updatedShift.id ? updatedShift : s));
    setShowEditModal(false);
  }, [activeShiftId, onEndServiceSilently, setShifts]);

  const validateShift = () => {
    if (!newShift.day || !newShift.start) return;
    const isPast = isNewShiftPast;
    const shiftId = Math.random().toString(36).substr(2, 9);
    
    const shiftData: Shift = { 
      id: shiftId,
      day: newShift.day,
      start: newShift.start,
      end: isPast ? (newShift.end || '18:00') : '--:--', 
      crew: 'Équipage',
      vehicle: newShift.vehicle,
      breaks: newShift.breaks 
    };

    setShifts(prev => [shiftData, ...prev]);
    if (!isPast && onAutoStartService) onAutoStartService(shiftId, shiftData.start, shiftData.day);
    setShowAddModal(false);
    setAddFlowStep('choice');
    setNewShift({ day: todayStr, start: '08:00', end: '18:00', vehicle: availableVehicles[0] || 'ASSU', breaks: [] });
  };

  const validateLeave = () => {
    if (!newLeave.day || isBalanceInsufficient) return;
    
    const startDate = new Date(newLeave.day);
    const endDate = new Date(newLeave.endDate);
    const totalDays = leaveDaysCount;
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
        if (cpCalculationMode === '30') {
          isBusinessDay = dayOfWeek !== 0;
        } else {
          isBusinessDay = dayOfWeek !== 0 && dayOfWeek !== 6;
        }
      }

      if (isBusinessDay) {
        const shiftId = Math.random().toString(36).substr(2, 9);
        const dayStr = getLocalDateString(curDate);
        
        newShifts.push({
          id: shiftId,
          day: dayStr,
          start: '00:00',
          end: '00:00',
          crew: 'Personnel',
          vehicle: 'CONGÉ',
          isLeave: true,
          leaveType: newLeave.type === 'Maladie' ? 'MAL' : newLeave.type === 'Sans solde' ? 'CSS' : newLeave.type as any,
          leaveDays: 0,
          note: `Décompté du solde le ${today}`
        });
      }
      curDate.setDate(curDate.getDate() + 1);
    }

    // On ajoute les shifts. Le useMemo dans App.tsx s'occupera de mettre à jour le solde
    // car il compte le nombre de shifts de type congé.
    setShifts(prev => [...newShifts, ...prev]);
    setShowAddModal(false);
    setAddFlowStep('choice');
    setNewLeave({ day: todayStr, endDate: todayStr, type: 'CP' });
  };

  const addTempBreakToNewShift = () => {
    const breakEndTime = calculateEndTimeFromDuration(tempBreak.start, tempBreak.duration);
    const breakData: Break = {
      id: Math.random().toString(36).substr(2, 9),
      start: tempBreak.start,
      end: breakEndTime,
      duration: tempBreak.duration,
      location: tempBreak.location,
      isMeal: tempBreak.type === 'repas'
    };
    setNewShift(prev => ({ ...prev, breaks: [...prev.breaks, breakData] }));
    setTempBreak({ ...tempBreak, isActive: false });
  };

  const removeBreakFromNewShift = (id: string) => {
    setNewShift(prev => ({ ...prev, breaks: prev.breaks.filter(b => b.id !== id) }));
  };

  const calculateTotalDuration = (shift: Shift) => {
    if (!shift.start || !shift.end || shift.end === '--:--') return '0H 0M';
    
    const startParts = shift.start.split(':');
    const endParts = shift.end.split(':');
    
    if (startParts.length < 2 || endParts.length < 2) return '0H 0M';

    const h1 = parseInt(startParts[0], 10);
    const m1 = parseInt(startParts[1], 10);
    const h2 = parseInt(endParts[0], 10);
    const m2 = parseInt(endParts[1], 10);
    
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return '0H 0M';
    
    let durationMin = (h2 * 60 + m2) - (h1 * 60 + m1);
    // Correction pour le passage à minuit
    if (durationMin < 0) durationMin += 1440;
    
    if (shift.breaks) {
      shift.breaks.forEach(b => {
        durationMin -= (Number(b.duration) || 0);
      });
    }
    
    const h = Math.floor(Math.max(0, durationMin) / 60);
    const m = Math.max(0, durationMin) % 60;
    return `${h}H ${m}M`;
  };
  
  const toggleWeekend = (dateStr: string) => {
    setWeekendDays(prev => 
      prev.includes(dateStr) 
        ? prev.filter(d => d !== dateStr) 
        : [...prev, dateStr]
    );
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
                    <button onClick={() => handleEditBreak(shift, b)} className="p-1.5 text-slate-400 hover:text-indigo-500 transition-colors"><Edit size={14} /></button>
                    <button onClick={() => handleDeleteBreak(shift.id, b.id)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
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

  const isNewShiftPast = useMemo(() => {
    if (!newShift.day) return false;
    return newShift.day < todayStr;
  }, [newShift.day, todayStr]);

  return (
    <div className="p-4 space-y-6 animate-fadeIn pb-40">
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
          <button onClick={() => { setNewShift({ ...newShift, day: selectedDay, breaks: [] }); setAddFlowStep('choice'); setShowAddModal(true); }} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/20 flex items-center justify-center active:scale-95 transition-all">
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

      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-fadeIn">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setShowAddModal(false)} />
          
          <AnimatePresence mode="wait">
            {addFlowStep === 'choice' && (
              <motion.div 
                key="choice"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                className={`relative w-full max-w-sm rounded-[40px] p-8 shadow-2xl border ${darkMode ? 'bg-[#15192D] border-white/10 text-white' : 'bg-white text-slate-900'}`}
              >
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black tracking-tight">Que veux-tu ajouter ?</h3>
                  <button onClick={() => setShowAddModal(false)} className={`p-3 rounded-2xl ${darkMode ? 'bg-slate-500/5' : 'bg-slate-100'}`}><X size={20} /></button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => setAddFlowStep('shift')}
                    className={`flex items-center gap-6 p-6 rounded-[32px] border-2 transition-all group ${darkMode ? 'bg-white/5 border-white/5 hover:bg-indigo-600 hover:border-indigo-400' : 'bg-slate-50 border-slate-100 hover:bg-indigo-600 hover:border-indigo-400 hover:text-white'}`}
                  >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${darkMode ? 'bg-white/10 group-hover:bg-white/20' : 'bg-indigo-100 group-hover:bg-white/20'}`}>
                      <Car size={32} className={darkMode ? 'text-indigo-400 group-hover:text-white' : 'text-indigo-600 group-hover:text-white'} />
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-black leading-tight">Journée de travail</p>
                      <p className={`text-xs font-bold uppercase tracking-widest opacity-60 ${darkMode ? '' : 'group-hover:text-white/80'}`}>Ambulance, VSL, ASSU</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setAddFlowStep('leave')}
                    className={`flex items-center gap-6 p-6 rounded-[32px] border-2 transition-all group ${darkMode ? 'bg-white/5 border-white/5 hover:bg-orange-600 hover:border-orange-400' : 'bg-slate-50 border-slate-100 hover:bg-orange-600 hover:border-orange-400 hover:text-white'}`}
                  >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${darkMode ? 'bg-white/10 group-hover:bg-white/20' : 'bg-orange-100 group-hover:bg-white/20'}`}>
                      <Calendar size={32} className={darkMode ? 'text-orange-400 group-hover:text-white' : 'text-orange-600 group-hover:text-white'} />
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-black leading-tight">Absence / Congé</p>
                      <p className={`text-xs font-bold uppercase tracking-widest opacity-60 ${darkMode ? '' : 'group-hover:text-white/80'}`}>CP, Maladie...</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {addFlowStep === 'shift' && (
              <motion.div 
                key="shift"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className={`relative w-full max-w-sm rounded-[32px] p-8 shadow-2xl border ${darkMode ? 'bg-[#15192D] border-white/10 text-white' : 'bg-white text-slate-900'} max-h-[90vh] overflow-y-auto no-scrollbar`}
              >
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setAddFlowStep('choice')} className="p-2 bg-slate-500/5 rounded-xl hover:bg-slate-500/10 transition-colors"><ArrowLeft size={18} /></button>
                    <h3 className="text-xl font-black tracking-tight">{isNewShiftPast ? "Fin de journée" : "Nouvelle mission"}</h3>
                  </div>
                  <button onClick={() => setShowAddModal(false)} className={`p-3 rounded-2xl ${darkMode ? 'bg-slate-500/5' : 'bg-slate-100'}`}><X size={20} /></button>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block px-1">Date</label>
                    <input type="date" className={inputClass} value={newShift.day} onChange={(e) => setNewShift({...newShift, day: e.target.value})} />
                  </div>

                  <div className={isNewShiftPast ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block px-1">Début</label>
                      <input type="time" className={inputClass} value={newShift.start} onChange={(e) => setNewShift({...newShift, start: e.target.value})} />
                    </div>
                    {isNewShiftPast && (
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block px-1">Fin (réelle)</label>
                        <input type="time" className={inputClass} value={newShift.end} onChange={(e) => setNewShift({...newShift, end: e.target.value})} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block px-1">Véhicule</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['ASSU', 'AMBU', 'VSL'].map((v) => {
                        const config = getVehicleConfig(v);
                        const isSelected = newShift.vehicle === v;
                        return (
                          <button 
                            key={v} 
                            onClick={() => setNewShift({ ...newShift, vehicle: v })} 
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

                  {/* SECTION PAUSES (UNIQUEMENT JOURS PASSÉS) */}
                  {isNewShiftPast && (
                    <div className="space-y-4 pt-4 border-t border-white/10">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block px-1">Pauses & Coupures</label>
                      </div>

                      {/* Liste des pauses déjà ajoutées */}
                      {newShift.breaks.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {newShift.breaks.map(b => (
                            <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                              <div className="flex items-center gap-2">
                                {b.isMeal ? <Utensils size={14} className="text-indigo-400" /> : <Coffee size={14} className="text-amber-400" />}
                                <span className="text-[10px] font-black">{b.start} - {b.end}</span>
                                {b.isMeal && b.duration < 30 && (
                                  <AlertTriangle size={10} className="text-amber-500" />
                                )}
                                {b.isMeal && <span className="text-[8px] opacity-60">({b.location})</span>}
                              </div>
                              <div className="flex items-center gap-1 pr-1">
                                <button className="text-indigo-400 p-1"><Edit size={14} /></button>
                                <button onClick={() => removeBreakFromNewShift(b.id)} className="text-rose-500 p-1"><Trash2 size={14} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!tempBreak.isActive ? (
                        <div className="grid grid-cols-2 gap-3">
                          <button 
                            onClick={() => setTempBreak({ ...tempBreak, isActive: true, type: 'cafe', duration: 20, start: '10:00' })}
                            className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                          >
                            <Coffee size={14} /> Pause Café
                          </button>
                          <button 
                            onClick={() => setTempBreak({ ...tempBreak, isActive: true, type: 'repas', duration: 30, start: '12:00' })}
                            className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                          >
                            <Utensils size={14} /> Coupure Repas
                          </button>
                        </div>
                      ) : (
                        <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-5 animate-slideUp">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Configuration {tempBreak.type === 'cafe' ? 'Pause Café' : 'Coupure Repas'}</span>
                            <button onClick={() => setTempBreak({ ...tempBreak, isActive: false })} className="p-1"><X size={14} /></button>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Début de pause</label>
                              <input 
                                type="time" 
                                className="bg-transparent font-black text-indigo-500 outline-none text-right cursor-pointer" 
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
                                max="90" 
                                className="w-full h-1.5 bg-slate-500/10 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                                value={tempBreak.duration} 
                                onChange={e => setTempBreak({ ...tempBreak, duration: parseInt(e.target.value) })} 
                              />
                            </div>

                            {tempBreak.type === 'repas' && (
                              <div className="grid grid-cols-2 gap-2">
                                <button 
                                  onClick={() => setTempBreak({ ...tempBreak, location: 'Entreprise' })}
                                  className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-[8px] font-black uppercase transition-all ${tempBreak.location === 'Entreprise' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'border-white/5 text-slate-400'}`}
                                >
                                  <Building2 size={12} /> Entreprise
                                </button>
                                <button 
                                  onClick={() => setTempBreak({ ...tempBreak, location: 'Extérieur' })}
                                  className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-[8px] font-black uppercase transition-all ${tempBreak.location === 'Extérieur' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'border-white/5 text-slate-400'}`}
                                >
                                  <MapPin size={12} /> Extérieur
                                </button>
                              </div>
                            )}

                            <button 
                              onClick={addTempBreakToNewShift}
                              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
                            >
                              <PlusCircle size={14} /> Ajouter cette pause
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <button onClick={validateShift} className="w-full py-5 rounded-[24px] bg-indigo-600 text-white font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all mt-4 border border-white/10">Enregistrer</button>
                </div>
              </motion.div>
            )}

            {addFlowStep === 'leave' && (
              <motion.div 
                key="leave"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className={`relative w-full max-w-sm rounded-[32px] p-8 shadow-2xl border ${darkMode ? 'bg-[#15192D] border-white/10 text-white' : 'bg-white text-slate-900'}`}
              >
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setAddFlowStep('choice')} className="p-2 bg-slate-500/5 rounded-xl hover:bg-slate-500/10 transition-colors"><ArrowLeft size={18} /></button>
                    <h3 className="text-xl font-black tracking-tight">Absence / Congé</h3>
                  </div>
                  <button onClick={() => setShowAddModal(false)} className={`p-3 rounded-2xl ${darkMode ? 'bg-slate-500/5' : 'bg-slate-100'}`}><X size={20} /></button>
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

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest block px-1">Type d'absence</label>
                      <select 
                        className={inputClass.replace('indigo', 'orange')}
                        value={newLeave.type}
                        onChange={(e) => setNewLeave({...newLeave, type: e.target.value as any})}
                      >
                        <option value="CP">Congé Payé (CP)</option>
                        <option value="Maladie">Maladie</option>
                        <option value="Sans solde">Sans solde</option>
                        <option value="AT">Accident du Travail (AT)</option>
                      </select>
                    </div>

                  {/* Aperçu du décompte */}
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
                    onClick={validateLeave} 
                    disabled={isBalanceInsufficient}
                    className={`w-full py-5 rounded-[24px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all mt-4 border border-white/10 ${isBalanceInsufficient ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-[#2ECC71] text-white'}`}
                  >
                    Valider
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {showEditModal && editingShift && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-fadeIn">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => { setShowEditModal(false); setTempBreak({ ...tempBreak, isActive: false }); setEditingBreakId(null); }} />
          <div className={`relative w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-popIn border ${darkMode ? 'bg-[#15192D] border-white/10 text-white' : 'bg-white text-slate-900'} max-h-[90vh] overflow-y-auto no-scrollbar`}>
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-2xl font-black tracking-tight capitalize">Édition</h3>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">{new Date(editingShift.day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <button onClick={() => { setShowEditModal(false); setTempBreak({ ...tempBreak, isActive: false }); setEditingBreakId(null); }} className={`p-3 rounded-2xl ${darkMode ? 'bg-slate-500/10' : 'bg-slate-100'}`}><X size={20} /></button>
            </div>
            
            <div className="space-y-6">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-indigo-500 font-black uppercase text-[9px] tracking-widest px-1">Début</label>
                    <input type="time" className={`w-full p-4 rounded-2xl ${darkMode ? 'bg-[#0F1221] text-white' : 'bg-slate-500/5 text-slate-900'} font-black border border-white/5 outline-none focus:border-indigo-500`} value={editingShift.start} onChange={e => setEditingShift({...editingShift, start: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-indigo-500 font-black uppercase text-[9px] tracking-widest px-1">Fin</label>
                    <input type="time" className={`w-full p-4 rounded-2xl ${darkMode ? 'bg-[#0F1221] text-white' : 'bg-slate-500/5 text-slate-900'} font-black border border-white/5 outline-none focus:border-indigo-500`} value={editingShift.end === '--:--' ? '' : editingShift.end} onChange={e => setEditingShift({...editingShift, end: e.target.value})} />
                  </div>
               </div>

               {/* SECTION PAUSES & COUPURES */}
               <div className={`space-y-4 pt-4 border-t ${darkMode ? 'border-white/10' : 'border-slate-500/10'}`}>
                    <label className="text-indigo-500 font-black uppercase text-[9px] tracking-widest px-1 block">PAUSES & COUPURES</label>
                    
                    {/* Liste des pauses existantes */}
                    {editingShift.breaks && editingShift.breaks.length > 0 && (
                      <div className="space-y-2">
                        {editingShift.breaks.map(b => (
                          <div key={b.id} className={`flex items-center justify-between p-3 rounded-xl border ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`p-1.5 rounded-lg ${darkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                                {b.isMeal ? <Utensils size={14} className="text-indigo-400" /> : <Coffee size={14} className="text-amber-400" />}
                              </div>
                              <div className="flex flex-col">
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
                              <button onClick={() => startEditingBreakInEditModal(b)} className="p-1.5 text-slate-400 hover:text-indigo-500 transition-colors"><Edit size={14} /></button>
                              <button onClick={() => removeBreakFromEditingShift(b.id)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!tempBreak.isActive ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => { setEditingBreakId(null); setTempBreak({ ...tempBreak, isActive: true, type: 'cafe', duration: 15, start: '10:00' }); }}
                          className={`flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed text-[10px] font-black uppercase tracking-widest transition-all ${darkMode ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'}`}
                        >
                          <Coffee size={14} /> + PAUSE CAFÉ
                        </button>
                        <button 
                          onClick={() => { setEditingBreakId(null); setTempBreak({ ...tempBreak, isActive: true, type: 'repas', duration: 45, start: '12:00' }); }}
                          className={`flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed text-[10px] font-black uppercase tracking-widest transition-all ${darkMode ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'}`}
                        >
                          <Utensils size={14} /> + COUPURE REPAS
                        </button>
                      </div>
                    ) : (
                      <div className={`p-5 rounded-2xl border space-y-5 animate-slideUp ${darkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                        <div className="flex justify-between items-center">
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
                              <span className="text-indigo-500">Fin : {calculateEndTimeFromDuration(tempBreak.start, tempBreak.duration)}</span>
                            </div>
                            <input 
                              type="range" 
                              min="1" 
                              max="120" 
                              className="w-full h-1.5 bg-indigo-500/10 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
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
                            onClick={addOrUpdateBreakInEditingShift}
                            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
                          >
                            <PlusCircle size={14} /> {editingBreakId ? 'Mettre à jour la pause' : 'Ajouter cette pause'}
                          </button>
                        </div>
                      </div>
                    )}
                 </div>

               <div className="space-y-3">
                 <button 
                   onClick={() => handleUpdateShift(editingShift)} 
                   disabled={!isShiftValid}
                   className={`w-full py-5 rounded-[24px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all border border-white/10 ${!isShiftValid ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white'}`}
                 >
                   Mettre à jour
                 </button>
                 {!isShiftValid && (
                   <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center animate-pulse">Les pauses doivent être dans l'amplitude</p>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PlanningTab;
