import React, { useState } from 'react';
import { 
  Banknote, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Building2, 
  User, 
  MessageSquare, 
  ChevronRight,
  ShieldCheck,
  CheckSquare,
  Sparkles,
  Search
} from 'lucide-react';
import { RecoveryCase } from '../types';
import { formatINR, formatTimeAgo } from '../utils/formatters';
import { recoveryService } from '../services/recoveryService';
import { OfflineVerificationModal } from './OfflineVerificationModal';

interface OfflineVerificationSectionProps {
  cases: RecoveryCase[];
  onOpenCustomerChat: (caseId: string) => void;
  onSelectCase?: (caseItem: RecoveryCase) => void;
}

export const OfflineVerificationSection: React.FC<OfflineVerificationSectionProps> = ({
  cases,
  onOpenCustomerChat,
  onSelectCase,
}) => {
  const [selectedCaseForReview, setSelectedCaseForReview] = useState<RecoveryCase | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  // Pending verification cases
  const pendingCases = cases.filter(
    c => c.offline_verification_status === 'PENDING' || c.offline_verification_status === 'IN_REVIEW'
  );

  if (pendingCases.length === 0) {
    return null;
  }

  const filteredCases = filterQuery.trim() === ''
    ? pendingCases
    : pendingCases.filter(c => 
        c.transaction_id?.toLowerCase().includes(filterQuery.toLowerCase()) ||
        c.customer?.email?.toLowerCase().includes(filterQuery.toLowerCase()) ||
        c.merchant?.name?.toLowerCase().includes(filterQuery.toLowerCase())
      );

  return (
    <>
      <div 
        id="offline-verification-merchant-widget"
        className="rounded-2xl bg-gradient-to-r from-[#172033] via-[#111A30] to-[#151F36] border-2 border-amber-500/40 p-5 shadow-xl space-y-4 relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#263553] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide font-mono uppercase">
                  OFFLINE PAYMENT VERIFICATION
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-pulse">
                  {pendingCases.length} Pending {pendingCases.length === 1 ? 'Case' : 'Cases'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Customers reported offline counter cash or bank deposits. Complete the 8-point merchant verification checklist to settle transactions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 hidden md:inline">
              Click [ REVIEW / VERIFY ] on any case below to begin
            </span>
          </div>
        </div>

        {/* Grid of Pending Offline Cases */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCases.map((c) => {
            const amountStr = formatINR(c.transaction?.amount_minor ?? c.revenue_at_risk_minor ?? 0);
            const txId = c.transaction_id || c.id.replace('rc-', 'PX-');
            const completedCount = c.offline_checklist 
              ? Object.values(c.offline_checklist).filter(Boolean).length 
              : 0;

            return (
              <div
                key={c.id}
                id={`offline-verify-card-${c.id}`}
                className="p-4 rounded-xl bg-[#0B1120] border border-[#263553] space-y-3.5 shadow-md hover:border-amber-500/50 transition-all flex flex-col justify-between"
              >
                {/* Header Info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">
                          {txId}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                          Cash / Offline
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 font-semibold truncate max-w-[200px]">
                        {c.customer?.email}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        <span>{c.merchant?.name}</span>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base font-mono font-bold text-amber-300">
                        {amountStr}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {c.offline_reported_at ? formatTimeAgo(c.offline_reported_at) : '10m ago'}
                      </div>
                    </div>
                  </div>

                  {/* Checklist Summary progress */}
                  <div className="p-2.5 rounded-lg bg-[#111A30] border border-[#1E2C4A] text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Checklist Progress:</span>
                      <span className={`font-bold ${completedCount > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                        {completedCount} / 8 Verified
                      </span>
                    </div>
                    <div className="w-full h-1 bg-[#1A2642] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-400 transition-all"
                        style={{ width: `${(completedCount / 8) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions: Review / Verify and Chat */}
                <div className="space-y-2 pt-1">
                  <button
                    id={`btn-review-verify-${c.id}`}
                    onClick={() => setSelectedCaseForReview(c)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer uppercase tracking-wide"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-950" />
                    <span>REVIEW / VERIFY</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      id={`btn-chat-offline-${c.id}`}
                      onClick={() => onOpenCustomerChat(c.id)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#111A30] hover:bg-[#182647] border border-[#223354] text-blue-300 hover:text-blue-200 text-[11px] font-mono font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <MessageSquare className="w-3 h-3 text-blue-400" />
                      <span>Communications</span>
                    </button>

                    {onSelectCase && (
                      <button
                        onClick={() => onSelectCase(c)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#111A30] hover:bg-[#182647] border border-[#223354] text-slate-400 hover:text-slate-200 text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DETAILED VERIFICATION MODAL / PANEL */}
      <OfflineVerificationModal
        caseItem={selectedCaseForReview}
        isOpen={!!selectedCaseForReview}
        onClose={() => setSelectedCaseForReview(null)}
        onOpenCustomerChat={onOpenCustomerChat}
      />
    </>
  );
};
