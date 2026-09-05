import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  SlidersHorizontal, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RotateCcw,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Bot
} from 'lucide-react';
import { 
  RecoveryCase, 
  FilterState, 
  CaseStatus, 
  CasePriority, 
  PaymentMethod, 
  FailureReason 
} from '../types';
import { 
  formatINR, 
  formatPercent, 
  getPriorityStyles, 
  getStatusStyles, 
  getFailureReasonLabel, 
  getPaymentMethodLabel, 
  getProbabilityColor, 
  formatTimeAgo 
} from '../utils/formatters';
import { matchCaseQuery } from '../utils/searchUtils';

interface CasesListViewProps {
  cases: RecoveryCase[];
  onSelectCase: (caseItem: RecoveryCase) => void;
  onSimulateML: (caseId: string) => void;
  onSimulateAI: (caseId: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const CasesListView: React.FC<CasesListViewProps> = ({
  cases,
  onSelectCase,
  onSimulateML,
  onSimulateAI,
  searchQuery,
  setSearchQuery,
}) => {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'ALL',
    priority: 'ALL',
    paymentMethod: 'ALL',
    failureReason: 'ALL',
    merchantCategory: 'ALL',
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Filter and sort logic
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Global and local search
      const query = searchQuery || filters.search;
      if (query && query.trim()) {
        if (!matchCaseQuery(c, query)) return false;
      }

      if (filters.status !== 'ALL' && c.status !== filters.status) return false;
      if (filters.priority !== 'ALL' && c.priority !== filters.priority) return false;
      if (filters.paymentMethod !== 'ALL' && c.transaction?.payment_method !== filters.paymentMethod) return false;
      if (filters.failureReason !== 'ALL' && c.transaction?.failure_reason !== filters.failureReason) return false;

      return true;
    }).sort((a, b) => {
      let valA: any = a.created_at;
      let valB: any = b.created_at;

      if (filters.sortBy === 'revenue') {
        valA = a.revenue_at_risk_minor;
        valB = b.revenue_at_risk_minor;
      } else if (filters.sortBy === 'probability') {
        valA = a.predictions?.[0]?.prediction ?? 0;
        valB = b.predictions?.[0]?.prediction ?? 0;
      } else if (filters.sortBy === 'priority') {
        const rank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        valA = rank[a.priority] || 0;
        valB = rank[b.priority] || 0;
      }

      if (filters.sortOrder === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
  }, [cases, filters, searchQuery]);

  const totalPages = Math.ceil(filteredCases.length / pageSize) || 1;
  const paginatedCases = filteredCases.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetFilters = () => {
    setFilters({
      search: '',
      status: 'ALL',
      priority: 'ALL',
      paymentMethod: 'ALL',
      failureReason: 'ALL',
      merchantCategory: 'ALL',
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
    setSearchQuery('');
    setCurrentPage(1);
  };

  const hasActiveFilters = 
    filters.status !== 'ALL' || 
    filters.priority !== 'ALL' || 
    filters.paymentMethod !== 'ALL' || 
    filters.failureReason !== 'ALL' || 
    searchQuery.length > 0;

  return (
    <div id="cases-list-container" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Overview bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Recovery Cases Explorer</h1>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
              {filteredCases.length} of {cases.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time transaction recovery queue with live ML inference and policy automation.
          </p>
        </div>

        {hasActiveFilters && (
          <button
            id="reset-filters-btn"
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111A30] hover:bg-[#16213A] border border-[#263553] text-xs font-semibold text-slate-300 hover:text-white transition-colors self-start sm:self-auto cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Filters</span>
          </button>
        )}
      </div>

      {/* Filter Control Bar */}
      <div 
        id="cases-filter-bar"
        className="bg-[#111A30] border border-[#263553] rounded-xl p-4 space-y-3 shadow-md"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Case Status
            </label>
            <select
              id="filter-status-select"
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value as any });
                setCurrentPage(1);
              }}
              className="w-full bg-[#0F172A] border border-[#263553] text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 focus:bg-[#16213A] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">NEW</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="ESCALATED">ESCALATED</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Risk Priority
            </label>
            <select
              id="filter-priority-select"
              value={filters.priority}
              onChange={(e) => {
                setFilters({ ...filters, priority: e.target.value as any });
                setCurrentPage(1);
              }}
              className="w-full bg-[#0F172A] border border-[#263553] text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 focus:bg-[#16213A] cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          {/* Failure Reason Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Failure Reason
            </label>
            <select
              id="filter-failure-select"
              value={filters.failureReason}
              onChange={(e) => {
                setFilters({ ...filters, failureReason: e.target.value as any });
                setCurrentPage(1);
              }}
              className="w-full bg-[#0F172A] border border-[#263553] text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 focus:bg-[#16213A] cursor-pointer"
            >
              <option value="ALL">All Failure Codes</option>
              <option value="NETWORK_TIMEOUT">Network Timeout</option>
              <option value="INSUFFICIENT_FUNDS">Insufficient Funds</option>
              <option value="CARD_DECLINED">Card Declined</option>
              <option value="BANK_ERROR">Bank Gateway Error</option>
              <option value="AUTH_FAILED">3DS OTP Timeout</option>
              <option value="FRAUD_REVIEW">Fraud Review</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Payment Rail
            </label>
            <select
              id="filter-payment-method-select"
              value={filters.paymentMethod}
              onChange={(e) => {
                setFilters({ ...filters, paymentMethod: e.target.value as any });
                setCurrentPage(1);
              }}
              className="w-full bg-[#0F172A] border border-[#263553] text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 focus:bg-[#16213A] cursor-pointer"
            >
              <option value="ALL">All Payment Rails</option>
              <option value="UPI">UPI</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="DEBIT_CARD">Debit Card</option>
              <option value="NET_BANKING">Net Banking</option>
            </select>
          </div>
        </div>

        {/* Sort & Search Strip */}
        <div className="pt-3 border-t border-[#263553] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Sort by:</span>
            <button
              onClick={() => setFilters({ ...filters, sortBy: 'created_at', sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1 border cursor-pointer ${
                filters.sortBy === 'created_at' ? 'bg-blue-600 text-white border-blue-500 font-bold' : 'bg-[#0F172A] text-slate-300 border-[#263553] hover:bg-[#16213A]'
              }`}
            >
              Date <ArrowUpDown className="w-3 h-3" />
            </button>
            <button
              onClick={() => setFilters({ ...filters, sortBy: 'revenue', sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1 border cursor-pointer ${
                filters.sortBy === 'revenue' ? 'bg-blue-600 text-white border-blue-500 font-bold' : 'bg-[#0F172A] text-slate-300 border-[#263553] hover:bg-[#16213A]'
              }`}
            >
              Amount <ArrowUpDown className="w-3 h-3" />
            </button>
            <button
              onClick={() => setFilters({ ...filters, sortBy: 'probability', sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1 border cursor-pointer ${
                filters.sortBy === 'probability' ? 'bg-blue-600 text-white border-blue-500 font-bold' : 'bg-[#0F172A] text-slate-300 border-[#263553] hover:bg-[#16213A]'
              }`}
            >
              ML Score <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredCases.length)} of {filteredCases.length}
          </div>
        </div>
      </div>

      {/* Main Cases Data Table */}
      <div 
        id="cases-table-wrapper"
        className="bg-[#111A30] border border-[#263553] rounded-xl overflow-hidden shadow-md"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0F172A] border-b border-[#263553] text-slate-400 font-mono text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Case ID</th>
                <th className="py-3 px-4">Customer & Merchant</th>
                <th className="py-3 px-4">Amount at Risk</th>
                <th className="py-3 px-4">Payment Rail</th>
                <th className="py-3 px-4">Failure Diagnostic</th>
                <th className="py-3 px-4">ML Recovery Prob</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263553]">
              {paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-200">No recovery cases match your filters</p>
                    <p className="text-xs mt-1 text-slate-400">Try resetting the filter criteria or search query.</p>
                  </td>
                </tr>
              ) : (
                paginatedCases.map((caseItem) => {
                  const priorityStyle = getPriorityStyles(caseItem.priority);
                  const statusStyle = getStatusStyles(caseItem.status);
                  const prob = caseItem.predictions?.[0]?.prediction ?? 0.5;
                  const probStyle = getProbabilityColor(prob);

                  return (
                    <tr 
                      key={caseItem.id}
                      className="hover:bg-[#16213A] transition-colors cursor-pointer group"
                      onClick={() => onSelectCase(caseItem)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-white group-hover:text-blue-400 transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>{caseItem.id}</span>
                          {caseItem.is_simulation && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              SIM
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal">{formatTimeAgo(caseItem.created_at)}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white truncate max-w-[160px]">
                          {caseItem.customer?.email || 'customer@domain.com'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {caseItem.merchant?.name}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        <div>{formatINR(caseItem.revenue_at_risk_minor)}</div>
                        {caseItem.recovered_amount_minor > 0 && (
                          <div className="text-[10px] text-emerald-400 font-semibold">
                            Recovered: {formatINR(caseItem.recovered_amount_minor)}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-slate-300 bg-[#0F172A] px-2 py-0.5 rounded border border-[#263553] font-mono text-[11px]">
                          {getPaymentMethodLabel(caseItem.transaction?.payment_method as any)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-slate-200 font-medium text-xs">
                          {getFailureReasonLabel(caseItem.transaction?.failure_reason as any)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Retries: {caseItem.retry_count}/3
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${probStyle.bar}`}
                              style={{ width: `${prob * 100}%` }}
                            ></div>
                          </div>
                          <span className={`font-mono font-bold text-xs ${probStyle.text}`}>
                            {formatPercent(prob)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}`}>
                          {caseItem.priority}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                          {caseItem.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`list-predict-btn-${caseItem.id}`}
                            onClick={() => onSimulateML(caseItem.id)}
                            className="p-1.5 rounded-lg bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                            title="Re-run ML Inference"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`list-ai-btn-${caseItem.id}`}
                            onClick={() => onSimulateAI(caseItem.id)}
                            className="p-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-400 transition-colors cursor-pointer"
                            title="Generate AI Explanation"
                          >
                            <Bot className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`list-open-btn-${caseItem.id}`}
                            onClick={() => onSelectCase(caseItem)}
                            className="px-2.5 py-1 rounded-lg bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Inspect
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-[#263553] bg-[#0F172A] flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-lg bg-[#111A30] border border-[#263553] text-xs font-semibold text-slate-300 hover:bg-[#16213A] disabled:opacity-40 transition-colors cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-lg bg-[#111A30] border border-[#263553] text-xs font-semibold text-slate-300 hover:bg-[#16213A] disabled:opacity-40 transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
