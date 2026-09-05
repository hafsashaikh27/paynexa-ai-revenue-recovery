import { 
  RecoveryCase, 
  ModelPrediction, 
  LLMExplanation, 
  DashboardSummary, 
  Experiment, 
  AuditLog, 
  ChatMessage,
  CustomerRecoveryMessage,
  PaymentMethod,
  FailureReason,
  OfflineVerificationChecklist
} from '../types';
import { INITIAL_CASES, INITIAL_EXPERIMENTS, INITIAL_AUDIT_LOGS } from '../data/seedCases';
import { calculateRevenueMetrics } from '../utils/revenueCalculations';
import { buildInitialCaseMessages, getCustomerFriendlyFailureReason } from '../utils/customerChatUtils';
import { formatINR } from '../utils/formatters';
import { soundService } from './soundService';

class RecoveryService {
  private cases: RecoveryCase[] = [...INITIAL_CASES];
  private experiments: Experiment[] = [...INITIAL_EXPERIMENTS];
  private auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
  private listeners: (() => void)[] = [];

  constructor() {
    // Seed at least one pending offline verification case to demo immediately
    const offlinePendingCase = this.cases.find(c => c.id === 'rc-8942-12' || c.transaction_id === 'PX-8942-12');
    if (offlinePendingCase) {
      offlinePendingCase.offline_verification_status = 'PENDING';
      offlinePendingCase.last_customer_action = 'Customer reports cash payment completed';
      offlinePendingCase.offline_reported_at = new Date(Date.now() - 15 * 60000).toISOString();
      offlinePendingCase.retry_count = 2;
      offlinePendingCase.alternative_methods_offered = true;
      offlinePendingCase.customer_chat_messages = buildInitialCaseMessages(offlinePendingCase);
    } else if (this.cases.length > 5) {
      // Set case 6 as pending offline verification
      const target = this.cases[5];
      target.offline_verification_status = 'PENDING';
      target.last_customer_action = 'Customer reports cash payment completed';
      target.offline_reported_at = new Date(Date.now() - 25 * 60000).toISOString();
      target.retry_count = 2;
      target.alternative_methods_offered = true;
      target.customer_chat_messages = buildInitialCaseMessages(target);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getCases(): RecoveryCase[] {
    return this.cases;
  }

  public getCaseById(id: string): RecoveryCase | undefined {
    if (!id) return undefined;
    const cleanId = id.trim().toLowerCase();
    return this.cases.find((c) => 
      c.id.toLowerCase() === cleanId || 
      c.transaction_id.toLowerCase() === cleanId ||
      c.id.toLowerCase().replace('rc-', 'px-') === cleanId ||
      cleanId.replace('px-', 'rc-') === c.id.toLowerCase() ||
      c.transaction_id.toLowerCase().replace('px-', 'rc-') === cleanId
    );
  }

  public getPendingOfflineVerifications(): RecoveryCase[] {
    return this.cases.filter((c) => c.offline_verification_status === 'PENDING');
  }

  public getCustomerMessages(caseId: string): CustomerRecoveryMessage[] {
    const targetCase = this.getCaseById(caseId);
    if (!targetCase) return [];
    if (!targetCase.customer_chat_messages || targetCase.customer_chat_messages.length === 0) {
      targetCase.customer_chat_messages = buildInitialCaseMessages(targetCase);
    }
    return targetCase.customer_chat_messages;
  }

  public async sendCustomerChatMessage(caseId: string, text: string): Promise<CustomerRecoveryMessage> {
    const targetCase = this.getCaseById(caseId);
    if (!targetCase) throw new Error('Transaction case not found');

    const userMsg: CustomerRecoveryMessage = {
      id: `msg-${Date.now()}-cust`,
      sender: 'customer',
      text,
      timestamp: new Date().toISOString(),
      type: 'customer_response',
    };

    targetCase.customer_chat_messages = [...(targetCase.customer_chat_messages || buildInitialCaseMessages(targetCase)), userMsg];
    targetCase.last_customer_action = `Customer sent message: "${text.slice(0, 35)}..."`;
    targetCase.updated_at = new Date().toISOString();

    soundService.playCustomerCommunication();
    this.notify();

    // AI automated assistant reply
    await new Promise(r => setTimeout(r, 600));
    const lower = text.toLowerCase();
    let replyText = "We're here to assist with your payment. You can retry with your original payment method, choose an alternative like UPI or Card, or select Pay Offline.";
    
    if (lower.includes('why') || lower.includes('failed') || lower.includes('reason')) {
      replyText = `Your payment could not be completed: ${getCustomerFriendlyFailureReason(targetCase.transaction?.failure_reason)}. Your money was not debited by the merchant.`;
    } else if (lower.includes('offline') || lower.includes('cash')) {
      replyText = `You can pay directly to ${targetCase.merchant?.name || 'the merchant'}. Once paid, tap "I've Paid Offline" so the merchant can verify and complete your order.`;
    } else if (lower.includes('receipt') || lower.includes('invoice')) {
      replyText = targetCase.status === 'RESOLVED' 
        ? `Your transaction ${targetCase.transaction_id} for ${formatINR(targetCase.transaction?.amount_minor ?? targetCase.revenue_at_risk_minor)} has been confirmed and settled.`
        : `Your payment is currently pending recovery. A receipt will be issued as soon as the transaction is confirmed.`;
    }

    const assistantMsg: CustomerRecoveryMessage = {
      id: `msg-${Date.now()}-ai`,
      sender: 'paynexa',
      text: replyText,
      timestamp: new Date().toISOString(),
      type: 'status_update',
    };

    targetCase.customer_chat_messages.push(assistantMsg);
    this.notify();

    return assistantMsg;
  }

  /**
   * Customer triggers a payment retry
   */
  public async customerRetryPayment(
    caseId: string, 
    customMethod?: string
  ): Promise<{ success: boolean; message: string; caseItem: RecoveryCase }> {
    const targetCase = this.getCaseById(caseId);
    if (!targetCase) throw new Error('Transaction case not found');

    const previousAttempts = targetCase.retry_count;
    targetCase.retry_count += 1;
    targetCase.updated_at = new Date().toISOString();
    const amountStr = formatINR(targetCase.transaction?.amount_minor ?? targetCase.revenue_at_risk_minor ?? 0);
    const txId = targetCase.transaction_id || targetCase.id.replace('rc-', 'PX-');

    // Add Customer action to chat
    const custRetryMsg: CustomerRecoveryMessage = {
      id: `msg-${Date.now()}-retry-action`,
      sender: 'customer',
      text: customMethod ? `Retrying payment using ${customMethod}...` : `Initiated retry attempt #${targetCase.retry_count}...`,
      timestamp: new Date().toISOString(),
      type: 'customer_response',
    };
    targetCase.customer_chat_messages = [...(targetCase.customer_chat_messages || buildInitialCaseMessages(targetCase)), custRetryMsg];
    this.notify();

    // Audit Log: Customer Retry Requested
    this.addAuditLog({
      case_id: targetCase.id,
      transaction_id: targetCase.transaction_id,
      action_type: 'CUSTOMER_REAUTH',
      actor: 'CUSTOMER',
      summary: `Customer initiated payment retry attempt #${targetCase.retry_count}${customMethod ? ` via ${customMethod}` : ''}.`,
      decision: 'APPROVED',
      details: { attempt: targetCase.retry_count, method: customMethod || targetCase.transaction?.payment_method },
    });

    await new Promise(r => setTimeout(r, 750));

    // Simulation clearance calculation:
    // If retry with recommended alternative rail (e.g. UPI), 85% success.
    // If regular retry, depends on ML prediction or retry count.
    const mlProb = targetCase.predictions?.[0]?.prediction ?? 0.72;
    const isCustomSuccess = customMethod ? true : (Math.random() < (mlProb + (targetCase.retry_count === 1 ? 0.1 : -0.15)));

    if (isCustomSuccess) {
      targetCase.status = 'RESOLVED';
      targetCase.recovered_amount_minor = targetCase.revenue_at_risk_minor;
      if (targetCase.transaction) {
        targetCase.transaction.status = 'SUCCESS';
        if (customMethod) {
          targetCase.transaction.payment_method = (customMethod === 'UPI' ? 'UPI' : customMethod === 'CREDIT_CARD' ? 'CREDIT_CARD' : customMethod === 'NET_BANKING' ? 'NET_BANKING' : 'WALLET') as PaymentMethod;
        }
      }
      targetCase.last_customer_action = 'Payment cleared successfully via customer retry';

      const successMsg: CustomerRecoveryMessage = {
        id: `msg-${Date.now()}-succ`,
        sender: 'paynexa',
        text: `✓ Payment Successful\n\nYour payment of ${amountStr} was successfully processed.\n\nTransaction ID:\n${txId}\n\nPayment Method: ${customMethod || targetCase.transaction?.payment_method || 'Online'}\n\nThank you for your payment.`,
        timestamp: new Date().toISOString(),
        type: 'success_confirmation',
      };
      targetCase.customer_chat_messages.push(successMsg);

      this.addAuditLog({
        case_id: targetCase.id,
        transaction_id: targetCase.transaction_id,
        action_type: 'SMART_RETRY',
        actor: 'SYSTEM',
        summary: `Customer retry succeeded. Recovered ${amountStr} for ${targetCase.merchant?.name}.`,
        decision: 'SUCCESS',
        details: { recovered_amount_inr: targetCase.recovered_amount_minor / 100 },
      });

      soundService.playSuccess();
      this.notify();
      return { success: true, message: `Payment of ${amountStr} completed successfully!`, caseItem: targetCase };
    } else {
      // Unsuccessful attempt
      if (targetCase.retry_count >= 3) {
        targetCase.status = 'ESCALATED';
        targetCase.escalation_reason = 'Retry threshold exhausted without clearance.';
      } else {
        targetCase.status = 'IN_PROGRESS';
      }

      let botReply: CustomerRecoveryMessage;
      if (targetCase.retry_count === 1) {
        botReply = {
          id: `msg-${Date.now()}-fail-1`,
          sender: 'paynexa',
          text: `Payment Unsuccessful Again\n\nWe couldn't complete your payment with the previous method.\n\nYou can try again or choose another available payment method.`,
          timestamp: new Date().toISOString(),
          type: 'retry_prompt',
        };
      } else {
        targetCase.alternative_methods_offered = true;
        botReply = {
          id: `msg-${Date.now()}-fail-multi`,
          sender: 'paynexa',
          text: `We couldn't complete this payment after multiple attempts.\n\nChoose another way to pay:`,
          timestamp: new Date().toISOString(),
          type: 'alternative_methods',
        };
      }

      targetCase.customer_chat_messages.push(botReply);
      targetCase.last_customer_action = `Retry #${targetCase.retry_count} failed`;

      this.addAuditLog({
        case_id: targetCase.id,
        transaction_id: targetCase.transaction_id,
        action_type: 'SMART_RETRY',
        actor: 'SYSTEM',
        summary: `Customer retry attempt #${targetCase.retry_count} declined by payment gateway.`,
        decision: 'DECLINED',
        details: { attempt: targetCase.retry_count },
      });

      soundService.playFailureAlert();
      this.notify();
      return { success: false, message: `Payment retry was unsuccessful. Alternative payment options are now available.`, caseItem: targetCase };
    }
  }

  /**
   * Customer selects an alternative payment method from the list
   */
  public async customerSelectPaymentMethod(caseId: string, method: string): Promise<void> {
    const targetCase = this.getCaseById(caseId);
    if (!targetCase) throw new Error('Transaction case not found');

    if (method === 'OFFLINE') {
      const custMsg: CustomerRecoveryMessage = {
        id: `msg-${Date.now()}-off-req`,
        sender: 'customer',
        text: "I want to Pay Offline / directly with the merchant.",
        timestamp: new Date().toISOString(),
        type: 'customer_response',
      };

      const instrMsg: CustomerRecoveryMessage = {
        id: `msg-${Date.now()}-off-instr`,
        sender: 'paynexa',
        text: `PAY OFFLINE\n\nPlease complete the payment directly with ${targetCase.merchant?.name || 'the merchant'}.\n\nOnce you have paid, the merchant must verify the payment before the transaction is marked as received.\n\nWhen ready, tap "I've Paid Offline" below.`,
        timestamp: new Date().toISOString(),
        type: 'offline_instructions',
      };

      targetCase.customer_chat_messages = [...(targetCase.customer_chat_messages || buildInitialCaseMessages(targetCase)), custMsg, instrMsg];
      targetCase.last_customer_action = 'Customer requested Pay Offline instructions';
      targetCase.updated_at = new Date().toISOString();

      this.addAuditLog({
        case_id: targetCase.id,
        transaction_id: targetCase.transaction_id,
        action_type: 'CUSTOMER_REAUTH',
        actor: 'CUSTOMER',
        summary: `Customer selected 'Pay Offline' option. Offline settlement instructions provided.`,
        decision: 'APPROVED',
      });

      this.notify();
    } else {
      // Digital method chosen: execute direct switch
      await this.customerRetryPayment(caseId, method);
    }
  }

  /**
   * Customer reports they have completed offline payment
   */
  public async customerReportOfflinePayment(caseId: string, notes?: string): Promise<void> {
    const targetCase = this.getCaseById(caseId);
    if (!targetCase) throw new Error('Transaction case not found');

    targetCase.offline_verification_status = 'PENDING';
    targetCase.offline_reported_at = new Date().toISOString();
    targetCase.offline_notes = notes || 'Customer reports cash/direct settlement completed';
    targetCase.last_customer_action = 'Customer reported offline payment completed (Verification Pending)';
    targetCase.updated_at = new Date().toISOString();

    const amountStr = formatINR(targetCase.transaction?.amount_minor ?? targetCase.revenue_at_risk_minor ?? 0);
    const txId = targetCase.transaction_id || targetCase.id.replace('rc-', 'PX-');

    const custMsg: CustomerRecoveryMessage = {
      id: `msg-${Date.now()}-off-done`,
      sender: 'customer',
      text: "I've Paid Offline. I have completed the payment directly with the merchant.",
      timestamp: new Date().toISOString(),
      type: 'customer_response',
    };

    const pendingMsg: CustomerRecoveryMessage = {
      id: `msg-${Date.now()}-off-pending`,
      sender: 'paynexa',
      text: `Offline Payment Verification Pending\n\nWe have notified ${targetCase.merchant?.name || 'the merchant'}. Please allow a moment for the merchant to verify and confirm receipt of your offline payment.\n\nTransaction ID: ${txId}\nAmount: ${amountStr}\nStatus: Verification Pending`,
      timestamp: new Date().toISOString(),
      type: 'offline_pending',
    };

    targetCase.customer_chat_messages = [...(targetCase.customer_chat_messages || buildInitialCaseMessages(targetCase)), custMsg, pendingMsg];

    // Audit Log: Offline payment reported, verification pending
    this.addAuditLog({
      case_id: targetCase.id,
      transaction_id: targetCase.transaction_id,
      action_type: 'CUSTOMER_REAUTH',
      actor: 'CUSTOMER',
      summary: `Customer reported offline payment completed (${amountStr}). Created OFFLINE VERIFICATION PENDING case for merchant review.`,
      decision: 'APPROVED',
      details: { offline_status: 'PENDING', amount: amountStr },
    });

    soundService.playOfflineVerification();
    this.notify();
  }

  /**
   * Updates an individual checklist item for an offline verification case
   */
  public updateOfflineChecklist(
    caseId: string, 
    checklist: Partial<OfflineVerificationChecklist>,
    actor: string = 'MERCHANT_ADMIN'
  ): RecoveryCase {
    const targetCase = this.getCaseById(caseId);
    if (!targetCase) throw new Error('Transaction case not found');

    const currentChecklist: OfflineVerificationChecklist = targetCase.offline_checklist || {
      txIdMatched: false,
      customerMatched: false,
      amountMatched: false,
      originalFailedTxVerified: false,
      offlineMethodVerified: false,
      customerDeclarationReviewed: false,
      paymentEvidenceReviewed: false,
      merchantConfirmedReceived: false,
    };

    targetCase.offline_checklist = {
      ...currentChecklist,
      ...checklist,
    };

    targetCase.offline_verification_status = 'IN_REVIEW';
    targetCase.updated_at = new Date().toISOString();

    // Map item keys to friendly verification titles
    const titleMap: Record<keyof OfflineVerificationChecklist, string> = {
      txIdMatched: 'Transaction ID matches',
      customerMatched: 'Customer details match',
      amountMatched: 'Amount matches',
      originalFailedTxVerified: 'Original failed transaction verified',
      offlineMethodVerified: 'Offline payment method verified',
      customerDeclarationReviewed: 'Customer payment declaration reviewed',
      paymentEvidenceReviewed: 'Payment evidence/details reviewed',
      merchantConfirmedReceived: 'Merchant confirms payment received',
    };

    const historyItems = targetCase.offline_verification_history || [];
    const timestamp = new Date().toISOString();

    // Add entries to history for checked items if not already logged
    (Object.keys(checklist) as Array<keyof OfflineVerificationChecklist>).forEach((k) => {
      const isChecked = checklist[k];
      const title = titleMap[k] || String(k);
      if (isChecked) {
        historyItems.push({
          step: 2,
          step_title: `${title} Verified`,
          status: 'COMPLETED',
          timestamp,
          actor,
          notes: `Checklist item validated: ${title}`,
        });
      }
    });

    targetCase.offline_verification_history = historyItems;
    soundService.playOfflineVerification();
    this.notify();
    return targetCase;
  }

  /**
   * Merchant confirms receipt of offline payment
   */
  public async merchantConfirmOfflinePayment(caseId: string, notes?: string): Promise<{ success: boolean; message: string }> {
    const targetCase = this.getCaseById(caseId);
    if (!targetCase) throw new Error('Transaction case not found');

    targetCase.offline_verification_status = 'CONFIRMED';
    targetCase.status = 'RESOLVED';
    targetCase.recovered_amount_minor = targetCase.revenue_at_risk_minor;
    if (targetCase.transaction) {
      targetCase.transaction.status = 'SUCCESS';
    }
    targetCase.last_customer_action = 'Merchant verified and confirmed offline payment';
    targetCase.offline_completed_at = new Date().toISOString();
    targetCase.updated_at = new Date().toISOString();

    // Mark all checklist items as verified
    targetCase.offline_checklist = {
      txIdMatched: true,
      customerMatched: true,
      amountMatched: true,
      originalFailedTxVerified: true,
      offlineMethodVerified: true,
      customerDeclarationReviewed: true,
      paymentEvidenceReviewed: true,
      merchantConfirmedReceived: true,
    };

    const amountStr = formatINR(targetCase.recovered_amount_minor || targetCase.transaction?.amount_minor || 0);
    const txId = targetCase.transaction_id || targetCase.id.replace('rc-', 'PX-');
    const nowIso = new Date().toISOString();

    // Update comprehensive verification history
    targetCase.offline_verification_history = [
      ...(targetCase.offline_verification_history || []),
      {
        step: 1,
        step_title: 'Transaction Details Verified',
        status: 'COMPLETED',
        timestamp: nowIso,
        actor: 'MERCHANT_ADMIN',
        notes: `Validated transaction ${txId} for ${amountStr}.`,
      },
      {
        step: 1,
        step_title: 'Customer Details Verified',
        status: 'COMPLETED',
        timestamp: nowIso,
        actor: 'MERCHANT_ADMIN',
        notes: `Validated customer identity for ${targetCase.customer?.email || 'customer'}.`,
      },
      {
        step: 1,
        step_title: 'Amount Verified',
        status: 'COMPLETED',
        timestamp: nowIso,
        actor: 'MERCHANT_ADMIN',
        notes: `Confirmed exact settlement amount ${amountStr}.`,
      },
      {
        step: 2,
        step_title: 'Payment Details Verified',
        status: 'COMPLETED',
        timestamp: nowIso,
        actor: 'MERCHANT_ADMIN',
        notes: 'Offline payment rail and declaration verified.',
      },
      {
        step: 2,
        step_title: 'Evidence Reviewed',
        status: 'COMPLETED',
        timestamp: nowIso,
        actor: 'MERCHANT_ADMIN',
        notes: notes || 'Counter receipt and bank register audit completed.',
      },
      {
        step: 3,
        step_title: 'Merchant Confirmation',
        status: 'COMPLETED',
        timestamp: nowIso,
        actor: 'MERCHANT_ADMIN',
        notes: 'Merchant confirmed payment received and authorized ledger credit.',
      },
      {
        step: 3,
        step_title: 'PAYMENT VERIFIED',
        status: 'COMPLETED',
        timestamp: nowIso,
        actor: 'SYSTEM',
        notes: `Revenue of ${amountStr} recovered and transaction status updated to RESOLVED.`,
      },
    ];

    const confirmMsg: CustomerRecoveryMessage = {
      id: `msg-${Date.now()}-merch-confirm`,
      sender: 'paynexa',
      text: `Your offline payment of ${amountStr} has been verified by the merchant.\n\nTransaction ID: ${txId}\nStatus: PAYMENT VERIFIED / RECOVERED`,
      timestamp: nowIso,
      type: 'success_confirmation',
    };

    targetCase.customer_chat_messages = [...(targetCase.customer_chat_messages || buildInitialCaseMessages(targetCase)), confirmMsg];

    // Audit Log: Merchant confirmed offline payment
    this.addAuditLog({
      case_id: targetCase.id,
      transaction_id: targetCase.transaction_id,
      action_type: 'OFFLINE_VERIFICATION_CONFIRMED' as any,
      actor: 'MERCHANT_ADMIN',
      summary: `PAYMENT VERIFIED: Merchant confirmed receipt of ${amountStr} offline payment for ${txId}. Status changed to PAYMENT VERIFIED / RECOVERED.`,
      decision: 'SUCCESS',
      details: {
        action: 'OFFLINE_VERIFICATION_CONFIRMED',
        recovered_minor: targetCase.recovered_amount_minor,
        amount: amountStr,
        notes: notes || 'Confirmed by merchant reviewer after completing all 8 checklist steps.',
      },
    });

    this.addAuditLog({
      case_id: targetCase.id,
      transaction_id: targetCase.transaction_id,
      action_type: 'PAYMENT_CONFIRMED' as any,
      actor: 'SYSTEM',
      summary: `PAYMENT_CONFIRMED: Dual-verified offline payment confirmed for transaction ${txId}.`,
      decision: 'SUCCESS',
      details: { recovered_minor: targetCase.recovered_amount_minor },
    });

    this.addAuditLog({
      case_id: targetCase.id,
      transaction_id: targetCase.transaction_id,
      action_type: 'REVENUE_RECOVERED' as any,
      actor: 'SYSTEM',
      summary: `REVENUE_RECOVERED: ₹${((targetCase.recovered_amount_minor || 0) / 100).toLocaleString('en-IN')} added to recovered revenue metrics.`,
      decision: 'SUCCESS',
      details: { recovered_minor: targetCase.recovered_amount_minor },
    });

    soundService.playSuccess();
    this.notify();
    return {
      success: true,
      message: `Offline payment of ${amountStr} verified and confirmed for ${targetCase.customer?.email}. Transaction is now RECOVERED.`,
    };
  }

  /**
   * Merchant rejects offline payment (payment not received)
   */
  public async merchantRejectOfflinePayment(
    caseId: string, 
    reason: string = 'Payment not received',
    customNotes?: string
  ): Promise<{ success: boolean; message: string }> {
    const targetCase = this.getCaseById(caseId);
    if (!targetCase) throw new Error('Transaction case not found');

    targetCase.offline_verification_status = 'REJECTED';
    targetCase.status = 'FAILED';
    targetCase.recovered_amount_minor = 0;
    if (targetCase.transaction) {
      targetCase.transaction.status = 'FAILED';
    }
    targetCase.last_customer_action = `Merchant rejected offline verification: ${reason}`;
    targetCase.updated_at = new Date().toISOString();

    const amountStr = formatINR(targetCase.transaction?.amount_minor ?? targetCase.revenue_at_risk_minor ?? 0);
    const txId = targetCase.transaction_id || targetCase.id.replace('rc-', 'PX-');
    const nowIso = new Date().toISOString();

    targetCase.offline_verification_history = [
      ...(targetCase.offline_verification_history || []),
      {
        step: 3,
        step_title: 'Verification Rejected',
        status: 'REJECTED',
        timestamp: nowIso,
        actor: 'MERCHANT_ADMIN',
        notes: `Merchant rejected offline payment verification: ${reason}. ${customNotes || ''}`.trim(),
      },
      {
        step: 3,
        step_title: 'PAYMENT NOT VERIFIED',
        status: 'REJECTED',
        timestamp: nowIso,
        actor: 'SYSTEM',
        notes: 'Status updated to PAYMENT NOT VERIFIED. Revenue remains at risk.',
      },
    ];

    const rejectMsg: CustomerRecoveryMessage = {
      id: `msg-${Date.now()}-merch-reject`,
      sender: 'paynexa',
      text: `We could not verify your offline payment of ${amountStr} with the merchant.\n\nReason: ${reason}\n\nPlease contact the merchant directly or select an alternate payment method (UPI / Card / NetBanking) to complete your order.`,
      timestamp: nowIso,
      type: 'rejection_notice',
    };

    targetCase.customer_chat_messages = [...(targetCase.customer_chat_messages || buildInitialCaseMessages(targetCase)), rejectMsg];

    // Audit Log: Merchant rejected offline payment
    this.addAuditLog({
      case_id: targetCase.id,
      transaction_id: targetCase.transaction_id,
      action_type: 'OFFLINE_VERIFICATION_REJECTED' as any,
      actor: 'MERCHANT_ADMIN',
      summary: `PAYMENT_NOT_VERIFIED: Merchant rejected offline verification for ${txId}. Reason: ${reason}.`,
      decision: 'DECLINED',
      details: {
        action: 'OFFLINE_VERIFICATION_REJECTED',
        reason,
        customNotes,
      },
    });

    this.addAuditLog({
      case_id: targetCase.id,
      transaction_id: targetCase.transaction_id,
      action_type: 'PAYMENT_NOT_VERIFIED' as any,
      actor: 'SYSTEM',
      summary: `PAYMENT_NOT_VERIFIED: Offline payment rejected for ${txId}. Recovered revenue unchanged.`,
      decision: 'DECLINED',
      details: { reason },
    });

    this.notify();
    return {
      success: true,
      message: `Offline verification rejected (${reason}). Transaction remains unresolved without increasing recovered revenue.`,
    };
  }

  public getExperiments(): Experiment[] {
    return this.experiments;
  }

  public getAuditLogs(): AuditLog[] {
    return this.auditLogs;
  }

  public getSummary(): DashboardSummary {
    const metrics = calculateRevenueMetrics(this.cases);
    const total_cases = this.cases.length;

    const high_risk_cases = this.cases.filter((c) => ['CRITICAL', 'HIGH'].includes(c.priority)).length;

    let probSum = 0;
    let probCount = 0;
    let explanations_generated = 0;

    this.cases.forEach((c) => {
      if (c.predictions && c.predictions.length > 0) {
        probSum += c.predictions[0].prediction;
        probCount++;
      }
      if (c.explanations && c.explanations.length > 0) {
        explanations_generated += c.explanations.length;
      }
    });

    const average_recovery_probability = probCount > 0 ? probSum / probCount : 0.748;

    return {
      total_cases,
      total_transactions: metrics.total_transactions_count,
      successful_transactions: metrics.successful_transactions_count,
      unsuccessful_transactions: metrics.unsuccessful_transactions_count,
      total_transaction_value_minor: metrics.total_transaction_value_minor,
      total_transaction_value_inr: metrics.total_transaction_value_inr,
      initial_revenue_at_risk_minor: metrics.initial_revenue_at_risk_minor,
      initial_revenue_at_risk_inr: metrics.initial_revenue_at_risk_inr,
      recovered_revenue_minor: metrics.recovered_revenue_minor,
      recovered_revenue_inr: metrics.recovered_revenue_inr,
      current_revenue_at_risk_minor: metrics.current_revenue_at_risk_minor,
      current_revenue_at_risk_inr: metrics.current_revenue_at_risk_inr,
      blended_recovery_rate: metrics.recovery_rate,
      recovery_rate: metrics.recovery_rate,
      average_recovery_probability: Math.round(average_recovery_probability * 1000) / 1000,
      high_risk_cases,
      explanations_generated,
      revenue_at_risk_minor: metrics.current_revenue_at_risk_minor,
      revenue_at_risk_inr: metrics.current_revenue_at_risk_inr,
      before_revenue_at_risk_minor: metrics.initial_revenue_at_risk_minor,
      revenue_risk_reduction_minor: metrics.risk_reduction_minor,
      revenue_risk_reduction_pct: metrics.recovery_rate,
    };
  }

  public async runPrediction(caseId: string): Promise<ModelPrediction> {
    await new Promise((res) => setTimeout(res, 350));

    const targetCase = this.cases.find((c) => c.id === caseId);
    if (!targetCase) {
      throw new Error('Case not found');
    }

    const tx = targetCase.transaction;
    const cust = targetCase.customer;

    // Heuristic ML scoring calculation
    let baseScore = 0.65;

    if (tx?.failure_reason === 'NETWORK_TIMEOUT') baseScore += 0.25;
    else if (tx?.failure_reason === 'INSUFFICIENT_FUNDS') baseScore += 0.05;
    else if (tx?.failure_reason === 'BANK_ERROR') baseScore += 0.20;
    else if (tx?.failure_reason === 'AUTH_FAILED') baseScore += 0.12;
    else if (tx?.failure_reason === 'CARD_DECLINED') baseScore -= 0.35;
    else if (tx?.failure_reason === 'FRAUD_REVIEW') baseScore -= 0.55;

    if (cust && cust.successful_payments_count > 5) baseScore += 0.15;
    if (cust && cust.has_opted_out) baseScore -= 0.40;
    if (targetCase.retry_count > 2) baseScore -= 0.25;
    if (tx?.is_subscription) baseScore += 0.08;

    const finalPrediction = Math.min(Math.max(baseScore + (Math.random() * 0.04 - 0.02), 0.05), 0.98);

    const predictionObj: ModelPrediction = {
      id: `pred-${Date.now()}`,
      recovery_case_id: caseId,
      model_name: 'recovery_probability_model',
      model_version: '1.0.0',
      feature_version: '1.0.0',
      prediction: Math.round(finalPrediction * 1000) / 1000,
      feature_importance: {
        failure_reason: {
          impact: tx?.failure_reason === 'CARD_DECLINED' || tx?.failure_reason === 'FRAUD_REVIEW' ? 'NEGATIVE' : 'POSITIVE',
          weight: 0.38,
          description: `Diagnosed ${tx?.failure_reason ?? 'gateway response'} telemetry.`,
        },
        customer_payment_history: {
          impact: (cust?.successful_payments_count ?? 0) > 2 ? 'POSITIVE' : 'NEUTRAL',
          weight: 0.28,
          description: `${cust?.successful_payments_count ?? 0} successful lifetime authorizations.`,
        },
        retry_fatigue: {
          impact: targetCase.retry_count > 1 ? 'NEGATIVE' : 'POSITIVE',
          weight: 0.18,
          description: `${targetCase.retry_count} prior recovery attempts on record.`,
        },
      },
      inference_latency_ms: Math.round((3.2 + Math.random() * 2.8) * 10) / 10,
      prediction_timestamp: new Date().toISOString(),
    };

    targetCase.predictions = [predictionObj, ...(targetCase.predictions || [])];
    targetCase.updated_at = new Date().toISOString();

    this.addAuditLog({
      case_id: caseId,
      transaction_id: targetCase.transaction_id,
      action_type: 'ANALYSIS',
      actor: 'AI_AGENT',
      summary: `ML inference completed: ${(predictionObj.prediction * 100).toFixed(1)}% recovery likelihood.`,
      decision: 'APPROVED',
      details: { prediction: predictionObj.prediction, latency_ms: predictionObj.inference_latency_ms },
    });

    this.notify();
    return predictionObj;
  }

  public async generateExplanation(caseId: string): Promise<LLMExplanation> {
    const targetCase = this.cases.find((c) => c.id === caseId);
    if (!targetCase) {
      throw new Error('Case not found');
    }

    try {
      const response = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseData: targetCase }),
      });
      if (response.ok) {
        const data = await response.json();
        const exp: LLMExplanation = {
          id: `exp-${Date.now()}`,
          recovery_case_id: caseId,
          model_prediction_id: targetCase.predictions?.[0]?.id,
          summary: data.summary || 'AI diagnostic completed successfully.',
          risk_level: data.risk_level || 'LOW',
          recovery_likelihood: data.recovery_likelihood || 'HIGH',
          key_factors: data.key_factors || [],
          recommended_next_step: data.recommended_next_step || 'Initiate smart retry.',
          confidence: data.confidence || 0.92,
          model_version: '1.0.0',
          feature_version: '1.0.0',
          created_at: new Date().toISOString(),
        };

        targetCase.explanations = [exp, ...(targetCase.explanations || [])];
        targetCase.updated_at = new Date().toISOString();

        this.addAuditLog({
          case_id: caseId,
          transaction_id: targetCase.transaction_id,
          action_type: 'AI_DIAGNOSIS',
          actor: 'AI_AGENT',
          summary: `Gemini 3.7 Flash: ${exp.summary}`,
          decision: 'APPROVED',
          details: { risk_level: exp.risk_level, confidence: exp.confidence },
        });

        this.notify();
        return exp;
      }
    } catch {
      // Fallback if fetch fails
    }

    await new Promise((res) => setTimeout(res, 400));
    const latestPred = targetCase.predictions?.[0]?.prediction ?? 0.75;
    const isHigh = latestPred >= 0.75;
    const isMed = latestPred >= 0.45 && latestPred < 0.75;

    const likelihood = isHigh ? 'HIGH' : isMed ? 'MEDIUM' : 'LOW';
    const riskLevel = isHigh ? 'LOW' : isMed ? 'MEDIUM' : 'HIGH';
    const tx = targetCase.transaction;
    const cust = targetCase.customer;

    let summaryText = '';
    let recommendation = '';

    if (isHigh) {
      summaryText = `High recovery likelihood (${(latestPred * 100).toFixed(1)}%). The failure is transient (${tx?.failure_reason || 'Gateway Error'}) with a reliable customer history (${cust?.successful_payments_count || 1} past clearances).`;
      recommendation = 'Initiate immediate automated background retry with secondary gateway routing.';
    } else if (isMed) {
      summaryText = `Moderate recovery probability (${(latestPred * 100).toFixed(1)}%). Action requires friction-free customer notification with fallback payment routes.`;
      recommendation = 'Dispatch omni-channel smart checkout link via WhatsApp & SMS with 48-hour invoice hold.';
    } else {
      summaryText = `Low recovery probability (${(latestPred * 100).toFixed(1)}%). Transaction blocked by ${tx?.failure_reason || 'Issuer Decline'} and high retry saturation.`;
      recommendation = 'Escalate to merchant success desk for account review; halt automated retries.';
    }

    const fallbackExp: LLMExplanation = {
      id: `exp-${Date.now()}`,
      recovery_case_id: caseId,
      model_prediction_id: targetCase.predictions?.[0]?.id,
      summary: summaryText,
      risk_level: riskLevel,
      recovery_likelihood: likelihood,
      key_factors: [
        {
          feature: 'Failure Signature',
          impact: isHigh ? 'POSITIVE' : 'NEGATIVE',
          explanation: `Failure code '${tx?.failure_reason}' evaluated against merchant gateway baseline.`,
        },
        {
          feature: 'Historical Loyalty',
          impact: (cust?.successful_payments_count ?? 0) > 2 ? 'POSITIVE' : 'NEUTRAL',
          explanation: `Customer account age and settlement track record across ${cust?.successful_payments_count ?? 0} previous transactions.`,
        },
      ],
      recommended_next_step: recommendation,
      confidence: 0.94,
      model_version: '1.0.0',
      feature_version: '1.0.0',
      created_at: new Date().toISOString(),
    };

    targetCase.explanations = [fallbackExp, ...(targetCase.explanations || [])];
    targetCase.updated_at = new Date().toISOString();

    this.addAuditLog({
      case_id: caseId,
      transaction_id: targetCase.transaction_id,
      action_type: 'AI_DIAGNOSIS',
      actor: 'AI_AGENT',
      summary: `Gemini 3.7 Flash: ${fallbackExp.summary}`,
      decision: 'APPROVED',
      details: { risk_level: fallbackExp.risk_level, confidence: fallbackExp.confidence },
    });

    this.notify();
    return fallbackExp;
  }

  public async executeRecoveryAction(
    caseId: string, 
    actionType: 'SMART_RETRY' | 'ALTERNATE_ROUTE' | 'CUSTOMER_REAUTH' | 'ESCALATION' | 'NO_ACTION'
  ): Promise<{ success: boolean; message: string; policyApproved: boolean }> {
    const targetCase = this.cases.find((c) => c.id === caseId);
    if (!targetCase) {
      throw new Error('Case not found');
    }

    // Deterministic Policy Engine Guardrails
    if (targetCase.customer?.has_opted_out) {
      this.addAuditLog({
        case_id: caseId,
        transaction_id: targetCase.transaction_id,
        action_type: 'POLICY_VALIDATION',
        actor: 'POLICY_ENGINE',
        summary: `Action ${actionType} BLOCKED: Customer has explicitly opted out of dunning.`,
        decision: 'BLOCKED',
        details: { opt_out: true },
      });
      soundService.playWarning();
      return {
        success: false,
        policyApproved: false,
        message: 'Policy Guardrail Violation: Customer has opted out of automated recovery contacts.',
      };
    }

    if (actionType === 'SMART_RETRY' && targetCase.retry_count >= 3) {
      this.addAuditLog({
        case_id: caseId,
        transaction_id: targetCase.transaction_id,
        action_type: 'POLICY_VALIDATION',
        actor: 'POLICY_ENGINE',
        summary: `Action SMART_RETRY BLOCKED: Maximum retry ceiling (3) reached.`,
        decision: 'BLOCKED',
        details: { retry_count: targetCase.retry_count, max: 3 },
      });
      soundService.playWarning();
      return {
        success: false,
        policyApproved: false,
        message: 'Policy Guardrail: Maximum retry limit (3 attempts) reached. Escalation required.',
      };
    }

    if (targetCase.transaction?.failure_reason === 'FRAUD_REVIEW' && actionType === 'SMART_RETRY') {
      this.addAuditLog({
        case_id: caseId,
        transaction_id: targetCase.transaction_id,
        action_type: 'POLICY_VALIDATION',
        actor: 'POLICY_ENGINE',
        summary: `Action SMART_RETRY BLOCKED: Fraud risk flag prevents automated charge attempt.`,
        decision: 'BLOCKED',
        details: { failure_reason: 'FRAUD_REVIEW' },
      });
      soundService.playHighRiskAlert();
      return {
        success: false,
        policyApproved: false,
        message: 'Policy Guardrail: Transaction flagged for fraud review. Automated retry prohibited.',
      };
    }

    // Policy Approved - Execute Simulated Action
    this.addAuditLog({
      case_id: caseId,
      transaction_id: targetCase.transaction_id,
      action_type: 'POLICY_VALIDATION',
      actor: 'POLICY_ENGINE',
      summary: `Policy validated action '${actionType}' under Rule POL-REV-v1.0.`,
      decision: 'APPROVED',
      details: { action: actionType, policy_version: '1.0.0' },
    });

    await new Promise((res) => setTimeout(res, 650));

    if (actionType === 'SMART_RETRY' || actionType === 'ALTERNATE_ROUTE') {
      targetCase.retry_count += 1;
      const pred = targetCase.predictions?.[0]?.prediction ?? 0.72;
      const boost = actionType === 'ALTERNATE_ROUTE' ? 0.15 : 0;
      const isSuccess = Math.random() < (pred + boost);

      if (isSuccess) {
        targetCase.status = 'RESOLVED';
        targetCase.recovered_amount_minor = targetCase.revenue_at_risk_minor;
        targetCase.updated_at = new Date().toISOString();

        this.addAuditLog({
          case_id: caseId,
          transaction_id: targetCase.transaction_id,
          action_type: actionType,
          actor: 'SYSTEM',
          summary: `Simulated ${actionType === 'ALTERNATE_ROUTE' ? 'secondary gateway failover' : 'smart retry'} succeeded. Recovered ₹${(targetCase.recovered_amount_minor / 100).toLocaleString('en-IN')}.`,
          decision: 'SUCCESS',
          details: { recovered_inr: targetCase.recovered_amount_minor / 100 },
        });

        soundService.playSuccess();
        this.notify();
        return {
          success: true,
          policyApproved: true,
          message: `Simulated recovery successful! ₹${(targetCase.recovered_amount_minor / 100).toLocaleString('en-IN')} recovered via ${actionType === 'ALTERNATE_ROUTE' ? 'secondary acquiring route' : 'smart retry'}.`,
        };
      } else {
        if (targetCase.retry_count >= 3) {
          targetCase.status = 'ESCALATED';
          targetCase.escalation_reason = 'Retry threshold exhausted without clearance.';
        } else {
          targetCase.status = 'IN_PROGRESS';
        }
        targetCase.updated_at = new Date().toISOString();

        this.addAuditLog({
          case_id: caseId,
          transaction_id: targetCase.transaction_id,
          action_type: actionType,
          actor: 'SYSTEM',
          summary: `Simulated ${actionType} attempt declined by issuer.`,
          decision: 'DECLINED',
          details: { retry_count: targetCase.retry_count },
        });

        soundService.playFailureAlert();
        this.notify();
        return {
          success: false,
          policyApproved: true,
          message: `Simulated gateway attempt declined by issuer. Case moved to ${targetCase.status}.`,
        };
      }
    } else if (actionType === 'CUSTOMER_REAUTH') {
      targetCase.contact_count += 1;
      targetCase.status = 'IN_PROGRESS';
      targetCase.updated_at = new Date().toISOString();

      this.addAuditLog({
        case_id: caseId,
        transaction_id: targetCase.transaction_id,
        action_type: 'CUSTOMER_REAUTH',
        actor: 'AI_AGENT',
        summary: `Dispatched WhatsApp & SMS 1-click re-authentication link to ${targetCase.customer?.email}.`,
        decision: 'SUCCESS',
        details: { channel: 'WHATSAPP_SMS_UPI' },
      });

      soundService.playCustomerCommunication();
      this.notify();
      return {
        success: true,
        policyApproved: true,
        message: `1-Click re-authentication link dispatched via WhatsApp & SMS. Customer invoice placed in 48-hour grace period.`,
      };
    } else if (actionType === 'ESCALATION') {
      targetCase.status = 'ESCALATED';
      targetCase.escalation_reason = 'Manual operator escalation requested from Control Center.';
      targetCase.updated_at = new Date().toISOString();

      this.addAuditLog({
        case_id: caseId,
        transaction_id: targetCase.transaction_id,
        action_type: 'ESCALATION',
        actor: 'MERCHANT_ADMIN',
        summary: `Case manually escalated to senior operations team.`,
        decision: 'FLAGGED',
      });

      soundService.playHighRiskAlert();
      this.notify();
      return {
        success: true,
        policyApproved: true,
        message: `Case successfully escalated to Merchant Support & Account Ops.`,
      };
    } else {
      // NO_ACTION
      targetCase.status = 'FAILED';
      targetCase.updated_at = new Date().toISOString();

      this.addAuditLog({
        case_id: caseId,
        transaction_id: targetCase.transaction_id,
        action_type: 'STATUS_CHANGE',
        actor: 'MERCHANT_ADMIN',
        summary: `Case suppressed / marked as no-action to prevent churn or excessive dunning.`,
        decision: 'APPROVED',
      });

      this.notify();
      return {
        success: true,
        policyApproved: true,
        message: `Case suppressed. Automated recovery halted.`,
      };
    }
  }

  public async askAIAssistant(prompt: string, context?: any): Promise<{ text: string; suggestedActions: string[] }> {
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, context: context || { summary: this.getSummary(), casesCount: this.cases.length } }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          text: data.text,
          suggestedActions: data.suggestedActions || [],
        };
      }
    } catch {
      // Fallback
    }

    // Client-side fallback if server endpoint is unreachable
    const query = prompt.toLowerCase();
    if (query.includes('prioritize') || query.includes('priority')) {
      return {
        text: `**Priority Recovery Queue Analysis:**\n\n1. **Case rc-8942-01 (CloudScale SaaS - ₹48,900)**: Transient \`NETWORK_TIMEOUT\`. High ML recovery score (91.2%).\n2. **Case rc-8942-04 (Bharat Logistics - ₹1,25,000)**: B2B NetBanking gateway drop. High LTV client.\n3. **Case rc-8942-02 (Aura Fashion - ₹12,500)**: Mobile UPI insufficient funds. High repeat buyer.\n\n*Combined addressable recovery*: **₹1,86,400**.`,
        suggestedActions: ['Run Smart Retry on Top 3', 'Export Dunning Queue', 'View Risk Cohorts'],
      };
    } else if (query.includes('loss') || query.includes('causing')) {
      return {
        text: `**Revenue Loss Diagnostics:**\n\n- **Gateway Outages & Network Drops**: 46.8% (₹1,73,900)\n- **UPI & 3DS Auth Drops**: 31.2% (₹1,15,800)\n- **Insufficient Balance / Soft Declines**: 16.5% (₹61,200)\n- **Hard Card Declines**: 5.5% (₹20,400)\n\n*Recommendation*: Activate Dynamic UPI Routing and 1-Click WhatsApp Dunning to reduce drop-offs by up to 28%.`,
        suggestedActions: ['Inspect Gateway Telemetry', 'Configure WhatsApp 1-Click', 'View Failure Reasons'],
      };
    } else {
      return {
        text: `**PayNexa Copilot Intelligence:**\n\nActive monitoring of all merchant recovery streams indicates a **76.4%** average recovery probability across **₹3,71,399** at-risk volume.\n\nKey Recommendations:\n- Trigger automated retries for transient gateway drops.\n- Send 1-click UPI links for session timeouts.\n- Escalate repeat decline cases to operations desk.`,
        suggestedActions: ['Which transactions should I prioritize?', 'What is causing the most revenue loss?', 'Summarize today\'s recovery performance'],
      };
    }
  }

  private simulationScenarioIndex = 0;

  public async generateOneClickSimulatedEvent(): Promise<{
    caseItem: RecoveryCase;
    scenarioTitle: string;
    amountFormatted: string;
    paymentRail: string;
    failureReasonFormatted: string;
    outcomeSummary: string;
  }> {
    const merchants = [
      { id: 'm-1', name: 'CloudScale SaaS', code: 'CLOUD_SAAS', category: 'SaaS' as const },
      { id: 'm-2', name: 'Aura Fashion & Apparel', code: 'AURA_FASHION', category: 'E-commerce' as const },
      { id: 'm-3', name: 'QuickCart Retail', code: 'QUICK_CART', category: 'Retail' as const },
      { id: 'm-4', name: 'Bharat Logistics B2B', code: 'BHARAT_LOG', category: 'Services' as const },
    ];

    const scenarioPresets = [
      {
        title: '₹48,900 Credit Card • Network Timeout',
        amountMinor: 4890000,
        merchant: merchants[0],
        customerName: 'Rohan Mehta',
        customerEmail: 'rohan.mehta@enterprise-scale.io',
        customerLTV: 24500000,
        successfulPayments: 12,
        failedPayments: 1,
        optedOut: false,
        paymentMethod: 'CREDIT_CARD' as const,
        failureReason: 'NETWORK_TIMEOUT' as const,
        failureLabel: 'UPI / Card Gateway Network Timeout',
        retryCount: 0,
        priority: 'CRITICAL' as const,
        mlScore: 0.912,
        recommendedAction: 'SMART_RETRY' as const,
        recommendedText: 'Initiate automated background retry with secondary gateway routing.',
        policyBlocked: false,
        policyRule: 'POL-REV-01',
        policyOutcomeText: 'Policy Guardrails Passed (Rule POL-REV-01: Idempotency & Gateway Health Verified).',
        actionSuccess: true,
        actionResultText: 'Simulated smart retry successful via secondary HDFC gateway switch. Recovered ₹48,900.',
        finalStatus: 'RESOLVED' as const,
      },
      {
        title: '₹85,000 Credit Card • 3DS / OTP Drop',
        amountMinor: 8500000,
        merchant: merchants[1],
        customerName: 'Priya Sharma',
        customerEmail: 'priya.sharma@luxuryreach.in',
        customerLTV: 38000000,
        successfulPayments: 9,
        failedPayments: 0,
        optedOut: false,
        paymentMethod: 'CREDIT_CARD' as const,
        failureReason: 'AUTH_FAILED' as const,
        failureLabel: '3DS / Bank OTP Session Expired',
        retryCount: 0,
        priority: 'CRITICAL' as const,
        mlScore: 0.845,
        recommendedAction: 'ALTERNATE_ROUTE' as const,
        recommendedText: 'Route through high-ticket VIP acquiring rail with automated SMS re-authentication.',
        policyBlocked: false,
        policyRule: 'POL-REV-04',
        policyOutcomeText: 'Policy Guardrails Passed (Rule POL-REV-04: High-Value VIP Acquirer Failover).',
        actionSuccess: true,
        actionResultText: 'Simulated VIP failover clearance succeeded. Recovered ₹85,000.',
        finalStatus: 'RESOLVED' as const,
      },
      {
        title: '₹12,500 UPI • Insufficient Balance',
        amountMinor: 1250000,
        merchant: merchants[2],
        customerName: 'Amitav Ghosh',
        customerEmail: 'amitav.ghosh@gmail.com',
        customerLTV: 6800000,
        successfulPayments: 5,
        failedPayments: 2,
        optedOut: false,
        paymentMethod: 'UPI' as const,
        failureReason: 'INSUFFICIENT_FUNDS' as const,
        failureLabel: 'UPI Insufficient Funds (Soft Decline)',
        retryCount: 1,
        priority: 'HIGH' as const,
        mlScore: 0.684,
        recommendedAction: 'CUSTOMER_REAUTH' as const,
        recommendedText: 'Dispatch 1-click WhatsApp payment checkout link with 48h invoice grace hold.',
        policyBlocked: false,
        policyRule: 'POL-REV-02',
        policyOutcomeText: 'Policy Guardrails Passed (Rule POL-REV-02: Dunning Frequency Cap: 1/3).',
        actionSuccess: true,
        actionResultText: 'WhatsApp 1-click link dispatched. Customer placed in 48-hour payment hold.',
        finalStatus: 'IN_PROGRESS' as const,
      },
      {
        title: '₹24,500 Credit Card • Max Retries Exceeded',
        amountMinor: 2450000,
        merchant: merchants[0],
        customerName: 'Sneha Kapoor',
        customerEmail: 'sneha.k@finserve.net',
        customerLTV: 11200000,
        successfulPayments: 3,
        failedPayments: 4,
        optedOut: false,
        paymentMethod: 'CREDIT_CARD' as const,
        failureReason: 'CARD_DECLINED' as const,
        failureLabel: 'Card Issuer Do Not Honor (Hard Decline)',
        retryCount: 3,
        priority: 'CRITICAL' as const,
        mlScore: 0.285,
        recommendedAction: 'SMART_RETRY' as const,
        recommendedText: 'Escalate to merchant success desk for account review; halt automated retries.',
        policyBlocked: true,
        policyRule: 'POL-REV-03',
        policyOutcomeText: 'Policy Guardrail BLOCKED: Maximum retry threshold (3 attempts) exhausted.',
        actionSuccess: false,
        actionResultText: 'Automated retry prohibited by policy engine. Escalated to human operations desk.',
        finalStatus: 'ESCALATED' as const,
      },
      {
        title: '₹18,500 UPI • Customer DND Opt-Out',
        amountMinor: 1850000,
        merchant: merchants[1],
        customerName: 'Vikram Rao',
        customerEmail: 'vikram.rao@techcorp.in',
        customerLTV: 14500000,
        successfulPayments: 7,
        failedPayments: 1,
        optedOut: true,
        paymentMethod: 'UPI' as const,
        failureReason: 'INSUFFICIENT_FUNDS' as const,
        failureLabel: 'Insufficient Funds / Account Limit',
        retryCount: 1,
        priority: 'MEDIUM' as const,
        mlScore: 0.412,
        recommendedAction: 'CUSTOMER_REAUTH' as const,
        recommendedText: 'Halt automated contact; customer is enrolled in DND privacy opt-out.',
        policyBlocked: true,
        policyRule: 'POL-REV-02',
        policyOutcomeText: 'Policy Guardrail BLOCKED: Customer has active DND opt-out flag.',
        actionSuccess: false,
        actionResultText: 'Outbound dunning suppressed per customer privacy preference.',
        finalStatus: 'FAILED' as const,
      },
      {
        title: '₹1,25,000 Net Banking • Bank Gateway Outage',
        amountMinor: 12500000,
        merchant: merchants[3],
        customerName: 'Rahul Verma',
        customerEmail: 'rahul.verma@bharatlogistics.com',
        customerLTV: 95000000,
        successfulPayments: 24,
        failedPayments: 1,
        optedOut: false,
        paymentMethod: 'NET_BANKING' as const,
        failureReason: 'BANK_ERROR' as const,
        failureLabel: 'Acquiring Bank Host Down (Transient Outage)',
        retryCount: 0,
        priority: 'CRITICAL' as const,
        mlScore: 0.892,
        recommendedAction: 'ALTERNATE_ROUTE' as const,
        recommendedText: 'Switch instantly to ICICI/Axis corporate alternate gateway rail.',
        policyBlocked: false,
        policyRule: 'POL-REV-04',
        policyOutcomeText: 'Policy Guardrails Passed (Rule POL-REV-04: Multi-Acquirer Direct Failover).',
        actionSuccess: true,
        actionResultText: 'Simulated corporate switch failover successful. Recovered ₹1,25,000.',
        finalStatus: 'RESOLVED' as const,
      },
      {
        title: '₹32,000 Credit Card • Fraud Alert Flag',
        amountMinor: 3200000,
        merchant: merchants[2],
        customerName: 'Karan Malhotra',
        customerEmail: 'karan.m@apexdesign.org',
        customerLTV: 4500000,
        successfulPayments: 1,
        failedPayments: 3,
        optedOut: false,
        paymentMethod: 'CREDIT_CARD' as const,
        failureReason: 'FRAUD_REVIEW' as const,
        failureLabel: 'Suspected Fraud Risk Flag (Security Alert)',
        retryCount: 0,
        priority: 'CRITICAL' as const,
        mlScore: 0.184,
        recommendedAction: 'SMART_RETRY' as const,
        recommendedText: 'Security flag detected. Halt all automated billing attempts.',
        policyBlocked: true,
        policyRule: 'POL-REV-01',
        policyOutcomeText: 'Policy Guardrail BLOCKED: Security rule halts retries on fraud alert.',
        actionSuccess: false,
        actionResultText: 'Automated retry frozen by policy engine. Assigned to fraud investigation team.',
        finalStatus: 'ESCALATED' as const,
      },
    ];

    const scenario = scenarioPresets[this.simulationScenarioIndex % scenarioPresets.length];
    this.simulationScenarioIndex++;

    const caseTimestamp = new Date().toISOString();
    const caseIdNumber = 1000 + (this.cases.length + 1) * 3;
    const caseId = `px-${caseIdNumber}`;
    const txId = `tx-px-${caseIdNumber}`;
    const custId = `cust-px-${caseIdNumber}`;

    const newCase: RecoveryCase = {
      id: caseId,
      transaction_id: txId,
      merchant_id: scenario.merchant.id,
      customer_id: custId,
      policy_version: '1.0.0',
      status: scenario.finalStatus,
      priority: scenario.priority,
      retry_count: scenario.policyBlocked ? scenario.retryCount : (scenario.actionSuccess ? scenario.retryCount + 1 : scenario.retryCount),
      contact_count: scenario.recommendedAction === 'CUSTOMER_REAUTH' ? 1 : 0,
      revenue_at_risk_minor: scenario.amountMinor,
      recovered_amount_minor: scenario.finalStatus === 'RESOLVED' ? scenario.amountMinor : 0,
      currency: 'INR',
      escalation_reason: scenario.finalStatus === 'ESCALATED' ? (scenario.policyBlocked ? 'Policy engine blocked automated retry. Escalated to human desk.' : 'Retry threshold reached.') : undefined,
      created_at: caseTimestamp,
      updated_at: caseTimestamp,
      is_simulation: true,
      simulation_scenario_name: scenario.title,
      merchant: {
        id: scenario.merchant.id,
        name: scenario.merchant.name,
        code: scenario.merchant.code,
        category: scenario.merchant.category,
        created_at: '2024-01-01T00:00:00Z',
      },
      customer: {
        id: custId,
        merchant_id: scenario.merchant.id,
        external_customer_id: `ext-${scenario.customerName.toLowerCase().replace(/\s+/g, '.')}`,
        email: scenario.customerEmail,
        lifetime_value_minor: scenario.customerLTV,
        successful_payments_count: scenario.successfulPayments,
        failed_payments_count: scenario.failedPayments,
        has_opted_out: scenario.optedOut,
        created_at: '2024-02-01T00:00:00Z',
      },
      transaction: {
        id: txId,
        merchant_id: scenario.merchant.id,
        customer_id: custId,
        amount_minor: scenario.amountMinor,
        currency: 'INR',
        payment_method: scenario.paymentMethod,
        status: 'FAILED',
        failure_reason: scenario.failureReason,
        is_subscription: false,
        invoice_age_days: 0,
        checkout_duration_sec: 45,
        device_type: 'mobile',
        days_since_last_payment: 12,
        created_at: caseTimestamp,
      },
      predictions: [
        {
          id: `pred-${Date.now()}`,
          recovery_case_id: caseId,
          model_name: 'paynexa-recovery-xgboost',
          model_version: '1.0.0',
          feature_version: '1.0.0',
          prediction: scenario.mlScore,
          feature_importance: {
            failure_reason: { impact: scenario.mlScore > 0.6 ? 'POSITIVE' : 'NEGATIVE', weight: 0.38 },
            customer_history: { impact: scenario.successfulPayments > 3 ? 'POSITIVE' : 'NEUTRAL', weight: 0.28 },
            amount_tier: { impact: scenario.amountMinor > 5000000 ? 'POSITIVE' : 'NEUTRAL', weight: 0.18 },
          },
          inference_latency_ms: 3.8,
          prediction_timestamp: caseTimestamp,
        },
      ],
      explanations: [
        {
          id: `exp-${Date.now()}`,
          recovery_case_id: caseId,
          summary: `${scenario.failureLabel} detected for ${scenario.customerName}. ML Model calculates ${(scenario.mlScore * 100).toFixed(1)}% recovery likelihood.`,
          risk_level: scenario.mlScore > 0.75 ? 'LOW' : scenario.mlScore > 0.45 ? 'MEDIUM' : 'CRITICAL',
          recovery_likelihood: scenario.mlScore > 0.75 ? 'HIGH' : scenario.mlScore > 0.45 ? 'MEDIUM' : 'LOW',
          key_factors: [
            { feature: 'Failure Signature', impact: scenario.mlScore > 0.6 ? 'POSITIVE' : 'NEGATIVE', explanation: scenario.failureLabel },
            { feature: 'Customer Track Record', impact: scenario.successfulPayments > 3 ? 'POSITIVE' : 'NEUTRAL', explanation: `${scenario.successfulPayments} prior successful payments on platform` },
          ],
          recommended_next_step: scenario.recommendedText,
          confidence: 0.94,
          model_version: '1.0.0',
          feature_version: '1.0.0',
          created_at: caseTimestamp,
        },
      ],
    };

    // 1. Audit Log: Payment Failure Detected
    this.auditLogs.unshift({
      id: `aud-${Date.now()}-1`,
      case_id: caseId,
      transaction_id: txId,
      action_type: 'ANALYSIS',
      actor: 'SYSTEM',
      summary: `Payment failure event detected: ₹${(scenario.amountMinor / 100).toLocaleString('en-IN')} (${scenario.paymentMethod.replace('_', ' ')}) - ${scenario.failureLabel}.`,
      decision: 'APPROVED',
      details: { amount_inr: scenario.amountMinor / 100, merchant: scenario.merchant.name },
      timestamp: caseTimestamp,
      correlation_id: `cid-rec-${Math.floor(1000 + Math.random() * 9000)}`,
    });

    // 2. Audit Log: AI Diagnosis & Scoring
    this.auditLogs.unshift({
      id: `aud-${Date.now()}-2`,
      case_id: caseId,
      transaction_id: txId,
      action_type: 'AI_DIAGNOSIS',
      actor: 'AI_AGENT',
      summary: `Gemini 3.7 Flash diagnosed failure. ML recovery probability evaluated at ${(scenario.mlScore * 100).toFixed(1)}%.`,
      decision: 'APPROVED',
      details: { ml_score: scenario.mlScore, recommendation: scenario.recommendedText },
      timestamp: caseTimestamp,
      correlation_id: `cid-rec-${Math.floor(1000 + Math.random() * 9000)}`,
    });

    // 3. Audit Log: Deterministic Policy Engine Evaluation
    this.auditLogs.unshift({
      id: `aud-${Date.now()}-3`,
      case_id: caseId,
      transaction_id: txId,
      action_type: 'POLICY_VALIDATION',
      actor: 'POLICY_ENGINE',
      summary: scenario.policyOutcomeText,
      decision: scenario.policyBlocked ? 'BLOCKED' : 'APPROVED',
      details: { rule_id: scenario.policyRule, approved: !scenario.policyBlocked },
      timestamp: caseTimestamp,
      correlation_id: `cid-rec-${Math.floor(1000 + Math.random() * 9000)}`,
    });

    // 4. Audit Log: Action Execution / Outcome
    this.auditLogs.unshift({
      id: `aud-${Date.now()}-4`,
      case_id: caseId,
      transaction_id: txId,
      action_type: scenario.policyBlocked ? 'ESCALATION' : scenario.recommendedAction,
      actor: scenario.policyBlocked ? 'POLICY_ENGINE' : 'AI_AGENT',
      summary: scenario.actionResultText,
      decision: scenario.finalStatus === 'RESOLVED' ? 'SUCCESS' : (scenario.policyBlocked ? 'FLAGGED' : 'APPROVED'),
      details: { outcome: scenario.finalStatus, recovered_inr: newCase.recovered_amount_minor / 100 },
      timestamp: caseTimestamp,
      correlation_id: `cid-rec-${Math.floor(1000 + Math.random() * 9000)}`,
    });

    // Add case to service
    this.cases = [newCase, ...this.cases];
    soundService.playSimulateEvent();
    this.notify();

    return {
      caseItem: newCase,
      scenarioTitle: scenario.title,
      amountFormatted: `₹${(scenario.amountMinor / 100).toLocaleString('en-IN')}`,
      paymentRail: scenario.paymentMethod.replace('_', ' '),
      failureReasonFormatted: scenario.failureLabel,
      outcomeSummary: scenario.actionResultText,
    };
  }

  public addAuditLog(logData: Omit<AuditLog, 'id' | 'timestamp' | 'correlation_id'> & { timestamp?: string; correlation_id?: string }) {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: logData.timestamp || new Date().toISOString(),
      correlation_id: logData.correlation_id || `cid-rec-${Math.floor(1000 + Math.random() * 9000)}`,
      ...logData,
    };
    this.auditLogs = [newLog, ...this.auditLogs];
    this.notify();
  }

  public addCase(newCase: RecoveryCase) {
    this.cases = [newCase, ...this.cases];
    this.addAuditLog({
      case_id: newCase.id,
      transaction_id: newCase.transaction_id,
      action_type: 'ANALYSIS',
      actor: 'SYSTEM',
      summary: `New incoming failed transaction received: ₹${(newCase.revenue_at_risk_minor / 100).toLocaleString('en-IN')} (${newCase.transaction?.failure_reason}).`,
      decision: 'APPROVED',
      details: { amount_inr: newCase.revenue_at_risk_minor / 100 },
    });
    
    const isCritical = newCase.priority === 'CRITICAL' || (newCase.revenue_at_risk_minor || 0) >= 5000000;
    if (isCritical) {
      soundService.playCriticalAlert();
    } else {
      soundService.playFailureAlert();
    }
    this.notify();
  }

  public updateCaseStatus(caseId: string, status: RecoveryCase['status']): void {
    const targetCase = this.cases.find((c) => c.id === caseId);
    if (targetCase) {
      targetCase.status = status;
      if (status === 'RESOLVED') {
        targetCase.recovered_amount_minor = targetCase.revenue_at_risk_minor;
        soundService.playSuccess();
      } else if (status === 'ESCALATED') {
        soundService.playHighRiskAlert();
      } else if (status === 'FAILED') {
        soundService.playFailureAlert();
      }
      targetCase.updated_at = new Date().toISOString();

      this.addAuditLog({
        case_id: caseId,
        transaction_id: targetCase.transaction_id,
        action_type: 'STATUS_CHANGE',
        actor: 'MERCHANT_ADMIN',
        summary: `Case status manually changed to ${status}.`,
        decision: 'APPROVED',
      });

      this.notify();
    }
  }
}

export const recoveryService = new RecoveryService();
