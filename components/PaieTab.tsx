
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  TrendingUp, 
  Receipt, 
  Sparkles, 
  AlertCircle, 
  Euro, 
  Utensils, 
  Clock, 
  CalendarDays,
  ChevronRight,
  TrendingDown,
  Stethoscope,
  Briefcase,
  Car,
  Info,
  ArrowRightLeft,
  FileText,
  X,
  Download,
  ChevronDown
} from 'lucide-react';
import { Shift, Break } from '../types';



// Helper pour calculer les jours fériés français
const getFrenchPublicHolidays = (year: number) => {
  const holidays = [
    `${year}-01-01`, // Nouvel An
    `${year}-05-01`, // Fête du Travail
    `${year}-05-08`, // Victoire 1945
    `${year}-07-14`, // Fête Nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noël
  ];

  const a = year % 19, b = Math.floor(year / 100), c = year % 100,
        d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
        g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
        i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
        m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  const month = Math.floor(n / 31);
  const day = (n % 31) + 1;

  const easter = new Date(year, month - 1, day);
  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  holidays.push(addDays(easter, 1)); // Lundi de Pâques
  holidays.push(addDays(easter, 39)); // Ascension
  holidays.push(addDays(easter, 50)); // Lundi de Pentecôte

  return holidays;
};

const isSundayOrHoliday = (dateStr: string) => {
  const date = new Date(dateStr);
  if (date.getDay() === 0) return true; // Dimanche
  const year = date.getFullYear();
  const holidays = getFrenchPublicHolidays(year);
  return holidays.includes(dateStr);
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
};

const formatWeekTitle = (startDate: Date) => {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const startMonth = startDate.toLocaleDateString('fr-FR', { month: 'short' });
  const endMonth = endDate.toLocaleDateString('fr-FR', { month: 'long' });
  
  if (startDate.getMonth() === endDate.getMonth()) {
    return `Semaine du ${String(startDay).padStart(2, '0')} au ${String(endDay).padStart(2, '0')} ${endMonth}`;
  }
  return `Semaine du ${String(startDay).padStart(2, '0')} ${startMonth} au ${String(endDay).padStart(2, '0')} ${endMonth}`;
};

const MonthAccordion = ({ month, displayMode, darkMode, cardClass, isDefaultOpen }: any) => {
  const [isOpen, setIsOpen] = useState(isDefaultOpen);
  
  const currentMonthTotal = displayMode === 'net' ? month.totalNet : month.totalBrut;
  const previousMonthTotal = displayMode === 'net' ? month.prevMonthNet : month.prevMonthBrut;
  
  const diff = currentMonthTotal - previousMonthTotal;
  const monthName = month.startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  
  return (
    <div className={`rounded-[32px] border overflow-hidden transition-all duration-300 mb-4 ${
      darkMode ? 'bg-slate-900/30 border-white/5' : 'bg-slate-50 border-slate-100'
    }`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-6 flex items-center justify-between text-left transition-colors ${
          isOpen ? (darkMode ? 'bg-white/5' : 'bg-white') : ''
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${darkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            <CalendarDays size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black capitalize tracking-tight">{monthName}</h3>
            <p className={`text-sm font-bold tabular-nums ${
              diff < 0 && displayMode === 'net' ? 'text-rose-500' : (displayMode === 'net' ? 'text-emerald-500' : 'text-indigo-500')
            }`}>
              {currentMonthTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </p>
            {previousMonthTotal > 0 && (
              <p className={`text-[11px] font-medium opacity-70 ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {diff >= 0 ? '+' : '-'} {Math.abs(diff).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € vs mois dernier
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {diff < 0 && displayMode === 'net' && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 text-rose-500 text-[8px] font-black uppercase tracking-widest">
              <TrendingDown size={10} /> Baisse
            </div>
          )}
          <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-4 space-y-4">
              {month.weeks.map((week: any) => (
                <WeekAccordion 
                  key={week.weekKey} 
                  week={week} 
                  displayMode={displayMode} 
                  darkMode={darkMode} 
                  cardClass={cardClass} 
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const WeekAccordion = ({ week, displayMode, darkMode, cardClass }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const totalEarnings = displayMode === 'net' ? week.totalNet : week.totalBrut;
  const hours = Math.floor(week.totalEffectiveMin / 60);
  const minutes = week.totalEffectiveMin % 60;

  return (
    <div className={`rounded-[32px] border overflow-hidden transition-all duration-300 ${
      darkMode ? 'bg-slate-900/50 border-white/5' : 'bg-white border-slate-100'
    }`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex flex-col gap-4 text-left hover:bg-slate-500/5 transition-colors"
      >
        <div className="flex justify-between items-start w-full">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${darkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <CalendarDays size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                {formatWeekTitle(week.startDate)}
              </p>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-black tabular-nums ${displayMode === 'net' ? 'text-emerald-500' : 'text-indigo-500'}`}>
                  +{totalEarnings.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </p>
                <ChevronRight size={20} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
             <div className="flex items-center gap-1.5 text-slate-400 justify-end">
                <Clock size={12} />
                <span className="text-[10px] font-black uppercase tracking-widest">{hours}h {minutes}m</span>
             </div>
             <div className="flex items-center gap-1.5 text-emerald-500 justify-end mt-1">
                <Receipt size={12} />
                <span className="text-[10px] font-black uppercase tracking-widest">{week.totalAllowances.toFixed(2)} € ind.</span>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 sm:hidden">
           <div className="flex items-center gap-1.5 text-slate-400">
              <Clock size={12} />
              <span className="text-[10px] font-black uppercase tracking-widest">{hours}h {minutes}m</span>
           </div>
           <div className="flex items-center gap-1.5 text-emerald-500">
              <Receipt size={12} />
              <span className="text-[10px] font-black uppercase tracking-widest">{week.totalAllowances.toFixed(2)} € ind.</span>
           </div>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="p-6 pt-0 space-y-3 border-t border-slate-500/5">
              {week.shifts.map((shift: any) => (
                <div key={shift.id} className={`${cardClass} p-5 group hover:border-indigo-500/30 transition-all !bg-transparent !shadow-none !border-slate-500/10`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl bg-slate-500/5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {shift.vehicle.includes('ASSU') ? <Stethoscope size={16} /> : shift.vehicle.includes('VSL') ? <Briefcase size={16} /> : <Car size={16} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">
                          {new Date(shift.day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <p className="text-sm font-black tracking-tight">{shift.start} — {shift.end}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black tabular-nums ${displayMode === 'net' ? 'text-emerald-500' : 'text-indigo-500'}`}>
                        +{ (displayMode === 'net' ? shift.calc.netEarnings : shift.calc.grossEarnings).toFixed(2) } €
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        {displayMode === 'net' ? 'Gain Net' : 'Gain Brut'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-500/5">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Effectif</span>
                      <span className="text-xs font-black">{shift.calc.effective}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Indemnités</span>
                      <div className="flex flex-wrap gap-1">
                        {shift.calc.allowanceLabels.length > 0 ? shift.calc.allowanceLabels.map((l: string, i: number) => (
                          <span key={i} className="text-[8px] bg-indigo-500/10 text-indigo-500 px-1 rounded-sm">{l}</span>
                        )) : <span className="text-xs font-black">0.00 €</span>}
                      </div>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Total Ind.</span>
                      <span className="text-xs font-black text-emerald-500">{shift.calc.totalAllowances.toFixed(2)} €</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface PaieTabProps {
  logs: any[];
  darkMode?: boolean;
  hasTaxiCard?: boolean;
  hourlyRate: string;
  weeklyContractHours: number;
  overtimeMode: 'weekly' | 'biweekly' | 'modulation' | 'annualized';
  payRateMode: '100_percent' | '90_percent';
  workRegime: string;
  shifts: Shift[];
  cpCalculationMode?: '25' | '30';
}

const PaieTab: React.FC<PaieTabProps> = ({ 
  darkMode = false, 
  hasTaxiCard = false, 
  hourlyRate, 
  weeklyContractHours,
  overtimeMode,
  payRateMode,
  workRegime, 
  shifts,
  cpCalculationMode = '25'
}) => {
  const [displayMode, setDisplayMode] = useState<'net' | 'brut'>('net');

  const handleExportCSV = () => {
    const currentMonth = monthlyStats.months.find((m: any) => m.isCurrentMonth) || monthlyStats.months[0];
    if (!currentMonth) return;

    const monthName = currentMonth.startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    
    // BOM for Excel to recognize UTF-8
    let csvContent = "\uFEFF";
    // Header
    csvContent += "Date;Véhicule;Début;Fin;Type;Heures Effectives;Gain Brut;Gain Net;Indemnités;Détail Indemnités\n";

    // Shifts - flattened from weeks
    const allShifts = currentMonth.weeks.flatMap((w: any) => w.shifts).sort((a: any, b: any) => a.day.localeCompare(b.day));

    allShifts.forEach((shift: any) => {
      const row = [
        new Date(shift.day).toLocaleDateString('fr-FR'),
        shift.calc.vehicle,
        shift.start,
        shift.end,
        shift.isLeave ? (shift.leaveType || 'Congé') : 'Mission',
        shift.calc.effective.replace('h ', ':').replace('m', ''),
        shift.calc.grossEarnings.toFixed(2).replace('.', ','),
        shift.calc.netEarnings.toFixed(2).replace('.', ','),
        shift.calc.totalAllowances.toFixed(2).replace('.', ','),
        shift.calc.allowanceLabels.join('/')
      ].join(';');
      csvContent += row + "\n";
    });

    // Totals row (with some space)
    csvContent += "\n";
    csvContent += `TOTAL;;;;;${Math.floor(currentMonth.totalEffectiveMin / 60)}h${currentMonth.totalEffectiveMin % 60};${currentMonth.totalBrut.toFixed(2).replace('.', ',')};${currentMonth.totalNet.toFixed(2).replace('.', ',')};${currentMonth.totalAllowances.toFixed(2).replace('.', ',')};\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.style.display = 'none';
    link.href = url;
    link.download = `AmbuFlow_Paie_${monthName.replace(' ', '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Constantes conventionnelles
  const SMPG_BASE = 1842.40;
  const TAXI_BONUS_PERCENT = 0.05;
  const NET_COEFFICIENT = 0.78; 

  const ALLOWANCES = {
    REPAS: 15.54,
    REPAS_UNIQUE: 9.59,
    SPECIALE: 4.34,
    DIMANCHE_FERIE: 23.90
  };

  const parsedHourlyRate = parseFloat(hourlyRate) || 11.65;

  const calculateShiftStats = (shift: Shift) => {
    if (shift.isLeave) {
      const baseHours = weeklyContractHours || 35;
      const hoursPerDay = baseHours / (cpCalculationMode === '25' ? 5 : 6);
      const effectiveMin = Math.round(hoursPerDay * 60);
      const grossEarnings = (effectiveMin / 60) * parsedHourlyRate;
      const netEarnings = grossEarnings * NET_COEFFICIENT;

      return {
        amplitude: "00h 00m",
        effective: `${Math.floor(effectiveMin / 60)}h ${effectiveMin % 60}m`,
        effectiveMin,
        totalAllowances: 0,
        allowanceLabels: [shift.leaveType || 'ABS'],
        grossEarnings,
        netEarnings,
        vehicle: 'CONGÉ'
      };
    }

    if (shift.end === '--:--') return null;

    const [h1, m1] = (shift.start || "00:00").split(':').map(v => parseInt(v, 10) || 0);
    const [h2, m2] = (shift.end || "00:00").split(':').map(v => parseInt(v, 10) || 0);
    
    // Safety check for NaN
    const validH1 = isNaN(h1) ? 0 : h1;
    const validM1 = isNaN(m1) ? 0 : m1;
    const validH2 = isNaN(h2) ? 0 : h2;
    const validM2 = isNaN(m2) ? 0 : m2;

    const startMin = validH1 * 60 + validM1;
    const endMin = validH2 * 60 + validM2;
    let amplitudeMin = endMin - startMin;
    if (amplitudeMin < 0) amplitudeMin += 24 * 60;

    let totalBreaksMin = 0;
    const hasExternalBreak = shift.breaks?.some(b => b.location === 'Extérieur');

    if (shift.breaks) {
      shift.breaks.forEach(b => {
        totalBreaksMin += Number(b.duration) || 0;
      });
    }

    const effectiveMin = Math.max(0, isNaN(amplitudeMin) ? 0 : amplitudeMin - (isNaN(totalBreaksMin) ? 0 : totalBreaksMin));
    const safeAmplitudeMin = isNaN(amplitudeMin) ? 0 : amplitudeMin;
    const safeEffectiveMin = isNaN(effectiveMin) ? 0 : effectiveMin;

    const remunerationCoefficient = payRateMode === '90_percent' ? 0.9 : 1.0;
    const paidMin = safeEffectiveMin * remunerationCoefficient;
    const effectiveHours = paidMin / 60;
    
    const baseGrossEarnings = effectiveHours * parsedHourlyRate;

    // Logique des indemnités
    let totalAllowances = 0;
    let allowanceLabels: string[] = [];

    // 1. Indemnité de repas (15.54€)
    if (startMin <= 660 && (endMin >= 870 || endMin < startMin) && hasExternalBreak) {
      totalAllowances += ALLOWANCES.REPAS;
      allowanceLabels.push("Repas");
    }

    // 2. Indemnité de repas unique (9.59€)
    const sStart = startMin;
    const sEnd = endMin < startMin ? endMin + 1440 : endMin;
    const nightOverlapStart = Math.max(sStart, 1320);
    const nightOverlapEnd = Math.min(sEnd, 1860);
    if (nightOverlapEnd - nightOverlapStart >= 240) {
      totalAllowances += ALLOWANCES.REPAS_UNIQUE;
      allowanceLabels.push("Repas Unique");
    }

    // 3. Indemnité spéciale (Casse-croûte) (4.34€)
    if (hasExternalBreak && (startMin < 300 || (endMin > 1260 && endMin <= 1440))) {
      totalAllowances += ALLOWANCES.SPECIALE;
      allowanceLabels.push("Spéciale");
    }

    // 4. Indemnité Dimanche & Férié (23.90€ brut)
    if (isSundayOrHoliday(shift.day)) {
      totalAllowances += ALLOWANCES.DIMANCHE_FERIE;
      allowanceLabels.push("Dimanche/Férié");
    }

    const grossEarnings = baseGrossEarnings + totalAllowances;
    const netEarnings = (baseGrossEarnings * NET_COEFFICIENT) + totalAllowances;

    return {
      amplitude: `${Math.floor(safeAmplitudeMin / 60)}h ${safeAmplitudeMin % 60}m`,
      effective: `${Math.floor(safeEffectiveMin / 60)}h ${safeEffectiveMin % 60}m`,
      effectiveMin: safeEffectiveMin,
      totalAllowances,
      allowanceLabels,
      grossEarnings,
      netEarnings,
      vehicle: shift.vehicle
    };
  };

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonthIdx = now.getMonth();
    const currentYearIdx = now.getFullYear();

    const prevMonthDate = new Date(currentYearIdx, currentMonthIdx - 1, 1);
    const prevMonthIdx = prevMonthDate.getMonth();
    const prevYearIdx = prevMonthDate.getFullYear();

    let prevMonthBrutAtSameDay = 0;

    const shiftResults = shifts
      .filter(s => s.isLeave || s.end !== '--:--')
      .map(s => ({ ...s, calc: calculateShiftStats(s) }))
      .filter(s => s.calc !== null);

    // Groupement par mois
    const monthsMap: { [key: string]: any } = {};

    shiftResults.forEach(s => {
      if (s.calc) {
        const date = new Date(s.day);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (date.getMonth() === prevMonthIdx && date.getFullYear() === prevYearIdx) {
          if (date.getDate() <= currentDay) {
            prevMonthBrutAtSameDay += s.calc.grossEarnings;
          }
        }

        if (!monthsMap[monthKey]) {
          monthsMap[monthKey] = {
            monthKey,
            startDate: new Date(date.getFullYear(), date.getMonth(), 1),
            totalNet: 0,
            totalBrut: 0,
            totalEffectiveMin: 0,
            totalAllowances: 0,
            weeksMap: {},
            isCurrentMonth: date.getMonth() === currentMonthIdx && date.getFullYear() === currentYearIdx
          };
        }

        const month = monthsMap[monthKey];
        month.totalNet += s.calc.netEarnings;
        month.totalBrut += s.calc.grossEarnings;
        month.totalEffectiveMin += s.calc.effectiveMin;
        month.totalAllowances += s.calc.totalAllowances;

        // Groupement par semaine à l'intérieur du mois
        const startOfWeek = getStartOfWeek(date);
        const weekKey = startOfWeek.toISOString().split('T')[0];

        if (!month.weeksMap[weekKey]) {
          month.weeksMap[weekKey] = {
            weekKey,
            startDate: startOfWeek,
            totalNet: 0,
            totalBrut: 0,
            totalEffectiveMin: 0,
            totalAllowances: 0,
            shifts: []
          };
        }

        const week = month.weeksMap[weekKey];
        week.totalNet += s.calc.netEarnings;
        week.totalBrut += s.calc.grossEarnings;
        week.totalEffectiveMin += s.calc.effectiveMin;
        week.totalAllowances += s.calc.totalAllowances;
        week.shifts.push(s);
      }
    });

    const sortedMonths = Object.values(monthsMap).sort((a: any, b: any) => b.monthKey.localeCompare(a.monthKey));

    // Calcul des tendances mensuelles
    sortedMonths.forEach((month: any, index: number) => {
      month.weeks = Object.values(month.weeksMap).sort((a: any, b: any) => b.weekKey.localeCompare(a.weekKey));
      
      // Comparaison avec le mois précédent chronologique dans les données
      const prevMonthKey = (() => {
        const d = new Date(month.startDate);
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })();
      
      const prevMonthData = monthsMap[prevMonthKey];
      month.prevMonthNet = prevMonthData ? prevMonthData.totalNet : 0;
      month.prevMonthBrut = prevMonthData ? prevMonthData.totalBrut : 0;
      month.isPositiveTrend = prevMonthData ? month.totalNet >= prevMonthData.totalNet : true;
    });

    const currentMonthData = monthsMap[`${currentYearIdx}-${String(currentMonthIdx + 1).padStart(2, '0')}`];
    const prevMonthKey = (() => {
      const d = new Date(currentYearIdx, currentMonthIdx - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();
    const prevMonthData = monthsMap[prevMonthKey];
    
    const taxiBonusBrut = hasTaxiCard ? SMPG_BASE * TAXI_BONUS_PERCENT : 0;
    const taxiBonusNet = taxiBonusBrut * NET_COEFFICIENT;

    const currentMonthBrut = currentMonthData?.totalBrut || 0;
    const isPositiveTrendBrut = currentMonthBrut >= prevMonthBrutAtSameDay;

    return {
      totalMonthlyBrut: currentMonthBrut + taxiBonusBrut,
      totalMonthlyNet: (currentMonthData?.totalNet || 0) + taxiBonusNet,
      prevMonthlyBrut: (prevMonthData?.totalBrut || 0) + taxiBonusBrut,
      prevMonthlyNet: (prevMonthData?.totalNet || 0) + taxiBonusNet,
      totalEffectiveHours: (currentMonthData?.totalEffectiveMin || 0) / 60,
      totalAllowances: currentMonthData?.totalAllowances || 0,
      isPositiveTrend: currentMonthData?.isPositiveTrend ?? true,
      isPositiveTrendBrut,
      months: sortedMonths
    };
  }, [shifts, hasTaxiCard, parsedHourlyRate, weeklyContractHours, overtimeMode, payRateMode, cpCalculationMode]);

  const cardClass = `p-6 rounded-[32px] border transition-all duration-300 ${
    darkMode ? 'bg-slate-900 border-white/5 shadow-2xl shadow-black/40' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'
  }`;

  return (
    <div className="p-5 space-y-6 animate-fadeIn pb-32">
      <div className="flex justify-center items-center gap-3">
        <div className={`p-1 rounded-2xl flex items-center gap-1 ${darkMode ? 'bg-slate-900' : 'bg-slate-200/50'}`}>
          <button 
            onClick={() => setDisplayMode('net')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              displayMode === 'net' 
                ? (monthlyStats.isPositiveTrend ? 'bg-emerald-500 text-white shadow-lg' : 'bg-rose-500 text-white shadow-lg') 
                : 'text-slate-400'
            }`}
          >
            Revenu Net
          </button>
          <button 
            onClick={() => setDisplayMode('brut')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              displayMode === 'brut' 
                ? 'bg-violet-600 text-white shadow-lg' 
                : 'text-slate-400'
            }`}
          >
            Revenu Brut
          </button>
        </div>
        
        <button 
          onClick={handleExportCSV}
          title="Exporter le mois en cours (CSV)"
          className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
            darkMode 
              ? 'bg-slate-900 text-slate-400 hover:text-white border border-white/5' 
              : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 shadow-sm'
          }`}
        >
          <Download size={18} />
        </button>
      </div>

      <div className={`rounded-[36px] p-8 text-white shadow-2xl relative overflow-hidden transition-all duration-500 ${
        displayMode === 'net' 
          ? (monthlyStats.isPositiveTrend ? 'bg-gradient-to-br from-emerald-500 to-teal-700' : 'bg-gradient-to-br from-rose-500 to-rose-700')
          : 'bg-gradient-to-br from-violet-600 to-indigo-800'
      }`}>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                {displayMode === 'net' ? 'Net à payer estimé (Mois)' : 'Brut total estimé (Mois)'}
              </p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-5xl font-black tracking-tighter tabular-nums">
                    {(displayMode === 'net' ? monthlyStats.totalMonthlyNet : monthlyStats.totalMonthlyBrut).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h2>
                  <span className="text-xl font-bold opacity-60">€</span>
                </div>
                
                {/* Différence par rapport au mois dernier */}
                {(() => {
                  const current = displayMode === 'net' ? monthlyStats.totalMonthlyNet : monthlyStats.totalMonthlyBrut;
                  const prev = displayMode === 'net' ? monthlyStats.prevMonthlyNet : monthlyStats.prevMonthlyBrut;
                  const diff = current - prev;
                  
                  if (prev <= 0) return null;

                  return (
                    <span className="text-sm font-semibold text-white/80 ml-1">
                      ({diff >= 0 ? '+' : '-'} {Math.abs(diff).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              {displayMode === 'net' ? (
                monthlyStats.isPositiveTrend ? <TrendingUp size={24} /> : <TrendingDown size={24} />
              ) : (
                monthlyStats.isPositiveTrendBrut ? <TrendingUp size={24} /> : <TrendingDown size={24} />
              )}
            </div>
          </div>
          
          <div className="flex gap-4 mt-6">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest opacity-50">Heures</span>
              <span className="text-lg font-black">{Math.floor(monthlyStats.totalEffectiveHours)}h {Math.floor((monthlyStats.totalEffectiveHours % 1) * 60)}m</span>
            </div>
            <div className="w-px h-8 bg-white/10 self-center" />
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest opacity-50">Indemnités</span>
              <span className="text-lg font-black">{monthlyStats.totalAllowances.toFixed(2)} €</span>
            </div>
            {displayMode === 'net' && (
              <>
                <div className="w-px h-8 bg-white/10 self-center" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-50">Charges (22%)</span>
                  <span className="text-lg font-black italic">-{ (monthlyStats.totalMonthlyBrut - monthlyStats.totalMonthlyNet).toFixed(0) }€</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="absolute -right-12 -bottom-12 opacity-10 pointer-events-none">
          {displayMode === 'net' ? (
            !monthlyStats.isPositiveTrend ? <TrendingDown size={240} /> : <TrendingUp size={240} />
          ) : (
            !monthlyStats.isPositiveTrendBrut ? <TrendingDown size={240} /> : <TrendingUp size={240} />
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Historique des revenus ({displayMode.toUpperCase()})</h3>
          <div className="flex items-center gap-1.5 text-slate-400">
             <Info size={12} />
             <span className="text-[9px] font-bold uppercase">Groupé par mois</span>
          </div>
        </div>

        {monthlyStats.months.length > 0 ? (
          <div className="space-y-2">
            {monthlyStats.months.map((month: any) => (
              <MonthAccordion 
                key={month.monthKey} 
                month={month} 
                displayMode={displayMode} 
                darkMode={darkMode} 
                cardClass={cardClass}
                isDefaultOpen={month.isCurrentMonth}
              />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center opacity-30">
            <CalendarDays size={48} className="mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">Aucune mission enregistrée</p>
          </div>
        )}
      </div>

      <div className={`p-6 rounded-[32px] border space-y-3 transition-colors ${darkMode ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3 text-slate-500">
          <Info size={18} />
          <h4 className="text-[10px] font-black uppercase tracking-widest">Logique des Indemnités (Accords 3085)</h4>
        </div>
        <ul className="text-[10px] font-medium text-slate-500 space-y-1.5 list-disc pl-4">
          <li><strong>Dimanche & Férié (23,90€ brut) :</strong> Attribué pour tout service débutant un dimanche ou un jour férié.</li>
          <li><strong>Repas (15,54€) :</strong> Service complet de 11h à 14h30 en déplacement.</li>
          <li><strong>Repas Unique (9,59€) :</strong> Min. 4h de service entre 22h et 7h du matin.</li>
          <li><strong>Spéciale (4,34€) :</strong> Déplacement + (Début &lt; 5h ou Fin &gt; 21h).</li>
        </ul>
      </div>
    </div>
  );
};

export default PaieTab;
