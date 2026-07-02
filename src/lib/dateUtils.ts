
import { Shift, Break } from '../../types';

export const getLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseLocalDate = (dayStr: string): Date => {
  if (!dayStr || typeof dayStr !== 'string') return new Date();
  const [year, month, day] = dayStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return new Date();
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const getFrenchPublicHolidays = (year: number) => {
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
};

export const isSundayOrHoliday = (dateStr: string) => {
    const date = parseLocalDate(dateStr);
    if (date.getDay() === 0) return true; // Dimanche
    const year = date.getFullYear();
    const holidays = getFrenchPublicHolidays(year);
    return !!holidays[dateStr];
};

export const calculateBusinessDays = (start: string, end: string, weekendDays: string[], cpCalculationMode: '25' | '30') => {
    if (!start || !end) return 0;
    const startDate = parseLocalDate(start);
    const endDateObj = parseLocalDate(end);
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
        if (dayOfWeek === 0) shouldExclude = true;
      } else {
        if (dayOfWeek === 0 || dayOfWeek === 6) shouldExclude = true;
      }

      if (!shouldExclude) {
        count++;
      }
      curDate.setDate(curDate.getDate() + 1);
    }
    return count;
};

export const calculateTotalDurationMinutes = (shift: Shift) => {
    if (shift.isFerieChome || shift.isCP || (shift.isLeave && shift.leaveType === 'CP')) return 420;
    if (!shift.start || !shift.end || shift.end === '--:--') return 0;
    
    const startParts = shift.start.split(':');
    const endParts = shift.end.split(':');
    
    if (startParts.length < 2 || endParts.length < 2) return 0;

    const h1 = parseInt(startParts[0], 10);
    const m1 = parseInt(startParts[1], 10);
    const h2 = parseInt(endParts[0], 10);
    const m2 = parseInt(endParts[1], 10);
    
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
    
    let durationMin = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (durationMin < 0) durationMin += 1440;
    
    if (shift.breaks) {
      shift.breaks.forEach(b => {
        durationMin -= (Number(b.duration) || 0);
      });
    }
    
    return Math.max(0, durationMin);
};

export const calculateTotalDuration = (shift: Shift) => {
    const durationMin = calculateTotalDurationMinutes(shift);
    const h = Math.floor(durationMin / 60);
    const m = durationMin % 60;
    return `${h}H ${m}M`;
};

export const calculateEndTimeFromDuration = (startTime: string, durationMin: number) => {
  const [h, m] = startTime.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m + durationMin);
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

export const toMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};
