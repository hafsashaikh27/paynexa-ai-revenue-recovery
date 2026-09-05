import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Building2, 
  User, 
  FileText, 
  MessageSquare, 
  X, 
  RotateCw,
  ArrowRight,
  Receipt,
  CheckSquare,
  Square,
  HelpCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { RecoveryCase, OfflineVerificationChecklist } from '../types';
import { formatINR, formatTimeAgo } from '../utils/formatters';
import { recoveryService } from '../services/recoveryService';

interface OfflineVerificationModalProps {
  caseItem: RecoveryCase | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenCustomerChat?: (caseId: string) => void;
}

export const OfflineVerificationModal: React.FC<OfflineVerificationModalProps> = ({
  caseItem,
  isOpen,
  onClose,
  onOpenCustomerChat,
}) => {
  const [checklist, setChecklist] = useState<OfflineVerificationChecklist>({
    txIdMatched: false,
    customerMatched: false,
    amountMatched: false,
    originalFailedTxVerified: false,
    offlineMethodVerified: false,
    customerDeclarationReviewed: false,
    paymentEvidenceReviewed: false,
    merchantConfirmedReceived: false,
  });

  const [activeTab, setActiveTab] = useState<'checklist' | 'history' | 'dossier'>('checklist');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('Payment not received');
  const [rejectNotes, setRejectNotes] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync checklist from caseItem whenever opened or updated
  useEffect(() => {
    if (caseItem) {
      if (caseItem.offline_checklist) {
        setChecklist({ ...caseItem.offline_checklist });
      } else {
        setChecklist({
          txIdMatched: false,
          customerMatched: false,
          amountMatched: false,
          originalFailedTxVerified: false,
          offlineMethodVerified: false,
          customerDeclarationReviewed: false,
          paymentEvidenceReviewed: false,
          merchantConfirmedReceived: false,
        });
      }
      setShowConfirmModal(false);
      setShowRejectModal(false);
      setFeedback(null);
    }
  }, [caseItem, isOpen]);

  if (!isOpen || !caseItem) return null;

  const amountStr = formatINR(caseItem.transaction?.amount_minor ?? caseItem.revenue_at_risk_minor ?? 0);
  const txId = caseItem.transaction_id || caseItem.id.replace('rc-', 'PX-');

  // Checklist items definitions
  const checklistConfig: Array<{
    key: keyof OfflineVerificationChecklist;
    stage: 1 | 2 | 3 | 4;
    title: string;
    description: string;
    detail: string;
  }> = [
    // Stage 1: Transaction Details (Checks 1-3)
    {
      key: 'txIdMatched',
      stage: 1,
      title: '1. Transaction ID matches',
      description: `Verify transaction identifier matches reference order.`,
      detail: `ID: ${txId}`,
    },
    {
      key: 'customerMatched',
      stage: 1,
      title: '2. Customer details match',
      description: `Validate customer identity, email and account records.`,
      detail: `${caseItem.customer?.email || 'Demo Customer'} (LTV: ${formatINR(caseItem.customer?.lifetime_value_minor || 0)})`,
    },
    {
      key: 'amountMatched',
      stage: 1,
      title: '3. Amount matches',
      description: `Check exact rupee amount against unpaid checkout basket.`,
      detail: `${amountStr} (Exact Settlement Match)`,
    },

    // Stage 2: Payment Information (Checks 4-6)
    {
      key: 'originalFailedTxVerified',
      stage: 2,
      title: '4. Original failed transaction verified',
      description: `Confirm primary digital gateway recorded a failed attempt.`,
      detail: `Reason: ${caseItem.transaction?.failure_reason || 'NETWORK_TIMEOUT'} (Attempt ${caseItem.retry_count || 1} of 3)`,
    },
    {
      key: 'offlineMethodVerified',
      stage: 2,
      title: '5. Offline payment method verified',
      description: `Confirm payment channel is recognized by merchant policies.`,
      detail: `Counter Cash / Store Till / Branch Deposit`,
    },
    {
      key: 'customerDeclarationReviewed',
      stage: 2,
      title: '6. Customer payment declaration reviewed',
      description: `Review customer declaration timestamp and chat notes.`,
      detail: caseItem.last_customer_action || 'Customer self-reported offline payment completion',
    },

    // Stage 3: Evidence Review (Check 7)
    {
      key: 'paymentEvidenceReviewed',
      stage: 3,
      title: '7. Payment evidence / receipt details reviewed',
      description: `Inspect physical cash receipt, POS slip, or till register journal.`,
      detail: `Receipt Log Reference: RCP-${txId.slice(-6)}-OFF • Verified by Store Cashier`,
    },

    // Stage 4: Merchant Confirmation (Check 8)
    {
      key: 'merchantConfirmedReceived',
      stage: 4,
      title: '8. Merchant confirms payment received',
      description: `Final sign-off by merchant administrator to credit revenue ledger.`,
      detail: `Merchant Admin: ${caseItem.merchant?.name || 'Store Operations'}`,
    },
  ];

  // Calculate completion counts
  const totalChecks = 8;
  const completedChecks = Object.values(checklist).filter(Boolean).length;
  const allChecksCompleted = completedChecks === totalChecks;
  const progressPercent = Math.round((completedChecks / totalChecks) * 100);

  // Stage completion flags
  const stage1Completed = checklist.txIdMatched && checklist.customerMatched && checklist.amountMatched;
  const stage2Completed = checklist.originalFailedTxVerified && checklist.offlineMethodVerified && checklist.customerDeclarationReviewed;
  const stage3Completed = checklist.paymentEvidenceReviewed;
  const stage4Completed = checklist.merchantConfirmedReceived;

  const handleToggleCheck = (key: keyof OfflineVerificationChecklist) => {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    recoveryService.updateOfflineChecklist(caseItem.id, { [key]: updated[key] });
  };

  const handleVerifyAll = () => {
    const allTrue: OfflineVerificationChecklist = {
      txIdMatched: true,
      customerMatched: true,
      amountMatched: true,
      originalFailedTxVerified: true,
      offlineMethodVerified: true,
      customerDeclarationReviewed: true,
      paymentEvidenceReviewed: true,
      merchantConfirmedReceived: true,
    };
    setChecklist(allTrue);
    recoveryService.updateOfflineChecklist(caseItem.id, allTrue);
  };

  const handleFinalConfirm = async () => {
    setIsSubmitting(true);
    try {
      const res = await recoveryService.merchantConfirmOfflinePayment(caseItem.id);
      setFeedback({ type: 'success', text: res.message });
      setShowConfirmModal(false);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to confirm verification' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalReject = async () => {
    setIsSubmitting(true);
    try {
      const res = await recoveryService.merchantRejectOfflinePayment(caseItem.id, rejectReason, rejectNotes);
      setFeedback({ type: 'success', text: res.message });
      setShowRejectModal(false);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to reject verification' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVerified = caseItem.offline_verification_status === 'CONFIRMED' || caseItem.status === 'RESOLVED';
  const isRejected = caseItem.offline_verification_status === 'REJECTED';

  return (
    <div 
      id="offline-verification-panel-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        id="offline-verification-panel-dialog"
        className="bg-[#0D1527] border-2 border-amber-500/40 rounded-2xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="p-5 sm:p-6 border-b border-[#223354] bg-[#111C35] flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded border border-amber-500/30">
                  OFFLINE PAYMENT VERIFICATION
                </span>
                <span className="font-mono text-sm font-bold text-white">
                  {txId}
                </span>
                {isVerified ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> PAYMENT VERIFIED
                  </span>
                ) : isRejected ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> PAYMENT NOT VERIFIED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                    <Clock className="w-3 h-3" /> PENDING VERIFICATION
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Merchant verification workflow for self-reported offline and counter cash transactions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCustomerChat && (
              <button
                id="btn-offline-panel-open-chat"
                onClick={() => {
                  onClose();
                  onOpenCustomerChat(caseItem.id);
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Customer Communications</span>
              </button>
            )}
            <button
              id="btn-offline-panel-close"
              onClick={onClose}
              className="p-2 rounded-lg bg-[#182647] hover:bg-[#223354] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div className={`px-6 py-2.5 text-xs font-mono font-semibold flex items-center gap-2 ${
            feedback.type === 'success' 
              ? 'bg-emerald-950/80 text-emerald-300 border-b border-emerald-500/30' 
              : 'bg-rose-950/80 text-rose-300 border-b border-rose-500/30'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* KEY TRANSACTION SUMMARY METRICS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 bg-[#0B1222] border-b border-[#223354]">
          <div className="p-3 bg-[#111C35] rounded-xl border border-[#223354]">
            <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Amount to Verify</div>
            <div className="text-xl font-mono font-bold text-amber-300 mt-0.5">{amountStr}</div>
            <div className="text-[10px] font-mono text-slate-400">INR Direct Settlement</div>
          </div>

          <div className="p-3 bg-[#111C35] rounded-xl border border-[#223354]">
            <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Customer Account</div>
            <div className="text-xs font-bold text-white truncate mt-0.5">{caseItem.customer?.email}</div>
            <div className="text-[10px] font-mono text-slate-400">Past Orders: {caseItem.customer?.successful_payments_count ?? 1} cleared</div>
          </div>

          <div className="p-3 bg-[#111C35] rounded-xl border border-[#223354]">
            <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Original Gateway Status</div>
            <div className="text-xs font-bold text-rose-400 font-mono mt-0.5">FAILED ({caseItem.transaction?.failure_reason || 'TIMEOUT'})</div>
            <div className="text-[10px] font-mono text-slate-400">Retry Attempts: {caseItem.retry_count || 1} / 3</div>
          </div>

          <div className="p-3 bg-[#111C35] rounded-xl border border-[#223354]">
            <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Reported Channel</div>
            <div className="text-xs font-bold text-slate-200 font-mono mt-0.5">Counter Cash / Till</div>
            <div className="text-[10px] font-mono text-slate-400">{caseItem.offline_reported_at ? formatTimeAgo(caseItem.offline_reported_at) : 'Recently'}</div>
          </div>
        </div>

        {/* PROGRESS INDICATOR BAR */}
        <div className="px-5 py-3 bg-[#111C35] border-b border-[#223354] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-200">VERIFICATION PROGRESS:</span>
              <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                allChecksCompleted 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {completedChecks} of {totalChecks} checks completed ({progressPercent}%)
              </span>
            </div>

            {!isVerified && !isRejected && (
              <button
                id="btn-verify-all-checks"
                onClick={handleVerifyAll}
                className="text-[11px] font-mono text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>Verify All Checks (Demo Helper)</span>
              </button>
            )}
          </div>

          {/* Step Progress Pills */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <div className={`p-1.5 rounded-lg border text-center text-[10px] font-mono font-bold transition-all ${
              stage1Completed 
                ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300' 
                : 'bg-[#182647] border-[#223354] text-slate-400'
            }`}>
              {stage1Completed ? '✓ Stage 1: Details' : '1. Details (3)'}
            </div>

            <div className={`p-1.5 rounded-lg border text-center text-[10px] font-mono font-bold transition-all ${
              stage2Completed 
                ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300' 
                : 'bg-[#182647] border-[#223354] text-slate-400'
            }`}>
              {stage2Completed ? '✓ Stage 2: Payment' : '2. Payment (3)'}
            </div>

            <div className={`p-1.5 rounded-lg border text-center text-[10px] font-mono font-bold transition-all ${
              stage3Completed 
                ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300' 
                : 'bg-[#182647] border-[#223354] text-slate-400'
            }`}>
              {stage3Completed ? '✓ Stage 3: Evidence' : '3. Evidence (1)'}
            </div>

            <div className={`p-1.5 rounded-lg border text-center text-[10px] font-mono font-bold transition-all ${
              stage4Completed 
                ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300' 
                : 'bg-[#182647] border-[#223354] text-slate-400'
            }`}>
              {stage4Completed ? '✓ Stage 4: Confirm' : '4. Confirm (1)'}
            </div>
          </div>

          {/* Bar */}
          <div className="w-full h-1.5 rounded-full bg-[#182647] overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                allChecksCompleted ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* TABS HEADER */}
        <div className="flex items-center gap-2 px-6 pt-2 bg-[#0B1222] border-b border-[#223354]">
          <button
            id="tab-btn-checklist"
            onClick={() => setActiveTab('checklist')}
            className={`pb-2.5 px-3 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'checklist'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Verification Checklist ({completedChecks}/8)</span>
          </button>

          <button
            id="tab-btn-history"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Verification History ({caseItem.offline_verification_history?.length || 1})</span>
          </button>
        </div>

        {/* BODY CONTENT */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-[#090F1C]">
          {/* TAB 1: CHECKLIST */}
          {activeTab === 'checklist' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Merchant Verification Protocol:</strong> In accordance with financial compliance rules, all 8 verification items must be validated before authorizing transaction recovery and crediting revenue metrics.
                </div>
              </div>

              <div className="space-y-2.5">
                {checklistConfig.map((item, idx) => {
                  const isChecked = checklist[item.key];
                  return (
                    <div
                      key={item.key}
                      id={`checklist-item-${item.key}`}
                      onClick={() => !isVerified && handleToggleCheck(item.key)}
                      className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                        isChecked 
                          ? 'bg-[#102035] border-emerald-500/40 text-slate-200 shadow-xs' 
                          : 'bg-[#0E172B] border-[#223354] text-slate-300 hover:border-amber-500/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-500 hover:text-amber-400 transition-colors" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{item.title}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#182647] text-slate-400">
                              Stage {item.stage}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {item.description}
                          </p>
                          <div className="text-[11px] font-mono text-cyan-300 pt-0.5">
                            {item.detail}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all ${
                          isChecked 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                            : 'bg-[#182647] text-slate-400 border border-[#223354] hover:text-white'
                        }`}>
                          {isChecked ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>VERIFIED</span>
                            </>
                          ) : (
                            <span>VERIFY</span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: VERIFICATION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold font-mono uppercase text-slate-400">
                Timestamped Verification Audit Trail
              </h3>

              <div className="space-y-2">
                {(caseItem.offline_verification_history || []).map((hist, idx) => (
                  <div 
                    key={idx} 
                    className="p-3.5 rounded-xl bg-[#0E172B] border border-[#223354] flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          hist.status === 'COMPLETED' 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                            : hist.status === 'REJECTED'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {hist.status}
                        </span>
                        <span className="font-bold text-white">{hist.step_title}</span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{hist.notes}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-mono text-slate-400">
                        {formatTimeAgo(hist.timestamp)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        Actor: {hist.actor}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ACTIONS BAR */}
        <div className="p-4 sm:p-5 bg-[#111C35] border-t border-[#223354] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            {!allChecksCompleted && !isVerified && (
              <span className="text-amber-300 font-mono text-[11px] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Complete remaining {totalChecks - completedChecks} checks to enable confirmation.
              </span>
            )}
            {allChecksCompleted && !isVerified && (
              <span className="text-emerald-300 font-mono text-[11px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                All 8 checks completed. Ready for final merchant authorization.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              id="btn-offline-panel-cancel"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#182647] hover:bg-[#223354] border border-[#223354] text-slate-300 text-xs font-semibold cursor-pointer transition-all"
            >
              Cancel / Close
            </button>

            {!isVerified && (
              <button
                id="btn-offline-panel-reject"
                onClick={() => setShowRejectModal(true)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Payment Not Received</span>
              </button>
            )}

            {!isVerified ? (
              <button
                id="btn-offline-panel-confirm"
                onClick={() => setShowConfirmModal(true)}
                disabled={!allChecksCompleted || isSubmitting}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#1E293B] disabled:text-slate-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:cursor-not-allowed cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Payment Received</span>
              </button>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>PAYMENT CONFIRMED & RECOVERED</span>
              </div>
            )}
          </div>
        </div>

        {/* CONFIRMATION MODAL POPUP */}
        {showConfirmModal && (
          <div 
            id="offline-final-confirm-dialog"
            className="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          >
            <div className="bg-[#111C35] border-2 border-emerald-500/50 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">FINAL VERIFICATION</h3>
                  <p className="text-xs text-slate-300">Transaction: <strong className="font-mono text-white">{txId}</strong></p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#090F1C] border border-[#223354] text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Settlement Amount:</span>
                  <span className="font-mono font-bold text-emerald-300">{amountStr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="text-white truncate max-w-[200px]">{caseItem.customer?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Checklist Status:</span>
                  <span className="text-emerald-400 font-mono font-bold">8 of 8 Completed ✓</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                Are you sure the merchant has received this offline payment? This will update the status to <strong>PAYMENT VERIFIED / RECOVERED</strong>, credit the merchant revenue ledger, and notify the customer.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#182647] hover:bg-[#223354] text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-final-verification"
                  type="button"
                  onClick={handleFinalConfirm}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {isSubmitting ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Confirm Payment Received</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REJECTION REASON MODAL POPUP */}
        {showRejectModal && (
          <div 
            id="offline-reject-dialog"
            className="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          >
            <div className="bg-[#111C35] border-2 border-rose-500/50 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">REJECT OFFLINE VERIFICATION</h3>
                  <p className="text-xs text-slate-300">Transaction: <strong className="font-mono text-white">{txId}</strong></p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Select Rejection Reason:
                  </label>
                  <select
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#090F1C] border border-[#223354] text-white text-xs focus:outline-none focus:border-rose-500"
                  >
                    <option value="Payment not received">Payment not received at merchant counter</option>
                    <option value="Amount mismatch">Amount mismatch (Claimed vs Actual received)</option>
                    <option value="Transaction details mismatch">Transaction details or order reference mismatch</option>
                    <option value="Insufficient evidence">Insufficient evidence / Unverified receipt</option>
                    <option value="Voided or cancelled by store">Voided or cancelled by store cashier</option>
                    <option value="Other">Other reason</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Additional Review Notes (Optional):
                  </label>
                  <textarea
                    rows={2}
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="Provide details for audit log..."
                    className="w-full px-3 py-2 rounded-lg bg-[#090F1C] border border-[#223354] text-white text-xs focus:outline-none focus:border-rose-500 placeholder:text-slate-500"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-400">
                This transaction will remain <strong>FAILED / UNRESOLVED</strong> and recovered revenue will not increase.
              </p>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#182647] hover:bg-[#223354] text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-rejection"
                  type="button"
                  onClick={handleFinalReject}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {isSubmitting ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
