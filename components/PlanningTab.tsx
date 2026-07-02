import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Edit, 
  Calendar, 
  Clock, 
  AlertTriangle,
  Briefcase,
  Coffee,
  Utensils,
  Car,
  Stethoscope,
  Plane,
  X,
  Sparkles,
  Smile
} from 'lucide-react';
import { Shift, Break, ServiceStatus, AppTab } from '../types';
import { 
  getLocalDateString, 
  parseLocalDate, 
  getFrenchPublicHolidays, 
  isSundayOrHoliday,
  calculateBusinessDays,
  calculateTotalDurationMinutes,
  calculateTotalDuration,
  toMinutes
} from '../src/lib/dateUtils';
import { PlanningSummary } from './PlanningSummary';
import { AddPlanningModal } from './AddPlanningModal';
import { EditShiftModal } from './EditShiftModal';

interface PlanningTabProps {
  darkMode?: boolean;
  status?: ServiceStatus;
  setStatus?: (status: ServiceStatus) => void;
  onAutoStartService?: (shiftId: string, startTime: string, shiftDay: string) => void;
  onEndServiceSilently?: () => void;
  appCurrentTime: Date;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  weekendDays: string[];
  setWeekendDays: React.Dispatch<React.SetStateAction<string[]>>;
  activeShiftId: string | null;
  setActiveShiftId: React.Dispatch<React.SetStateAction<string | null>>;
  availableVehicles: string[];
  hourlyRate: number;
  setActiveTab: React.Dispatch<React.SetStateAction<AppTab>>;
  workRegime: string;
  cpCalculationMode: '25' | '30';
  modulationWeeks?: string;
  modulationStartDate?: string;
  contractStartDate?: string;
  leaveBalances: { cp: number };
  initialCpBalance?: number;
  setInitialCpBalance?: React.Dispatch<React.SetStateAction<number>>;
  primaryRole?: string;
  onClearAllShifts?: () => Promise<void>;
  onDeleteShift?: (id: string) => Promise<void>;
}

type ViewType = 'week' | 'month';

export const PlanningTab: React.FC<PlanningTabProps> = ({
  darkMode = false,
  status,
  setStatus,
  onAutoStartService,
  onEndServiceSilently,
  appCurrentTime,
  shifts,
  setShifts,
  weekendDays,
  setWeekendDays,
  activeShiftId,
  setActiveShiftId,
  availableVehicles,
  hourlyRate,
  setActiveTab,
  workRegime,
  cpCalculationMode,
  modulationWeeks,
  modulationStartDate,
  contractStartDate,
  leaveBalances,
  initialCpBalance,
  setInitialCpBalance,
  primaryRole,
  onClearAllShifts,
  onDeleteShift
}) => {
  const [viewType, setViewType] = useState<ViewType>('week');
  const [currentPivotDate, setCurrentPivotDate] = useState<Date>(() => new Date(appCurrentTime));
  const [selectedDayLine, setSelectedDayLine] = useState<string | null>(null);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  // 1. Calculate dates for current week view (Monday to Sunday)
  const weekDates = useMemo(() => {
    const pivot = new Date(currentPivotDate);
    const day = pivot.getDay();
    const diff = pivot.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const startOfWeek = new Date(pivot.setDate(diff));
    
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return getLocalDateString(d);
    });
  }, [currentPivotDate]);

  // 2. Calculate dates for current month view
  const monthInfo = useMemo(() => {
    const year = currentPivotDate.getFullYear();
    const month = currentPivotDate.getMonth();
    
    const firstDayInstance = new Date(year, month, 1);
    const lastDayInstance = new Date(year, month + 1, 0);
    
    // Day of week of the first day (0 = Sunday, 1 = Monday...)
    let firstDayOfWeek = firstDayInstance.getDay();
    if (firstDayOfWeek === 0) firstDayOfWeek = 7; // Treat Sunday as 7 to match Mon-Sun
    
    const padDaysBefore = firstDayOfWeek - 1; // Days to show from prev month
    
    const days: string[] = [];
    
    // Start of grid (may include late days from previous month)
    const startDate = new Date(firstDayInstance);
    startDate.setDate(startDate.getDate() - padDaysBefore);
    
    // Total cells to show (usually 35 or 42 to cover whole grid)
    const totalCells = padDaysBefore + lastDayInstance.getDate() <= 35 ? 35 : 42;
    
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      days.push(getLocalDateString(d));
    }
    
    return {
      days,
      year,
      monthName: currentPivotDate.toLocaleString('fr-FR', { month: 'long' }),
      monthIndex: month
    };
  }, [currentPivotDate]);

  // 3. Navigate periods
  const navigate = (direction: number) => {
    setCurrentPivotDate(prev => {
      const next = new Date(prev);
      if (viewType === 'week') {
        next.setDate(prev.getDate() + (direction * 7));
      } else {
        next.setMonth(prev.getMonth() + direction);
      }
      return next;
    });
  };

  const goToToday = () => {
    setCurrentPivotDate(new Date(appCurrentTime));
  };

  // Toggle Weekend Status
  const toggleWeekend = (dateStr: string) => {
    setWeekendDays(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr);
      } else {
        return [...prev, dateStr];
      }
    });
  };

  // 4. Shift Mutators
  const handleAddShift = (partialShift: Partial<Shift> & { isPast: boolean }) => {
    const id = `shift_${Math.random().toString(36).substr(2, 9)}`;
    const isFerie = partialShift.isFerieChome || false;
    const freshShift: Shift = {
      id,
      day: partialShift.day || getLocalDateString(appCurrentTime),
      start: partialShift.start || '08:00',
      end: partialShift.end && partialShift.end !== '' ? partialShift.end : '--:--',
      crew: partialShift.crew || 'Équipage A',
      vehicle: partialShift.vehicle || 'ASSU',
      breaks: partialShift.breaks || [],
      isLeave: false,
      isFerieChome: isFerie,
      type: isFerie ? 'FERIE' : undefined,
      totalMinutes: isFerie ? 420 : undefined
    };
    
    setShifts(prev => [freshShift, ...prev]);
    setShowAddModal(false);
  };

  const handleAddLeave = (leave: { 
    day: string; 
    endDate: string; 
    type: 'CP' | 'Maladie' | 'Sans solde' | 'AT' | 'SOLIDARITE'; 
    hours?: number; 
    isUnpaidButCounted?: boolean; 
  }) => {
    // Generate leave days
    const start = parseLocalDate(leave.day);
    const end = parseLocalDate(leave.endDate);
    const cur = new Date(start);
    const newLeaves: Shift[] = [];
    
    while (cur <= end) {
      const dStr = getLocalDateString(cur);
      const id = `leave_${Math.random().toString(36).substr(2, 9)}`;
      
      newLeaves.push({
        id,
        day: dStr,
        start: '00:00',
        end: '00:00',
        crew: 'CP',
        vehicle: 'CONGÉ',
        isLeave: true,
        isCP: leave.type === 'CP',
        type: leave.type === 'CP' ? 'CP' : 'Absence',
        totalMinutes: leave.type === 'CP' ? 420 : 0,
        leaveType: leave.type === 'CP' ? 'CP' : (leave.type === 'Maladie' ? 'MAL' : (leave.type === 'Sans solde' ? 'CSS' : (leave.type === 'AT' ? 'AT' : 'SOLIDARITE'))),
        hours: leave.hours || 7,
        isUnpaidButCounted: leave.isUnpaidButCounted
      });
      
      cur.setDate(cur.getDate() + 1);
    }
    
    const leaveDays = newLeaves.map(l => l.day);
    setShifts(prev => [...newLeaves, ...prev.filter(s => !leaveDays.includes(s.day))]);
    setShowAddModal(false);
  };

  const handleUpdateShift = (updatedShift: Shift) => {
    setShifts(prev => prev.map(s => s.id === updatedShift.id ? updatedShift : s));
    setShowEditModal(false);
    setEditingShift(null);
  };

  const handleDeleteShift = async (id: string) => {
    try {
      if (onDeleteShift) {
        await onDeleteShift(id);
      } else {
        setShifts(prev => prev.filter(s => s.id !== id));
      }
      if (activeShiftId === id) {
        setActiveShiftId(null);
        onEndServiceSilently?.();
      }
    } catch (err) {
      console.error("Error calling onDeleteShift:", err);
    }
  };

  // 5. Statistics Calculation
  const activePeriodShifts = useMemo(() => {
    const targetDates = viewType === 'week' ? weekDates : monthInfo.days;
    return shifts.filter(s => targetDates.includes(s.day));
  }, [shifts, viewType, weekDates, monthInfo.days]);

  const stats = useMemo(() => {
    let totalMin = 0;
    let cpCount = 0;
    
    activePeriodShifts.forEach(shift => {
      if (shift.isLeave || shift.vehicle === 'CONGÉ') {
        if (shift.leaveType === 'CP' || shift.isCP || shift.type === 'CP') {
          cpCount++;
          totalMin += 420; // CP counts as 7 hours (420 min)
        }
      } else {
        totalMin += calculateTotalDurationMinutes(shift);
      }
    });

    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const totalHoursStr = `${h}H ${m.toString().padStart(2, '0')}M`;

    return {
      totalHours: totalHoursStr,
      totalCp: cpCount
    };
  }, [activePeriodShifts]);

  // Labels and Formatters
  const periodLabel = useMemo(() => {
    if (viewType === 'week') {
      const first = parseLocalDate(weekDates[0]);
      const last = parseLocalDate(weekDates[6]);
      const formatOption: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
      const startStr = first.toLocaleDateString('fr-FR', formatOption);
      const endStr = last.toLocaleDateString('fr-FR', { ...formatOption, year: 'numeric' });
      return `${startStr} - ${endStr}`;
    } else {
      return `${monthInfo.monthName.toUpperCase()} ${monthInfo.year}`;
    }
  }, [viewType, weekDates, monthInfo]);

  return (
    <div className="flex flex-col gap-6 pb-28">
      {/* Summary Stats */}
      <PlanningSummary 
        darkMode={darkMode} 
        totalHours={stats.totalHours} 
        totalCp={stats.totalCp} 
      />

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 w-full">
        <div className={`p-1 rounded-2xl flex gap-1 border ${darkMode ? 'bg-slate-900 border-white/5' : 'bg-slate-100 border-slate-200'} shrink-0`}>
          <button 
            onClick={() => setViewType('week')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              viewType === 'week' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Semaine
          </button>
          <button 
            onClick={() => setViewType('month')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              viewType === 'month' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Mois
          </button>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate(-1)} 
            className={`p-2 rounded-xl border hover:scale-105 active:scale-95 transition-all ${
              darkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
            }`}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex flex-col items-center justify-center text-center px-2">
            <span className={`text-xs font-black tracking-tight leading-none ${darkMode ? 'text-white' : 'text-slate-900'}`}>{periodLabel}</span>
            <button 
              onClick={goToToday} 
              className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1 hover:underline"
            >
              Aujourd'hui
            </button>
          </div>
          <button 
            onClick={() => navigate(1)} 
            className={`p-2 rounded-xl border hover:scale-105 active:scale-95 transition-all ${
              darkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
            }`}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Add Entry & Clear Actions */}
        <div className="flex gap-2">
          {shifts.length > 0 && (
            <button 
              onClick={() => setShowClearModal(true)}
              title="Vider l'agenda"
              className={`w-10 h-10 rounded-xl border flex items-center justify-center active:scale-90 transition-all ${
                darkMode 
                  ? 'border-white/10 text-rose-500 bg-white/5 hover:bg-rose-500/10 hover:border-rose-500/30' 
                  : 'border-slate-200 text-rose-600 bg-white hover:bg-rose-50 shadow-sm'
              }`}
            >
              <Trash2 size={16} />
            </button>
          )}
          <button 
            onClick={() => {
              setSelectedDayLine(getLocalDateString(currentPivotDate));
              setShowAddModal(true);
            }} 
            className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center active:scale-90 transition-all"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Week View Layout */}
      {viewType === 'week' && (
        <div className="flex flex-col gap-3">
          {weekDates.map(dateStr => {
            const date = parseLocalDate(dateStr);
            const isToday = getLocalDateString(appCurrentTime) === dateStr;
            const isWeekend = weekendDays.includes(dateStr) || date.getDay() === 0;
            const holidays = getFrenchPublicHolidays(date.getFullYear());
            const holidayName = holidays[dateStr];
            
            const dayShifts = shifts.filter(s => s.day === dateStr);
            
            return (
              <div 
                key={dateStr}
                className={`p-5 rounded-[32px] border transition-all duration-300 ${
                  isToday 
                    ? (darkMode ? 'bg-indigo-950/20 border-indigo-500/30 shadow-indigo-500/5 shadow-2xl' : 'bg-indigo-50/50 border-indigo-200 shadow-xl')
                    : (darkMode ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-100 shadow-sm')
                }`}
              >
                {/* Header of the Day */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-base font-black tracking-tight capitalize ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {date.toLocaleDateString('fr-FR', { weekday: 'long' })}
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      isToday 
                        ? 'bg-indigo-500/15 text-indigo-500 font-bold' 
                        : (darkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500')
                    }`}>
                      {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </span>
                    {holidayName && (
                      <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 px-2.5 py-0.5 rounded-full">
                        {holidayName}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => toggleWeekend(dateStr)}
                    className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border transition-all ${
                      isWeekend
                        ? 'bg-orange-500/15 border-orange-500/20 text-orange-500'
                        : (darkMode ? 'border-white/5 text-slate-500 hover:text-slate-300' : 'border-slate-150 text-slate-400 hover:text-slate-600')
                    }`}
                  >
                    {isWeekend ? 'Repos' : 'Travail'}
                  </button>
                </div>

                {/* Day content and list */}
                {dayShifts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-4 border border-dashed rounded-[20px] cursor-pointer hover:bg-slate-500/5 transition-all text-slate-400 border-slate-500/20"
                       onClick={() => {
                         setSelectedDayLine(dateStr);
                         setShowAddModal(true);
                       }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Rien de prévu aujourd'hui ?</span>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1">Cliquez pour ajouter <Plus size={10} /></span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {dayShifts.map(shift => {
                      const duration = calculateTotalDuration(shift);
                      const isL = shift.isLeave || shift.vehicle === 'CONGÉ';
                      const isFerie = shift.isFerieChome === true;
                      
                      return (
                        <div 
                          key={shift.id}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                            isFerie
                              ? 'bg-violet-500/10 border-violet-500/25'
                              : isL 
                                ? 'bg-amber-500/5 border-amber-500/20' 
                                : (darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-150/40')
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isFerie ? (
                              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-500 shrink-0">
                                <Calendar size={16} />
                              </div>
                            ) : isL ? (
                              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                                <Sparkles size={16} />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-500 shrink-0">
                                <Car size={16} />
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className={`text-xs font-extrabold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                                {isFerie ? 'Jour Férié Chômé (Garantie 7h)' : isL ? (shift.leaveType || 'CP/CONGÉ') : (shift.end === '--:--' ? `Embauche à ${shift.start}` : `${shift.start} - ${shift.end}`)}
                              </p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-0.5 flex items-center gap-1.5 font-sans">
                                {isFerie ? 'Maintien de salaire' : isL ? 'Journée de congé' : <><span>{shift.vehicle}</span> &bull; <span>{shift.end === '--:--' ? 'Fin non connue' : duration}</span></>}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={() => {
                                setEditingShift(shift);
                                setShowEditModal(true);
                              }}
                              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                                darkMode 
                                  ? 'border-white/5 text-slate-400 hover:text-white bg-white/5' 
                                  : 'border-slate-200 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 shadow-sm'
                              }`}
                            >
                              <Edit size={12} />
                            </button>
                            <button 
                              onClick={() => handleDeleteShift(shift.id)}
                              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                                darkMode 
                                  ? 'border-white/5 text-slate-400 hover:text-rose-500 bg-white/5' 
                                  : 'border-slate-200 text-slate-500 hover:text-rose-600 bg-white hover:bg-rose-50 shadow-sm'
                              }`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Month View Layout (Grid Calendar style) */}
      {viewType === 'month' && (
        <div className={`p-5 rounded-[32px] border ${darkMode ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className="grid grid-cols-7 gap-1 text-center mb-3">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
              <span key={d} className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-1">{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {monthInfo.days.map(dateStr => {
              const date = parseLocalDate(dateStr);
              const isToday = getLocalDateString(appCurrentTime) === dateStr;
              const isCurrentMonth = date.getMonth() === monthInfo.monthIndex;
              
              const dayShifts = shifts.filter(s => s.day === dateStr);
              const hasLeave = dayShifts.some(s => s.isLeave || s.vehicle === 'CONGÉ');
              const hasShifts = dayShifts.some(s => !s.isLeave && s.vehicle !== 'CONGÉ');

              return (
                <div 
                  key={dateStr}
                  onClick={() => {
                    setSelectedDayLine(dateStr);
                    setShowAddModal(true);
                  }}
                  className={`aspect-square p-1 rounded-2xl flex flex-col justify-between cursor-pointer border hover:-translate-y-0.5 active:translate-y-0 transition-all ${
                    isToday 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                      : (isCurrentMonth 
                          ? (darkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-slate-800')
                          : (darkMode ? 'bg-white/0 border-transparent text-slate-600' : 'bg-transparent border-transparent text-slate-350'))
                  }`}
                >
                  <span className="text-xs font-black p-0.5 self-start">{date.getDate()}</span>
                  
                  {/* Indicators */}
                  <div className="flex gap-1 items-center justify-center pb-0.5">
                    {hasLeave && (
                      <span className={`w-2 h-2 rounded-full ${isToday ? 'bg-white' : 'bg-amber-500'}`} />
                    )}
                    {hasShifts && (
                      <span className={`w-2 h-2 rounded-full ${isToday ? 'bg-white' : 'bg-indigo-500'}`} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-center gap-4 mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
              <span>Garde / Service</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span>Congés / Repos</span>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddPlanningModal 
        darkMode={darkMode}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddShift={handleAddShift}
        onAddLeave={handleAddLeave}
        availableVehicles={availableVehicles}
        todayStr={getLocalDateString(appCurrentTime)}
        selectedDay={selectedDayLine || undefined}
        leaveBalances={leaveBalances}
        leaveDaysCount={0}
        calculateBusinessDays={(s, e) => calculateBusinessDays(s, e, weekendDays, cpCalculationMode)}
        primaryRole={primaryRole}
        shifts={shifts}
      />

      <EditShiftModal 
        darkMode={darkMode}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingShift(null);
        }}
        shift={editingShift}
        onUpdate={handleUpdateShift}
        availableVehicles={availableVehicles}
        primaryRole={primaryRole}
        todayStr={getLocalDateString(appCurrentTime)}
      />

      {/* Confirm Agenda Clear Modal */}
      <AnimatePresence>
        {showClearModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
              onClick={() => setShowClearModal(false)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-sm p-6 rounded-[32px] border shadow-2xl ${
                darkMode ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-250 text-slate-900'
              }`}
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center shadow-inner">
                  <Trash2 size={24} />
                </div>
                
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-black tracking-tight leading-none">Réinitialiser l'agenda ?</h3>
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-1">Mise à zéro complète</p>
                </div>
                
                <p className={`text-xs font-semibold leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Êtes-vous sûr de vouloir supprimer définitivement toutes les entrées du planning ? Cette action est irréversible.
                </p>
                
                <div className="flex w-full gap-3 mt-2">
                  <button
                    onClick={() => setShowClearModal(false)}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      darkMode ? 'bg-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        if (onClearAllShifts) {
                          await onClearAllShifts();
                        } else {
                          setShifts([]);
                          onEndServiceSilently?.();
                        }
                      } catch (err) {
                        console.error("Error calling onClearAllShifts:", err);
                      }
                      setShowClearModal(false);
                    }}
                    className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
