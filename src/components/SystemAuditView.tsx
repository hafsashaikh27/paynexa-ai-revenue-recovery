import React, { useState } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  Database, 
  Cpu, 
  Bot, 
  ShieldCheck, 
  Terminal, 
  RefreshCw,
  Clock,
  Server,
  Lock,
  AlertTriangle,
  FileText,
  Filter,
  Sparkles
} from 'lucide-react';
import { recoveryService } from '../services/recoveryService';
import { AuditLog } from '../types';
import { formatTimeAgo } from '../utils/formatters';

export const SystemAuditView: React.FC = () => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>(new Date().toLocaleTimeString());
  const [correlationId] = useState<string>(`req-${Math.random().toString(36).substring(2, 9)}`);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => recoveryService.getAuditLogs());
  const [selectedActorFilter, setSelectedActorFilter] = useState<string>('ALL');

  const handleVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setLastCheckTime(new Date().toLocaleTimeString());
      setAuditLogs([...recoveryService.getAuditLogs()]);
    }, 500);
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (selectedActorFilter === 'ALL') return true;
    return log.actor === selectedActorFilter;
  });

  return (
    <div id="system-audit-container" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-[#111A30] border border-[#263553] p-6 shadow-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm">
              <Activity className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-white">System Safety & Immutable Audit Trail</h1>
            <span className="text-[10px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold">
              GUARDED • ACTIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Deterministic policy guardrails, cryptographic idempotency verifications, AI recommendation validations, and end-to-end event traceability.
          </p>
        </div>

        <button
          id="run-audit-btn"
          onClick={handleVerify}
          disabled={isVerifying}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-[#16213A] text-blue-400 border border-[#263553] text-xs font-bold transition-all self-start sm:self-auto disabled:opacity-50 cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
          <span>{isVerifying ? 'Verifying Integrity...' : 'Refresh Audit Stream'}</span>
        </button>
      </div>

      {/* Safety Guardrails Architecture Card */}
      <div className="bg-[#111A30] border border-[#263553] rounded-2xl p-6 relative overflow-hidden shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
            Deterministic Guardrail Architecture
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#0F172A] border border-[#263553] space-y-2">
            <div className="flex items-center gap-2 text-blue-400 font-bold font-mono">
              <Sparkles className="w-4 h-4" />
              <span>1. AI Recommends</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed font-medium">
              Gemini 3.7 Flash analyzes error codes, latency logs, and customer history to hypothesize optimal dunning.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0F172A] border border-[#263553] space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-bold font-mono">
              <ShieldCheck className="w-4 h-4" />
              <span>2. Policy Validates</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed font-medium">
              Hard deterministic business rules verify max retry limits, opt-out status, and fraud exclusion ceilings.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0F172A] border border-[#263553] space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-bold font-mono">
              <Lock className="w-4 h-4" />
              <span>3. Idempotency Check</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed font-medium">
              Unique request keys guarantee no transaction is doubly debited or subjected to conflicting retry attempts.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0F172A] border border-[#263553] space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold font-mono">
              <Terminal className="w-4 h-4" />
              <span>4. Human Escalation</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed font-medium">
              High-value or disputed transactions above threshold automatically route to human merchant ops.
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#263553] flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Safety Notice: Demo simulation mode active — No live payment network debiting occurs.
          </span>
          <span className="font-mono text-[10px] text-slate-400 font-medium">Session ID: {correlationId}</span>
        </div>
      </div>

      {/* System Readiness Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-[#111A30] border border-[#263553] space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400 font-semibold">API Core Engine</span>
            <Server className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-lg font-bold font-mono text-white">Healthy</div>
          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>FastAPI / Node Server Proxy • 3000ms SLA</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#111A30] border border-[#263553] space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400 font-semibold">Telemetry Database</span>
            <Database className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-lg font-bold font-mono text-emerald-400">Connected</div>
          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted Session Store Active</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#111A30] border border-[#263553] space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400 font-semibold">ML Predictor</span>
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-lg font-bold font-mono text-emerald-400">Model Loaded</div>
          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>v1.0.0 • Latency &lt; 5ms</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#111A30] border border-[#263553] space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400 font-semibold">Gemini 3.7 Provider</span>
            <Bot className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold font-mono text-purple-400">Operational</div>
          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Server-side Key Isolation Verified</span>
          </div>
        </div>
      </div>

      {/* Live Immutable Audit Trail Table */}
      <div className="bg-[#111A30] border border-[#263553] rounded-2xl p-6 space-y-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-white">Live Immutable Audit Trail</h2>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Timestamped chronological ledger of all AI reasoning outputs, policy decisions, and recovery simulations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedActorFilter}
              onChange={(e) => setSelectedActorFilter(e.target.value)}
              className="bg-[#0F172A] border border-[#263553] rounded-lg px-2.5 py-1 text-xs text-slate-200 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Actors</option>
              <option value="AI_AGENT">AI Agent</option>
              <option value="POLICY_ENGINE">Policy Engine</option>
              <option value="SYSTEM">System</option>
              <option value="MERCHANT_ADMIN">Merchant Admin</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#263553] text-slate-400 font-mono text-[11px] uppercase bg-[#0F172A]">
                <th className="py-3 px-3">Timestamp / Ref</th>
                <th className="py-3 px-3">Case & Tx ID</th>
                <th className="py-3 px-3">Actor</th>
                <th className="py-3 px-3">Action Type</th>
                <th className="py-3 px-3">Audit Summary</th>
                <th className="py-3 px-3">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263553]">
              {filteredLogs.map((log) => {
                const decisionStyles: Record<string, string> = {
                  APPROVED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                  SUCCESS: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                  BLOCKED: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                  FLAGGED: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                  DECLINED: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                };
                const style = decisionStyles[log.decision] || 'bg-[#16213A] text-slate-300 border-[#263553]';

                return (
                  <tr key={log.id} className="hover:bg-[#16213A] transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-mono text-white font-bold">{formatTimeAgo(log.timestamp)}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{log.correlation_id}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-mono">
                      <span className="text-blue-400 font-bold">{log.case_id}</span>
                      <span className="text-slate-400 block text-[10px] font-medium">{log.transaction_id}</span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#0F172A] border border-[#263553] text-slate-300 font-semibold">
                        {log.actor}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-200 font-bold">
                      {log.action_type}
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-medium max-w-md">
                      {log.summary}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono border font-bold ${style}`}>
                        {log.decision}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
