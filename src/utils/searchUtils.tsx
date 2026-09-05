import React from 'react';
import { RecoveryCase, Customer } from '../types';
import { 
  formatINR, 
  getFailureReasonLabel, 
  getPaymentMethodLabel, 
  isTransactionSuccessful,
  getOfflineVerificationStatusLabel
} from './formatters';

/**
 * Returns a human-friendly display name for a customer.
 */
export function getCustomerDisplayName(customer?: Customer): string {
  if (!customer) return 'Unknown Customer';
  if (customer.name && customer.name.trim()) return customer.name.trim();

  // If email is available, derive a clean name from the username part
  if (customer.email) {
    const username = customer.email.split('@')[0];
    if (username.startsWith('demo.customer.')) {
      const letter = username.replace('demo.customer.', '').toUpperCase();
      return `Demo Customer ${letter}`;
    }
    // Convert dot/underscore separated names like alex.morgan -> Alex Morgan
    const parts = username.split(/[._-]/).filter(Boolean);
    if (parts.length > 0) {
      return parts
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
    }
  }

  if (customer.external_customer_id) {
    return customer.external_customer_id;
  }

  return customer.id || 'Customer';
}

/**
 * Normalizes a string for search comparison:
 * lowercase, trimmed, removes extra spaces and common symbols.
 */
export function normalizeSearchStr(str: string): string {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/[\s\-_]+/g, ' ');
}

/**
 * Evaluates whether a transaction case matches the search query across all searchable fields.
 */
export function matchCaseQuery(caseItem: RecoveryCase, rawQuery: string): boolean {
  if (!rawQuery || !rawQuery.trim()) return false;
  const q = rawQuery.trim().toLowerCase();
  const cleanQ = normalizeSearchStr(rawQuery);
  const words = cleanQ.split(' ').filter(Boolean);

  // 1. Transaction ID & Case ID matches
  const txId = (caseItem.transaction_id || '').toLowerCase();
  const caseId = (caseItem.id || '').toLowerCase();
  const rawTxId = (caseItem.transaction?.id || '').toLowerCase();

  const idText = `${txId} ${caseId} ${rawTxId} ${txId.replace(/[^a-z0-9]/g, '')} ${caseId.replace(/[^a-z0-9]/g, '')}`;
  if (idText.includes(q) || idText.includes(cleanQ)) return true;

  // 2. Customer fields (Name, Email, ID)
  const custName = getCustomerDisplayName(caseItem.customer).toLowerCase();
  const custEmail = (caseItem.customer?.email || '').toLowerCase();
  const custExtId = (caseItem.customer?.external_customer_id || '').toLowerCase();
  const custId = (caseItem.customer_id || '').toLowerCase();

  const customerText = `${custName} ${custEmail} ${custExtId} ${custId}`;
  if (customerText.includes(q) || customerText.includes(cleanQ)) return true;

  // 3. Merchant fields (Name, Category, Code, ID)
  const merchantName = (caseItem.merchant?.name || '').toLowerCase();
  const merchantCode = (caseItem.merchant?.code || '').toLowerCase();
  const merchantCat = (caseItem.merchant?.category || '').toLowerCase();
  const merchantId = (caseItem.merchant_id || '').toLowerCase();

  const merchantText = `${merchantName} ${merchantCode} ${merchantCat} ${merchantId}`;
  if (merchantText.includes(q) || merchantText.includes(cleanQ)) return true;

  // 4. Payment Method & Rails
  const pmRaw = (caseItem.transaction?.payment_method || '').toLowerCase();
  const pmLabel = getPaymentMethodLabel(caseItem.transaction?.payment_method as any).toLowerCase();
  const pmText = `${pmRaw} ${pmLabel} ${pmRaw.replace(/_/g, ' ')}`;
  
  if (pmText.includes(q) || pmText.includes(cleanQ)) return true;

  // Specific payment method keywords
  if (q === 'upi' && (pmRaw.includes('upi') || pmLabel.includes('upi'))) return true;
  if ((q === 'card' || q === 'cards') && (pmRaw.includes('card') || pmLabel.includes('card'))) return true;
  if ((q === 'credit card' || q === 'credit') && pmRaw.includes('credit')) return true;
  if ((q === 'debit card' || q === 'debit') && pmRaw.includes('debit')) return true;
  if ((q === 'net banking' || q === 'netbanking' || q === 'banking') && (pmRaw.includes('net') || pmLabel.includes('net'))) return true;
  if ((q === 'wallet' || q === 'wallets') && pmRaw.includes('wallet')) return true;
  if ((q === 'cash' || q === 'offline') && (pmRaw.includes('cash') || pmRaw.includes('offline') || caseItem.offline_verification_status)) return true;

  // 5. Status, Recovery Status & Verification Status
  const isSuccess = isTransactionSuccessful(caseItem);
  const caseStatus = (caseItem.status || '').toLowerCase();
  const txStatus = (caseItem.transaction?.status || '').toLowerCase();
  const offlineStatus = (caseItem.offline_verification_status || '').toLowerCase();
  const offlineLabel = getOfflineVerificationStatusLabel(caseItem.offline_verification_status, caseItem.offline_verification_step).toLowerCase();
  const priority = (caseItem.priority || '').toLowerCase();

  // Query = "failed" / "unsuccessful" / "failure"
  if (q.includes('fail') || q.includes('unsuccess') || q.includes('at risk')) {
    if (!isSuccess || txStatus === 'failed' || caseStatus === 'failed') return true;
  }

  // Query = "successful" / "success" / "recovered" / "resolved"
  if (q.includes('success') || q.includes('recover') || q.includes('resolv') || q.includes('paid')) {
    if (isSuccess || caseStatus === 'resolved' || txStatus === 'success' || (caseItem.recovered_amount_minor && caseItem.recovered_amount_minor > 0)) return true;
  }

  // Query = "offline" / "verification" / "verify" / "declare" / "challan"
  if (q.includes('offline') || q.includes('verif') || q.includes('cash') || q.includes('challan') || q.includes('counter')) {
    if (
      (caseItem.offline_verification_status && caseItem.offline_verification_status !== 'NONE') ||
      pmRaw === 'offline' ||
      pmRaw === 'cash' ||
      caseItem.last_customer_action?.toLowerCase().includes('cash') ||
      caseItem.last_customer_action?.toLowerCase().includes('offline')
    ) {
      return true;
    }
  }

  // Query = "pending"
  if (q.includes('pending')) {
    if (
      caseItem.offline_verification_status === 'PENDING' ||
      caseItem.offline_verification_status === 'IN_REVIEW' ||
      caseStatus === 'new' ||
      caseStatus === 'in_progress'
    ) {
      return true;
    }
  }

  // Query = "in recovery" / "in progress"
  if (q.includes('progress') || q.includes('in recovery')) {
    if (caseStatus === 'in_progress' || caseStatus === 'in_review') return true;
  }

  // Priority queries
  if (['critical', 'high', 'medium', 'low'].includes(q) && priority === q) {
    return true;
  }

  const statusFullText = `${caseStatus} ${txStatus} ${offlineStatus} ${offlineLabel} ${priority}`;
  if (statusFullText.includes(q) || statusFullText.includes(cleanQ)) return true;

  // 6. Failure Reason & Failure Code
  const failReasonRaw = (caseItem.transaction?.failure_reason || '').toLowerCase();
  const failReasonLabel = getFailureReasonLabel(caseItem.transaction?.failure_reason as any).toLowerCase();
  const escalationReason = (caseItem.escalation_reason || '').toLowerCase();
  const lastAction = (caseItem.last_customer_action || '').toLowerCase();
  const simName = (caseItem.simulation_scenario_name || '').toLowerCase();

  const failureText = `${failReasonRaw} ${failReasonLabel} ${failReasonRaw.replace(/_/g, ' ')} ${escalationReason} ${lastAction} ${simName}`;
  if (failureText.includes(q) || failureText.includes(cleanQ)) return true;

  // Specific failure reason terms
  if (q.includes('timeout') && (failReasonRaw.includes('timeout') || failReasonLabel.includes('timeout') || failReasonRaw === 'auth_failed')) return true;
  if (q.includes('decline') && (failReasonRaw.includes('declined') || failReasonLabel.includes('declined'))) return true;
  if (q.includes('insufficient') || q.includes('funds')) {
    if (failReasonRaw.includes('funds') || failReasonLabel.includes('funds')) return true;
  }
  if (q.includes('bank') && (failReasonRaw.includes('bank') || failReasonLabel.includes('bank'))) return true;
  if (q.includes('expired') && (failReasonRaw.includes('expired') || failReasonLabel.includes('expired'))) return true;
  if (q.includes('fraud') && (failReasonRaw.includes('fraud') || failReasonLabel.includes('fraud'))) return true;
  if (q.includes('auth') || q.includes('otp') || q.includes('3ds')) {
    if (failReasonRaw.includes('auth') || failReasonLabel.includes('auth') || failReasonLabel.includes('3ds')) return true;
  }

  // 7. Amount in INR
  const amountMinor = caseItem.transaction?.amount_minor ?? caseItem.revenue_at_risk_minor ?? 0;
  const amountRupees = Math.round(amountMinor / 100).toString();
  const formattedINRText = formatINR(amountMinor).toLowerCase().replace(/[^0-9,.]/g, '');
  const digitsOnlyQ = q.replace(/[^0-9]/g, '');

  if (digitsOnlyQ.length >= 3) {
    if (amountRupees.includes(digitsOnlyQ) || formattedINRText.includes(digitsOnlyQ)) return true;
  }

  // 8. Multi-word match: all words in query match across combined case record
  if (words.length > 1) {
    const combinedRecord = `${idText} ${customerText} ${merchantText} ${pmText} ${statusFullText} ${failureText} ${amountRupees}`.toLowerCase();
    const allWordsMatch = words.every((w) => combinedRecord.includes(w));
    if (allWordsMatch) return true;
  }

  return false;
}

/**
 * Filters the transaction dataset against a query string.
 */
export function filterTransactions(cases: RecoveryCase[], query: string): RecoveryCase[] {
  if (!query || !query.trim()) return [];
  return cases.filter((c) => matchCaseQuery(c, query));
}

/**
 * Highlights matches in text safely without external dependencies.
 */
export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || !query.trim() || !text) return text;
  const cleanQ = query.trim();
  
  // Escape regex special chars
  const escapedQuery = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((part, index) => {
        if (part.toLowerCase() === cleanQ.toLowerCase()) {
          return (
            <mark 
              key={index} 
              className="bg-amber-400/30 text-amber-200 font-semibold px-0.5 rounded"
            >
              {part}
            </mark>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}
