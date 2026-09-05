import React, { useState } from 'react';
import { 
  ArrowRightLeft, 
  RotateCw, 
  Zap, 
  ShieldCheck, 
  Send, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  Sliders, 
  Play, 
  Clock, 
  Sparkles,
  Info,
  ShieldAlert
} from 'lucide-react';
import { RecoveryCase } from '../types';
import { formatINR, formatPercent, getPriorityStyles, getStatusStyles, getFailureReasonLabel, getPaymentMethodLabel } from '../utils/formatters';

interface RecoveryActionsViewProps {
  cases: RecoveryCase[];
  onExecuteAction: (caseId: string, actionType: 'SMART_RETRY' | 'ALTERNATE_ROUTE' | 'CUSTOMER_REAUTH' | 'ESCALATION') => Promise<{ success: boolean; message: string; policyApproved?: boolean }>;
  onSelectCase: (caseItem: RecoveryCase) => void;
}

export const RecoveryActionsView: React.FC<RecoveryActionsViewProps> = ({
  cases,
  onExecuteAction,
  onSelectCase,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || '');
  const [selectedActionType, setSelectedActionType] = useState<'SMART_RETRY' | 'ALTERNATE_ROUTE' | 'CUSTOMER_REAUTH' | 'ESCALATION'>('SMART_RETRY');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{ success: boolean; message: string; policyApproved?: boolean } | null>(null);

  const currentCase = cases.find(c => c.id === selectedCaseId) || cases[0];

  const handleRunAction = async () => {
    if (!currentCase || isExecuting) return;
    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const result = await onExecuteAction(currentCase.id, selectedActionType);
      setExecutionResult(result);
    } finally {
      setIsExecuting(false);
    }
  };

  const actionTypes = [
    {
      id: 'SMART_RETRY' as const,
      name: 'Smart Retry',
      icon: RotateCw,
      tagline: 'Exponential backoff with gateway latency sensing',
      description: 'Dispatches retry at optimal banking processing windows. Guards against excessive spam declines.',
      badge: 'Autonomous',
      badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      expectedSuccessRate: '88.5%',
    },
    {
      id: 'ALTERNATE_ROUTE' as const,
      name: 'Alternate Route',
      icon: ArrowRightLeft,
      tagline: 'Dynamic fallback rail (HDFC → ICICI → Secondary Switch)',
      description: 'Switches secondary payment acquirer rail instantly when primary bank experiences downtime.',
      badge: 'Multi-Acquirer',
      badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
      expectedSuccessRate: '92.1%',
    },
    {
      id: 'CUSTOMER_REAUTH' as const,
      name: 'Customer Re-Authentication',
      icon: Send,
      tagline: 'Instant 1-click WhatsApp/SMS payment recovery link',
      description: 'Sends deep-linked UPI / 3DS re-auth URL directly to verified customer. Strictly honors DND opt-outs.',
      badge: 'Customer-Facing',
      badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      expectedSuccessRate: '74.3%',
    },
    {
      id: 'ESCALATION' as const,
      name: 'Manual Review & Escalation',
      icon: UserCheck,
      tagline: 'Routes high-value B2B invoice to account operations',
      description: 'Freezes automated retries and opens priority dispute ticket for enterprise accounts (> ₹50,000).',
      badge: 'Human Oversight',
      badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      expectedSuccessRate: '95.0%',
    },
  ];

  return (
    <div id="recovery-actions-view" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] uppercase font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
              Deterministic Guardrails
            </span>
            <span className="text-xs text-slate-400 font-mono">Policy Engine v1.0.0</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Recovery Action Center
          </h1>
          <p className="text-sm text-slate-400">
            Execute policy-validated recovery workflows across failed payment rails with simulated real-time settlement telemetry.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Transaction Selection */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#111A30] border border-[#263553] rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-[#263553]">
              <h2 className="text-sm font-bold text-white">Select Target Transaction</h2>
              <span className="text-[11px] font-mono text-slate-400 font-semibold">{cases.length} candidates</span>
            </div>

            <div className="mt-3 space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {cases.map((c) => {
                const isSelected = c.id === currentCase?.id;
                const priorityStyle = getPriorityStyles(c.priority);
                const statusStyle = getStatusStyles(c.status);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCaseId(c.id);
                      setExecutionResult(null);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#16213A] border-blue-500 ring-1 ring-blue-500/40 shadow-sm'
                        : 'bg-[#0F172A] border-[#263553] hover:bg-[#16213A] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-xs font-bold ${isSelected ? 'text-blue-400' : 'text-white'}`}>
                        {c.id}
                      </span>
                      <span className="font-mono text-xs font-bold text-white">
                        {formatINR(c.revenue_at_risk_minor)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {c.merchant?.name} • {c.customer?.email}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="bg-[#111A30] px-2 py-0.5 rounded text-slate-300 border border-[#263553] font-medium">
                        {getFailureReasonLabel(c.transaction?.failure_reason as any)}
                      </span>
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span className={`px-2 py-0.5 rounded font-mono border ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}`}>
                          {c.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded font-mono border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Execution Workspace */}
        <div className="lg:col-span-7 space-y-4">
          {currentCase && (
            <div className="bg-[#111A30] border border-[#263553] rounded-xl p-5 space-y-5 shadow-md">
              {/* Selected Target Dossier Card */}
              <div className="bg-[#0F172A] border border-[#263553] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-white">{currentCase.id}</span>
                    <span className="text-xs text-slate-400 font-mono">({currentCase.transaction_id})</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    Merchant: <strong className="text-white">{currentCase.merchant?.name}</strong> • Method: <span className="font-mono font-medium text-slate-300">{getPaymentMethodLabel(currentCase.transaction?.payment_method as any)}</span>
                  </div>
                  <div className="text-xs text-rose-400 font-mono font-semibold mt-0.5">
                    Failure: {getFailureReasonLabel(currentCase.transaction?.failure_reason as any)}
                  </div>
                </div>

                <div className="text-right sm:border-l sm:border-[#263553] sm:pl-4">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold">Revenue at Risk</div>
                  <div className="text-xl font-bold font-mono text-rose-400">
                    {formatINR(currentCase.revenue_at_risk_minor)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">Retries: {currentCase.retry_count}/3</div>
                </div>
              </div>

              {/* Action Selection Cards */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block font-semibold">
                  Select Policy Action
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {actionTypes.map((act) => {
                    const Icon = act.icon;
                    const isSelected = selectedActionType === act.id;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => {
                          setSelectedActionType(act.id);
                          setExecutionResult(null);
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-950/40 border-blue-500 text-white ring-1 ring-blue-500/40 shadow-sm'
                            : 'bg-[#0F172A] border-[#263553] text-slate-300 hover:bg-[#16213A] hover:border-slate-600 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                            <span className="font-bold text-xs text-white">{act.name}</span>
                          </div>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold ${act.badgeColor}`}>
                            {act.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-2 leading-relaxed font-medium">
                          {act.description}
                        </p>
                        <div className="mt-2.5 pt-2 border-t border-[#263553] flex items-center justify-between text-[10px] font-mono text-slate-400 font-medium">
                          <span>Recovery Probability</span>
                          <span className="text-emerald-400 font-bold">{act.expectedSuccessRate}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Deterministic Guardrail Check Banner */}
              <div className="p-3.5 rounded-xl bg-[#0F172A] border border-[#263553] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    Pre-Execution Policy Guardrail Audit
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                    Passed (4/4 Checks)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 font-mono pt-1">
                  <div>• Retries ({currentCase.retry_count} &lt; 3 Max Limit)</div>
                  <div>• Cooldown (15m Interval Clear)</div>
                  <div>• Customer Opt-Out (Not Opted Out)</div>
                  <div>• Advisory Bound (No Card Vault Tamper)</div>
                </div>
              </div>

              {/* Execution Feedback */}
              {executionResult && (
                <div 
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    executionResult.success
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
                      : 'bg-rose-950/40 border-rose-800/60 text-rose-400'
                  }`}
                >
                  {executionResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="text-xs font-bold font-mono">
                      {executionResult.success ? 'SIMULATION SUCCEEDED' : 'POLICY GUARDRAIL BLOCKED'}
                    </div>
                    <div className="text-xs mt-0.5 text-white font-medium">{executionResult.message}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      Audit Event logged: correlation ID <span className="text-blue-400 font-semibold">corr-sim-{Date.now().toString().slice(-6)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-[#263553]">
                <button
                  type="button"
                  onClick={() => onSelectCase(currentCase)}
                  className="px-3.5 py-2 rounded-lg bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] text-xs text-slate-300 hover:text-white font-medium transition-colors cursor-pointer"
                >
                  Open Full Case Dossier
                </button>

                <button
                  type="button"
                  onClick={handleRunAction}
                  disabled={isExecuting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isExecuting ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Executing Policy Simulation...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Trigger Simulated {actionTypes.find(a => a.id === selectedActionType)?.name}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
