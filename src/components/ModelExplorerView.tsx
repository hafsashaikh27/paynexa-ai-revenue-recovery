import React, { useState } from 'react';
import { 
  Cpu, 
  Sparkles, 
  Layers, 
  Activity, 
  ShieldCheck, 
  Sliders, 
  CheckCircle2, 
  Bot, 
  Terminal,
  Zap,
  ArrowRight
} from 'lucide-react';
import { formatINR, formatPercent, getProbabilityColor } from '../utils/formatters';

export const ModelExplorerView: React.FC = () => {
  // Interactive Playground State
  const [amountRupees, setAmountRupees] = useState<number>(4500);
  const [failureReason, setFailureReason] = useState<string>('NETWORK_TIMEOUT');
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [pastSuccesses, setPastSuccesses] = useState<number>(8);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isSubscription, setIsSubscription] = useState<boolean>(true);
  const [hasOptedOut, setHasOptedOut] = useState<boolean>(false);

  // Compute live prediction
  let score = 0.65;
  if (failureReason === 'NETWORK_TIMEOUT') score += 0.24;
  else if (failureReason === 'BANK_ERROR') score += 0.18;
  else if (failureReason === 'INSUFFICIENT_FUNDS') score += 0.04;
  else if (failureReason === 'AUTH_FAILED') score += 0.10;
  else if (failureReason === 'CARD_DECLINED') score -= 0.32;
  else if (failureReason === 'FRAUD_REVIEW') score -= 0.55;

  if (pastSuccesses > 5) score += 0.14;
  if (isSubscription) score += 0.08;
  if (retryCount > 1) score -= 0.22;
  if (hasOptedOut) score -= 0.40;

  const finalScore = Math.min(Math.max(score, 0.05), 0.98);
  const probStyle = getProbabilityColor(finalScore);

  return (
    <div id="models-view-container" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="rounded-2xl bg-[#111A30] border border-[#263553] p-6 space-y-2 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm">
            <Cpu className="w-4 h-4" />
          </div>
          <h1 className="text-xl font-bold text-white">ML Inference & Feature Architecture</h1>
          <span className="text-[10px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold">
            recovery_probability_model v1.0.0
          </span>
        </div>
        <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
          The PayNexa ML pipeline extracts 14 deterministic transaction, customer behavioral, and gateway telemetry features to estimate payment settlement likelihood before any automated recovery action is dispatched.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Simulation Sandbox (7 cols) */}
        <div className="lg:col-span-7 bg-[#111A30] border border-[#263553] rounded-xl p-5 space-y-5 shadow-md">
          <div className="flex items-center justify-between border-b border-[#263553] pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-white">Real-Time ML Inference Sandbox</h2>
            </div>
            <span className="text-[10px] font-mono text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded border border-blue-500/30 font-bold">
              Interactive
            </span>
          </div>

          <div className="space-y-4">
            {/* Input 1: Transaction Amount */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <label className="text-slate-300">Transaction Amount</label>
                <span className="font-mono text-blue-400 font-bold">{formatINR(amountRupees * 100)}</span>
              </div>
              <input
                type="range"
                min="100"
                max="100000"
                step="100"
                value={amountRupees}
                onChange={(e) => setAmountRupees(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer bg-[#0F172A]"
              />
            </div>

            {/* Input 2: Failure Reason */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Gateway Failure Reason</label>
                <select
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full bg-[#0F172A] border border-[#263553] text-xs text-slate-200 font-medium rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                >
                  <option value="NETWORK_TIMEOUT">Network Timeout (Transient)</option>
                  <option value="BANK_ERROR">Bank Gateway Maintenance</option>
                  <option value="INSUFFICIENT_FUNDS">Insufficient Balance</option>
                  <option value="AUTH_FAILED">3DS OTP Timeout</option>
                  <option value="CARD_DECLINED">Card Declined (Hard)</option>
                  <option value="FRAUD_REVIEW">Fraud Filter Flag</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-[#0F172A] border border-[#263553] text-xs text-slate-200 font-medium rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                >
                  <option value="UPI">UPI Instant</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="NET_BANKING">Net Banking</option>
                </select>
              </div>
            </div>

            {/* Input 3: Customer History & Retries */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <label className="text-slate-300">Past Successful Payments</label>
                  <span className="font-mono text-white font-bold">{pastSuccesses}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={pastSuccesses}
                  onChange={(e) => setPastSuccesses(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer bg-[#0F172A]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <label className="text-slate-300">Retries Attempted</label>
                  <span className="font-mono text-white font-bold">{retryCount} / 3</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  value={retryCount}
                  onChange={(e) => setRetryCount(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer bg-[#0F172A]"
                />
              </div>
            </div>

            {/* Input 4: Toggles */}
            <div className="flex flex-wrap items-center gap-6 pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-200 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSubscription}
                  onChange={(e) => setIsSubscription(e.target.checked)}
                  className="accent-blue-600 rounded cursor-pointer"
                />
                <span>Active Subscription Mandate</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-200 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasOptedOut}
                  onChange={(e) => setHasOptedOut(e.target.checked)}
                  className="accent-rose-500 rounded cursor-pointer"
                />
                <span>Customer Opted Out</span>
              </label>
            </div>
          </div>

          {/* Real-time Computed Gauge Result */}
          <div className="mt-4 p-4 rounded-xl bg-[#0F172A] border border-[#263553] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Predicted Recovery Probability</div>
              <div className={`text-3xl font-bold font-mono ${probStyle.text}`}>
                {formatPercent(finalScore)}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 font-medium">
                Estimated Inference Latency: <span className="text-white font-mono font-bold">3.8ms</span>
              </div>
            </div>

            <div className="text-right">
              <span className={`px-3 py-1 rounded text-xs font-mono font-bold border ${
                finalScore >= 0.75 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                finalScore >= 0.45 ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}>
                {finalScore >= 0.75 ? 'AUTO RETRY RECOMMENDED' : finalScore >= 0.45 ? 'SMART LINK NUDGE' : 'HUMAN ESCALATION'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Pipeline Architecture & Guardrails (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#111A30] border border-[#263553] rounded-xl p-5 space-y-4 shadow-md">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Feature Extractor Vector (14 Inputs)</h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#0F172A] border border-[#263553] flex items-center justify-between font-mono">
                <span className="text-slate-300 font-medium">revenue_at_risk_minor</span>
                <span className="text-blue-400 font-bold">float64 (log normalized)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0F172A] border border-[#263553] flex items-center justify-between font-mono">
                <span className="text-slate-300 font-medium">failure_reason</span>
                <span className="text-indigo-400 font-bold">One-Hot (7 classes)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0F172A] border border-[#263553] flex items-center justify-between font-mono">
                <span className="text-slate-300 font-medium">customer_clearance_ratio</span>
                <span className="text-emerald-400 font-bold">success / total</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0F172A] border border-[#263553] flex items-center justify-between font-mono">
                <span className="text-slate-300 font-medium">retry_count</span>
                <span className="text-rose-400 font-bold">int (fatigue penalty)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0F172A] border border-[#263553] flex items-center justify-between font-mono">
                <span className="text-slate-300 font-medium">is_subscription</span>
                <span className="text-purple-400 font-bold">boolean flag</span>
              </div>
            </div>
          </div>

          <div className="bg-[#111A30] border border-[#263553] rounded-xl p-5 space-y-3 shadow-md">
            <div className="flex items-center gap-2 text-blue-400">
              <ShieldCheck className="w-4 h-4" />
              <h3 className="text-sm font-bold text-white">Advisory Safety Verification</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Every inference and LLM prompt runs through a strict sanitization gateway:
            </p>
            <div className="space-y-1.5 text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cardholder PII & PAN stripped from prompt payloads</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Deterministic JSON schema response enforcement</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Advisory output isolation (no raw execution capability)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
