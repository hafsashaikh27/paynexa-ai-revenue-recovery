import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { RecoveryCase } from '../types';
import { getFailureReasonLabel, getPaymentMethodLabel } from './formatters';
import { calculateRevenueMetrics, getTransactionFinancials } from './revenueCalculations';
import { soundService } from '../services/soundService';

export interface ExcelExportOptions {
  statusFilter: 'ALL' | 'SUCCESSFUL' | 'UNSUCCESSFUL';
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

/**
 * PayNexa Brand Color Palette for Excel (ARGB & Hex)
 * Curated for executive fintech presentation.
 */
const COLORS = {
  // Brand Primary & Navy
  NAVY_DARK: '0B1226',
  NAVY_HEADER: '0E162B',
  NAVY_CARD: '111A30',
  BLUE_ROYAL: '1E40AF',
  BLUE_PRIMARY: '2563EB',
  PURPLE_DEEP: '581C87',
  PURPLE_ACCENT: '7C3AED',
  CYAN_ACCENT: '0284C7',

  // Status & Highlights
  GREEN_BG: 'ECFDF5',
  GREEN_LIGHT: 'D1FAE5',
  GREEN_TEXT: '065F46',
  GREEN_BORDER: 'A7F3D0',
  GREEN_DARK: '047857',

  RED_BG: 'FEF2F2',
  RED_LIGHT: 'FEE2E2',
  RED_TEXT: '991B1B',
  RED_BORDER: 'FECACA',
  RED_DARK: 'DC2626',

  AMBER_BG: 'FFFBEB',
  AMBER_LIGHT: 'FEF3C7',
  AMBER_TEXT: '92400E',
  AMBER_BORDER: 'FDE68A',
  AMBER_DARK: 'D97706',

  BLUE_BG: 'EFF6FF',
  BLUE_LIGHT: 'DBEAFE',
  BLUE_TEXT: '1E40AF',
  BLUE_BORDER: 'BFDBFE',

  PURPLE_BG: 'FAF5FF',
  PURPLE_LIGHT: 'EDE9FE',
  PURPLE_TEXT: '5B21B6',
  PURPLE_BORDER: 'DDD6FE',

  // Neutrals & Grid
  WHITE: 'FFFFFF',
  SLATE_50: 'F8FAFC',
  SLATE_100: 'F1F5F9',
  SLATE_200: 'E2E8F0',
  SLATE_300: 'CBD5E1',
  SLATE_400: '94A3B8',
  SLATE_500: '64748B',
  SLATE_600: '475569',
  SLATE_700: '334155',
  SLATE_800: '1E293B',
  SLATE_900: '0F172A',
};

/**
 * Currency and Numeric Excel formatting strings
 * Uses standard Indian Rupee formatting without unnecessary decimal clutter.
 */
const INR_FORMAT = '[$₹-en-IN]#,##0';
const COUNT_FORMAT = '#,##0';

/**
 * Format a Date instance to "29-Aug-2026"
 */
function formatDateIndian(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a Date instance to "29-Aug-2026, 10:30 AM"
 */
function formatDateTimeIndian(d: Date): string {
  const datePart = formatDateIndian(d);
  const timePart = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

/**
 * Helper to apply clean cell borders
 */
function applyBorder(
  cell: ExcelJS.Cell,
  color: string = COLORS.SLATE_300,
  style: ExcelJS.BorderStyle = 'thin'
) {
  cell.border = {
    top: { style, color: { argb: 'FF' + color } },
    left: { style, color: { argb: 'FF' + color } },
    bottom: { style, color: { argb: 'FF' + color } },
    right: { style, color: { argb: 'FF' + color } },
  };
}

/**
 * Helper to apply thick card border
 */
function applyCardBorder(
  cell: ExcelJS.Cell,
  color: string = COLORS.BLUE_ROYAL
) {
  cell.border = {
    top: { style: 'medium', color: { argb: 'FF' + color } },
    left: { style: 'medium', color: { argb: 'FF' + color } },
    bottom: { style: 'medium', color: { argb: 'FF' + color } },
    right: { style: 'medium', color: { argb: 'FF' + color } },
  };
}

/**
 * Authoritative single-assignment classifier for Recovery Method.
 * Guarantees that every transaction belongs to ONLY ONE recovery method,
 * completely eliminating double counting across the workbook.
 */
export function getCasePrimaryRecoveryMethod(c: RecoveryCase): {
  id: 'OFFLINE_VERIFICATION' | 'ALTERNATIVE_PAYMENT' | 'SMART_RETRY' | 'DYNAMIC_ROUTING';
  name: string;
  pipeline: string;
  shortName: string;
  themeBg: string;
  themeText: string;
} {
  // 1. Offline Payment Verification if offline verification status exists (not 'NONE') or proof uploaded
  if (
    (c.offline_verification_status && c.offline_verification_status !== 'NONE') ||
    (c.offline_verification_history && c.offline_verification_history.length > 0)
  ) {
    return {
      id: 'OFFLINE_VERIFICATION',
      name: 'Offline Payment Verification (UTR / Bank Slip)',
      shortName: 'Offline Verification (UTR)',
      pipeline: 'AI OCR Slip Extraction + Automated Merchant Ledger Reconcile',
      themeBg: COLORS.AMBER_BG,
      themeText: COLORS.AMBER_TEXT,
    };
  }

  const nextStep = c.explanations?.[0]?.recommended_next_step?.toLowerCase() || '';

  // 2. Alternative Payment Switch if alternative payment offered or customer switch routed
  if (
    c.alternative_methods_offered ||
    nextStep.includes('alternative') ||
    nextStep.includes('upi') ||
    nextStep.includes('switch')
  ) {
    return {
      id: 'ALTERNATIVE_PAYMENT',
      name: 'Alternative Payment Switch (UPI / QR)',
      shortName: 'Alternative Payment Switch (UPI)',
      pipeline: 'Dynamic WhatsApp / SMS Payment Link with Instant UPI Settlement',
      themeBg: COLORS.PURPLE_BG,
      themeText: COLORS.PURPLE_TEXT,
    };
  }

  // 3. Smart Gateway Retry if retry count recorded or retry recommended
  if (
    (c.retry_count && c.retry_count > 0) ||
    nextStep.includes('retry')
  ) {
    return {
      id: 'SMART_RETRY',
      name: 'Smart Gateway Retry Schedule',
      shortName: `Smart Retry (${c.retry_count || 1} att.)`,
      pipeline: 'Autonomous Token Re-submission via Optimal Secondary Acquirer',
      themeBg: COLORS.BLUE_BG,
      themeText: COLORS.BLUE_TEXT,
    };
  }

  // 4. Dynamic Acquiring Cascade & Failover
  return {
    id: 'DYNAMIC_ROUTING',
    name: 'Dynamic Acquiring Cascade & Failover',
    shortName: 'Dynamic Acquiring Cascade',
    pipeline: 'Real-time multi-rail routing around degraded banking nodes',
    themeBg: COLORS.GREEN_BG,
    themeText: COLORS.GREEN_TEXT,
  };
}

/**
 * Generates an in-memory high-resolution PayNexa Logo PNG (Base64 string)
 * using an off-screen HTML5 Canvas.
 */
function generatePayNexaLogoPngBase64(): string {
  try {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    const width = 480;
    const height = 120;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Dark Navy Rounded Container Background
    ctx.fillStyle = '#0B1226';
    ctx.beginPath();
    const r = 16;
    ctx.moveTo(r, 0);
    ctx.lineTo(width - r, 0);
    ctx.quadraticCurveTo(width, 0, width, r);
    ctx.lineTo(width, height - r);
    ctx.quadraticCurveTo(width, height, width - r, height);
    ctx.lineTo(r, height);
    ctx.quadraticCurveTo(0, height, 0, height - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = '#263553';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 1. Icon Squircle Background (Left)
    const iconX = 18;
    const iconY = 16;
    const iconSize = 88;
    const iconRadius = 24;

    const iconGrad = ctx.createLinearGradient(iconX, iconY, iconX + iconSize, iconY + iconSize);
    iconGrad.addColorStop(0, '#0B1226');
    iconGrad.addColorStop(1, '#080D1A');
    ctx.fillStyle = iconGrad;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(iconX, iconY, iconSize, iconSize, iconRadius);
    } else {
      ctx.rect(iconX, iconY, iconSize, iconSize);
    }
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Stylized 'P' with Cyan-to-Purple Gradient
    const pGrad = ctx.createLinearGradient(iconX, iconY, iconX + iconSize, iconY + iconSize);
    pGrad.addColorStop(0, '#00E5FF');
    pGrad.addColorStop(0.25, '#00B4D8');
    pGrad.addColorStop(0.55, '#2563EB');
    pGrad.addColorStop(0.85, '#7C3AED');
    pGrad.addColorStop(1, '#A855F7');

    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.moveTo(iconX + 27, iconY + 19);
    ctx.lineTo(iconX + 53, iconY + 19);
    ctx.bezierCurveTo(iconX + 68, iconY + 19, iconX + 76, iconY + 27, iconX + 76, iconY + 39);
    ctx.bezierCurveTo(iconX + 76, iconY + 52, iconX + 66, iconY + 60, iconX + 53, iconY + 60);
    ctx.lineTo(iconX + 42, iconY + 60);
    ctx.lineTo(iconX + 42, iconY + 73);
    ctx.lineTo(iconX + 27, iconY + 73);
    ctx.closePath();
    ctx.fill();

    // P hole
    ctx.fillStyle = '#080D1A';
    ctx.beginPath();
    ctx.moveTo(iconX + 39, iconY + 29);
    ctx.lineTo(iconX + 50, iconY + 29);
    ctx.bezierCurveTo(iconX + 59, iconY + 29, iconX + 63, iconY + 33, iconX + 63, iconY + 40);
    ctx.bezierCurveTo(iconX + 63, iconY + 47, iconX + 59, iconY + 50, iconX + 50, iconY + 50);
    ctx.lineTo(iconX + 39, iconY + 50);
    ctx.closePath();
    ctx.fill();

    // Upward Recovery Arrow
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(iconX + 20, iconY + 70);
    ctx.quadraticCurveTo(iconX + 32, iconY + 48, iconX + 56, iconY + 33);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(iconX + 46, iconY + 27);
    ctx.lineTo(iconX + 63, iconY + 31);
    ctx.lineTo(iconX + 55, iconY + 47);
    ctx.closePath();
    ctx.fill();

    // 3. Brand Text: "PayNexa"
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('PayNexa', iconX + iconSize + 20, iconY + 44);

    // 4. Subtitle: "AI REVENUE RECOVERY PLATFORM"
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 12px "Segoe UI", Roboto, monospace';
    ctx.fillText('AI REVENUE RECOVERY PLATFORM', iconX + iconSize + 22, iconY + 66);

    // 5. Small Tagline
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Multi-Rail Intelligence · Enterprise Financial Audit', iconX + iconSize + 22, iconY + 82);

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  } catch (err) {
    console.warn('Canvas logo generation fallback:', err);
    return '';
  }
}

/**
 * Main Authoritative Excel Export Generator using ExcelJS
 */
export async function exportTransactionsToExcel(
  cases: RecoveryCase[],
  options: ExcelExportOptions
): Promise<void> {
  const metrics = calculateRevenueMetrics(cases);

  const now = new Date();
  const reportDateFull = formatDateTimeIndian(now);

  const dateRangeLabel =
    options.dateFrom && options.dateTo
      ? `${options.dateFrom} to ${options.dateTo}`
      : options.dateFrom
      ? `From ${options.dateFrom}`
      : options.dateTo
      ? `Until ${options.dateTo}`
      : 'All Recorded Transactions (Reporting Cycle)';

  // Process detailed transaction objects with strict single-method classification
  const transactionData = cases.map((c) => {
    const fin = getTransactionFinancials(c);
    const prob = c.predictions?.[0]?.prediction ?? (fin.is_successful ? 0.95 : 0.72);
    const scorePct = `${(prob * 100).toFixed(1)}%`;
    const failureReason = fin.is_initially_at_risk
      ? getFailureReasonLabel(c.transaction?.failure_reason as any) || 'Network Timeout'
      : 'None (Settled Normally)';

    const recommendedAction =
      c.explanations?.[0]?.recommended_next_step ||
      (fin.is_successful
        ? 'Settled successfully via acquiring rail'
        : 'Smart retry via secondary acquiring route');

    const primaryMethod = getCasePrimaryRecoveryMethod(c);

    return {
      case: c,
      fin,
      prob,
      scorePct,
      failureReason,
      recommendedAction,
      primaryMethod,
    };
  });

  // Create ExcelJS Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PayNexa AI Revenue Recovery Platform';
  workbook.lastModifiedBy = 'PayNexa Financial Intelligence Engine';
  workbook.created = now;
  workbook.modified = now;

  // Embed PayNexa Logo Image
  const logoBase64 = generatePayNexaLogoPngBase64();
  let logoImageId: number | null = null;
  if (logoBase64) {
    try {
      logoImageId = workbook.addImage({
        base64: logoBase64,
        extension: 'png',
      });
    } catch (e) {
      console.warn('Could not register logo image in ExcelJS:', e);
    }
  }

  // =========================================================================
  // SHEET 1: PAYNEXA SUMMARY (EXECUTIVE DASHBOARD & IMPACT)
  // =========================================================================
  const summarySheet = workbook.addWorksheet('PAYNEXA SUMMARY', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: 'FF' + COLORS.NAVY_DARK } },
  });

  summarySheet.columns = [
    { width: 22 }, // A
    { width: 22 }, // B
    { width: 22 }, // C
    { width: 22 }, // D
    { width: 22 }, // E
    { width: 22 }, // F
    { width: 22 }, // G
    { width: 22 }, // H
    { width: 22 }, // I
    { width: 22 }, // J
    { width: 22 }, // K
  ];

  // Set Row Heights for Header
  summarySheet.getRow(1).height = 26;
  summarySheet.getRow(2).height = 26;
  summarySheet.getRow(3).height = 26;
  summarySheet.getRow(4).height = 12;

  // 1. Embed Logo at A1:B3 if available
  if (logoImageId !== null) {
    summarySheet.addImage(logoImageId, {
      tl: { col: 0.05, row: 0.05 },
      ext: { width: 330, height: 78 },
      editAs: 'oneCell',
    });
  } else {
    summarySheet.mergeCells('A1:B3');
    const logoFallback = summarySheet.getCell('A1');
    logoFallback.value = 'PAYNEXA\nAI REVENUE RECOVERY';
    logoFallback.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF' + COLORS.NAVY_DARK },
    };
    logoFallback.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF' + COLORS.WHITE } };
    logoFallback.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    applyCardBorder(logoFallback, COLORS.PURPLE_ACCENT);
  }

  // 2. Title Header Banner at C1:K3
  summarySheet.mergeCells('C1:K3');
  const bannerCell = summarySheet.getCell('C1');
  bannerCell.value = `PAYNEXA\nAI REVENUE RECOVERY REPORT\nAI Revenue Recovery Platform | Report Period: ${dateRangeLabel} | Generated: ${reportDateFull}`;
  bannerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF' + COLORS.NAVY_DARK },
  };
  bannerCell.font = {
    name: 'Segoe UI',
    size: 11.5,
    bold: true,
    color: { argb: 'FF' + COLORS.WHITE },
  };
  bannerCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  applyCardBorder(bannerCell, COLORS.PURPLE_ACCENT);

  // 3. Status Legend Row (Row 5)
  summarySheet.getRow(5).height = 24;
  summarySheet.getCell('A5').value = 'STATUS LEGEND:';
  summarySheet.getCell('A5').font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.SLATE_800 } };
  summarySheet.getCell('A5').alignment = { vertical: 'middle', horizontal: 'right' };

  const legendItems = [
    { range: 'B5:C5', text: '🟢 Successful / Recovered', bg: COLORS.GREEN_LIGHT, textCol: COLORS.GREEN_TEXT, border: COLORS.GREEN_BORDER },
    { range: 'D5:E5', text: '🔴 Unsuccessful / Failed', bg: COLORS.RED_LIGHT, textCol: COLORS.RED_TEXT, border: COLORS.RED_BORDER },
    { range: 'F5:G5', text: '🟡 Pending / Verification', bg: COLORS.AMBER_LIGHT, textCol: COLORS.AMBER_TEXT, border: COLORS.AMBER_BORDER },
    { range: 'H5:I5', text: '🔵 Total / Standard Rail', bg: COLORS.BLUE_LIGHT, textCol: COLORS.BLUE_TEXT, border: COLORS.BLUE_BORDER },
    { range: 'J5:K5', text: '🟣 AI Recovery Win', bg: COLORS.PURPLE_LIGHT, textCol: COLORS.PURPLE_TEXT, border: COLORS.PURPLE_BORDER },
  ];

  legendItems.forEach((item) => {
    summarySheet.mergeCells(item.range);
    const cell = summarySheet.getCell(item.range.split(':')[0]);
    cell.value = item.text;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + item.bg } };
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + item.textCol } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorder(cell, item.border, 'thin');
  });

  // 4. Section Header: EXECUTIVE KPI DASHBOARD (Row 7)
  summarySheet.getRow(7).height = 22;
  summarySheet.mergeCells('A7:K7');
  const kpiSectionHeader = summarySheet.getCell('A7');
  kpiSectionHeader.value = 'PORTFOLIO & FINANCIAL KPI CARDS';
  kpiSectionHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.NAVY_HEADER } };
  kpiSectionHeader.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF' + COLORS.WHITE } };
  kpiSectionHeader.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  applyBorder(kpiSectionHeader, COLORS.SLATE_700);

  // Helper for KPI Card construction
  const createKpiCard = (
    colStart: number,
    colEnd: number,
    rowStart: number,
    rowEnd: number,
    title: string,
    value: string | number,
    subtext: string,
    headerColor: string,
    bgColor: string,
    valColor: string,
    numFormat?: string
  ) => {
    // Header Row
    summarySheet.mergeCells(rowStart, colStart, rowStart, colEnd);
    const headerCell = summarySheet.getCell(rowStart, colStart);
    headerCell.value = title;
    headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + headerColor } };
    headerCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + COLORS.WHITE } };
    headerCell.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorder(headerCell, headerColor);

    // Value Row
    summarySheet.mergeCells(rowStart + 1, colStart, rowStart + 1, colEnd);
    const valCell = summarySheet.getCell(rowStart + 1, colStart);
    valCell.value = value;
    if (numFormat) valCell.numFmt = numFormat;
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgColor } };
    valCell.font = { name: 'Segoe UI', size: 17, bold: true, color: { argb: 'FF' + valColor } };
    valCell.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorder(valCell, headerColor);

    // Subtext Row
    summarySheet.mergeCells(rowStart + 2, colStart, rowStart + 2, colEnd);
    const subCell = summarySheet.getCell(rowStart + 2, colStart);
    subCell.value = subtext;
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgColor } };
    subCell.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF' + COLORS.SLATE_600 } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorder(subCell, headerColor);
  };

  // KPI Card Row 1 Heights (Rows 8-10)
  summarySheet.getRow(8).height = 20;
  summarySheet.getRow(9).height = 32;
  summarySheet.getRow(10).height = 18;

  // 1. TOTAL TRANSACTIONS (Blue) - Cols A:B (1:2)
  createKpiCard(
    1, 2, 8, 10,
    'TOTAL TRANSACTIONS',
    metrics.total_transactions_count,
    '100% Portfolio Volume',
    COLORS.BLUE_ROYAL,
    COLORS.BLUE_BG,
    COLORS.BLUE_TEXT,
    COUNT_FORMAT
  );

  // 2. SUCCESSFUL TRANSACTIONS (Green) - Cols C:E (3:5)
  createKpiCard(
    3, 5, 8, 10,
    'SUCCESSFUL TRANSACTIONS',
    metrics.successful_transactions_count,
    `${metrics.total_transactions_count > 0 ? ((metrics.successful_transactions_count / metrics.total_transactions_count) * 100).toFixed(1) : 0}% Settled`,
    COLORS.GREEN_DARK,
    COLORS.GREEN_BG,
    COLORS.GREEN_TEXT,
    COUNT_FORMAT
  );

  // 3. UNSUCCESSFUL TRANSACTIONS (Red) - Cols F:H (6:8)
  createKpiCard(
    6, 8, 8, 10,
    'UNSUCCESSFUL TRANSACTIONS',
    metrics.unsuccessful_transactions_count,
    `${metrics.total_transactions_count > 0 ? ((metrics.unsuccessful_transactions_count / metrics.total_transactions_count) * 100).toFixed(1) : 0}% Failed/At Risk`,
    COLORS.RED_DARK,
    COLORS.RED_BG,
    COLORS.RED_TEXT,
    COUNT_FORMAT
  );

  // 4. TOTAL REVENUE (Blue) - Cols I:K (9:11)
  createKpiCard(
    9, 11, 8, 10,
    'TOTAL REVENUE',
    Math.round(metrics.total_transaction_value_minor / 100),
    'Gross Transaction Value (₹)',
    COLORS.BLUE_PRIMARY,
    COLORS.BLUE_BG,
    COLORS.BLUE_TEXT,
    INR_FORMAT
  );

  // KPI Card Row 2 Heights (Rows 12-14)
  summarySheet.getRow(11).height = 8; // Spacer
  summarySheet.getRow(12).height = 20;
  summarySheet.getRow(13).height = 32;
  summarySheet.getRow(14).height = 18;

  // 5. REVENUE AT RISK (Amber) - Cols A:C (1:3)
  createKpiCard(
    1, 3, 12, 14,
    'REVENUE AT RISK',
    Math.round(metrics.initial_revenue_at_risk_minor / 100),
    'Original Failed Amount',
    COLORS.AMBER_DARK,
    COLORS.AMBER_BG,
    COLORS.AMBER_TEXT,
    INR_FORMAT
  );

  // 6. RECOVERED REVENUE (Purple/Blue) - Cols D:F (4:6)
  createKpiCard(
    4, 6, 12, 14,
    'RECOVERED REVENUE',
    Math.round(metrics.recovered_revenue_minor / 100),
    'Saved by PayNexa AI Platform',
    COLORS.PURPLE_ACCENT,
    COLORS.PURPLE_BG,
    COLORS.PURPLE_TEXT,
    INR_FORMAT
  );

  // 7. RECOVERY RATE (Purple) - Cols G:I (7:9)
  createKpiCard(
    7, 9, 12, 14,
    'RECOVERY RATE',
    `${metrics.recovery_rate}%`,
    'Recovered / Original Risk Ratio',
    COLORS.PURPLE_DEEP,
    COLORS.PURPLE_BG,
    COLORS.PURPLE_TEXT
  );

  // 8. REMAINING AT RISK (Amber/Red) - Cols J:K (10:11)
  createKpiCard(
    10, 11, 12, 14,
    'REMAINING AT RISK',
    Math.round(metrics.current_revenue_at_risk_minor / 100),
    'Outstanding Unresolved Risk',
    COLORS.AMBER_DARK,
    COLORS.AMBER_BG,
    COLORS.RED_TEXT,
    INR_FORMAT
  );

  // 5. Section: REVENUE RECOVERY IMPACT (Row 16)
  summarySheet.getRow(15).height = 10; // Spacer
  summarySheet.getRow(16).height = 24;
  summarySheet.mergeCells('A16:K16');
  const impactHeader = summarySheet.getCell('A16');
  impactHeader.value = 'REVENUE RECOVERY IMPACT';
  impactHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.NAVY_HEADER } };
  impactHeader.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF' + COLORS.WHITE } };
  impactHeader.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  applyBorder(impactHeader, COLORS.SLATE_700);

  // Table Column Headers for Impact Section (Row 17)
  const impactHeaders = [
    { cell: 'A17:D17', text: 'IMPACT METRIC / REVENUE CATEGORY', align: 'left' },
    { cell: 'E17:F17', text: 'AMOUNT (₹)', align: 'right' },
    { cell: 'G17:H17', text: 'TRANSACTIONS', align: 'center' },
    { cell: 'I17:J17', text: 'REPRESENTATION (%)', align: 'center' },
    { cell: 'K17', text: 'STATUS / ACTION', align: 'center' },
  ];

  summarySheet.getRow(17).height = 22;
  impactHeaders.forEach((h) => {
    if (h.cell.includes(':')) summarySheet.mergeCells(h.cell);
    const cell = summarySheet.getCell(h.cell.split(':')[0]);
    cell.value = h.text;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.SLATE_800 } };
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };
    cell.alignment = { vertical: 'middle', horizontal: h.align as any };
    applyBorder(cell, COLORS.SLATE_600);
  });

  const recoveredCasesCount = transactionData.filter(t => t.fin.recovery_status_label === 'RECOVERED').length;
  const pendingCasesCount = transactionData.filter(t => t.fin.recovery_status_label === 'IN_PROGRESS' || t.fin.recovery_status_label === 'RECOVERABLE').length;

  const impactRowsData = [
    {
      name: 'Original Revenue at Risk',
      amount: Math.round(metrics.initial_revenue_at_risk_minor / 100),
      count: metrics.unsuccessful_transactions_count,
      pct: `${metrics.total_transaction_value_minor > 0 ? ((metrics.initial_revenue_at_risk_minor / metrics.total_transaction_value_minor) * 100).toFixed(1) : 0}% of Total Revenue`,
      status: '🔴 At-Risk Base',
      bg: COLORS.AMBER_BG,
      valColor: COLORS.AMBER_TEXT,
    },
    {
      name: 'Recovered Revenue (Saved by PayNexa)',
      amount: Math.round(metrics.recovered_revenue_minor / 100),
      count: recoveredCasesCount,
      pct: `${metrics.recovery_rate}% Recovery Win Rate`,
      status: '🟢 AI Recovered',
      bg: COLORS.GREEN_BG,
      valColor: COLORS.GREEN_DARK,
    },
    {
      name: 'Remaining Revenue at Risk',
      amount: Math.round(metrics.current_revenue_at_risk_minor / 100),
      count: pendingCasesCount,
      pct: `${metrics.initial_revenue_at_risk_minor > 0 ? ((metrics.current_revenue_at_risk_minor / metrics.initial_revenue_at_risk_minor) * 100).toFixed(1) : 0}% Unrecovered`,
      status: '🟡 Active In-Flight',
      bg: COLORS.RED_BG,
      valColor: COLORS.RED_TEXT,
    },
    {
      name: 'Total Transaction Volume Processed',
      amount: Math.round(metrics.total_transaction_value_minor / 100),
      count: metrics.total_transactions_count,
      pct: '100.0% Portfolio Volume',
      status: '🔵 Gross Ledger',
      bg: COLORS.BLUE_BG,
      valColor: COLORS.BLUE_TEXT,
    },
  ];

  impactRowsData.forEach((row, idx) => {
    const rowNum = 18 + idx;
    summarySheet.getRow(rowNum).height = 22;

    summarySheet.mergeCells(`A${rowNum}:D${rowNum}`);
    const nameCell = summarySheet.getCell(`A${rowNum}`);
    nameCell.value = row.name;
    nameCell.font = { name: 'Segoe UI', size: 9.5, bold: idx === 1 || idx === 0, color: { argb: 'FF' + COLORS.SLATE_900 } };
    nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + row.bg } };
    nameCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    applyBorder(nameCell, COLORS.SLATE_300);

    summarySheet.mergeCells(`E${rowNum}:F${rowNum}`);
    const amtCell = summarySheet.getCell(`E${rowNum}`);
    amtCell.value = row.amount;
    amtCell.numFmt = INR_FORMAT;
    amtCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + row.valColor } };
    amtCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + row.bg } };
    amtCell.alignment = { vertical: 'middle', horizontal: 'right' };
    applyBorder(amtCell, COLORS.SLATE_300);

    summarySheet.mergeCells(`G${rowNum}:H${rowNum}`);
    const countCell = summarySheet.getCell(`G${rowNum}`);
    countCell.value = row.count;
    countCell.numFmt = COUNT_FORMAT;
    countCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.SLATE_800 } };
    countCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + row.bg } };
    countCell.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorder(countCell, COLORS.SLATE_300);

    summarySheet.mergeCells(`I${rowNum}:J${rowNum}`);
    const pctCell = summarySheet.getCell(`I${rowNum}`);
    pctCell.value = row.pct;
    pctCell.font = { name: 'Segoe UI', size: 9, bold: idx === 1, color: { argb: 'FF' + (idx === 1 ? COLORS.PURPLE_TEXT : COLORS.SLATE_700) } };
    pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + row.bg } };
    pctCell.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorder(pctCell, COLORS.SLATE_300);

    const statusCell = summarySheet.getCell(`K${rowNum}`);
    statusCell.value = row.status;
    statusCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + COLORS.SLATE_800 } };
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + row.bg } };
    statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorder(statusCell, COLORS.SLATE_300);
  });

  // 6. Section: CHARTS & RECOVERY ANALYSIS (Row 24)
  summarySheet.getRow(23).height = 10; // Spacer
  summarySheet.getRow(24).height = 24;
  summarySheet.mergeCells('A24:K24');
  const chartsHeader = summarySheet.getCell('A24');
  chartsHeader.value = 'AI REVENUE RECOVERY VISUAL CHARTS & COMPARISONS';
  chartsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.NAVY_HEADER } };
  chartsHeader.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF' + COLORS.WHITE } };
  chartsHeader.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  applyBorder(chartsHeader, COLORS.SLATE_700);

  // Visual Comparisons & Charts Data
  const visualMetrics = [
    {
      chartTitle: 'CHART 1: SUCCESSFUL VS UNSUCCESSFUL TRANSACTIONS',
      metricDetail: `${metrics.successful_transactions_count} Succeeded (₹${Math.round(metrics.total_transaction_value_minor / 100 - metrics.initial_revenue_at_risk_minor / 100 + metrics.recovered_revenue_minor / 100).toLocaleString('en-IN')}) vs ${metrics.unsuccessful_transactions_count} Initial Failures`,
      barGraphic: '████████████████████░░░░░',
      pctLabel: `${metrics.total_transactions_count > 0 ? ((metrics.successful_transactions_count / metrics.total_transactions_count) * 100).toFixed(1) : 0}% Success`,
      bg: COLORS.BLUE_BG,
      barCol: COLORS.BLUE_ROYAL,
    },
    {
      chartTitle: 'CHART 2: REVENUE AT RISK VS RECOVERED VS REMAINING AT RISK',
      metricDetail: `Initial Risk: ₹${Math.round(metrics.initial_revenue_at_risk_minor / 100).toLocaleString('en-IN')}  →  Recovered: ₹${Math.round(metrics.recovered_revenue_minor / 100).toLocaleString('en-IN')}  |  Remaining: ₹${Math.round(metrics.current_revenue_at_risk_minor / 100).toLocaleString('en-IN')}`,
      barGraphic: '██████████████████░░░░░░░',
      pctLabel: `${metrics.recovery_rate}% Recovered`,
      bg: COLORS.PURPLE_BG,
      barCol: COLORS.PURPLE_TEXT,
    },
    {
      chartTitle: 'CHART 3: RECOVERY BY METHOD EFFICIENCY',
      metricDetail: 'Smart Retry (Token Switch) · Alternative UPI Link · Offline OCR Verification · Dynamic Multi-Rail Failover',
      barGraphic: '██████████████████████░░░',
      pctLabel: 'Multi-Rail Active',
      bg: COLORS.GREEN_BG,
      barCol: COLORS.GREEN_DARK,
    },
  ];

  visualMetrics.forEach((m, idx) => {
    const rowNum = 25 + idx;
    summarySheet.getRow(rowNum).height = 24;

    summarySheet.mergeCells(`A${rowNum}:D${rowNum}`);
    const tCell = summarySheet.getCell(`A${rowNum}`);
    tCell.value = m.chartTitle;
    tCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.SLATE_900 } };
    tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + m.bg } };
    tCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    applyBorder(tCell, COLORS.SLATE_300);

    summarySheet.mergeCells(`E${rowNum}:G${rowNum}`);
    const rCell = summarySheet.getCell(`E${rowNum}`);
    rCell.value = m.metricDetail;
    rCell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF' + COLORS.SLATE_700 } };
    rCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + m.bg } };
    rCell.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorder(rCell, COLORS.SLATE_300);

    summarySheet.mergeCells(`H${rowNum}:J${rowNum}`);
    const bCell = summarySheet.getCell(`H${rowNum}`);
    bCell.value = m.barGraphic;
    bCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + m.barCol } };
    bCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + m.bg } };
    bCell.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorder(bCell, COLORS.SLATE_300);

    const pCell = summarySheet.getCell(`K${rowNum}`);
    pCell.value = m.pctLabel;
    pCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.SLATE_900 } };
    pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + m.bg } };
    pCell.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorder(pCell, COLORS.SLATE_300);
  });

  // Footer on summary sheet (Row 29)
  summarySheet.getRow(29).height = 22;
  summarySheet.mergeCells('A29:K29');
  const summaryFooter = summarySheet.getCell('A29');
  summaryFooter.value = `PayNexa — AI Revenue Recovery Platform | AI-powered revenue recovery and payment intelligence | Generated: ${reportDateFull}`;
  summaryFooter.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF' + COLORS.SLATE_500 } };
  summaryFooter.alignment = { vertical: 'middle', horizontal: 'center' };

  // =========================================================================
  // SHEET 2: TRANSACTIONS (DETAILED DATA, HIGHLIGHTS & CONDITIONAL FORMATTING)
  // =========================================================================
  const txSheet = workbook.addWorksheet('TRANSACTIONS', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    properties: { tabColor: { argb: 'FF' + COLORS.BLUE_PRIMARY } },
  });

  const txColumns = [
    { key: 'tx_id', header: 'Transaction ID', width: 18 },
    { key: 'date', header: 'Date', width: 14 },
    { key: 'time', header: 'Time', width: 12 },
    { key: 'customer', header: 'Customer Email', width: 30 },
    { key: 'amount', header: 'Amount (₹)', width: 16 },
    { key: 'payment_method', header: 'Payment Method', width: 18 },
    { key: 'status', header: 'Status', width: 16 },
    { key: 'failure_reason', header: 'Failure Reason', width: 26 },
    { key: 'retry_count', header: 'Retry Count', width: 12 },
    { key: 'recovery_status', header: 'Recovery Status', width: 18 },
    { key: 'recovery_method', header: 'Recovery Method', width: 26 },
    { key: 'recovered_amount', header: 'Recovered Amount (₹)', width: 22 },
    { key: 'verification_status', header: 'Verification Status', width: 22 },
    { key: 'risk_level', header: 'Risk Level', width: 14 },
    { key: 'score_pct', header: 'AI Score (%)', width: 14 },
    { key: 'action', header: 'Recommended Action', width: 44 },
  ];

  txSheet.columns = txColumns.map((c) => ({
    key: c.key,
    header: c.header,
    width: c.width,
  }));

  // Style Header Row (Row 1)
  const txHeaderRow = txSheet.getRow(1);
  txHeaderRow.height = 30;
  txHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF' + COLORS.NAVY_DARK },
    };
    cell.font = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: 'FF' + COLORS.WHITE },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    applyBorder(cell, COLORS.SLATE_700, 'medium');
  });

  // Populate Data Rows with Strict Conditional Styling
  transactionData.forEach((item, index) => {
    const { case: c, fin, scorePct, failureReason, recommendedAction, primaryMethod } = item;

    // Parse Date & Time
    const dateObj = new Date(c.created_at || Date.now());
    const dateStr = formatDateIndian(dateObj);
    const timeStr = dateObj.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const isFailed = !fin.is_successful;
    const isRecovered = fin.recovery_status_label === 'RECOVERED';
    const isPending =
      c.offline_verification_status === 'IN_REVIEW' ||
      c.offline_verification_status === 'PENDING' ||
      fin.recovery_status_label === 'IN_PROGRESS' ||
      fin.recovery_status_label === 'RECOVERABLE';
    const isVerified = c.offline_verification_status === 'CONFIRMED';

    // Offline Verification status string
    let verificationLabel = 'N/A';
    if (c.offline_verification_status) {
      if (c.offline_verification_status === 'CONFIRMED') verificationLabel = 'VERIFIED / CONFIRMED';
      else if (c.offline_verification_status === 'REJECTED') verificationLabel = 'REJECTED';
      else if (c.offline_verification_status === 'IN_REVIEW') verificationLabel = 'IN REVIEW (PENDING)';
      else verificationLabel = 'PENDING VERIFICATION';
    }

    const row = txSheet.addRow({
      tx_id: c.transaction_id || c.id.replace('rc-', 'PX-'),
      date: dateStr,
      time: timeStr,
      customer: c.customer?.email || 'customer@domain.com',
      amount: Math.round(fin.amount_minor / 100),
      payment_method: getPaymentMethodLabel(c.transaction?.payment_method as any) || 'Credit Card',
      status: fin.status_label,
      failure_reason: failureReason,
      retry_count: c.retry_count || 0,
      recovery_status: fin.recovery_status_label,
      recovery_method: primaryMethod.name,
      recovered_amount: Math.round(fin.recovered_minor / 100),
      verification_status: verificationLabel,
      risk_level: c.priority || 'MEDIUM',
      score_pct: scorePct,
      action: recommendedAction,
    });

    row.height = 22;

    // Row-level base tint priority
    let rowBgColor = index % 2 === 0 ? COLORS.WHITE : COLORS.SLATE_50;
    if (isFailed && !isRecovered) {
      rowBgColor = COLORS.RED_BG; // Subtle light red tint for failed rows
    } else if (isRecovered) {
      rowBgColor = COLORS.PURPLE_BG; // Subtle light purple tint for recovered
    } else if (isPending) {
      rowBgColor = COLORS.AMBER_BG; // Subtle light amber tint for pending verification
    } else if (fin.is_successful) {
      rowBgColor = COLORS.GREEN_BG; // Subtle light green tint for successful rows
    }

    // Apply baseline cell styling
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF' + rowBgColor },
      };
      cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF' + COLORS.SLATE_800 } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      applyBorder(cell, COLORS.SLATE_200);

      // Alignment overrides
      if (colNumber === 1 || colNumber === 2 || colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF' + COLORS.SLATE_700 } };
      }
      if (colNumber === 5 || colNumber === 12) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = INR_FORMAT;
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.SLATE_900 } };
      }
      if (colNumber === 9 || colNumber === 15) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (colNumber === 16) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }
    });

    // 1. Highlight Status Cell (Col 7: Status)
    const statusCell = row.getCell('status');
    if (isFailed) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.RED_LIGHT } };
      statusCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.RED_TEXT } };
      applyBorder(statusCell, COLORS.RED_BORDER, 'medium');
    } else {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.GREEN_LIGHT } };
      statusCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.GREEN_TEXT } };
      applyBorder(statusCell, COLORS.GREEN_BORDER, 'medium');
    }

    // 2. Highlight Recovery Status Cell (Col 10: Recovery Status)
    const recStatusCell = row.getCell('recovery_status');
    if (isRecovered) {
      recStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.PURPLE_LIGHT } };
      recStatusCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.PURPLE_TEXT } };
      applyBorder(recStatusCell, COLORS.PURPLE_BORDER, 'medium');
    } else if (fin.recovery_status_label === 'IN_PROGRESS' || fin.recovery_status_label === 'RECOVERABLE') {
      recStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.AMBER_LIGHT } };
      recStatusCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.AMBER_TEXT } };
      applyBorder(recStatusCell, COLORS.AMBER_BORDER, 'thin');
    }

    // 3. Highlight Recovered Amount Cell (Col 12: Recovered Amount)
    const recAmtCell = row.getCell('recovered_amount');
    if (fin.recovered_minor > 0) {
      recAmtCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.GREEN_LIGHT } };
      recAmtCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.GREEN_DARK } };
      applyBorder(recAmtCell, COLORS.GREEN_BORDER, 'medium');
    }

    // 4. Highlight Verification Status Cell (Col 13: Verification Status)
    const verifCell = row.getCell('verification_status');
    if (isPending) {
      verifCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.AMBER_LIGHT } };
      verifCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.AMBER_TEXT } };
      applyBorder(verifCell, COLORS.AMBER_BORDER, 'medium');
    } else if (isVerified) {
      verifCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.GREEN_LIGHT } };
      verifCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.GREEN_TEXT } };
      applyBorder(verifCell, COLORS.GREEN_BORDER, 'thin');
    }

    // 5. Highlight Risk Level Cell (Col 14: Risk Level)
    const riskCell = row.getCell('risk_level');
    const riskVal = String(c.priority || 'MEDIUM').toUpperCase();
    riskCell.alignment = { vertical: 'middle', horizontal: 'center' };
    if (riskVal === 'LOW') {
      riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.GREEN_LIGHT } };
      riskCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + COLORS.GREEN_TEXT } };
    } else if (riskVal === 'HIGH' || riskVal === 'CRITICAL') {
      riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.RED_LIGHT } };
      riskCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + COLORS.RED_TEXT } };
    } else {
      riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.AMBER_LIGHT } };
      riskCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + COLORS.AMBER_TEXT } };
    }
  });

  // Enable AutoFilter on Transactions worksheet
  txSheet.autoFilter = {
    from: 'A1',
    to: `P${transactionData.length + 1}`,
  };

  // =========================================================================
  // SHEET 3: RECOVERY ANALYSIS (MUTUALLY EXCLUSIVE METHODS & ROOT CAUSES)
  // =========================================================================
  const recSheet = workbook.addWorksheet('RECOVERY ANALYSIS', {
    views: [{ state: 'frozen', ySplit: 2, showGridLines: true }],
    properties: { tabColor: { argb: 'FF' + COLORS.PURPLE_ACCENT } },
  });

  recSheet.columns = [
    { width: 34 }, // A: Recovery Method / Root Cause
    { width: 16 }, // B: Transactions
    { width: 22 }, // C: Original At-Risk Amount (₹)
    { width: 22 }, // D: Recovered Amount (₹)
    { width: 22 }, // E: Remaining At-Risk (₹)
    { width: 18 }, // F: Recovery Rate (%)
    { width: 44 }, // G: AI Orchestration Strategy
  ];

  // Header Banner Row 1 & 2
  recSheet.mergeCells('A1:G1');
  const recBanner = recSheet.getCell('A1');
  recBanner.value = 'PAYNEXA — RECOVERY PERFORMANCE, METHOD EFFICIENCY & DIAGNOSTICS';
  recBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.NAVY_DARK } };
  recBanner.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF' + COLORS.WHITE } };
  recBanner.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  recSheet.getRow(1).height = 28;

  recSheet.mergeCells('A2:G2');
  const recSubBanner = recSheet.getCell('A2');
  recSubBanner.value = `Total At-Risk Exposure: ₹${Math.round(metrics.initial_revenue_at_risk_minor / 100).toLocaleString('en-IN')} | Total Recovered: ₹${Math.round(metrics.recovered_revenue_minor / 100).toLocaleString('en-IN')} | Remaining At-Risk: ₹${Math.round(metrics.current_revenue_at_risk_minor / 100).toLocaleString('en-IN')} | Recovery Rate: ${metrics.recovery_rate}%`;
  recSubBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.NAVY_HEADER } };
  recSubBanner.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.CYAN_ACCENT } };
  recSubBanner.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  recSheet.getRow(2).height = 20;

  // Table 1: RECOVERY BY METHOD
  recSheet.getRow(4).height = 22;
  recSheet.mergeCells('A4:G4');
  const methHeader = recSheet.getCell('A4');
  methHeader.value = '1. RECOVERY PERFORMANCE BY METHOD (MUTUALLY EXCLUSIVE PIPELINES)';
  methHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.SLATE_800 } };
  methHeader.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };
  methHeader.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  applyBorder(methHeader, COLORS.SLATE_700);

  const methCols = [
    'RECOVERY METHOD',
    'TRANSACTIONS',
    'ORIGINAL AT-RISK (₹)',
    'RECOVERED (₹)',
    'REMAINING AT-RISK (₹)',
    'RECOVERY RATE (%)',
    'ORCHESTRATION PIPELINE',
  ];

  recSheet.getRow(5).height = 22;
  methCols.forEach((text, i) => {
    const cell = recSheet.getCell(5, i + 1);
    cell.value = text;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.NAVY_DARK } };
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + COLORS.WHITE } };
    cell.alignment = { vertical: 'middle', horizontal: i === 0 || i === 6 ? 'left' : 'center' };
    applyBorder(cell, COLORS.SLATE_600);
  });

  // Strict Mutually Exclusive Partitioning by primaryMethod.id for at-risk items
  const atRiskTransactions = transactionData.filter((t) => t.fin.is_initially_at_risk);

  const methodGroups = [
    {
      id: 'SMART_RETRY',
      name: 'Smart Gateway Retry Schedule',
      pipeline: 'Autonomous Token Re-submission via Optimal Secondary Acquirer',
      bg: COLORS.BLUE_BG,
      items: atRiskTransactions.filter((t) => t.primaryMethod.id === 'SMART_RETRY'),
    },
    {
      id: 'ALTERNATIVE_PAYMENT',
      name: 'Alternative Payment Switch (UPI / QR)',
      pipeline: 'Dynamic WhatsApp / SMS Payment Link with Instant UPI Settlement',
      bg: COLORS.PURPLE_BG,
      items: atRiskTransactions.filter((t) => t.primaryMethod.id === 'ALTERNATIVE_PAYMENT'),
    },
    {
      id: 'OFFLINE_VERIFICATION',
      name: 'Offline Payment Verification (UTR / Bank Slip)',
      pipeline: 'AI OCR Slip Extraction + Automated Merchant Ledger Reconcile',
      bg: COLORS.AMBER_BG,
      items: atRiskTransactions.filter((t) => t.primaryMethod.id === 'OFFLINE_VERIFICATION'),
    },
    {
      id: 'DYNAMIC_ROUTING',
      name: 'Dynamic Acquiring Cascade & Failover',
      pipeline: 'Real-time multi-rail routing around degraded banking nodes',
      bg: COLORS.GREEN_BG,
      items: atRiskTransactions.filter((t) => t.primaryMethod.id === 'DYNAMIC_ROUTING'),
    },
  ];

  let methodRowIndex = 6;
  methodGroups.forEach((m) => {
    recSheet.getRow(methodRowIndex).height = 22;

    const count = m.items.length;
    const initRiskMinor = m.items.reduce((sum, t) => sum + t.fin.initial_risk_minor, 0);
    const recMinor = m.items.reduce((sum, t) => sum + t.fin.recovered_minor, 0);
    const curRiskMinor = m.items.reduce((sum, t) => sum + t.fin.remaining_risk_minor, 0);
    const rate = initRiskMinor > 0 ? `${((recMinor / initRiskMinor) * 100).toFixed(1)}%` : '0.0%';

    const row = recSheet.getRow(methodRowIndex);
    row.getCell(1).value = m.name;
    row.getCell(1).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.SLATE_900 } };

    row.getCell(2).value = count;
    row.getCell(2).numFmt = COUNT_FORMAT;
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(3).value = Math.round(initRiskMinor / 100);
    row.getCell(3).numFmt = INR_FORMAT;
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(4).value = Math.round(recMinor / 100);
    row.getCell(4).numFmt = INR_FORMAT;
    row.getCell(4).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.GREEN_DARK } };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(5).value = Math.round(curRiskMinor / 100);
    row.getCell(5).numFmt = INR_FORMAT;
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(6).value = rate;
    row.getCell(6).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.PURPLE_TEXT } };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(7).value = m.pipeline;
    row.getCell(7).font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF' + COLORS.SLATE_600 } };

    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + m.bg } };
      applyBorder(cell, COLORS.SLATE_300);
    });

    methodRowIndex++;
  });

  // Table 1 Total Row
  recSheet.getRow(methodRowIndex).height = 24;
  const methTotalRow = recSheet.getRow(methodRowIndex);
  methTotalRow.getCell(1).value = 'TOTAL AT-RISK PIPELINE (SUM)';
  methTotalRow.getCell(1).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };

  methTotalRow.getCell(2).value = atRiskTransactions.length;
  methTotalRow.getCell(2).numFmt = COUNT_FORMAT;
  methTotalRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
  methTotalRow.getCell(2).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };

  methTotalRow.getCell(3).value = Math.round(metrics.initial_revenue_at_risk_minor / 100);
  methTotalRow.getCell(3).numFmt = INR_FORMAT;
  methTotalRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
  methTotalRow.getCell(3).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };

  methTotalRow.getCell(4).value = Math.round(metrics.recovered_revenue_minor / 100);
  methTotalRow.getCell(4).numFmt = INR_FORMAT;
  methTotalRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
  methTotalRow.getCell(4).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };

  methTotalRow.getCell(5).value = Math.round(metrics.current_revenue_at_risk_minor / 100);
  methTotalRow.getCell(5).numFmt = INR_FORMAT;
  methTotalRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
  methTotalRow.getCell(5).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };

  methTotalRow.getCell(6).value = `${metrics.recovery_rate}%`;
  methTotalRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
  methTotalRow.getCell(6).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };

  methTotalRow.getCell(7).value = 'Complete Ledger Synchronization · Zero Double-Counting Enforced';
  methTotalRow.getCell(7).font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF' + COLORS.SLATE_300 } };

  methTotalRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.NAVY_HEADER } };
    applyBorder(cell, COLORS.SLATE_700, 'medium');
  });

  // Table 2: ROOT CAUSE BREAKDOWN
  const rootCauseStartRow = methodRowIndex + 3;
  recSheet.getRow(rootCauseStartRow - 1).height = 22;
  recSheet.mergeCells(`A${rootCauseStartRow - 1}:G${rootCauseStartRow - 1}`);
  const reasonHeader = recSheet.getCell(`A${rootCauseStartRow - 1}`);
  reasonHeader.value = '2. ROOT CAUSE FAILURE DIAGNOSTICS & RECOVERY EFFICIENCY';
  reasonHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.SLATE_800 } };
  reasonHeader.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };
  reasonHeader.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  applyBorder(reasonHeader, COLORS.SLATE_700);

  const reasonCols = [
    'FAILURE ROOT CAUSE',
    'CASES',
    'EXPOSURE (₹)',
    'RECOVERED (₹)',
    'CURRENT RISK (₹)',
    'EFFICIENCY (%)',
    'AI MITIGATION STRATEGY',
  ];

  recSheet.getRow(rootCauseStartRow).height = 22;
  reasonCols.forEach((text, i) => {
    const cell = recSheet.getCell(rootCauseStartRow, i + 1);
    cell.value = text;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.NAVY_DARK } };
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + COLORS.WHITE } };
    cell.alignment = { vertical: 'middle', horizontal: i === 0 || i === 6 ? 'left' : 'center' };
    applyBorder(cell, COLORS.SLATE_600);
  });

  // Group by failure reason
  const reasonMap: Record<
    string,
    { count: number; initRisk: number; rec: number; curRisk: number; strategy: string }
  > = {};

  atRiskTransactions.forEach((item) => {
    const reason = item.failureReason;
    if (!reasonMap[reason]) {
      let strat = 'Secondary Gateway Routing & Cascade';
      const rLower = reason.toLowerCase();
      if (rLower.includes('otp') || rLower.includes('3ds'))
        strat = 'Interactive WhatsApp Prompt & Push Resend';
      else if (rLower.includes('fund') || rLower.includes('balance'))
        strat = 'Intelligent Balance Cycle Retry Schedule';
      else if (rLower.includes('fraud') || rLower.includes('risk'))
        strat = 'Step-up AI Re-verification & Risk Scoring';
      else if (rLower.includes('card') || rLower.includes('bank') || rLower.includes('technical'))
        strat = 'Zero-Friction Alternate Payment Link (UPI)';
      reasonMap[reason] = { count: 0, initRisk: 0, rec: 0, curRisk: 0, strategy: strat };
    }
    reasonMap[reason].count += 1;
    reasonMap[reason].initRisk += item.fin.initial_risk_minor;
    reasonMap[reason].rec += item.fin.recovered_minor;
    reasonMap[reason].curRisk += item.fin.remaining_risk_minor;
  });

  let reasonRowIdx = rootCauseStartRow + 1;
  Object.entries(reasonMap).forEach(([reason, stat], idx) => {
    recSheet.getRow(reasonRowIdx).height = 22;
    const rate = stat.initRisk > 0 ? `${((stat.rec / stat.initRisk) * 100).toFixed(1)}%` : '0.0%';
    const bgCol = idx % 2 === 0 ? COLORS.WHITE : COLORS.SLATE_50;

    const row = recSheet.getRow(reasonRowIdx);
    row.getCell(1).value = reason;
    row.getCell(1).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.SLATE_900 } };

    row.getCell(2).value = stat.count;
    row.getCell(2).numFmt = COUNT_FORMAT;
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(3).value = Math.round(stat.initRisk / 100);
    row.getCell(3).numFmt = INR_FORMAT;
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(4).value = Math.round(stat.rec / 100);
    row.getCell(4).numFmt = INR_FORMAT;
    row.getCell(4).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.GREEN_DARK } };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(5).value = Math.round(stat.curRisk / 100);
    row.getCell(5).numFmt = INR_FORMAT;
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(6).value = rate;
    row.getCell(6).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.PURPLE_TEXT } };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(7).value = stat.strategy;
    row.getCell(7).font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF' + COLORS.SLATE_600 } };

    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgCol } };
      applyBorder(cell, COLORS.SLATE_300);
    });

    reasonRowIdx++;
  });

  // Table 2 Total Row
  recSheet.getRow(reasonRowIdx).height = 24;
  const reasonTotalRow = recSheet.getRow(reasonRowIdx);
  reasonTotalRow.getCell(1).value = 'TOTAL ROOT CAUSE RECOVERY (SUM)';
  reasonTotalRow.getCell(1).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };

  reasonTotalRow.getCell(2).value = atRiskTransactions.length;
  reasonTotalRow.getCell(2).numFmt = COUNT_FORMAT;
  reasonTotalRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
  reasonTotalRow.getCell(2).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };

  reasonTotalRow.getCell(3).value = Math.round(metrics.initial_revenue_at_risk_minor / 100);
  reasonTotalRow.getCell(3).numFmt = INR_FORMAT;
  reasonTotalRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
  reasonTotalRow.getCell(3).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };

  reasonTotalRow.getCell(4).value = Math.round(metrics.recovered_revenue_minor / 100);
  reasonTotalRow.getCell(4).numFmt = INR_FORMAT;
  reasonTotalRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
  reasonTotalRow.getCell(4).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };

  reasonTotalRow.getCell(5).value = Math.round(metrics.current_revenue_at_risk_minor / 100);
  reasonTotalRow.getCell(5).numFmt = INR_FORMAT;
  reasonTotalRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
  reasonTotalRow.getCell(5).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };

  reasonTotalRow.getCell(6).value = `${metrics.recovery_rate}%`;
  reasonTotalRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
  reasonTotalRow.getCell(6).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.WHITE } };

  reasonTotalRow.getCell(7).value = '100% Primary Root Cause Attributed';
  reasonTotalRow.getCell(7).font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF' + COLORS.SLATE_300 } };

  reasonTotalRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.NAVY_HEADER } };
    applyBorder(cell, COLORS.SLATE_700, 'medium');
  });

  // Footer on recovery sheet
  recSheet.getRow(reasonRowIdx + 2).height = 22;
  recSheet.mergeCells(`A${reasonRowIdx + 2}:G${reasonRowIdx + 2}`);
  const recFooter = recSheet.getCell(`A${reasonRowIdx + 2}`);
  recFooter.value = `PayNexa — AI Revenue Recovery Platform | AI-powered revenue recovery and payment intelligence | Generated: ${reportDateFull}`;
  recFooter.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF' + COLORS.SLATE_500 } };
  recFooter.alignment = { vertical: 'middle', horizontal: 'center' };

  // =========================================================================
  // SHEET 4: AUDIT TRAIL (CHRONOLOGICAL EVENT LOGS & VERIFICATIONS)
  // =========================================================================
  const auditSheet = workbook.addWorksheet('AUDIT TRAIL', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    properties: { tabColor: { argb: 'FF' + COLORS.SLATE_700 } },
  });

  auditSheet.columns = [
    { key: 'timestamp', header: 'Timestamp', width: 24 },
    { key: 'tx_id', header: 'Transaction ID', width: 18 },
    { key: 'action', header: 'Orchestration Action / Event', width: 34 },
    { key: 'prev_status', header: 'Previous Status', width: 18 },
    { key: 'new_status', header: 'New Status', width: 18 },
    { key: 'recovery_method', header: 'Recovery Rail / Method', width: 28 },
    { key: 'verification_status', header: 'Verification Status', width: 22 },
    { key: 'agent_note', header: 'AI Engine Diagnostic & Audit Note', width: 50 },
  ];

  const auditHeaderRow = auditSheet.getRow(1);
  auditHeaderRow.height = 30;
  auditHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.NAVY_DARK } };
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.WHITE } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    applyBorder(cell, COLORS.SLATE_700, 'medium');
  });

  transactionData.forEach((item, idx) => {
    const { case: c, fin, primaryMethod } = item;
    const dateObj = new Date(c.created_at || Date.now());
    const ts = formatDateTimeIndian(dateObj);

    let action = 'Direct Acquiring Route';
    let prevStatus = 'INITIATED';
    let newStatus: string = fin.status_label;
    let agentNote = 'Transaction settled directly via primary acquiring rail.';

    if (fin.is_initially_at_risk) {
      prevStatus = 'FAILED';
      if (fin.recovery_status_label === 'RECOVERED') {
        action = 'Autonomous Recovery Succeeded';
        newStatus = 'RECOVERED';
        agentNote = 'AI dynamic cascade detected optimal route and successfully settled transaction.';
      } else if (c.offline_verification_status === 'IN_REVIEW' || c.offline_verification_status === 'PENDING') {
        action = 'Offline Verification Slip Submitted';
        newStatus = 'IN_REVIEW';
        agentNote = 'Customer uploaded bank transfer proof. AI OCR extracted matching transaction amount.';
      } else if (c.offline_verification_status === 'CONFIRMED') {
        action = 'Manual / AI Offline Proof Confirmed';
        newStatus = 'RECOVERED';
        agentNote = 'Merchant verified settlement in banking ledger. Revenue secured.';
      } else {
        action = 'AI Orchestrator Retry Dispatched';
        newStatus = 'IN_PROGRESS';
        agentNote = 'Targeting secondary acquiring node with optimized payload structure.';
      }
    }

    const row = auditSheet.addRow({
      timestamp: ts,
      tx_id: c.transaction_id || c.id.replace('rc-', 'PX-'),
      action,
      prev_status: prevStatus,
      new_status: newStatus,
      recovery_method: primaryMethod.name,
      verification_status: c.offline_verification_status || 'N/A',
      agent_note: agentNote,
    });

    row.height = 22;
    const bgCol = idx % 2 === 0 ? COLORS.WHITE : COLORS.SLATE_50;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgCol } };
      cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF' + COLORS.SLATE_800 } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      applyBorder(cell, COLORS.SLATE_200);

      if (colNum === 1 || colNum === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (colNum === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }
    });
  });

  auditSheet.autoFilter = {
    from: 'A1',
    to: `H${transactionData.length + 1}`,
  };

  // =========================================================================
  // WORKBOOK WRITE & DOWNLOAD AS TRUE .XLSX
  // =========================================================================
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  let fileName = 'PayNexa_Revenue_Recovery_Report_2026-08-29.xlsx';
  if (options.dateFrom && options.dateTo) {
    fileName = `PayNexa_Revenue_Recovery_Report_${options.dateFrom}_to_${options.dateTo}.xlsx`;
  } else if (options.dateFrom) {
    fileName = `PayNexa_Revenue_Recovery_Report_from_${options.dateFrom}.xlsx`;
  }

  saveAs(blob, fileName);
  soundService.playReportReady();
}
