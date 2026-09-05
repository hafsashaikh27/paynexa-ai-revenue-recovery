import React, { useState } from 'react';
import { 
  DollarSign, 
  ShieldAlert, 
  TrendingUp, 
  Bot, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle,
  Zap,
  CheckCircle2,
  Clock,
  ChevronRight,
  Sparkles,
  Layers,
  BarChart3,
  Activity,
  ArrowRightLeft,
  Calendar,
  FileSpreadsheet,
  Check,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Building2,
  CreditCard,
  Wallet,
  Smartphone,
  Info,
  ArrowUp,
  ArrowDown,
  Percent
} from 'lucide-react';
import { DashboardSummary, RecoveryCase } from '../types';
import { 
  formatINR, 
  formatCompactINR, 
  formatPercent, 
  getPriorityStyles, 
  getStatusStyles, 
  getFailureReasonLabel, 
  getPaymentMethodLabel, 
  getProbabilityColor, 
  formatTimeAgo,
  isTransactionSuccessful,
  getRecoveryStatusLabel
} from '../utils/formatters';
import { calculateRevenueMetrics } from '../utils/revenueCalculations';
import { TransactionHistorySection } from './TransactionHistorySection';
import { OfflineVerificationSection } from './OfflineVerificationSection';
import { exportTransactionsToExcel } from '../utils/excelExport';

interface OverviewViewProps {
  summary: DashboardSummary;
  cases: RecoveryCase[];
  onSelectCase: (caseItem: RecoveryCase) => void;
  onNavigateToCases: () => void;
  onSimulateML: (caseId: string) => void;
  onSimulateAI: (caseId: string) => void;
  onSimulateNewFailure?: () => void;
  isSimulating?: boolean;
  onOpenAssistant?: () => void;
  onOpenCustomerChat?: (caseId: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  summary,
  cases,
  onSelectCase,
  onNavigateToCases,
  onSimulateML,
  onSimulateAI,
  onSimulateNewFailure,
  isSimulating = false,
  onOpenAssistant,
  onOpenCustomerChat,
}) => {
  const [chartTimeframe, setChartTimeframe] = useState<'7D' | '30D' | 'TODAY'>('7D');
  const [isExportingHeader, setIsExportingHeader] = useState(false);
  const [headerExportSuccess, setHeaderExportSuccess] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<'ALL' | 'SUCCESSFUL' | 'UNSUCCESSFUL'>('ALL');

  // Single authoritative calculation for revenue and recovery metrics
  const metrics = calculateRevenueMetrics(cases);

  const totalTransactionsCount = metrics.total_transactions_count;
  const successfulCases = cases.filter((c) => isTransactionSuccessful(c));
  const unsuccessfulCases = cases.filter((c) => !isTransactionSuccessful(c));
  const criticalCases = cases.filter((c) => c.priority === 'CRITICAL' || c.priority === 'HIGH');

  // Rail breakdown
  const railsBreakdown = [
    { name: 'UPI / QR', count: cases.filter(c => c.transaction?.payment_method === 'UPI').length, color: 'from-emerald-500 to-teal-500', icon: Smartphone },
    { name: 'Credit Cards', count: cases.filter(c => c.transaction?.payment_method === 'CREDIT_CARD').length, color: 'from-blue-500 to-indigo-500', icon: CreditCard },
    { name: 'Net Banking', count: cases.filter(c => c.transaction?.payment_method === 'NET_BANKING').length, color: 'from-purple-500 to-pink-500', icon: Building2 },
    { name: 'Debit Cards', count: cases.filter(c => c.transaction?.payment_method === 'DEBIT_CARD').length, color: 'from-amber-500 to-orange-500', icon: CreditCard },
    { name: 'Wallets', count: cases.filter(c => c.transaction?.payment_method === 'WALLET').length, color: 'from-cyan-500 to-blue-500', icon: Wallet },
  ];

  // Performance Chart points for 7D view
  const chartPoints = [
    { day: 'Mon', atRiskINR: 420000, recoveredINR: 310000, rate: 73.8 },
    { day: 'Tue', atRiskINR: 380000, recoveredINR: 295000, rate: 77.6 },
    { day: 'Wed', atRiskINR: 490000, recoveredINR: 390000, rate: 79.5 },
    { day: 'Thu', atRiskINR: 350000, recoveredINR: 270000, rate: 77.1 },
    { day: 'Fri', atRiskINR: 520000, recoveredINR: 415000, rate: 79.8 },
    { day: 'Sat', atRiskINR: 310000, recoveredINR: 245000, rate: 79.0 },
    { day: 'Sun (Today)', atRiskINR: metrics.current_revenue_at_risk_inr, recoveredINR: metrics.recovered_revenue_inr, rate: metrics.recovery_rate },
  ];

  const handleHeaderExcelExport = async () => {
    setIsExportingHeader(true);
    setHeaderExportSuccess(false);
    try {
      await exportTransactionsToExcel(cases, { statusFilter: 'ALL' });
      setIsExportingHeader(false);
      setHeaderExportSuccess(true);
      setTimeout(() => setHeaderExportSuccess(false), 3500);
    } catch (err) {
      console.error(err);
      setIsExportingHeader(false);
    }
  };

  const scrollToTransactions = (tab: 'ALL' | 'SUCCESSFUL' | 'UNSUCCESSFUL') => {
    setActiveStatusFilter(tab);
    const element = document.getElementById('transaction-history-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div id="overview-view-container" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner: PayNexa Control Center Operational Status */}
      <div 
        id="overview-hero-card"
        className="rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#16213A] to-[#111A30] border border-[#263553] text-white p-6 relative overflow-hidden shadow-xl"
      >
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-blue-500/15 via-purple-500/10 to-transparent pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded font-mono text-[10px] uppercase font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Payment Operations Control Center
              </span>
              <span className="text-xs text-blue-300 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Gemini 3.7 Flash Copilot Active • 100% Policy Safe
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>PayNexa — AI Revenue Recovery Platform</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Autonomous payment failure telemetry, real-time ML recoverability scoring, dynamic smart retries, and comprehensive audit trail verification.
            </p>
          </div>

          {/* Quick Header Operational Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onSimulateNewFailure && (
              <button
                id="hero-simulate-btn"
                onClick={onSimulateNewFailure}
                disabled={isSimulating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold font-mono bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-500/50 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Simulating Event...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                    <span>Simulate Payment Event</span>
                  </>
                )}
              </button>
            )}

            <button
              id="hero-export-excel-btn"
              onClick={handleHeaderExcelExport}
              disabled={isExportingHeader}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold font-mono border transition-all cursor-pointer shadow-md ${
                headerExportSuccess
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-[#111A30] hover:bg-[#16223D] text-slate-200 hover:text-white border-[#263553]'
              }`}
            >
              {headerExportSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-100" />
                  <span>Report Downloaded</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. REVENUE OVERVIEW: 4 CORE FINANCIAL IMPACT METRIC CARDS */}
      {/* ========================================================================= */}
      <section id="revenue-impact-section" className="space-y-3">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-1 border-b border-[#263553]">
          <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Revenue Overview</span>
          </h2>
        </div>

        {/* 4 Core Metric Cards Grid */}
        <div id="revenue-impact-cards-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* CARD 1: TOTAL TRANSACTION VALUE */}
          <div 
            id="impact-card-total-transaction-value"
            onClick={() => scrollToTransactions('ALL')}
            className="bg-[#111A30] hover:bg-[#14203D] border border-[#263553] hover:border-blue-500/50 rounded-2xl p-5 space-y-3 transition-all duration-200 shadow-md group cursor-pointer relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Total Transaction Value
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
                {formatINR(metrics.total_transaction_value_minor)}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-1">
                {metrics.total_transactions_count} transactions
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-mono border-t border-[#1C2844] pt-2">
              All transactions in reporting period
            </div>
          </div>

          {/* CARD 2: REVENUE AT RISK */}
          <div 
            id="impact-card-revenue-at-risk"
            onClick={() => scrollToTransactions('UNSUCCESSFUL')}
            className="bg-[#181628] hover:bg-[#201c34] border border-rose-900/40 hover:border-rose-500/50 rounded-2xl p-5 space-y-3 transition-all duration-200 shadow-md group cursor-pointer relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wider font-mono">
                Revenue At Risk
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-rose-400 tracking-tight">
                {formatINR(metrics.current_revenue_at_risk_minor)}
              </div>
              
              {/* Before -> Now Sub-box */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 mt-2 bg-[#0E0C17] px-2.5 py-1.5 rounded-lg border border-rose-950/60">
                <span>Before <strong className="text-slate-300">{formatCompactINR(metrics.initial_revenue_at_risk_minor)}</strong></span>
                <span className="text-rose-400">→</span>
                <span>Now <strong className="text-rose-300">{formatCompactINR(metrics.current_revenue_at_risk_minor)}</strong></span>
              </div>
            </div>

            {/* Indicator */}
            <div className="flex items-center gap-1 text-xs font-mono text-emerald-400 border-t border-rose-950/60 pt-2 font-medium">
              <ArrowDown className="w-3 h-3 text-emerald-400" />
              <span>↓ {formatCompactINR(metrics.risk_reduction_minor)} at risk</span>
            </div>
          </div>

          {/* CARD 3: RECOVERED REVENUE */}
          <div 
            id="impact-card-recovered-revenue"
            onClick={() => scrollToTransactions('SUCCESSFUL')}
            className="bg-[#0E1E28] hover:bg-[#122634] border border-emerald-900/40 hover:border-emerald-500/50 rounded-2xl p-5 space-y-3 transition-all duration-200 shadow-md group cursor-pointer relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider font-mono">
                Recovered Revenue
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 tracking-tight">
                {formatINR(metrics.recovered_revenue_minor)}
              </div>
              
              {/* Before -> Now Sub-box */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 mt-2 bg-[#09141D] px-2.5 py-1.5 rounded-lg border border-emerald-950/60">
                <span>Before <strong className="text-slate-300">₹0</strong></span>
                <span className="text-emerald-400">→</span>
                <span>Now <strong className="text-emerald-300">{formatCompactINR(metrics.recovered_revenue_minor)}</strong></span>
              </div>
            </div>

            {/* Indicator */}
            <div className="flex items-center gap-1 text-xs font-mono text-emerald-400 border-t border-emerald-950/60 pt-2 font-medium">
              <ArrowUp className="w-3 h-3 text-emerald-400" />
              <span>↑ {formatCompactINR(metrics.recovered_revenue_minor)} recovered</span>
            </div>
          </div>

          {/* CARD 4: RECOVERY RATE */}
          <div 
            id="impact-card-recovery-rate"
            onClick={() => scrollToTransactions('ALL')}
            className="bg-[#16152F] hover:bg-[#1E1B3E] border border-indigo-900/40 hover:border-indigo-500/50 rounded-2xl p-5 space-y-3 transition-all duration-200 shadow-md group cursor-pointer relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider font-mono">
                Recovery Rate
              </span>
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                <Percent className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-indigo-200 tracking-tight">
                {metrics.recovery_rate.toFixed(1)}%
              </div>
              
              <div className="text-xs font-mono text-slate-300 mt-2 bg-[#0E0D21] px-2.5 py-1.5 rounded-lg border border-indigo-950/60">
                <span className="text-emerald-400 font-semibold">{formatCompactINR(metrics.recovered_revenue_minor)}</span>
                <span className="text-slate-400"> recovered from </span>
                <span className="text-slate-300 font-semibold">{formatCompactINR(metrics.initial_revenue_at_risk_minor)}</span>
                <span className="text-slate-400"> initially at risk</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 font-mono border-t border-indigo-950/60 pt-2 flex items-center justify-between">
              <span>{successfulCases.length} of {metrics.total_transactions_count} settled</span>
              <span className="text-indigo-400 font-medium">{formatCompactINR(metrics.recovered_revenue_minor)} / {formatCompactINR(metrics.initial_revenue_at_risk_minor)}</span>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. OFFLINE PAYMENT VERIFICATION SECTION (MERCHANT WORKFLOW) */}
      {/* ========================================================================= */}
      <OfflineVerificationSection
        cases={cases}
        onOpenCustomerChat={onOpenCustomerChat || ((id) => {})}
        onSelectCase={onSelectCase}
      />

      {/* ========================================================================= */}
      {/* 3. PRIMARY OPERATIONAL CENTER: TRANSACTION HISTORY TABLE */}
      {/* ========================================================================= */}
      <TransactionHistorySection
        cases={cases}
        onSelectCase={onSelectCase}
        onOpenCustomerChat={onOpenCustomerChat}
        externalStatusFilter={activeStatusFilter}
        onStatusFilterChange={setActiveStatusFilter}
      />

      {/* ========================================================================= */}
      {/* 3. RISK & RECOVERY ANALYTICS (Charts & Rail Telemetry) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recovery Performance Trend */}
        <div 
          id="recovery-performance-chart-card"
          className="lg:col-span-8 bg-[#111A30] border border-[#263553] rounded-2xl p-5 space-y-4 shadow-md"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#263553]">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-white">Recovery Performance Trend</h2>
              </div>
              <p className="text-xs text-slate-400">
                Historical failure volume at risk vs autonomous recovered capital.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-[#0F172A] p-1 rounded-lg border border-[#263553]">
              {(['7D', '30D', 'TODAY'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setChartTimeframe(tf)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
                    chartTimeframe === tf
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Visual SVG Performance Chart */}
          <div className="pt-2">
            <div className="h-52 w-full flex items-end justify-between gap-3 px-2 pt-6 pb-2 relative">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30 px-2 pb-6">
                <div className="border-b border-[#263553] w-full"></div>
                <div className="border-b border-[#263553] w-full"></div>
                <div className="border-b border-[#263553] w-full"></div>
              </div>

              {chartPoints.map((pt, idx) => {
                const maxVal = 600000;
                const atRiskHeightPct = Math.min(100, Math.round((pt.atRiskINR / maxVal) * 100));
                const recoveredHeightPct = Math.min(100, Math.round((pt.recoveredINR / maxVal) * 100));

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end z-10 group">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 bg-[#16213A] border border-[#263553] text-white px-2.5 py-1 rounded-lg text-[10px] font-mono shadow-xl pointer-events-none whitespace-nowrap z-20">
                      Recovered: ₹{pt.recoveredINR.toLocaleString()} ({pt.rate}%)
                    </div>

                    <div className="w-full max-w-[36px] flex items-end justify-center gap-1.5 h-40">
                      {/* At Risk Bar */}
                      <div 
                        className="w-1/2 bg-slate-700/60 group-hover:bg-slate-600 rounded-t transition-all"
                        style={{ height: `${atRiskHeightPct}%` }}
                        title={`Revenue at risk: ₹${pt.atRiskINR.toLocaleString()}`}
                      ></div>
                      {/* Recovered Bar */}
                      <div 
                        className="w-1/2 bg-gradient-to-t from-emerald-600 to-teal-500 group-hover:from-emerald-500 group-hover:to-teal-400 rounded-t transition-all shadow-xs"
                        style={{ height: `${recoveredHeightPct}%` }}
                        title={`Recovered: ₹${pt.recoveredINR.toLocaleString()}`}
                      ></div>
                    </div>

                    <div className="text-[10px] font-mono text-slate-400 group-hover:text-slate-200 font-medium transition-colors truncate w-full text-center">
                      {pt.day.split(' ')[0]}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend & Stats */}
            <div className="pt-3 border-t border-[#263553] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-xs bg-slate-700"></div>
                  <span className="text-slate-400">At-Risk Volume</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-xs bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                  <span className="text-emerald-400 font-bold">Recovered Revenue</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400">
                Blended Velocity: <strong className="text-emerald-400 font-bold">{formatINR(metrics.recovered_revenue_minor)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Rail Telemetry & Guardrail Summary */}
        <div 
          id="payment-rails-card"
          className="lg:col-span-4 bg-[#111A30] border border-[#263553] rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-md"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#263553]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-white">Payment Rail Distribution</h2>
              </div>
              <span className="text-[10px] font-mono text-slate-300 font-semibold bg-[#0F172A] border border-[#263553] px-2 py-0.5 rounded">
                {totalTransactionsCount} TX Total
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {railsBreakdown.map((rail, idx) => {
                const pct = totalTransactionsCount > 0 ? Math.round((rail.count / totalTransactionsCount) * 100) : 0;
                const IconComponent = rail.icon;
                return (
                  <div key={idx} className="p-2.5 bg-[#0F172A] border border-[#263553] rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium text-slate-200">
                        <IconComponent className="w-3.5 h-3.5 text-blue-400" />
                        <span>{rail.name}</span>
                      </div>
                      <span className="font-mono text-slate-300 font-bold">{rail.count} cases ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${rail.color}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#263553] flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              Policy Guardrails Active
            </span>
            <span className="text-slate-300">Deterministic</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. AI COPILOT & PRIORITY QUEUE SECTION */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Priority Action Queue */}
        <div 
          id="priority-queue-card"
          className="lg:col-span-8 bg-[#111A30] border border-[#263553] rounded-2xl overflow-hidden shadow-md"
        >
          <div className="p-5 border-b border-[#263553] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white">
                  High-Priority Recovery Queue
                </h2>
                <span className="text-[10px] font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-semibold">
                  {criticalCases.length} Cases
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Flagged for high-value enterprise accounts, timeout failovers, or escalation review.
              </p>
            </div>

            <button
              id="view-all-cases-btn"
              onClick={onNavigateToCases}
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors self-start sm:self-auto cursor-pointer"
            >
              <span>View All Cases</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0F172A] border-b border-[#263553] text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Case & Customer</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Failure Code</th>
                  <th className="py-3 px-4">ML Score</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263553]">
                {criticalCases.slice(0, 4).map((caseItem) => {
                  const prob = caseItem.predictions?.[0]?.prediction ?? 0.75;
                  const probStyle = getProbabilityColor(prob);
                  const isSuccess = isTransactionSuccessful(caseItem);

                  return (
                    <tr 
                      key={caseItem.id}
                      className="hover:bg-[#16213A] transition-colors cursor-pointer group"
                      onClick={() => onSelectCase(caseItem)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-white group-hover:text-blue-400 transition-colors">
                          {caseItem.transaction_id || caseItem.id}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                          {caseItem.customer?.email || 'customer@domain.com'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {formatINR(caseItem.revenue_at_risk_minor)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-300 bg-[#0F172A] px-2 py-1 rounded border border-[#263553] text-[11px] font-mono">
                          {getFailureReasonLabel(caseItem.transaction?.failure_reason as any)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`font-mono font-bold ${probStyle.text}`}>
                          {isSuccess ? '100%' : formatPercent(prob)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectCase(caseItem)}
                          className="px-3 py-1 rounded-lg bg-[#0F172A] hover:bg-blue-600 text-slate-300 hover:text-white border border-[#263553] hover:border-blue-500 text-xs font-semibold transition-all cursor-pointer"
                        >
                          Review →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Copilot Quick Assistant Card */}
        <div 
          id="ai-copilot-summary-card"
          className="lg:col-span-4 bg-gradient-to-b from-[#111A30] to-[#0D1527] border border-[#263553] rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-md"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#263553]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">PayNexa AI Copilot</h2>
                  <p className="text-[10px] text-purple-300 font-mono">Powered by Gemini 3.7 Flash</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                ONLINE
              </span>
            </div>

            <div className="p-3 bg-[#0A0F1E] rounded-xl border border-[#263553] space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-blue-300 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Autonomous Recovery Engine Insight:</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                6 active unsuccessful transactions detected. Highest recovery affinity is on transient gateway timeouts (91.2% success probability). Recommended instant smart retry via secondary ICICI/HDFC acquiring rail.
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
                <span>Deterministic Guardrails:</span>
                <span className="text-emerald-400 font-bold">POL-RETRY-01 (Active)</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
                <span>Fraud Escalation Policy:</span>
                <span className="text-amber-400 font-bold">POL-FRAUD-LOCK (Active)</span>
              </div>
            </div>
          </div>

          {onOpenAssistant && (
            <button
              onClick={onOpenAssistant}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-semibold font-mono flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Bot className="w-4 h-4" />
              <span>Open PayNexa AI Assistant →</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
