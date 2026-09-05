import { RecoveryCase } from '../types';

export interface CalculatedRevenueMetrics {
  total_transactions_count: number;
  successful_transactions_count: number;
  unsuccessful_transactions_count: number;

  // 1. TOTAL TRANSACTION VALUE: Monetary value of all transactions in reporting period
  total_transaction_value_minor: number;
  total_transaction_value_inr: number;

  // 2. INITIAL REVENUE AT RISK: Monetary value of transactions at risk before PayNexa recovery
  initial_revenue_at_risk_minor: number;
  initial_revenue_at_risk_inr: number;

  // 3. RECOVERED REVENUE: Amount successfully recovered by PayNexa (subset of Initial Risk)
  recovered_revenue_minor: number;
  recovered_revenue_inr: number;

  // 4. CURRENT REVENUE AT RISK: Initial Risk - Recovered Revenue (>= 0)
  current_revenue_at_risk_minor: number;
  current_revenue_at_risk_inr: number;

  // NET RISK REDUCTION: Initial Risk - Current Risk (= Recovered Revenue)
  risk_reduction_minor: number;
  risk_reduction_inr: number;

  // 5. RECOVERY RATE: (Recovered Revenue / Initial Risk) * 100 (0% if Initial Risk is 0)
  recovery_rate: number;
}

export interface TransactionFinancials {
  amount_minor: number;
  amount_inr: number;
  is_initially_at_risk: boolean;
  initial_risk_minor: number;
  initial_risk_inr: number;
  recovered_minor: number;
  recovered_inr: number;
  remaining_risk_minor: number;
  remaining_risk_inr: number;
  is_successful: boolean;
  status_label: 'SUCCESSFUL' | 'UNSUCCESSFUL';
  recovery_status_label: 'RECOVERED' | 'RECOVERABLE' | 'IN_PROGRESS' | 'ESCALATED' | 'FAILED' | 'SETTLED_NORMALLY';
}

/**
 * Calculates financial parameters for an individual transaction/case.
 * Enforces:
 * - A normal successful transaction (no failure/recovery) has Initial Risk = 0, Recovered = 0, Remaining Risk = 0
 * - An unsuccessful or recovered transaction has Initial Risk = Amount, Recovered = recovered amount (<= Initial Risk), Remaining Risk = Initial Risk - Recovered
 */
export function getTransactionFinancials(c: RecoveryCase): TransactionFinancials {
  const txAmount = c.transaction?.amount_minor ?? c.revenue_at_risk_minor ?? 0;
  
  // A transaction was at risk if it has a recorded failure, is in non-resolved status, or was recovered from a failure
  const isNormalSuccess = 
    c.transaction?.status === 'SUCCESS' && 
    (!c.recovered_amount_minor || c.recovered_amount_minor === 0) && 
    c.status === 'RESOLVED';

  const isInitiallyAtRisk = !isNormalSuccess && (
    c.revenue_at_risk_minor > 0 || 
    (c.recovered_amount_minor || 0) > 0 || 
    c.transaction?.status === 'FAILED' || 
    c.status !== 'RESOLVED'
  );

  const initialRiskMinor = isInitiallyAtRisk ? (c.revenue_at_risk_minor > 0 ? c.revenue_at_risk_minor : txAmount) : 0;
  const rawRecovered = c.recovered_amount_minor || 0;
  const recoveredMinor = isInitiallyAtRisk ? Math.min(initialRiskMinor, Math.max(0, rawRecovered)) : 0;
  const remainingRiskMinor = Math.max(0, initialRiskMinor - recoveredMinor);

  const isSuccessful = isNormalSuccess || c.status === 'RESOLVED' || recoveredMinor > 0 || c.transaction?.status === 'SUCCESS';
  const statusLabel: 'SUCCESSFUL' | 'UNSUCCESSFUL' = isSuccessful ? 'SUCCESSFUL' : 'UNSUCCESSFUL';

  let recoveryStatusLabel: 'RECOVERED' | 'RECOVERABLE' | 'IN_PROGRESS' | 'ESCALATED' | 'FAILED' | 'SETTLED_NORMALLY';
  if (isNormalSuccess) {
    recoveryStatusLabel = 'SETTLED_NORMALLY';
  } else if (recoveredMinor > 0 || c.status === 'RESOLVED') {
    recoveryStatusLabel = 'RECOVERED';
  } else if (c.status === 'ESCALATED') {
    recoveryStatusLabel = 'ESCALATED';
  } else if (c.status === 'FAILED') {
    recoveryStatusLabel = 'FAILED';
  } else {
    const prob = c.predictions?.[0]?.prediction ?? 0.72;
    recoveryStatusLabel = prob >= 0.75 ? 'RECOVERABLE' : 'IN_PROGRESS';
  }

  return {
    amount_minor: txAmount,
    amount_inr: Math.round(txAmount / 100),
    is_initially_at_risk: isInitiallyAtRisk,
    initial_risk_minor: initialRiskMinor,
    initial_risk_inr: Math.round(initialRiskMinor / 100),
    recovered_minor: recoveredMinor,
    recovered_inr: Math.round(recoveredMinor / 100),
    remaining_risk_minor: remainingRiskMinor,
    remaining_risk_inr: Math.round(remainingRiskMinor / 100),
    is_successful: isSuccessful,
    status_label: statusLabel,
    recovery_status_label: recoveryStatusLabel,
  };
}

/**
 * Single source of truth calculation for all PayNexa revenue & recovery metrics.
 * Ensures strict financial consistency:
 * - Recovered Revenue <= Initial Revenue At Risk
 * - Current Revenue At Risk = Initial Revenue At Risk - Recovered Revenue
 * - Total Transaction Value is the overall payment volume (NOT equated to recovered revenue)
 * - Recovery Rate = (Recovered / Initial Risk) * 100
 */
export function calculateRevenueMetrics(cases: RecoveryCase[]): CalculatedRevenueMetrics {
  let totalTxValueMinor = 0;
  let initialRiskMinor = 0;
  let recoveredMinor = 0;
  let successfulCount = 0;
  let unsuccessfulCount = 0;

  for (const c of cases) {
    const fin = getTransactionFinancials(c);
    totalTxValueMinor += fin.amount_minor;
    initialRiskMinor += fin.initial_risk_minor;
    recoveredMinor += fin.recovered_minor;

    if (fin.is_successful) {
      successfulCount++;
    } else {
      unsuccessfulCount++;
    }
  }

  // Enforce invariants
  // 1. Recovered cannot exceed initial risk
  recoveredMinor = Math.min(recoveredMinor, initialRiskMinor);

  // 2. Current risk = Initial Risk - Recovered
  const currentRiskMinor = Math.max(0, initialRiskMinor - recoveredMinor);

  // 3. Risk reduction = Initial Risk - Current Risk (= Recovered)
  const riskReductionMinor = initialRiskMinor - currentRiskMinor;

  // 4. Recovery Rate
  const recoveryRate = initialRiskMinor > 0
    ? Math.round((recoveredMinor / initialRiskMinor) * 1000) / 10
    : 0;

  return {
    total_transactions_count: cases.length,
    successful_transactions_count: successfulCount,
    unsuccessful_transactions_count: unsuccessfulCount,

    total_transaction_value_minor: totalTxValueMinor,
    total_transaction_value_inr: Math.round(totalTxValueMinor / 100),

    initial_revenue_at_risk_minor: initialRiskMinor,
    initial_revenue_at_risk_inr: Math.round(initialRiskMinor / 100),

    recovered_revenue_minor: recoveredMinor,
    recovered_revenue_inr: Math.round(recoveredMinor / 100),

    current_revenue_at_risk_minor: currentRiskMinor,
    current_revenue_at_risk_inr: Math.round(currentRiskMinor / 100),

    risk_reduction_minor: riskReductionMinor,
    risk_reduction_inr: Math.round(riskReductionMinor / 100),

    recovery_rate: recoveryRate,
  };
}
