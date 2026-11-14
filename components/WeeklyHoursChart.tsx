import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine
} from 'recharts';
import { BarChart3, Car } from 'lucide-react';
import { Shift, ServiceStatus } from '../types';
import {
  calculateTotalDurationMinutes,
  getLocalDateString,
  parseLocalDate
} from '../src/lib/dateUtils';

export type WeeklyChartMode = 'day' | 'vehicle';

interface WeeklyHoursChartProps {
  darkMode: boolean;
  shifts: Shift[];
  weekDates: string[];
  appCurrentTime: Date;
  activeShiftId?: string | null;
  status?: ServiceStatus;
  isCurrentWeek?: boolean;
  mode?: WeeklyChartMode;
  availableVehicles?: string[];
}

interface DayChartDatum {
  dateStr: string;
  dayShort: string;
  dayFull: string;
  dateLabel: string;
  hours: number;
  workedMinutes: number;
  creditedMinutes: number;
  totalMinutes: number;
  formattedTotal: string;
  isToday: boolean;
  isLive: boolean;
  vehicles: string[];
}

interface VehicleChartDatum {
  vehicle: string;
  label: string;
  hours: number;
  minutes: number;
  formattedTotal: string;
  percentage: number;
  shiftsCount: number;
  isLive: boolean;
  color: string;
}

const DAY_SHORTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const VEHICLE_COLORS: Record<string, string> = {
  ASSU: '#FF4B5C',
  AMBU: '#10b981',
  VSL: '#6366f1',
  TAXI: '#f59e0b'
};

const VEHICLE_LABELS: Record<string, string> = {
  ASSU: 'ASSU · Secours d’urgence',
  AMBU: 'Ambulance',
  VSL: 'Véhicule Sanitaire Léger',
  TAXI: 'Taxi conventionné'
};

const getVehicleKey = (vehicle?: string): string => {
  const v = (vehicle || '').trim().toUpperCase();
  if (!v || v === 'CONGÉ') return 'Autre';
  if (v.includes('ASSU')) return 'ASSU';
  if (v.includes('VSL')) return 'VSL';
  if (v.includes('TAXI')) return 'TAXI';
  if (v.includes('AMBU')) return 'AMBU';
  return vehicle!.trim();
};

const formatMinutes = (totalMin: number): string => {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
};

const computeShiftMinutesForChart = (
  shift: Shift,
  activeShiftId: string | null | undefined,
  status: ServiceStatus | undefined,
  currentTime: Date
): { workedMinutes: number; creditedMinutes: number; isLive: boolean } => {
  const isCP =
    shift.isCP === true ||
    (shift as any).isCP === 'true' ||
    shift.type === 'CP' ||
    (shift as any).absenceType === 'CP' ||
    shift.leaveType === 'CP';

  const isFerie =
    shift.isFerieChome === true ||
    (shift as any).isFerieChome === 'true' ||
    shift.type === 'FERIE';

  if (isCP || isFerie) {
    return { workedMinutes: 0, creditedMinutes: 420, isLive: false };
  }

  if (shift.isLeave || shift.vehicle === 'CONGÉ') {
    return { workedMinutes: 0, creditedMinutes: 0, isLive: false };
  }

  if (shift.end && shift.end !== '--:--') {
    return {
      workedMinutes: calculateTotalDurationMinutes(shift),
      creditedMinutes: 0,
      isLive: false
    };
  }

  // Service en cours (pas encore clôturé)
  if (activeShiftId && shift.id === activeShiftId && shift.start && shift.start !== '--:--') {
    const [h1, m1] = shift.start.split(':').map((v) => parseInt(v, 10) || 0);
    const [year, month, day] = shift.day.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, h1, m1, 0, 0);

    const isInBreak = status === ServiceStatus.BREAK;
    const lastBreak =
      isInBreak && shift.breaks && shift.breaks.length > 0
        ? shift.breaks[shift.breaks.length - 1]
        : null;

    let endDate = new Date(currentTime);
    if (isInBreak && lastBreak?.start) {
      const [hb, mb] = lastBreak.start.split(':').map((v) => parseInt(v, 10) || 0);
      endDate = new Date(year, month - 1, day, hb, mb, 0, 0);
      if (endDate.getTime() < startDate.getTime()) {
        endDate.setDate(endDate.getDate() + 1);
      }
    }

    let durationMin = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 60000));
    if (shift.breaks) {
      shift.breaks.forEach((b) => {
        if (b.end !== '--:--' && b.id !== lastBreak?.id) {
          const rawDur = Number(b.duration) || 0;
          const accountedDur = b.isMeal
            ? Math.max(30, Math.min(90, rawDur))
            : Math.max(20, Math.min(90, rawDur));
          durationMin -= Math.min(90, accountedDur);
        }
      });
    }

    return {
      workedMinutes: Math.max(0, durationMin),
      creditedMinutes: 0,
      isLive: true
    };
  }

  return { workedMinutes: 0, creditedMinutes: 0, isLive: false };
};

interface DayTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DayChartDatum }>;
  darkMode: boolean;
}

const DayTooltip: React.FC<DayTooltipProps> = ({ active, payload, darkMode }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;

  return (
    <div
      className={`px-3.5 py-2.5 rounded-2xl border shadow-xl text-xs ${
        darkMode
          ? 'bg-slate-900/95 border-white/10 text-white'
          : 'bg-white/95 border-slate-200 text-slate-900'
      }`}
    >
      <div className="flex items-center justify-between gap-4 mb-1">
        <span className="font-bold capitalize">
          {item.dayFull} {item.dateLabel}
        </span>
        {item.isLive && (
          <span className="text-[10px] font-semibold text-emerald-500">En cours</span>
        )}
      </div>

      <div className="font-black text-sm tabular-nums text-indigo-500">
        {item.totalMinutes > 0 ? item.formattedTotal : 'Repos / 0h00'}
      </div>

      {item.workedMinutes > 0 && item.creditedMinutes > 0 && (
        <div className={`mt-1 text-[11px] tabular-nums ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Travail : {formatMinutes(item.workedMinutes)} · CP/Férié : {formatMinutes(item.creditedMinutes)}
        </div>
      )}

      {item.creditedMinutes > 0 && item.workedMinutes === 0 && (
        <div className={`mt-0.5 text-[11px] ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
          Assimilé CP / Férié
        </div>
      )}

      {item.vehicles.length > 0 && (
        <div className={`mt-1 text-[10px] font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {item.vehicles.join(' · ')}
        </div>
      )}
    </div>
  );
};

interface VehicleTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: VehicleChartDatum }>;
  darkMode: boolean;
}

const VehicleTooltip: React.FC<VehicleTooltipProps> = ({ active, payload, darkMode }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;

  return (
    <div
      className={`px-3.5 py-2.5 rounded-2xl border shadow-xl text-xs ${
        darkMode
          ? 'bg-slate-900/95 border-white/10 text-white'
          : 'bg-white/95 border-slate-200 text-slate-900'
      }`}
    >
      <div className="flex items-center justify-between gap-4 mb-1">
        <span className="font-bold flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-sm inline-block"
            style={{ backgroundColor: item.color }}
          />
          {item.vehicle}
        </span>
        {item.isLive && (
          <span className="text-[10px] font-semibold text-emerald-500">En cours</span>
        )}
      </div>

      <div className="font-black text-sm tabular-nums" style={{ color: item.color }}>
        {item.minutes > 0 ? item.formattedTotal : '0h00'}
      </div>

      <div className={`mt-0.5 text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {item.label}
      </div>

      <div className={`mt-1 text-[10px] font-semibold tabular-nums ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {item.percentage}% du total · {item.shiftsCount} {item.shiftsCount > 1 ? 'gardes' : 'garde'}
      </div>
    </div>
  );
};

export const WeeklyHoursChart: React.FC<WeeklyHoursChartProps> = ({
  darkMode,
  shifts,
  weekDates,
  appCurrentTime,
  activeShiftId,
  status,
  isCurrentWeek = true,
  mode = 'day',
  availableVehicles = ['ASSU', 'AMBU', 'VSL']
}) => {
  const todayStr = getLocalDateString(appCurrentTime);

  const { dayChartData, totalWeekMinutes, workedDaysCount, hasCreditedDays } = useMemo(() => {
    let totalMin = 0;
    let activeDays = 0;
    let creditedFound = false;

    const data: DayChartDatum[] = weekDates.map((dateStr) => {
      const date = parseLocalDate(dateStr);
      const dayShifts = shifts.filter((s) => s.day === dateStr);

      let dayWorkedMin = 0;
      let dayCreditedMin = 0;
      let dayIsLive = false;
      const vehiclesSet = new Set<string>();

      dayShifts.forEach((shift) => {
        const res = computeShiftMinutesForChart(shift, activeShiftId, status, appCurrentTime);
        dayWorkedMin += res.workedMinutes;
        dayCreditedMin += res.creditedMinutes;
        if (res.isLive) dayIsLive = true;
        if (shift.vehicle && shift.vehicle !== 'CONGÉ' && !shift.isLeave) {
          vehiclesSet.add(shift.vehicle);
        }
      });

      const dayTotalMin = dayWorkedMin + dayCreditedMin;
      if (dayTotalMin > 0) activeDays++;
      if (dayCreditedMin > 0) creditedFound = true;
      totalMin += dayTotalMin;

      return {
        dateStr,
        dayShort: DAY_SHORTS[date.getDay()],
        dayFull: date.toLocaleDateString('fr-FR', { weekday: 'long' }),
        dateLabel: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        hours: Number((dayTotalMin / 60).toFixed(2)),
        workedMinutes: dayWorkedMin,
        creditedMinutes: dayCreditedMin,
        totalMinutes: dayTotalMin,
        formattedTotal: formatMinutes(dayTotalMin),
        isToday: dateStr === todayStr,
        isLive: dayIsLive,
        vehicles: Array.from(vehiclesSet)
      };
    });

    return {
      dayChartData: data,
      totalWeekMinutes: totalMin,
      workedDaysCount: activeDays,
      hasCreditedDays: creditedFound
    };
  }, [weekDates, shifts, activeShiftId, status, appCurrentTime, todayStr]);

  const { vehicleChartData, totalVehicleMinutes, activeVehiclesCount } = useMemo(() => {
    const vehicleMap = new Map<string, { minutes: number; shiftsCount: number; isLive: boolean }>();

    availableVehicles.forEach((v) => {
      const key = getVehicleKey(v);
      if (key !== 'Autre' && !vehicleMap.has(key)) {
        vehicleMap.set(key, { minutes: 0, shiftsCount: 0, isLive: false });
      }
    });

    let totalMin = 0;

    weekDates.forEach((dateStr) => {
      const dayShifts = shifts.filter((s) => s.day === dateStr);
      dayShifts.forEach((shift) => {
        const res = computeShiftMinutesForChart(shift, activeShiftId, status, appCurrentTime);
        if (res.workedMinutes <= 0 && (shift.isLeave || shift.vehicle === 'CONGÉ' || shift.isFerieChome || shift.type === 'FERIE')) {
          return;
        }
        const key = getVehicleKey(shift.vehicle);
        const current = vehicleMap.get(key) || { minutes: 0, shiftsCount: 0, isLive: false };
        current.minutes += res.workedMinutes;
        if (res.workedMinutes > 0 || res.isLive) {
          current.shiftsCount += 1;
        }
        if (res.isLive) current.isLive = true;
        vehicleMap.set(key, current);
        totalMin += res.workedMinutes;
      });
    });

    const list: VehicleChartDatum[] = Array.from(vehicleMap.entries())
      .map(([vehicle, stats]) => ({
        vehicle,
        label: VEHICLE_LABELS[vehicle] || vehicle,
        hours: Number((stats.minutes / 60).toFixed(2)),
        minutes: stats.minutes,
        formattedTotal: formatMinutes(stats.minutes),
        percentage: totalMin > 0 ? Math.round((stats.minutes / totalMin) * 100) : 0,
        shiftsCount: stats.shiftsCount,
        isLive: stats.isLive,
        color: VEHICLE_COLORS[vehicle] || '#8b5cf6'
      }))
      .sort((a, b) => b.minutes - a.minutes);

    return {
      vehicleChartData: list,
      totalVehicleMinutes: totalMin,
      activeVehiclesCount: list.filter((v) => v.minutes > 0).length
    };
  }, [weekDates, shifts, availableVehicles, activeShiftId, status, appCurrentTime]);

  const weekRangeText = useMemo(() => {
    if (weekDates.length < 7) return '';
    const first = parseLocalDate(weekDates[0]);
    const last = parseLocalDate(weekDates[6]);
    const start = first.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const end = last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `${start} – ${end}`;
  }, [weekDates]);

  const gridStroke = darkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)';
  const axisTickColor = darkMode ? '#94a3b8' : '#64748b';
  const isVehicleMode = mode === 'vehicle';
  const displayedTotalMinutes = isVehicleMode ? totalVehicleMinutes : totalWeekMinutes;

  return (
    <section
      aria-label={isVehicleMode ? 'Graphique des heures travaillées par véhicule' : 'Graphique des heures travaillées par jour'}
      className={`p-5 rounded-[32px] border transition-colors duration-300 ${
        darkMode
          ? 'bg-slate-900/40 border-white/5'
          : 'bg-white border-slate-100 shadow-sm'
      }`}
    >
      {/* En-tête épuré */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isVehicleMode ? (
              <Car size={16} className="text-indigo-500 shrink-0" />
            ) : (
              <BarChart3 size={16} className="text-indigo-500 shrink-0" />
            )}
            <h3 className={`text-sm font-black tracking-tight truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {isVehicleMode ? 'Heures par type de véhicule' : 'Heures par jour'}
            </h3>
          </div>
          <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {isCurrentWeek ? 'Semaine en cours' : 'Semaine affichée'} · {weekRangeText}
          </p>
        </div>

        <div className="text-right shrink-0">
          <div className={`text-base font-black tabular-nums leading-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            {formatMinutes(displayedTotalMinutes)}
          </div>
          <div className={`text-[11px] font-medium tabular-nums ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {isVehicleMode
              ? `${activeVehiclesCount} ${activeVehiclesCount > 1 ? 'véhicules' : 'véhicule'}`
              : `${workedDaysCount} j ${workedDaysCount > 1 ? 'actifs' : 'actif'}`}
          </div>
        </div>
      </div>

      {/* Conteneur graphique Recharts */}
      <div className="relative h-[196px] w-full min-w-0">
        {isVehicleMode ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={vehicleChartData}
              margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis
                dataKey="vehicle"
                axisLine={false}
                tickLine={false}
                tick={{ fill: axisTickColor, fontSize: 11, fontWeight: 700 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                unit="h"
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax + 2))]}
                tick={{ fill: axisTickColor, fontSize: 10, fontWeight: 600 }}
              />
              <Tooltip
                cursor={{
                  fill: darkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(99, 102, 241, 0.05)',
                  radius: 8
                }}
                content={<VehicleTooltip darkMode={darkMode} />}
              />
              <Bar
                dataKey="hours"
                radius={[8, 8, 0, 0]}
                maxBarSize={44}
                animationDuration={400}
              >
                {vehicleChartData.map((entry) => (
                  <Cell
                    key={entry.vehicle}
                    fill={entry.minutes > 0 ? entry.color : 'transparent'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dayChartData}
              margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis
                dataKey="dayShort"
                axisLine={false}
                tickLine={false}
                tick={({ x, y, payload }) => {
                  const entry = dayChartData[payload.index];
                  const isToday = entry?.isToday;
                  return (
                    <text
                      x={x}
                      y={Number(y) + 12}
                      textAnchor="middle"
                      fill={isToday ? '#6366f1' : axisTickColor}
                      fontSize={11}
                      fontWeight={isToday ? 800 : 600}
                    >
                      {payload.value}
                    </text>
                  );
                }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                unit="h"
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax + 1))]}
                tick={{ fill: axisTickColor, fontSize: 10, fontWeight: 600 }}
              />
              <ReferenceLine
                y={7}
                stroke={darkMode ? 'rgba(148, 163, 184, 0.25)' : 'rgba(100, 116, 139, 0.25)'}
                strokeDasharray="4 4"
              />
              <Tooltip
                cursor={{
                  fill: darkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(99, 102, 241, 0.05)',
                  radius: 8
                }}
                content={<DayTooltip darkMode={darkMode} />}
              />
              <Bar
                dataKey="hours"
                radius={[8, 8, 0, 0]}
                maxBarSize={34}
                animationDuration={400}
              >
                {dayChartData.map((entry) => {
                  let fillColor = 'transparent';
                  if (entry.totalMinutes > 0) {
                    if (entry.creditedMinutes > 0 && entry.workedMinutes === 0) {
                      fillColor = '#f59e0b';
                    } else if (entry.isToday) {
                      fillColor = '#6366f1';
                    } else {
                      fillColor = darkMode ? '#818cf8' : '#4f46e5';
                    }
                  }
                  return <Cell key={entry.dateStr} fill={fillColor} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {displayedTotalMinutes === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-4">
            <span
              className={`text-xs font-medium px-3 py-1.5 rounded-xl ${
                darkMode ? 'bg-slate-900/80 text-slate-400' : 'bg-white/85 text-slate-500'
              }`}
            >
              {isVehicleMode
                ? 'Aucune heure par véhicule sur cette semaine'
                : 'Aucune heure enregistrée sur cette semaine'}
            </span>
          </div>
        )}
      </div>

      {/* Légende discrète */}
      {isVehicleMode ? (
        <div className={`flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t text-[11px] ${
          darkMode ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-500'
        }`}>
          <div className="flex flex-wrap items-center gap-3.5">
            {vehicleChartData.map((v) => (
              <span key={v.vehicle} className="flex items-center gap-1.5 tabular-nums">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ backgroundColor: v.color }}
                />
                <span>{v.vehicle}</span>
                {v.minutes > 0 && (
                  <span className="opacity-70">{v.formattedTotal}</span>
                )}
              </span>
            ))}
          </div>
          <span className="opacity-75">Hors congés / fériés</span>
        </div>
      ) : (
        <div className={`flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t text-[11px] ${
          darkMode ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-500'
        }`}>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm inline-block ${darkMode ? 'bg-indigo-400' : 'bg-indigo-600'}`} />
              <span>Travaillées</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block bg-indigo-500 ring-2 ring-indigo-500/30" />
              <span>Aujourd'hui</span>
            </span>
            {hasCreditedDays && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block bg-amber-500" />
                <span>CP / Férié</span>
              </span>
            )}
          </div>
          <span className="tabular-nums opacity-75">Repère 7h / jour</span>
        </div>
      )}
    </section>
  );
};
