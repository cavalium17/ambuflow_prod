import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Shift, Break, ServiceStatus, MonthlyReportSummary } from '../../types';
import {
  calculateTotalDurationMinutes,
  getLocalDateString,
  parseLocalDate
} from './dateUtils';

export interface MonthlyPdfReportParams {
  shifts: Shift[];
  pivotDate: Date;
  appCurrentTime: Date;
  activeShiftId?: string | null;
  status?: ServiceStatus;
  workRegime?: string;
  userName?: string;
  companyName?: string;
}

export interface PdfReportDetailRow {
  date: string;
  vehicleOrType: string;
  horaires: string;
  amplitude: string;
  breaksText: string;
  breakDeducted: string;
  effective: string;
}

export interface BuiltMonthlyPdfReport {
  doc: jsPDF;
  blob: Blob;
  base64: string;
  fileName: string;
  monthKey: string;
  monthTitle: string;
  periodStartLabel: string;
  periodEndLabel: string;
  generatedAtLabel: string;
  summary: MonthlyReportSummary;
  detailRows: PdfReportDetailRow[];
}

export const formatMinutesLabel = (totalMin: number): string => {
  const safeMin = Math.max(0, Math.round(totalMin));
  const h = Math.floor(safeMin / 60);
  const m = safeMin % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

const sanitizePdfText = (text: string): string => {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2022]/g, '-');
};

const getVehicleKey = (vehicle?: string): string => {
  const v = (vehicle || '').trim().toUpperCase();
  if (!v || v === 'CONGÉ') return 'Autre';
  if (v.includes('ASSU')) return 'ASSU';
  if (v.includes('VSL')) return 'VSL';
  if (v.includes('TAXI')) return 'TAXI';
  if (v.includes('AMBU')) return 'AMBU';
  return (vehicle || 'Autre').trim();
};

const getWorkRegimeLabel = (regime?: string): string => {
  switch (regime) {
    case 'weekly':
      return 'Hebdomadaire (35h)';
    case 'fortnightly':
      return 'Quinzaine (70h / 2 sem.)';
    case 'modulation':
      return 'Modulation';
    case 'annualization':
      return 'Annualisation';
    default:
      return regime || 'Standard';
  }
};

const getAccountedBreakMinutes = (b: Break): number => {
  const rawDur = Number(b.duration) || 0;
  return b.isMeal
    ? Math.max(30, Math.min(90, rawDur))
    : Math.max(20, Math.min(90, rawDur));
};

const computeShiftAmplitudeMinutes = (
  shift: Shift,
  activeShiftId: string | null | undefined,
  status: ServiceStatus | undefined,
  currentTime: Date
): { amplitudeMin: number; effectiveMin: number; isLive: boolean } => {
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
    return { amplitudeMin: 420, effectiveMin: 420, isLive: false };
  }

  if (shift.isLeave || shift.vehicle === 'CONGÉ') {
    return { amplitudeMin: 0, effectiveMin: 0, isLive: false };
  }

  if (!shift.start || shift.start === '--:--') {
    return { amplitudeMin: 0, effectiveMin: 0, isLive: false };
  }

  const [h1, m1] = shift.start.split(':').map((v) => parseInt(v, 10) || 0);
  const [year, month, day] = shift.day.split('-').map(Number);
  const startDate = new Date(year, month - 1, day, h1, m1, 0, 0);

  if (shift.end && shift.end !== '--:--') {
    const [h2, m2] = shift.end.split(':').map((v) => parseInt(v, 10) || 0);
    const endDate = new Date(year, month - 1, day, h2, m2, 0, 0);
    if (endDate.getTime() < startDate.getTime()) {
      endDate.setDate(endDate.getDate() + 1);
    }
    const amplitudeMin = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
    const effectiveMin = calculateTotalDurationMinutes(shift);
    return { amplitudeMin, effectiveMin, isLive: false };
  }

  // Shift en cours
  if (activeShiftId && shift.id === activeShiftId) {
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

    const amplitudeMin = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 60000));
    let effectiveMin = amplitudeMin;
    if (shift.breaks) {
      shift.breaks.forEach((b) => {
        if (b.end !== '--:--' && b.id !== lastBreak?.id) {
          effectiveMin -= Math.min(90, getAccountedBreakMinutes(b));
        }
      });
    }
    return { amplitudeMin, effectiveMin: Math.max(0, effectiveMin), isLive: true };
  }

  return { amplitudeMin: 0, effectiveMin: 0, isLive: false };
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

export const buildMonthlyPlanningPDF = ({
  shifts,
  pivotDate,
  appCurrentTime,
  activeShiftId,
  status,
  workRegime,
  userName,
  companyName
}: MonthlyPdfReportParams): BuiltMonthlyPdfReport => {
  const year = pivotDate.getFullYear();
  const monthIndex = pivotDate.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const firstDayStr = getLocalDateString(firstDay);
  const lastDayStr = getLocalDateString(lastDay);

  const monthTitleRaw = pivotDate.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  });
  const monthTitle = monthTitleRaw.charAt(0).toUpperCase() + monthTitleRaw.slice(1);

  const monthShifts = shifts
    .filter((s) => s.day >= firstDayStr && s.day <= lastDayStr)
    .sort((a, b) => {
      const dayDiff = a.day.localeCompare(b.day);
      if (dayDiff !== 0) return dayDiff;
      return (a.start || '').localeCompare(b.start || '');
    });

  // Calculs agrégés du mois
  let totalEffectiveMin = 0;
  let totalWorkedOnlyMin = 0;
  let totalCreditedMin = 0;
  let totalBreakRawMin = 0;
  let totalBreakDeductedMin = 0;
  let totalBreakCount = 0;
  let mealBreakCount = 0;
  let mealBreakMin = 0;
  let coffeeBreakCount = 0;
  let coffeeBreakMin = 0;
  let workShiftCount = 0;
  let cpDaysCount = 0;
  let ferieDaysCount = 0;
  let otherLeaveCount = 0;

  const vehicleStats = new Map<string, { minutes: number; count: number }>();

  const detailRows: string[][] = [];

  monthShifts.forEach((shift) => {
    const dateObj = parseLocalDate(shift.day);
    const dayStr = dateObj.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });
    const formattedDay = dayStr.charAt(0).toUpperCase() + dayStr.slice(1);

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

    const isOtherLeave = (shift.isLeave || shift.vehicle === 'CONGÉ') && !isCP;

    const { amplitudeMin, effectiveMin, isLive } = computeShiftAmplitudeMinutes(
      shift,
      activeShiftId,
      status,
      appCurrentTime
    );

    totalEffectiveMin += effectiveMin;

    if (isCP) {
      cpDaysCount += 1;
      totalCreditedMin += effectiveMin;
      detailRows.push([
        sanitizePdfText(formattedDay),
        'Congé Payé (CP)',
        'Forfait journalier',
        '-',
        'Aucune pause',
        '-',
        formatMinutesLabel(effectiveMin)
      ]);
      return;
    }

    if (isFerie) {
      ferieDaysCount += 1;
      totalCreditedMin += effectiveMin;
      detailRows.push([
        sanitizePdfText(formattedDay),
        'Jour Férié Chômé',
        'Garantie 7h00',
        '-',
        'Aucune pause',
        '-',
        formatMinutesLabel(effectiveMin)
      ]);
      return;
    }

    if (isOtherLeave) {
      otherLeaveCount += 1;
      const leaveLabel = shift.leaveType || 'Absence';
      detailRows.push([
        sanitizePdfText(formattedDay),
        sanitizePdfText(`Absence (${leaveLabel})`),
        '-',
        '-',
        'Aucune pause',
        '-',
        '0h 00m'
      ]);
      return;
    }

    // Garde travaillée
    workShiftCount += 1;
    totalWorkedOnlyMin += effectiveMin;

    const vKey = getVehicleKey(shift.vehicle);
    const vEntry = vehicleStats.get(vKey) || { minutes: 0, count: 0 };
    vEntry.minutes += effectiveMin;
    vEntry.count += 1;
    vehicleStats.set(vKey, vEntry);

    // Pauses de la garde
    const shiftBreaks = shift.breaks || [];
    let shiftBreakDeducted = 0;
    const breakDescriptions: string[] = [];

    shiftBreaks.forEach((b) => {
      const rawDur = Math.max(0, Number(b.duration) || 0);
      const accountedDur = getAccountedBreakMinutes(b);
      shiftBreakDeducted += Math.min(90, accountedDur);
      totalBreakRawMin += rawDur;
      totalBreakDeductedMin += Math.min(90, accountedDur);
      totalBreakCount += 1;

      if (b.isMeal) {
        mealBreakCount += 1;
        mealBreakMin += rawDur;
      } else {
        coffeeBreakCount += 1;
        coffeeBreakMin += rawDur;
      }

      const kind = b.isMeal ? 'Repas' : 'Café';
      const loc = b.location ? `, ${b.location}` : '';
      const timeRange = b.start && b.end && b.end !== '--:--'
        ? `${b.start}-${b.end}`
        : (b.start || '--:--');
      breakDescriptions.push(`${kind} ${timeRange} (${rawDur}m${loc})`);
    });

    const horairesLabel =
      shift.end && shift.end !== '--:--'
        ? `${shift.start || '--:--'} - ${shift.end}`
        : isLive
          ? `${shift.start || '--:--'} - En cours`
          : `${shift.start || '--:--'} - --:--`;

    detailRows.push([
      sanitizePdfText(formattedDay),
      sanitizePdfText(shift.vehicle || vKey),
      sanitizePdfText(horairesLabel),
      amplitudeMin > 0 ? formatMinutesLabel(amplitudeMin) : '-',
      sanitizePdfText(breakDescriptions.length > 0 ? breakDescriptions.join('\n') : 'Aucune pause'),
      shiftBreakDeducted > 0 ? formatMinutesLabel(shiftBreakDeducted) : '-',
      formatMinutesLabel(effectiveMin)
    ]);
  });

  // Création du document PDF A4 portrait
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Bandeau d'en-tête sobre et structuré
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 34, 'F');

  doc.setFillColor(79, 70, 229); // Accent Indigo 600
  doc.rect(0, 34, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('AmbuFlow', margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(sanitizePdfText(`Rapport mensuel des heures travaillées - ${monthTitle}`), margin, 21.5);

  const metaParts: string[] = [
    `Période : ${firstDay.toLocaleDateString('fr-FR')} au ${lastDay.toLocaleDateString('fr-FR')}`,
    `Régime : ${getWorkRegimeLabel(workRegime)}`
  ];
  if (userName) metaParts.unshift(`Collaborateur : ${userName}`);
  if (companyName) metaParts.push(`Entreprise : ${companyName}`);

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(sanitizePdfText(metaParts.join('  |  ')), margin, 28.5);

  // Date de génération alignée à droite
  const generatedAtStr = `Édité le ${appCurrentTime.toLocaleDateString('fr-FR')} à ${appCurrentTime.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(sanitizePdfText(generatedAtStr), pageWidth - margin, 14, { align: 'right' });

  // Cartes de synthèse (4 KPIs)
  let cursorY = 43;
  const kpiGap = 3.5;
  const kpiWidth = (contentWidth - kpiGap * 3) / 4;
  const kpiHeight = 20;

  const kpis = [
    {
      label: 'TOTAL EFFECTIF',
      value: formatMinutesLabel(totalEffectiveMin),
      sub: totalCreditedMin > 0
        ? `dont ${formatMinutesLabel(totalCreditedMin)} CP/Férié`
        : `${workShiftCount} garde(s)`
    },
    {
      label: 'TRAVAIL RÉEL',
      value: formatMinutesLabel(totalWorkedOnlyMin),
      sub: `${workShiftCount} mission(s) active(s)`
    },
    {
      label: 'PAUSES DÉDUITES',
      value: formatMinutesLabel(totalBreakDeductedMin),
      sub: `${totalBreakCount} pause(s) (${totalBreakRawMin}m réelles)`
    },
    {
      label: 'CONGÉS & FÉRIÉS',
      value: `${cpDaysCount + ferieDaysCount} j`,
      sub: `${cpDaysCount} CP · ${ferieDaysCount} Férié · ${otherLeaveCount} Autre`
    }
  ];

  kpis.forEach((kpi, index) => {
    const x = margin + index * (kpiWidth + kpiGap);
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.roundedRect(x, cursorY, kpiWidth, kpiHeight, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(sanitizePdfText(kpi.label), x + 3, cursorY + 5.5);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(sanitizePdfText(kpi.value), x + 3, cursorY + 12.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(sanitizePdfText(kpi.sub), x + 3, cursorY + 17.5);
  });

  cursorY += kpiHeight + 8;

  // Section 1 : Répartition par type de véhicule + Synthèse des pauses
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Répartition par type de véhicule', margin, cursorY);
  cursorY += 2.5;

  const vehicleRows = Array.from(vehicleStats.entries())
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .map(([veh, st]) => {
      const pct = totalWorkedOnlyMin > 0 ? Math.round((st.minutes / totalWorkedOnlyMin) * 100) : 0;
      return [
        veh,
        `${st.count}`,
        formatMinutesLabel(st.minutes),
        `${pct}%`
      ];
    });

  if (vehicleRows.length === 0) {
    vehicleRows.push(['Aucune mission véhicule sur ce mois', '0', '0h 00m', '0%']);
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    head: [['Type de véhicule', 'Nb de gardes', 'Heures travaillées', 'Part (%)']],
    body: vehicleRows,
    foot: vehicleStats.size > 0
      ? [['Total missions véhicules', `${workShiftCount}`, formatMinutesLabel(totalWorkedOnlyMin), '100%']]
      : undefined,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold'
    },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right', fontStyle: 'bold' },
      3: { halign: 'right' }
    }
  });

  cursorY = ((doc as any).lastAutoTable?.finalY ?? cursorY + 25) + 7;

  // Section 2 : Synthèse des pauses du mois
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Synthèse des pauses enregistrées', margin, cursorY);
  cursorY += 2.5;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    head: [['Catégorie de pause', 'Nombre', 'Durée cumulée déclarée', 'Durée totale déduite']],
    body: [
      ['Pauses Repas (min. 30m)', `${mealBreakCount}`, formatMinutesLabel(mealBreakMin), '-'],
      ['Pauses Café (min. 20m)', `${coffeeBreakCount}`, formatMinutesLabel(coffeeBreakMin), '-']
    ],
    foot: [[
      'Total des pauses',
      `${totalBreakCount}`,
      formatMinutesLabel(totalBreakRawMin),
      formatMinutesLabel(totalBreakDeductedMin)
    ]],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold'
    },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' }
    }
  });

  cursorY = ((doc as any).lastAutoTable?.finalY ?? cursorY + 25) + 8;

  // Section 3 : Relevé journalier détaillé
  if (cursorY > pageHeight - 40) {
    doc.addPage();
    cursorY = 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Relevé journalier détaillé des gardes et pauses', margin, cursorY);
  cursorY += 2.5;

  if (detailRows.length === 0) {
    detailRows.push([
      '-',
      'Aucune entrée',
      '-',
      '-',
      'Aucune garde ou absence enregistrée pour ce mois',
      '-',
      '0h 00m'
    ]);
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin, bottom: 18 },
    head: [[
      'Date',
      'Véhicule / Type',
      'Horaires',
      'Amplitude',
      'Détail des pauses',
      'Pause déd.',
      'Heures eff.'
    ]],
    body: detailRows,
    foot: monthShifts.length > 0
      ? [[
          'TOTAL MENSUEL',
          `${workShiftCount} garde(s)`,
          '',
          '',
          `${totalBreakCount} pause(s)`,
          formatMinutesLabel(totalBreakDeductedMin),
          formatMinutesLabel(totalEffectiveMin)
        ]]
      : undefined,
    theme: 'striped',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      valign: 'middle'
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    footStyles: {
      fillColor: [224, 231, 255],
      textColor: [30, 27, 75],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 23, fontStyle: 'bold' },
      1: { cellWidth: 26 },
      2: { cellWidth: 27 },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
    }
  });

  // Pied de page sur chaque page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      sanitizePdfText(`AmbuFlow - Document d'archivage mensuel (${monthTitle})`),
      margin,
      pageHeight - 7
    );
    doc.text(
      `Page ${i} / ${totalPages}`,
      pageWidth - margin,
      pageHeight - 7,
      { align: 'right' }
    );
  }

  const monthSlug = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const fileName = `AmbuFlow_Rapport_Mensuel_${monthSlug}.pdf`;
  const arrayBuffer = doc.output('arraybuffer');
  const base64 = arrayBufferToBase64(arrayBuffer);
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });

  const structuredRows: PdfReportDetailRow[] = detailRows.map((row) => ({
    date: row[0] || '-',
    vehicleOrType: row[1] || '-',
    horaires: row[2] || '-',
    amplitude: row[3] || '-',
    breaksText: row[4] || '-',
    breakDeducted: row[5] || '-',
    effective: row[6] || '0h 00m'
  }));

  const vehicleBreakdown = Array.from(vehicleStats.entries())
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .map(([vehicle, st]) => ({
      vehicle,
      count: st.count,
      minutes: st.minutes
    }));

  return {
    doc,
    blob,
    base64,
    fileName,
    monthKey: monthSlug,
    monthTitle,
    periodStartLabel: firstDay.toLocaleDateString('fr-FR'),
    periodEndLabel: lastDay.toLocaleDateString('fr-FR'),
    generatedAtLabel: generatedAtStr,
    summary: {
      totalEffectiveMinutes: totalEffectiveMin,
      totalWorkedOnlyMinutes: totalWorkedOnlyMin,
      totalCreditedMinutes: totalCreditedMin,
      totalBreakDeductedMinutes: totalBreakDeductedMin,
      totalBreakRawMinutes: totalBreakRawMin,
      totalBreakCount,
      mealBreakCount,
      mealBreakMinutes: mealBreakMin,
      coffeeBreakCount,
      coffeeBreakMinutes: coffeeBreakMin,
      workShiftCount,
      cpDaysCount,
      ferieDaysCount,
      otherLeaveCount,
      vehicleBreakdown
    },
    detailRows: structuredRows
  };
};

export const exportMonthlyPlanningPDF = (params: MonthlyPdfReportParams): BuiltMonthlyPdfReport => {
  const built = buildMonthlyPlanningPDF(params);
  built.doc.save(built.fileName);
  return built;
};
