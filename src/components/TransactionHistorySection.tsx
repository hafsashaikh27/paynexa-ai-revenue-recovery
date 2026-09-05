import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  Calendar, 
  ArrowUpDown, 
  ChevronDown, 
  ChevronRight, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  RotateCcw, 
  Download, 
  Check, 
  CreditCard, 
  Building2, 
  Layers,
  ArrowUpRight,
  HelpCircle,
  Clock,
  MessageSquare,
  Banknote
} from 'lucide-react';
import { RecoveryCase } from '../types';
import { 
  formatINR, 
  formatDateFull, 
  formatDateOnly, 
  formatPercent, 
  getFailureReasonLabel, 
  getPaymentMethodLabel, 
  getProbabilityColor, 
  getRiskLevelStyles,
  isTransactionSuccessful,
  getRecoveryStatusLabel
} from '../utils/formatters';
import { exportTransactionsToExcel } from '../utils/excelExport';
import { matchCaseQuery, getCustomerDisplayName, highlightMatch } from '../utils/searchUtils';

interface TransactionHistorySectionProps {
  cases: RecoveryCase[];
  onSelectCase: (caseItem: RecoveryCase) => void;
  onOpenCustomerChat?: (caseId: string) => void;
  externalStatusFilter?: StatusTabFilter;
  onStatusFilterChange?: (filter: StatusTabFilter) => void;
}

type StatusTabFilter = 'ALL' | 'SUCCESSFUL' | 'UNSUCCESSFUL';
type SortField = 'date' | 'amount' | 'score' | 'status';
type SortOrder = 'asc' | 'desc';

export const TransactionHistorySection: React.FC<TransactionHistorySectionProps> = ({
  cases,
  onSelectCase,
  onOpenCustomerChat,
  externalStatusFilter,
  onStatusFilterChange,
}) => {
  const [internalStatusFilter, setInternalStatusFilter] = useState<StatusTabFilter>('ALL');
  
  // Use controlled or internal status filter
  const statusFilter = externalStatusFilter !== undefined ? externalStatusFilter : internalStatusFilter;
  const setStatusFilter = (newFilter: StatusTabFilter) => {
    setInternalStatusFilter(newFilter);
    if (onStatusFilterChange) {
      onStatusFilterChange(newFilter);
    }
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [activeDatePreset, setActiveDatePreset] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Dynamic status counts from the authoritative transaction dataset
  const totalCount = cases.length;
  const successfulCount = useMemo(
    () => cases.filter((c) => isTransactionSuccessful(c)).length,
    [cases]
  );
  const unsuccessfulCount = useMemo(
    () => cases.filter((c) => !isTransactionSuccessful(c)).length,
    [cases]
  );

  // Handle Preset Date Range Selection
  const handleDatePreset = (preset: 'all' | 'today' | '7d' | '30d' | 'this_month') => {
    setActiveDatePreset(preset);
    const now = new Date('2026-08-29T23:59:59Z');

    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'today') {
      const todayStr = '2026-08-29';
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === '7d') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDateFrom(past7.toISOString().split('T')[0]);
      setDateTo(now.toISOString().split('T')[0]);
    } else if (preset === '30d') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setDateFrom(past30.toISOString().split('T')[0]);
      setDateTo(now.toISOString().split('T')[0]);
    } else if (preset === 'this_month') {
      setDateFrom('2026-08-01');
      setDateTo('2026-08-31');
    }
    setCurrentPage(1);
  };

  // Filtered & Sorted Transactions
  const filteredCases = useMemo(() => {
    return cases.filter((caseItem) => {
      const isSuccess = isTransactionSuccessful(caseItem);

      // Status tab filter
      if (statusFilter === 'SUCCESSFUL' && !isSuccess) return false;
      if (statusFilter === 'UNSUCCESSFUL' && isSuccess) return false;

      // Date range filter
      if (dateFrom || dateTo) {
        const itemDateStr = formatDateOnly(caseItem.created_at);
        if (dateFrom && itemDateStr < dateFrom) return false;
        if (dateTo && itemDateStr > dateTo) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        if (!matchCaseQuery(caseItem, searchQuery)) return false;
      }

      return true;
    });
  }, [cases, statusFilter, dateFrom, dateTo, searchQuery]);

  // Sorted cases
  const sortedCases = useMemo(() => {
    return [...filteredCases].sort((a, b) => {
      if (sortField === 'date') {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      if (sortField === 'amount') {
        return sortOrder === 'asc'
          ? a.revenue_at_risk_minor - b.revenue_at_risk_minor
          : b.revenue_at_risk_minor - a.revenue_at_risk_minor;
      }
      if (sortField === 'score') {
        const scoreA = a.predictions?.[0]?.prediction ?? (isTransactionSuccessful(a) ? 1.0 : 0.7);
        const scoreB = b.predictions?.[0]?.prediction ?? (isTransactionSuccessful(b) ? 1.0 : 0.7);
        return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      }
      if (sortField === 'status') {
        const statusA = isTransactionSuccessful(a) ? 'SUCCESSFUL' : 'UNSUCCESSFUL';
        const statusB = isTransactionSuccessful(b) ? 'SUCCESSFUL' : 'UNSUCCESSFUL';
        return sortOrder === 'asc' ? statusA.localeCompare(statusB) : statusB.localeCompare(statusA);
      }
      return 0;
    });
  }, [filteredCases, sortField, sortOrder]);

  // Paginated records
  const paginatedCases = useMemo(() => {
    if (pageSize === -1) return sortedCases;
    const startIndex = (currentPage - 1) * pageSize;
    return sortedCases.slice(startIndex, startIndex + pageSize);
  }, [sortedCases, currentPage, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(sortedCases.length / pageSize) || 1;

  // Toggle sorting helper
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Download Excel Report Handler
  const handleDownloadExcel = async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      await exportTransactionsToExcel(sortedCases, {
        statusFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        searchQuery: searchQuery.trim() || undefined,
      });

      setIsExporting(false);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    } catch (err) {
      console.error('Error generating Excel file:', err);
      setIsExporting(false);
    }
  };

  const resetAllFilters = () => {
    setStatusFilter('ALL');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setActiveDatePreset('all');
    setCurrentPage(1);
  };

  return (
    <section 
      id="transaction-history-section" 
      className="bg-[#111A30] border border-[#263553] rounded-2xl overflow-hidden shadow-xl space-y-4"
    >
      {/* Section Header */}
      <div className="p-5 pb-4 border-b border-[#263553] flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0E162B]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Transaction History</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
              Live Feed · Multi-Rail
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time payment settlements, failure telemetry, and autonomous recoverability scores.
          </p>
        </div>

        {/* Action Controls: Download Excel Report */}
        <div className="flex items-center gap-3 self-start lg:self-auto">
          <button
            id="download-excel-report-btn"
            onClick={handleDownloadExcel}
            disabled={isExporting || sortedCases.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold font-mono transition-all duration-150 shadow-md cursor-pointer ${
              exportSuccess
                ? 'bg-emerald-600 text-white border border-emerald-500'
                : isExporting
                ? 'bg-blue-600/70 text-blue-200 cursor-wait'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-500/50 hover:shadow-emerald-900/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Download multi-sheet Excel (.xlsx) transaction report"
          >
            {exportSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-100" />
                <span>✓ Report Downloaded</span>
              </>
            ) : isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Generating XLSX...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                <span>Download Excel Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs & Filter Toolbar */}
      <div className="px-5 space-y-4">
        {/* 1. Status Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div 
            id="transaction-status-tabs"
            className="flex items-center p-1 bg-[#090E1C] rounded-xl border border-[#263553]"
          >
            {/* ALL TAB */}
            <button
              id="tab-filter-all"
              onClick={() => {
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span>ALL</span>
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                statusFilter === 'ALL' ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-300'
              }`}>
                {totalCount}
              </span>
            </button>

            {/* SUCCESSFUL TAB */}
            <button
              id="tab-filter-successful"
              onClick={() => {
                setStatusFilter('SUCCESSFUL');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                statusFilter === 'SUCCESSFUL'
                  ? 'bg-emerald-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/20'
              }`}
            >
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                SUCCESSFUL
              </span>
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                statusFilter === 'SUCCESSFUL' ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
              }`}>
                {successfulCount}
              </span>
            </button>

            {/* UNSUCCESSFUL TAB */}
            <button
              id="tab-filter-unsuccessful"
              onClick={() => {
                setStatusFilter('UNSUCCESSFUL');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                statusFilter === 'UNSUCCESSFUL'
                  ? 'bg-rose-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-rose-300 hover:bg-rose-950/20'
              }`}
            >
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                UNSUCCESSFUL
              </span>
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                statusFilter === 'UNSUCCESSFUL' ? 'bg-rose-800 text-rose-100' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
              }`}>
                {unsuccessfulCount}
              </span>
            </button>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-mono text-slate-400 uppercase mr-1 hidden sm:inline">Range:</span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: 'this_month', label: 'This Month' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleDatePreset(preset.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
                  activeDatePreset === preset.id
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 bg-[#0F172A] border border-[#263553]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Secondary Filter Toolbar: Search + Date Pickers + Reset */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-[#0A1022] rounded-xl border border-[#263553]">
          {/* Search Box */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="transaction-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by Transaction ID (e.g. PX-8942-01), customer, merchant, rail..."
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-[#111A30] border border-[#263553] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Date From */}
          <div className="md:col-span-3 flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-400 shrink-0">From:</span>
            <input
              id="date-filter-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setActiveDatePreset('custom');
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#111A30] border border-[#263553] text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            />
          </div>

          {/* Date To */}
          <div className="md:col-span-3 flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-400 shrink-0">To:</span>
            <input
              id="date-filter-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setActiveDatePreset('custom');
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#111A30] border border-[#263553] text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Filter Meta Feedback Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-1 pb-1">
          <div className="flex items-center gap-2">
            <span>Showing <strong className="text-white">{sortedCases.length}</strong> transactions</span>
            {(statusFilter !== 'ALL' || searchQuery || dateFrom || dateTo) && (
              <span className="text-[11px] text-blue-300 font-mono">
                (Filtered from {totalCount} total)
              </span>
            )}
          </div>

          {(statusFilter !== 'ALL' || searchQuery || dateFrom || dateTo) && (
            <button
              onClick={resetAllFilters}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Transaction Data Table */}
      <div className="overflow-x-auto border-t border-[#263553]">
        <table id="transactions-data-table" className="w-full text-left text-xs border-collapse">
          {/* Table Header */}
          <thead className="bg-[#090E1C] border-b border-[#263553] text-slate-400 font-mono text-[10px] uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th 
                className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Transaction ID & Date</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th className="py-3.5 px-4">Customer</th>
              <th className="py-3.5 px-4">Merchant</th>

              <th 
                className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('amount')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Amount</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th className="py-3.5 px-4">Payment Rail</th>

              <th 
                className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Status</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th className="py-3.5 px-4">Failure Reason</th>
              <th className="py-3.5 px-4">Recovery Status</th>

              <th 
                className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('score')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Recovery Score</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#263553]">
            {paginatedCases.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 px-4 text-center">
                  <div className="max-w-sm mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                      <Search className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-white">No transactions found</div>
                    <p className="text-xs text-slate-400">
                      No transaction records match your active search or date filters.
                    </p>
                    <button
                      onClick={resetAllFilters}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedCases.map((caseItem) => {
                const isSuccess = isTransactionSuccessful(caseItem);
                const prob = caseItem.predictions?.[0]?.prediction ?? (isSuccess ? 0.98 : 0.72);
                const probStyle = getProbabilityColor(prob);
                const formattedTxId = caseItem.transaction_id || caseItem.id.replace('rc-', 'PX-');
                const failureLabel = isSuccess
                  ? 'None (Settled)'
                  : getFailureReasonLabel(caseItem.transaction?.failure_reason as any) || 'Network Timeout';
                const recStatus = getRecoveryStatusLabel(caseItem);

                return (
                  <tr
                    key={caseItem.id}
                    id={`tx-row-${caseItem.id}`}
                    onClick={() => onSelectCase(caseItem)}
                    className={`transition-all cursor-pointer group ${
                      !isSuccess
                        ? 'bg-rose-950/15 hover:bg-rose-950/25 border-l-4 border-l-rose-500'
                        : 'bg-[#0E1528] hover:bg-[#16213A] border-l-4 border-l-transparent'
                    }`}
                  >
                    {/* 1. Transaction ID & Date */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-white group-hover:text-blue-400 transition-colors">
                          {searchQuery ? highlightMatch(formattedTxId, searchQuery) : formattedTxId}
                        </span>
                        {caseItem.is_simulation && (
                          <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/40">
                            SIM
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatDateFull(caseItem.created_at)}</span>
                      </div>
                    </td>

                    {/* 2. Customer */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-semibold text-slate-200 truncate max-w-[180px]">
                        {searchQuery ? highlightMatch(getCustomerDisplayName(caseItem.customer), searchQuery) : getCustomerDisplayName(caseItem.customer)}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                        {searchQuery ? highlightMatch(caseItem.customer?.email || '', searchQuery) : (caseItem.customer?.email || '')}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        LTV: {formatINR(caseItem.customer?.lifetime_value_minor || 0)}
                      </div>
                    </td>

                    {/* 3. Merchant */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-300 font-medium whitespace-nowrap">
                          {searchQuery ? highlightMatch(caseItem.merchant?.name || 'Enterprise Merchant', searchQuery) : (caseItem.merchant?.name || 'Enterprise Merchant')}
                        </span>
                      </div>
                    </td>

                    {/* 4. Amount */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-sm text-white">
                        {formatINR(caseItem.revenue_at_risk_minor)}
                      </div>
                      {isSuccess && caseItem.recovered_amount_minor > 0 && (
                        <div className="text-[10px] text-emerald-400 font-mono font-medium">
                          Recovered
                        </div>
                      )}
                    </td>

                    {/* 5. Payment Rail */}
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-[#0A1020] text-slate-300 border border-[#263553] whitespace-nowrap">
                        {getPaymentMethodLabel(caseItem.transaction?.payment_method as any)}
                      </span>
                    </td>

                    {/* 6. Status */}
                    <td className="py-3.5 px-4">
                      {isSuccess ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          SUCCESSFUL
                        </span>
                      ) : caseItem.offline_verification_status === 'IN_REVIEW' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 whitespace-nowrap shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                          IN REVIEW (Step {caseItem.offline_verification_step || 2}/3)
                        </span>
                      ) : caseItem.offline_verification_status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                          OFFLINE PENDING
                        </span>
                      ) : caseItem.offline_verification_status === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 whitespace-nowrap shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          NOT VERIFIED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 whitespace-nowrap shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                          UNSUCCESSFUL
                        </span>
                      )}
                    </td>

                    {/* 7. Failure Reason */}
                    <td className="py-3.5 px-4">
                      <span className={`text-[11px] font-mono ${
                        isSuccess ? 'text-slate-400' : 'text-rose-300 font-medium'
                      }`}>
                        {failureLabel}
                      </span>
                    </td>

                    {/* 8. Recovery Status */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                        isSuccess
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : caseItem.offline_verification_status === 'IN_REVIEW'
                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          : caseItem.offline_verification_status === 'PENDING'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : caseItem.offline_verification_status === 'REJECTED'
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : recStatus === 'ESCALATED'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      }`}>
                        {caseItem.offline_verification_status === 'IN_REVIEW'
                          ? `IN REVIEW (${caseItem.offline_verification_step || 2}/3)`
                          : caseItem.offline_verification_status === 'PENDING'
                          ? 'OFFLINE VERIFY'
                          : caseItem.offline_verification_status === 'REJECTED'
                          ? 'NOT VERIFIED'
                          : recStatus}
                      </span>
                    </td>

                    {/* 9. Recovery Score */}
                    <td className="py-3.5 px-4">
                      {isSuccess ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>100% (Settled)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${probStyle.bar}`}
                              style={{ width: `${prob * 100}%` }}
                            ></div>
                          </div>
                          <span className={`font-mono font-bold ${probStyle.text}`}>
                            {formatPercent(prob)}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* 10. Action Buttons */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {onOpenCustomerChat && (
                          <button
                            id={`btn-chat-${caseItem.id}`}
                            onClick={() => onOpenCustomerChat(caseItem.id)}
                            className="p-1.5 rounded-lg bg-[#111A30] hover:bg-purple-600/20 text-purple-300 hover:text-purple-200 border border-[#263553] hover:border-purple-500/40 text-xs transition-colors cursor-pointer"
                            title="Open Customer Communications"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          id={`btn-view-details-${caseItem.id}`}
                          onClick={() => onSelectCase(caseItem)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#16223D] hover:bg-blue-600 text-slate-200 hover:text-white border border-[#263553] hover:border-blue-500 text-xs font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap shadow-xs"
                        >
                          View Details →
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

      {/* 4. Table Pagination & Items Count */}
      <div className="p-4 border-t border-[#263553] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 bg-[#090E1C]">
        <div className="flex items-center gap-3">
          <span>
            Page <strong className="text-white">{currentPage}</strong> of <strong className="text-white">{totalPages}</strong>
          </span>
          <span className="text-slate-600">•</span>
          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-[#111A30] border border-[#263553] text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={-1}>All ({sortedCases.length})</option>
            </select>
          </div>
        </div>

        {/* Pagination Navigation */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-lg bg-[#111A30] border border-[#263553] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`w-7 h-7 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  currentPage === p
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-[#111A30] border border-[#263553] text-slate-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-lg bg-[#111A30] border border-[#263553] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
