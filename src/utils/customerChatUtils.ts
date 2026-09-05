import { RecoveryCase, PaymentMethod, FailureReason, CustomerRecoveryMessage } from '../types';
import { formatINR } from './formatters';

/**
 * Translates technical error codes into simple, understandable customer explanations.
 * Prohibits raw codes (e.g., GATEWAY_TIMEOUT_504, 3DS_AUTH_EXPIRED).
 */
export function getCustomerFriendlyFailureReason(reason?: FailureReason | string): string {
  if (!reason) return 'Your bank or payment provider did not respond in time.';
  
  switch (reason) {
    case 'NETWORK_TIMEOUT':
      return 'Your bank or payment provider did not respond in time.';
    case 'BANK_ERROR':
      return 'Your bank’s payment server experienced a temporary communication issue.';
    case 'AUTH_FAILED':
      return 'The one-time password (OTP) or 3D-Secure bank verification timed out.';
    case 'INSUFFICIENT_FUNDS':
      return 'Your bank account has insufficient balance to complete this transaction.';
    case 'CARD_DECLINED':
      return 'Your card issuer declined the payment. Please check with your bank or try an alternate method.';
    case 'EXPIRED_CARD':
      return 'Your card details could not be validated or the card has expired.';
    case 'FRAUD_REVIEW':
      return 'This payment was placed on temporary security hold by your card provider.';
    default:
      return 'The payment provider could not complete the authorization.';
  }
}

export interface RecommendedPaymentMethod {
  method: string;
  name: string;
  badge?: string;
  reason: string;
  isRecommended: boolean;
}

/**
 * PayNexa intelligent recovery method recommender based on failure telemetry and original rail.
 */
export function getRecommendedAlternativeMethods(
  originalMethod?: PaymentMethod,
  failureReason?: FailureReason
): RecommendedPaymentMethod[] {
  const allMethods: RecommendedPaymentMethod[] = [
    {
      method: 'UPI',
      name: 'UPI Instant (GPay / PhonePe / Paytm)',
      isRecommended: false,
      reason: 'Fastest 1-click clearance with zero card fatigue',
    },
    {
      method: 'CREDIT_CARD',
      name: 'Debit or Credit Card (Visa / Mastercard / RuPay)',
      isRecommended: false,
      reason: 'Secure card checkout via secondary multi-bank gateway',
    },
    {
      method: 'NET_BANKING',
      name: 'Net Banking (Top 50+ Banks)',
      isRecommended: false,
      reason: 'Direct corporate and retail banking clearance',
    },
    {
      method: 'WALLET',
      name: 'Digital Wallet (Paytm, Mobikwik, Amazon Pay)',
      isRecommended: false,
      reason: 'Pre-funded wallet with zero bank OTP friction',
    },
    {
      method: 'OFFLINE',
      name: 'Pay Offline / Cash Settlement',
      isRecommended: false,
      reason: 'Pay directly to merchant with manual verification',
    },
  ];

  // Apply PayNexa AI recommendation logic
  if (originalMethod === 'CREDIT_CARD' || originalMethod === 'DEBIT_CARD') {
    // For card drops, UPI has the highest recovery velocity (>94% clearance)
    const upi = allMethods.find(m => m.method === 'UPI');
    if (upi) {
      upi.isRecommended = true;
      upi.badge = 'Recommended by PayNexa (98.4% Success Rate)';
      upi.reason = 'Recommended alternative to avoid card issuer decline';
    }
  } else if (originalMethod === 'UPI') {
    if (failureReason === 'INSUFFICIENT_FUNDS') {
      const card = allMethods.find(m => m.method === 'CREDIT_CARD');
      if (card) {
        card.isRecommended = true;
        card.badge = 'Recommended by PayNexa';
        card.reason = 'Use credit card to bypass bank account balance limit';
      }
    } else {
      const netBanking = allMethods.find(m => m.method === 'NET_BANKING');
      if (netBanking) {
        netBanking.isRecommended = true;
        netBanking.badge = 'Recommended by PayNexa';
        netBanking.reason = 'Direct bank gateway route bypasses UPI server latency';
      }
    }
  } else {
    const upi = allMethods.find(m => m.method === 'UPI');
    if (upi) {
      upi.isRecommended = true;
      upi.badge = 'Recommended by PayNexa';
    }
  }

  return allMethods;
}

/**
 * Checks whether a recovery case or transaction has been successfully recovered / confirmed
 */
export function isTransactionSuccessful(c: RecoveryCase): boolean {
  if (!c) return false;
  return (
    c.status === 'RESOLVED' ||
    c.transaction?.status === 'SUCCESS' ||
    c.offline_verification_status === 'CONFIRMED' ||
    (c.recovered_amount_minor > 0 && c.status !== 'FAILED')
  );
}

export interface ChatTimelineItem {
  key: string;
  label: string;
  status: 'COMPLETED' | 'CURRENT' | 'PENDING' | 'FAILED';
  timestamp?: string;
  detail?: string;
}

/**
 * Generates the dynamic recovery timeline for a transaction
 */
export function getChatTimeline(c: RecoveryCase): ChatTimelineItem[] {
  const isConfirmed = c.offline_verification_status === 'CONFIRMED' || (c.status === 'RESOLVED' && c.transaction?.status === 'SUCCESS');
  const isRejected = c.offline_verification_status === 'REJECTED';
  const hasOffline = !!c.offline_verification_status || c.transaction?.payment_method === 'OFFLINE';

  const timeline: ChatTimelineItem[] = [
    {
      key: 'attempt',
      label: 'Payment Attempt',
      status: 'COMPLETED',
      timestamp: c.created_at,
      detail: `${c.transaction?.payment_method || 'Card'} checkout`,
    },
    {
      key: 'failed',
      label: 'Payment Failed',
      status: 'COMPLETED',
      timestamp: c.created_at,
      detail: getCustomerFriendlyFailureReason(c.transaction?.failure_reason),
    },
  ];

  if (c.retry_count >= 1 || hasOffline) {
    timeline.push({
      key: 'retry_1',
      label: 'Retry 1',
      status: 'COMPLETED',
      detail: 'Direct gateway retry',
    });
  }

  if (c.retry_count >= 2 || hasOffline) {
    timeline.push({
      key: 'retry_2',
      label: 'Retry 2',
      status: 'COMPLETED',
      detail: 'Alternative routing triggered',
    });
  }

  if (hasOffline) {
    timeline.push({
      key: 'offline_selected',
      label: 'Offline Payment Selected',
      status: 'COMPLETED',
      detail: 'Cash / counter payment requested',
    });

    timeline.push({
      key: 'offline_reported',
      label: 'Offline Payment Reported',
      status: 'COMPLETED',
      timestamp: c.offline_reported_at,
      detail: "Customer reported: \"I've paid offline\"",
    });

    if (isConfirmed) {
      timeline.push({
        key: 'merchant_verify',
        label: 'Merchant Verification',
        status: 'COMPLETED',
        detail: 'All 3 review steps completed',
      });
      timeline.push({
        key: 'confirmed',
        label: 'Payment Confirmed',
        status: 'COMPLETED',
        timestamp: c.updated_at,
        detail: 'Funds verified & ledger credited',
      });
    } else if (isRejected) {
      timeline.push({
        key: 'merchant_verify',
        label: 'Merchant Verification',
        status: 'FAILED',
        detail: 'Payment could not be verified',
      });
      timeline.push({
        key: 'rejected',
        label: 'Payment Not Verified',
        status: 'FAILED',
        timestamp: c.updated_at,
        detail: 'Transaction remains unconfirmed',
      });
    } else {
      timeline.push({
        key: 'merchant_verify',
        label: 'Merchant Verification',
        status: 'CURRENT',
        detail: `Step ${c.offline_verification_step || 1} of 3 in progress`,
      });
      timeline.push({
        key: 'pending_confirm',
        label: 'Payment Confirmation',
        status: 'PENDING',
        detail: 'Awaiting merchant clearance',
      });
    }
  } else if (isConfirmed) {
    timeline.push({
      key: 'recovered',
      label: 'Recovery Succeeded',
      status: 'COMPLETED',
      timestamp: c.updated_at,
      detail: 'Settled via secondary route',
    });
  } else {
    timeline.push({
      key: 'recovery_in_progress',
      label: 'Recovery In Progress',
      status: 'CURRENT',
      detail: 'Awaiting customer / automated retry',
    });
  }

  return timeline;
}

/**
 * Builds standard conversation history for a given case to ensure consistent state
 */
export function buildInitialCaseMessages(c: RecoveryCase): CustomerRecoveryMessage[] {
  const isSuccess = isTransactionSuccessful(c);
  const amountStr = formatINR(c.transaction?.amount_minor ?? c.revenue_at_risk_minor ?? 0);
  const txId = c.transaction_id || c.id.replace('rc-', 'PX-');
  const timestamp = c.created_at || new Date().toISOString();
  const merchantName = c.merchant?.name || 'the merchant';

  if (isSuccess && !c.offline_verification_status) {
    return [
      {
        id: `msg-${c.id}-1`,
        sender: 'paynexa',
        text: `✓ Payment Successful\n\nYour payment of ${amountStr} was successfully processed.\n\nTransaction ID: ${txId}\nMerchant: ${merchantName}\n\nThank you for your payment.`,
        timestamp,
        type: 'success_confirmation',
      },
    ];
  }

  const messages: CustomerRecoveryMessage[] = [];
  const friendlyReason = getCustomerFriendlyFailureReason(c.transaction?.failure_reason);

  // If offline verification flow occurred
  if (c.offline_verification_status === 'PENDING' || c.offline_verification_status === 'IN_REVIEW') {
    messages.push({
      id: `msg-${c.id}-1`,
      sender: 'paynexa',
      text: `Your payment of ${amountStr} could not be completed.\n\nReason:\n${friendlyReason}\n\nWould you like to try again?`,
      timestamp,
      type: 'retry_prompt',
    });

    messages.push({
      id: `msg-${c.id}-2`,
      sender: 'customer',
      text: "I'll try again.",
      timestamp: new Date(new Date(timestamp).getTime() + 10000).toISOString(),
      type: 'customer_response',
    });

    messages.push({
      id: `msg-${c.id}-3`,
      sender: 'paynexa',
      text: `Unfortunately, the payment could not be completed again.\n\nYou can choose another payment method.`,
      timestamp: new Date(new Date(timestamp).getTime() + 15000).toISOString(),
      type: 'alternative_methods',
    });

    messages.push({
      id: `msg-${c.id}-4`,
      sender: 'customer',
      text: "I'll pay offline.",
      timestamp: new Date(new Date(timestamp).getTime() + 25000).toISOString(),
      type: 'customer_response',
    });

    messages.push({
      id: `msg-${c.id}-5`,
      sender: 'paynexa',
      text: `You selected offline payment.\n\nPlease complete the payment directly with ${merchantName}.\n\nAfter making the payment, let us know.`,
      timestamp: new Date(new Date(timestamp).getTime() + 30000).toISOString(),
      type: 'offline_instructions',
    });

    messages.push({
      id: `msg-${c.id}-6`,
      sender: 'customer',
      text: "I've paid offline.",
      timestamp: c.offline_reported_at || new Date(new Date(timestamp).getTime() + 60000).toISOString(),
      type: 'customer_response',
    });

    const stepLabel = c.offline_verification_step === 3 
      ? 'Step 3 of 3: Final Confirmation' 
      : c.offline_verification_step === 2 
      ? 'Step 2 of 3: Transaction Review' 
      : 'Step 1 of 3: Details Review';

    messages.push({
      id: `msg-${c.id}-7`,
      sender: 'paynexa',
      text: `Thank you.\n\nYour offline payment has been submitted for merchant verification.\n\nAmount:\n${amountStr}\n\nStatus:\nOFFLINE VERIFICATION PENDING (${stepLabel})\n\nWe'll notify you once the merchant completes verification.`,
      timestamp: c.offline_reported_at || new Date(new Date(timestamp).getTime() + 65000).toISOString(),
      type: 'offline_pending',
    });

    return messages;
  } else if (c.offline_verification_status === 'CONFIRMED') {
    messages.push({
      id: `msg-${c.id}-1`,
      sender: 'paynexa',
      text: `Your payment of ${amountStr} could not be completed.\n\nReason:\n${friendlyReason}\n\nWould you like to try again?`,
      timestamp,
      type: 'retry_prompt',
    });

    messages.push({
      id: `msg-${c.id}-2`,
      sender: 'customer',
      text: "I'll try again.",
      timestamp: new Date(new Date(timestamp).getTime() + 10000).toISOString(),
      type: 'customer_response',
    });

    messages.push({
      id: `msg-${c.id}-3`,
      sender: 'paynexa',
      text: `Unfortunately, the payment could not be completed again.\n\nYou can choose another payment method.`,
      timestamp: new Date(new Date(timestamp).getTime() + 15000).toISOString(),
      type: 'alternative_methods',
    });

    messages.push({
      id: `msg-${c.id}-4`,
      sender: 'customer',
      text: "I'll pay offline.",
      timestamp: new Date(new Date(timestamp).getTime() + 25000).toISOString(),
      type: 'customer_response',
    });

    messages.push({
      id: `msg-${c.id}-5`,
      sender: 'paynexa',
      text: `You selected offline payment.\n\nPlease complete the payment directly with ${merchantName}.\n\nAfter making the payment, let us know.`,
      timestamp: new Date(new Date(timestamp).getTime() + 30000).toISOString(),
      type: 'offline_instructions',
    });

    messages.push({
      id: `msg-${c.id}-6`,
      sender: 'customer',
      text: "I've paid offline.",
      timestamp: c.offline_reported_at || new Date(new Date(timestamp).getTime() + 60000).toISOString(),
      type: 'customer_response',
    });

    messages.push({
      id: `msg-${c.id}-7`,
      sender: 'paynexa',
      text: `✓ Payment Confirmed\n\nThe merchant has confirmed receipt of your ${amountStr} offline payment.\n\nTransaction:\n${txId}\n\nStatus:\nPAYMENT CONFIRMED`,
      timestamp: c.updated_at || new Date().toISOString(),
      type: 'success_confirmation',
    });

    return messages;
  } else if (c.offline_verification_status === 'REJECTED') {
    messages.push({
      id: `msg-${c.id}-1`,
      sender: 'paynexa',
      text: `Your payment of ${amountStr} could not be completed.`,
      timestamp,
      type: 'retry_prompt',
    });

    messages.push({
      id: `msg-${c.id}-4`,
      sender: 'customer',
      text: "I'll pay offline.",
      timestamp: new Date(new Date(timestamp).getTime() + 25000).toISOString(),
      type: 'customer_response',
    });

    messages.push({
      id: `msg-${c.id}-6`,
      sender: 'customer',
      text: "I've paid offline.",
      timestamp: c.offline_reported_at || new Date(new Date(timestamp).getTime() + 60000).toISOString(),
      type: 'customer_response',
    });

    messages.push({
      id: `msg-${c.id}-7`,
      sender: 'paynexa',
      text: `We couldn't verify receipt of your offline payment.\n\nPlease contact the merchant or choose another available payment method.\n\nStatus:\nOFFLINE PAYMENT NOT VERIFIED`,
      timestamp: c.updated_at || new Date().toISOString(),
      type: 'rejection_notice',
    });

    return messages;
  }

  // 1. Initial Failure Notification for standard online recovery
  messages.push({
    id: `msg-${c.id}-1`,
    sender: 'paynexa',
    text: `Payment Unsuccessful\n\nYour payment of ${amountStr} could not be completed.\n\nReason:\n${friendlyReason}\n\nYour money has NOT been confirmed as successfully received by the merchant.\n\nWould you like to try again?`,
    timestamp,
    type: 'retry_prompt',
  });

  // If retried 1 time
  if (c.retry_count >= 1) {
    messages.push({
      id: `msg-${c.id}-2`,
      sender: 'customer',
      text: 'Trying payment again...',
      timestamp: new Date(new Date(timestamp).getTime() + 15000).toISOString(),
      type: 'customer_response',
    });

    if (c.retry_count === 1 && c.status !== 'RESOLVED') {
      messages.push({
        id: `msg-${c.id}-3`,
        sender: 'paynexa',
        text: `Payment Unsuccessful Again\n\nWe couldn't complete your payment with the previous method.\n\nYou can try again or choose another available payment method.`,
        timestamp: new Date(new Date(timestamp).getTime() + 25000).toISOString(),
        type: 'retry_prompt',
      });
    }
  }

  // If retried 2+ times or alternative methods were triggered
  if (c.retry_count >= 2 && c.status !== 'RESOLVED') {
    messages.push({
      id: `msg-${c.id}-4`,
      sender: 'customer',
      text: 'Exploring alternative payment methods.',
      timestamp: new Date(new Date(timestamp).getTime() + 35000).toISOString(),
      type: 'customer_response',
    });

    messages.push({
      id: `msg-${c.id}-5`,
      sender: 'paynexa',
      text: `We couldn't complete this payment after multiple attempts.\n\nChoose another way to pay from the options below:`,
      timestamp: new Date(new Date(timestamp).getTime() + 40000).toISOString(),
      type: 'alternative_methods',
    });
  } else if (isSuccess && c.retry_count > 0) {
    messages.push({
      id: `msg-${c.id}-succ`,
      sender: 'paynexa',
      text: `✓ Payment Recovered & Successful\n\nYour payment of ${amountStr} was successfully processed via alternative routing.\n\nTransaction ID: ${txId}\n\nThank you for your payment.`,
      timestamp: c.updated_at || new Date().toISOString(),
      type: 'success_confirmation',
    });
  }

  return messages;
}
