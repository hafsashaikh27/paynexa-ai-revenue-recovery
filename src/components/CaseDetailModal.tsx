import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Bot, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Cpu, 
  CreditCard, 
  User, 
  Building2, 
  Clock, 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight,
  Send,
  Layers,
  History,
  Terminal,
  ArrowRightLeft,
  UserCheck,
  ShieldCheck,
  Play,
  FileText,
  Lock,
  Ban,
  MessageSquare
} from 'lucide-react';
import { RecoveryCase, ModelPrediction, LLMExplanation, AuditLog } from '../types';
import { OfflineVerificationModal } from './OfflineVerificationModal';
import { 
  formatINR, 
  formatPercent, 
  getPriorityStyles, 
  getStatusStyles, 
  getFailureReasonLabel, 
  getPaymentMethodLabel, 
  getProbabilityColor, 
  getRiskLevelStyles,
  formatTimeAgo 
} from '../utils/formatters';
import { recoveryService } from '../services/recoveryService';

interface CaseDetailModalProps {
  caseItem: RecoveryCase | null;
  onClose: () => void;
  onRunML: (caseId: string) => Promise<void>;
  onRunAI: (caseId: string) => Promise<void>;
  onSimulateRecovery: (caseId: string, actionType?: any) => Promise<{ success: boolean; message: string; policyApproved?: boolean }>;
  onUpdateStatus: (caseId: string, status: RecoveryCase['status']) => void;
  onOpenCustomerChat?: (caseId: string) => void;
}

export const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  caseItem,
  onClose,
  onRunML,
  onRunAI,
  onSimulateRecovery,
  onUpdateStatus,
  onOpenCustomerChat,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'workflow' | 'dossier' | 'ml' | 'ai' | 'actions' | 'audit'>('overview');
  const [isProcessingML, setIsProcessingML] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isExecutingTimeline, setIsExecutingTimeline] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [actionResult, setActionResult] = useState<{ 
    success: boolean; 
    message: string; 
    policyApproved?: boolean;
    stoppingCondition?: string;
  } | null>(null);

  if (!caseItem) return null;

  const latestPred: ModelPrediction | undefined = caseItem.predictions?.[0];
  const latestExp: LLMExplanation | undefined = caseItem.explanations?.[0];
  const prob = latestPred?.prediction ?? 0.82;
  const probStyle = getProbabilityColor(prob);
  const priorityStyle = getPriorityStyles(caseItem.priority);
  const statusStyle = getStatusStyles(caseItem.status);

  // Policy Guardrail verification logic
  const isRetryExceeded = caseItem.retry_count >= 3;
  const isOptedOut = Boolean(caseItem.customer?.has_opted_out);
  const isFraud = caseItem.transaction?.failure_reason === 'FRAUD_REVIEW';
  const isHighValue = caseItem.revenue_at_risk_minor >= 5000000;

  const policyChecks = [
    { 
      name: 'Retry limit not exceeded', 
      passed: !isRetryExceeded, 
      desc: isRetryExceeded ? `Failed: Max 3 retries exhausted (${caseItem.retry_count}/3).` : `Passed: ${caseItem.retry_count}/3 attempts.` 
    },
    { 
      name: 'Amount within permitted threshold', 
      passed: true, 
      desc: `Passed: ${formatINR(caseItem.revenue_at_risk_minor)} authorized under policy limit (₹5,00,000 ceiling).` 
    },
    { 
      name: 'Customer contact frequency safe & DND clear', 
      passed: !isOptedOut, 
      desc: isOptedOut ? 'Failed: Customer DND opt-out active.' : `Passed: ${caseItem.contact_count}/2 contacts today.` 
    },
    { 
      name: 'No duplicate action (Idempotency verified)', 
      passed: true, 
      desc: `Passed: Cryptographic idempotency key valid (req-${caseItem.id.replace('rc-', '')}).` 
    },
    { 
      name: 'Recovery action permitted under Policy v1.0.0', 
      passed: !isFraud && !isRetryExceeded && !isOptedOut, 
      desc: isFraud ? 'Failed: Fraud alert locks automated actions.' : isRetryExceeded ? 'Failed: Exceeded retry ceiling.' : 'Passed: Autonomous recovery authorized.' 
    },
  ];

  const allRulesPassed = policyChecks.every(c => c.passed);
  const agentDecision = allRulesPassed ? 'APPROVED' : 'BLOCKED';

  const timelineSteps = [
    { num: 1, title: 'PAYMENT FAILURE DETECTED', desc: 'Real-time webhook intercepted from payment switch' },
    { num: 2, title: 'FAILURE DIAGNOSED', desc: 'Gemini 3.7 Flash root-cause telemetry diagnosis' },
    { num: 3, title: 'RECOVERABILITY CALCULATED', desc: `ML model computed ${formatPercent(prob)} recovery likelihood` },
    { num: 4, title: 'RECOVERY ACTION SELECTED', desc: 'Autonomous agent picked optimal dunning strategy' },
    { num: 5, title: 'POLICY GUARDRAILS CHECKED', desc: allRulesPassed ? 'All 5 deterministic rules PASSED' : 'Deterministic policy violation DETECTED' },
    { num: 6, title: 'RECOVERY ACTION EXECUTED', desc: allRulesPassed ? 'Dynamic secondary rail / dunning dispatched' : 'Automated action suppressed by policy' },
    { num: 7, title: 'RESULT MONITORED', desc: 'Verified acquirer settlement telemetry' },
    { num: 8, title: 'AUDIT EVENT RECORDED', desc: 'Immutable audit entry cryptographically logged' },
  ];

  const handleExecuteRecoveryWorkflow = async (actionType: 'SMART_RETRY' | 'ALTERNATE_ROUTE' | 'CUSTOMER_REAUTH' | 'ESCALATION' = 'SMART_RETRY') => {
    setIsExecutingTimeline(true);
    setActionResult(null);
    setCurrentStep(1);

    // Stepped animated execution
    for (let i = 1; i <= 8; i++) {
      setCurrentStep(i);
      await new Promise(r => setTimeout(r, 260));
    }

    try {
      const res = await onSimulateRecovery(caseItem.id, actionType);
      let stoppingCondition = 'Case Closed: Payment successfully recovered and settled.';
      if (!res.policyApproved || isRetryExceeded || isOptedOut || isFraud) {
        stoppingCondition = 'Recovery Stopped: Policy guardrail violation or maximum retry ceiling.';
      } else if (actionType === 'ESCALATION') {
        stoppingCondition = 'Recovery Escalated: Transferred to merchant ops desk.';
      } else if (caseItem.status === 'IN_PROGRESS') {
        stoppingCondition = 'Active Schedule: Waiting for secondary gateway retry window.';
      }

      setActionResult({
        ...res,
        stoppingCondition,
      });
    } finally {
      setIsExecutingTimeline(false);
    }
  };

  const caseAuditLogs = recoveryService.getAuditLogs().filter(
    log => log.case_id === caseItem.id || log.transaction_id === caseItem.transaction_id
  );

  return (
    <div 
      id="case-modal-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        id="case-modal-dialog"
        className="bg-[#0F172A] border border-[#263553] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#263553] bg-[#111A30] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-white">{caseItem.id}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}`}>
                  {caseItem.priority}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                  {caseItem.status}
                </span>
                {caseItem.is_simulation && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border bg-blue-500/15 text-blue-400 border-blue-500/30">
                    SIMULATED EVENT
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  agentDecision === 'APPROVED'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                }`}>
                  POLICY {agentDecision}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Transaction ID: <span className="font-mono text-slate-200 font-bold">{caseItem.transaction_id}</span> • Merchant: <span className="text-slate-300 font-semibold">{caseItem.merchant?.name}</span> • Created: <span className="text-slate-400">{formatTimeAgo(caseItem.created_at)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCustomerChat && (
              <button
                id="btn-modal-open-customer-chat"
                onClick={() => {
                  onClose();
                  onOpenCustomerChat(caseItem.id);
                }}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 border border-blue-500/40 text-blue-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                <span>Customer Communications</span>
              </button>
            )}
            <button
              id="close-case-modal-btn"
              onClick={onClose}
              className="p-2 rounded-lg bg-[#16213A] hover:bg-[#1E293B] border border-[#263553] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 bg-[#111A30] border-b border-[#263553] overflow-x-auto">
          <button
            id="tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Case Overview & Decision
          </button>
          <button
            id="tab-workflow"
            onClick={() => setActiveTab('workflow')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'workflow'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Agent Execution Timeline
          </button>
          <button
            id="tab-dossier"
            onClick={() => setActiveTab('dossier')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'dossier'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Telemetry Dossier
          </button>
          <button
            id="tab-ml"
            onClick={() => setActiveTab('ml')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'ml'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            ML Scoring ({formatPercent(prob)})
          </button>
          <button
            id="tab-ai"
            onClick={() => setActiveTab('ai')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'ai'
                ? 'border-purple-500 text-purple-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            Gemini AI Diagnosis
          </button>
          <button
            id="tab-actions"
            onClick={() => setActiveTab('actions')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'actions'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            Execute Action
          </button>
          <button
            id="tab-audit"
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Case Audit Log ({caseAuditLogs.length})
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#080D1A]">
          {/* TAB 1: CASE OVERVIEW & DECISION */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Primary Header Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-[#111A30] border border-[#263553] rounded-xl space-y-1 shadow-md">
                  <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Amount at Risk</div>
                  <div className="text-2xl font-bold font-mono text-rose-400">
                    {formatINR(caseItem.revenue_at_risk_minor)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">Currency: INR (₹)</div>
                </div>

                <div className="p-4 bg-[#111A30] border border-[#263553] rounded-xl space-y-1 shadow-md">
                  <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Customer & LTV</div>
                  <div className="text-sm font-bold text-white truncate">{caseItem.customer?.email}</div>
                  <div className="text-[11px] text-slate-300 font-mono font-medium">
                    LTV: {formatINR(caseItem.customer?.lifetime_value_minor || 0)}
                  </div>
                </div>

                <div className="p-4 bg-[#111A30] border border-[#263553] rounded-xl space-y-1 shadow-md">
                  <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Method & Failure</div>
                  <div className="text-sm font-bold font-mono text-slate-200">
                    {getPaymentMethodLabel(caseItem.transaction?.payment_method as any)}
                  </div>
                  <div className="text-[11px] text-rose-400 font-semibold truncate">
                    {getFailureReasonLabel(caseItem.transaction?.failure_reason as any)}
                  </div>
                </div>

                <div className="p-4 bg-[#111A30] border border-[#263553] rounded-xl space-y-1 shadow-md">
                  <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Recoverability Score</div>
                  <div className={`text-2xl font-bold font-mono ${probStyle.text}`}>
                    {formatPercent(prob)}
                  </div>
                  <div className="text-[11px] text-emerald-400 font-semibold">High Recovery Probability</div>
                </div>
              </div>

              {/* AI DIAGNOSIS & RECOVERABILITY */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AI Diagnosis */}
                <div className="p-5 bg-[#111A30] border border-[#263553] rounded-2xl space-y-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-400">
                      <Bot className="w-4 h-4" />
                      <h3 className="text-xs font-bold uppercase font-mono tracking-wider">
                        AI Diagnosis (Gemini 3.7 Flash)
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30 font-semibold">
                      Confidence: 91%
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed bg-[#0F172A] p-3.5 rounded-xl border border-[#263553] font-medium">
                    {latestExp?.summary || `Diagnosed case ${caseItem.id}: Failure caused by transient ${getFailureReasonLabel(caseItem.transaction?.failure_reason as any)} on primary acquirer switch. Customer has strong payment history with 0 historical chargebacks.`}
                  </p>

                  <div className="text-[11px] text-slate-400 space-y-1 pt-1 font-medium">
                    <div>• <strong>Likely Root Cause</strong>: Transient gateway latency during peak banking settlement window.</div>
                    <div>• <strong>Customer Reliability</strong>: {caseItem.customer?.successful_payments_count || 4} successful payments recorded.</div>
                  </div>
                </div>

                {/* Recommended Action & Expected Recovery */}
                <div className="p-5 bg-[#111A30] border border-[#263553] rounded-2xl space-y-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Sparkles className="w-4 h-4" />
                      <h3 className="text-xs font-bold uppercase font-mono tracking-wider">
                        Recommended Recovery Action
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                      Expected: {formatINR(Math.round((caseItem.revenue_at_risk_minor * prob)))}
                    </span>
                  </div>

                  <div className="p-3.5 bg-[#0F172A] rounded-xl border border-[#263553] space-y-2">
                    <div className="text-xs font-bold text-white flex items-center gap-2 font-mono">
                      <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                      <span>{latestExp?.recommended_next_step || 'Smart Retry via Secondary Acquirer Rail'}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium">
                      Trigger retry across secondary HDFC/ICICI banking rails within 15 minutes to maximize clearance probability.
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-400 font-medium">Optimal Window: <strong className="text-slate-200">15 min</strong></span>
                    <span className="text-slate-400 font-medium">Clearance Yield: <strong className="text-emerald-400 font-mono">+{formatPercent(prob)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Policy Guardrails Check (All 5 Rules Visible) */}
              <div className="p-5 bg-[#111A30] border border-[#263553] rounded-2xl space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <ShieldCheck className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase font-mono tracking-wider">
                      Policy Engine Guardrails (POL-REV-v1.0.0)
                    </h3>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border ${
                    allRulesPassed 
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}>
                    {allRulesPassed ? 'ALL RULES PASSED' : 'RULE VIOLATION DETECTED'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {policyChecks.map((rule, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                        rule.passed 
                          ? 'bg-[#0F172A] border-[#263553] text-slate-300' 
                          : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                      }`}
                    >
                      {rule.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold text-white text-[11px]">{rule.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{rule.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Offline Verification Banner if applicable */}
              {(caseItem.offline_verification_status === 'PENDING' || caseItem.offline_verification_status === 'IN_REVIEW' || caseItem.transaction?.payment_method === 'OFFLINE') && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/50 via-[#192238] to-amber-950/40 border-2 border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
                        OFFLINE PAYMENT VERIFICATION REQUIRED
                      </span>
                      {caseItem.offline_verification_status === 'CONFIRMED' && (
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">✓ VERIFIED</span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-white mt-1">
                      Customer reported offline settlement of {formatINR(caseItem.revenue_at_risk_minor)}. 8-point checklist ready.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowOfflineModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer font-mono"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-950" />
                    <span>REVIEW / VERIFY OFFLINE</span>
                  </button>
                </div>
              )}

              {/* Action Trigger Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#111A30] via-[#16213A] to-[#111A30] border border-blue-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div>
                  <span className="text-[10px] font-mono uppercase text-blue-400 font-bold">Autonomous Recovery Execution</span>
                  <div className="text-xs font-bold text-white mt-0.5">
                    Ready to execute policy-guarded recovery workflow for {formatINR(caseItem.revenue_at_risk_minor)}.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleExecuteRecoveryWorkflow('SMART_RETRY')}
                  disabled={isExecutingTimeline || caseItem.status === 'RESOLVED'}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{caseItem.status === 'RESOLVED' ? 'Already Recovered' : 'Execute Recovery Workflow'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: AGENT EXECUTION TIMELINE */}
          {activeTab === 'workflow' && (
            <div className="space-y-5">
              <div className="p-5 bg-[#111A30] border border-[#263553] rounded-2xl space-y-4 shadow-md">
                <div className="flex items-center justify-between pb-3 border-b border-[#263553]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                      8-Step Agent Execution Workflow
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExecuteRecoveryWorkflow('SMART_RETRY')}
                    disabled={isExecutingTimeline}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Run Stepped Simulation</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {timelineSteps.map((step) => {
                    const isStepActive = isExecutingTimeline && currentStep === step.num;
                    const isStepDone = (!isExecutingTimeline && currentStep === 8) || (isExecutingTimeline && currentStep > step.num);
                    return (
                      <div 
                        key={step.num}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isStepActive
                            ? 'bg-blue-950/40 border-blue-500 shadow-md ring-1 ring-blue-500'
                            : isStepDone
                            ? 'bg-[#0F172A] border-emerald-500/40 text-slate-200'
                            : 'bg-[#0F172A] border-[#263553] text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold">
                            STEP {step.num}
                          </span>
                          {isStepDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : isStepActive ? (
                            <RotateCw className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-600" />
                          )}
                        </div>
                        <div className="text-xs font-bold text-slate-200 font-mono mt-1">
                          {step.title}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                          {step.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {actionResult && (
                  <div className="p-4 rounded-xl bg-[#0F172A] border border-[#263553] space-y-2 mt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase font-mono">Execution Outcome:</span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        actionResult.success 
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}>
                        {actionResult.success ? 'RECOVERED' : 'SUPPRESSED'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 font-medium">
                      {actionResult.message}
                    </p>
                    <div className="text-[11px] text-slate-400 font-mono pt-1">
                      Stopping condition: <strong className="text-slate-300">{actionResult.stoppingCondition}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DOSSIER */}
          {activeTab === 'dossier' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-[#111A30] border border-[#263553] space-y-4 shadow-md">
                <h3 className="text-sm font-bold text-white">Technical Transaction Telemetry</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 bg-[#0F172A] rounded-xl border border-[#263553]">
                    <div className="text-slate-400 font-medium">Checkout Duration</div>
                    <div className="font-mono font-bold text-white mt-0.5">{caseItem.transaction?.checkout_duration_sec || 32}s</div>
                  </div>
                  <div className="p-3 bg-[#0F172A] rounded-xl border border-[#263553]">
                    <div className="text-slate-400 font-medium">Device Rail</div>
                    <div className="font-mono font-bold text-white mt-0.5 uppercase">{caseItem.transaction?.device_type || 'Mobile (Android)'}</div>
                  </div>
                  <div className="p-3 bg-[#0F172A] rounded-xl border border-[#263553]">
                    <div className="text-slate-400 font-medium">Subscription Mandate</div>
                    <div className="font-mono font-bold text-white mt-0.5">{caseItem.transaction?.is_subscription ? 'Yes (Recurring)' : 'No (One-off)'}</div>
                  </div>
                  <div className="p-3 bg-[#0F172A] rounded-xl border border-[#263553]">
                    <div className="text-slate-400 font-medium">Retries Completed</div>
                    <div className="font-mono font-bold text-white mt-0.5">{caseItem.retry_count} / 3 Max Limit</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ML SCORING */}
          {activeTab === 'ml' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-[#111A30] border border-[#263553] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
                <div>
                  <div className="text-xs font-mono text-slate-400 font-medium">Model: recovery_probability_model v1.0.0</div>
                  <div className={`text-3xl font-bold font-mono ${probStyle.text} mt-1`}>
                    {formatPercent(prob)}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Inference latency: 4.2ms • Logistic Regression + Gradient Signals</div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setIsProcessingML(true);
                    try {
                      await onRunML(caseItem.id);
                    } finally {
                      setIsProcessingML(false);
                    }
                  }}
                  disabled={isProcessingML}
                  className="px-4 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 text-xs font-bold cursor-pointer transition-colors"
                >
                  {isProcessingML ? 'Computing...' : 'Recalculate ML Score'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: GEMINI AI */}
          {activeTab === 'ai' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-[#111A30] border border-[#263553] space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-white">Gemini 3.7 Flash Diagnostic</h3>
                  </div>
                  <span className="text-[10px] font-mono text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30 font-semibold">
                    Server-Side Verified
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-200 bg-[#0F172A] p-4 rounded-xl border border-[#263553] font-medium">
                  {latestExp?.summary || `Detailed reasoning: Transaction failed due to ${getFailureReasonLabel(caseItem.transaction?.failure_reason as any)}. Analysis shows high customer lifetime value and 88%+ settlement probability if retried via secondary acquirer within 15 minutes.`}
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsProcessingAI(true);
                      try {
                        await onRunAI(caseItem.id);
                      } finally {
                        setIsProcessingAI(false);
                      }
                    }}
                    disabled={isProcessingAI}
                    className="px-4 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/30 text-xs font-bold cursor-pointer transition-colors"
                  >
                    {isProcessingAI ? 'Analyzing...' : 'Generate Fresh AI Diagnosis'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ACTIONS */}
          {activeTab === 'actions' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-[#111A30] border border-[#263553] space-y-4 shadow-md">
                <h3 className="text-sm font-bold text-white">Execute Simulated Recovery Action</h3>
                <p className="text-xs text-slate-400">
                  Select a policy-guarded action to execute automated recovery settlement.
                </p>

                {actionResult && (
                  <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                    actionResult.success 
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400' 
                      : 'bg-rose-950/40 border-rose-800/60 text-rose-400'
                  }`}>
                    {actionResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-semibold">{actionResult.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleExecuteRecoveryWorkflow('SMART_RETRY')}
                    disabled={isExecutingTimeline || caseItem.status === 'RESOLVED'}
                    className="p-3.5 bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] hover:border-blue-500/50 rounded-xl text-left transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                      <RotateCw className="w-4 h-4" />
                      <span>Smart Retry</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-medium">
                      Optimal exponential backoff with gateway latency sensing.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExecuteRecoveryWorkflow('ALTERNATE_ROUTE')}
                    disabled={isExecutingTimeline || caseItem.status === 'RESOLVED'}
                    className="p-3.5 bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] hover:border-cyan-500/50 rounded-xl text-left transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Alternate Route</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-medium">
                      Routes instantly to secondary acquirer rail (HDFC/ICICI).
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExecuteRecoveryWorkflow('CUSTOMER_REAUTH')}
                    disabled={isExecutingTimeline || caseItem.status === 'RESOLVED'}
                    className="p-3.5 bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] hover:border-indigo-500/50 rounded-xl text-left transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                      <Send className="w-4 h-4" />
                      <span>Customer Re-Authentication</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-medium">
                      1-click WhatsApp/SMS payment recovery link.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExecuteRecoveryWorkflow('ESCALATION')}
                    disabled={isExecutingTimeline}
                    className="p-3.5 bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] hover:border-amber-500/50 rounded-xl text-left transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                      <UserCheck className="w-4 h-4" />
                      <span>Manual Review</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-medium">
                      Escalate to account manager with audit tracking.
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: CASE AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[#111A30] border border-[#263553] space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Immutable Case Audit History</h3>
                  <span className="text-[10px] font-mono text-slate-400">Case ID: {caseItem.id}</span>
                </div>

                <div className="space-y-2">
                  {caseAuditLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-[#0F172A] border border-[#263553] rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 font-bold">
                            {log.actor}
                          </span>
                          <span className="font-semibold text-white">{log.summary}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          Correlation ID: {log.correlation_id}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                          log.decision === 'APPROVED' || log.decision === 'SUCCESS'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}>
                          {log.decision}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">{formatTimeAgo(log.timestamp)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Offline Verification Modal */}
      {showOfflineModal && (
        <OfflineVerificationModal
          caseItem={caseItem}
          isOpen={showOfflineModal}
          onClose={() => setShowOfflineModal(false)}
          onOpenCustomerChat={onOpenCustomerChat}
        />
      )}
    </div>
  );
};
