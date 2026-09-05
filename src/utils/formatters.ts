import { CasePriority, CaseStatus, FailureReason, PaymentMethod, RiskLevel, RecoveryLikelihood } from '../types';

export function formatINR(minorUnits: number): string {
  const rupees = minorUnits / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(rupees);
}

export function formatCompactINR(minorUnits: number): string {
  const rupees = minorUnits / 100;
  if (rupees >= 10000000) {
    return `₹${(rupees / 10000000).toFixed(2)} Cr`;
  }
  if (rupees >= 100000) {
    return `₹${(rupees / 100000).toFixed(2)} L`;
  }
  if (rupees >= 1000) {
    return `₹${(rupees / 1000).toFixed(1)}k`;
  }
  return `₹${rupees.toFixed(0)}`;
}

export function formatPercent(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`;
}

export function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function getPriorityStyles(priority: CasePriority): { bg: string; text: string; border: string; dot: string } {
  switch (priority) {
    case 'CRITICAL':
      return {
        bg: 'bg-rose-500/15',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        dot: 'bg-rose-500',
      };
    case 'HIGH':
      return {
        bg: 'bg-amber-500/15',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        dot: 'bg-amber-500',
      };
    case 'MEDIUM':
      return {
        bg: 'bg-indigo-500/15',
        text: 'text-indigo-400',
        border: 'border-indigo-500/30',
        dot: 'bg-indigo-400',
      };
    case 'LOW':
    default:
      return {
        bg: 'bg-slate-800/60',
        text: 'text-slate-300',
        border: 'border-slate-700/60',
        dot: 'bg-slate-500',
      };
  }
}

export function getStatusStyles(status: CaseStatus): { bg: string; text: string; border: string } {
  switch (status) {
    case 'NEW':
      return {
        bg: 'bg-sky-500/15',
        text: 'text-sky-400',
        border: 'border-sky-500/30',
      };
    case 'IN_PROGRESS':
      return {
        bg: 'bg-blue-500/15',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
      };
    case 'ESCALATED':
      return {
        bg: 'bg-rose-500/15',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
      };
    case 'RESOLVED':
      return {
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'FAILED':
    default:
      return {
        bg: 'bg-slate-800/60',
        text: 'text-slate-400',
        border: 'border-slate-700/60',
      };
  }
}

export function getFailureReasonLabel(reason: FailureReason): string {
  switch (reason) {
    case 'NETWORK_TIMEOUT':
      return 'Network Timeout';
    case 'INSUFFICIENT_FUNDS':
      return 'Insufficient Funds';
    case 'CARD_DECLINED':
      return 'Card Declined';
    case 'BANK_ERROR':
      return 'Bank Gateway Error';
    case 'EXPIRED_CARD':
      return 'Expired Card';
    case 'FRAUD_REVIEW':
      return 'Fraud Filter Review';
    case 'AUTH_FAILED':
      return '3DS OTP Timeout';
    default:
      return reason;
  }
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case 'CREDIT_CARD':
      return 'Credit Card';
    case 'DEBIT_CARD':
      return 'Debit Card';
    case 'UPI':
      return 'UPI Instant';
    case 'NET_BANKING':
      return 'Net Banking';
    case 'WALLET':
      return 'Digital Wallet';
    case 'OFFLINE':
      return 'Cash / Offline';
    case 'CASH':
      return 'Cash Payment';
    default:
      return method;
  }
}

export function getOfflineVerificationStatusLabel(status?: string, step?: number): string {
  if (status === 'CONFIRMED') return 'Payment Confirmed';
  if (status === 'REJECTED') return 'Payment Not Verified';
  if (status === 'IN_REVIEW') return `In Review (Step ${step || 2} of 3)`;
  if (status === 'PENDING') return `Verification Pending (Step ${step || 1} of 3)`;
  return 'Not Applicable';
}

export function getOfflineVerificationStatusStyles(status?: string): { bg: string; text: string; border: string; dot: string } {
  switch (status) {
    case 'CONFIRMED':
      return {
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        dot: 'bg-emerald-400',
      };
    case 'REJECTED':
      return {
        bg: 'bg-rose-500/15',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        dot: 'bg-rose-400',
      };
    case 'IN_REVIEW':
      return {
        bg: 'bg-blue-500/15',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        dot: 'bg-blue-400',
      };
    case 'PENDING':
    default:
      return {
        bg: 'bg-amber-500/15',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        dot: 'bg-amber-400',
      };
  }
}

export function getProbabilityColor(prob: number): { text: string; bg: string; bar: string } {
  if (prob >= 0.75) {
    return {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/15',
      bar: 'bg-emerald-500',
    };
  }
  if (prob >= 0.45) {
    return {
      text: 'text-amber-400',
      bg: 'bg-amber-500/15',
      bar: 'bg-amber-500',
    };
  }
  return {
    text: 'text-rose-400',
    bg: 'bg-rose-500/15',
    bar: 'bg-rose-500',
  };
}

export function getRiskLevelStyles(level: RiskLevel): { bg: string; text: string; border: string } {
  switch (level) {
    case 'CRITICAL':
      return { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' };
    case 'HIGH':
      return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' };
    case 'MEDIUM':
      return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' };
    case 'LOW':
    default:
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' };
  }
}

export function formatDateFull(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateOnly(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().split('T')[0];
}

export function isTransactionSuccessful(caseItem: any): boolean {
  return (
    caseItem.status === 'RESOLVED' ||
    caseItem.transaction?.status === 'SUCCESS' ||
    (caseItem.recovered_amount_minor > 0 && caseItem.status !== 'FAILED')
  );
}

export function getRecoveryStatusLabel(caseItem: any): string {
  if (isTransactionSuccessful(caseItem)) {
    return 'RECOVERED';
  }
  if (caseItem.status === 'ESCALATED') {
    return 'ESCALATED';
  }
  if (caseItem.status === 'IN_PROGRESS') {
    return 'IN PROGRESS';
  }
  if (caseItem.status === 'FAILED') {
    return 'FAILED';
  }
  const score = caseItem.predictions?.[0]?.prediction ?? 0.7;
  if (score >= 0.7) {
    return 'RECOVERABLE';
  }
  return 'AT RISK';
}

