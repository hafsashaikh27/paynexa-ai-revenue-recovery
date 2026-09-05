import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Building2,
  Banknote,
  RotateCw,
  Eye,
  ArrowRight,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Send,
  Filter,
  Check,
  Zap,
  Info,
  Layers,
  FileSpreadsheet,
  Activity,
  ArrowLeft,
  Smartphone,
  CreditCard,
  Lock,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { RecoveryCase, CustomerRecoveryMessage } from '../types';
import { 
  formatINR, 
  formatTimeAgo, 
  getFailureReasonLabel,
  getPaymentMethodLabel 
} from '../utils/formatters';
import { 
  isTransactionSuccessful,
  getCustomerFriendlyFailureReason,
  getRecommendedAlternativeMethods 
} from '../utils/customerChatUtils';
import { 
  matchCaseQuery, 
  getCustomerDisplayName, 
  highlightMatch 
} from '../utils/searchUtils';
import { recoveryService } from '../services/recoveryService';
import { CustomerExperiencePreviewModal } from './CustomerExperiencePreviewModal';
import { CustomerExperienceInteractive } from './CustomerExperienceInteractive';

export type PerspectiveMode = 'merchant' | 'customer';

export type CommunicationFilter = 
  | 'ALL' 
  | 'SUCCESSFUL' 
  | 'UNSUCCESSFUL' 
  | 'RECOVERY_IN_PROGRESS' 
  | 'RECOVERED' 
  | 'OFFLINE_VERIFICATION' 
  | 'PAYMENT_CONFIRMED' 
  | 'PENDING_CUSTOMER_RESPONSE';

interface CustomerCommunicationsViewProps {
  cases?: RecoveryCase[];
  initialCaseId?: string | null;
  selectedCaseId?: string | null;
  initialPerspective?: PerspectiveMode;
  onSelectCaseId?: (caseId: string) => void;
  onNavigateToAudit?: () => void;
  onBackToDashboard?: () => void;
  onSelectCase?: (caseItem: RecoveryCase) => void;
  onOpenOfflineVerification?: (caseId: string) => void;
}

export const CustomerCommunicationsView: React.FC<CustomerCommunicationsViewProps> = ({
  cases: propCases,
  initialCaseId,
  selectedCaseId,
  initialPerspective = 'merchant',
  onSelectCaseId,
  onNavigateToAudit,
  onBackToDashboard,
  onSelectCase,
  onOpenOfflineVerification,
}) => {
  // Top-Level Perspective Switch: Merchant View vs. Customer Experience
  const [perspectiveMode, setPerspectiveMode] = useState<PerspectiveMode>(initialPerspective);

  // Synchronize state with central recoveryService store
  const [allCases, setAllCases] = useState<RecoveryCase[]>(() => {
    const list = recoveryService.getCases();
    return list && list.length > 0 ? list : (propCases || []);
  });

  const effectiveTargetId = initialCaseId || selectedCaseId;

  // Determine initial target case
  const findTargetCase = (targetId?: string | null) => {
    if (targetId) {
      const match = recoveryService.getCaseById(targetId);
      if (match) return match;
    }
    // Prefer pending offline cases, then at-risk cases, then first
    return (
      allCases.find((c) => c.offline_verification_status === 'PENDING') ||
      allCases.find((c) => !isTransactionSuccessful(c)) ||
      allCases[0]
    );
  };

  const [activeCaseId, setActiveCaseId] = useState<string>(() => {
    const found = findTargetCase(effectiveTargetId);
    return found?.id || '';
  });

  // Customer Experience Preview Modal State (for secondary popup preview)
  const [previewModalCase, setPreviewModalCase] = useState<RecoveryCase | null>(null);

  // Search and Filter State for Merchant View
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<CommunicationFilter>('ALL');

  // Search / Selector for Customer Experience Mode
  const [customerExpSearch, setCustomerExpSearch] = useState<string>('');
  const [showSelectorDropdown, setShowSelectorDropdown] = useState<boolean>(false);

  // Simulation Trigger State
  const [isSimulatingEvent, setIsSimulatingEvent] = useState<boolean>(false);
  const [simulationNotice, setSimulationNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to central service store
  useEffect(() => {
    const unsubscribe = recoveryService.subscribe(() => {
      const updatedList = [...recoveryService.getCases()];
      setAllCases(updatedList);
    });
    return () => unsubscribe();
  }, []);

  // Update target when prop target ID changes
  useEffect(() => {
    if (effectiveTargetId) {
      const found = recoveryService.getCaseById(effectiveTargetId);
      if (found) {
        setActiveCaseId(found.id);
      }
    }
  }, [effectiveTargetId]);

  // Resolve current active case from store
  const activeCase =
    recoveryService.getCaseById(activeCaseId) ||
    allCases.find((c) => c.id === activeCaseId || c.transaction_id === activeCaseId) ||
    allCases[0];

  // Auto-scroll message feed in merchant timeline
  useEffect(() => {
    if (perspectiveMode === 'merchant') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeCase?.id, activeCase?.customer_chat_messages?.length, perspectiveMode]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    let totalMessages = 0;
    let successfulMessages = 0;
    let recoveryMessages = 0;
    let pendingCustomerResponses = 0;
    const uniqueCustomerIds = new Set<string>();

    allCases.forEach((c) => {
      if (c.customer?.id || c.customer?.email) {
        uniqueCustomerIds.add(c.customer.id || c.customer.email);
      }
      const msgs = recoveryService.getCustomerMessages(c.id);
      totalMessages += msgs.length;

      const isSuccess = isTransactionSuccessful(c);
      if (isSuccess) {
        successfulMessages += msgs.filter(m => m.type === 'success_confirmation').length || 1;
      } else {
        recoveryMessages += msgs.filter(m => m.sender === 'paynexa' && m.type !== 'success_confirmation').length;
        if (c.offline_verification_status === 'PENDING' || c.status === 'OPEN' || c.status === 'IN_RECOVERY') {
          pendingCustomerResponses += 1;
        }
      }
    });

    return {
      totalCustomers: uniqueCustomerIds.size || allCases.length,
      messagesSent: totalMessages,
      successfulPaymentMessages: successfulMessages,
      recoveryMessages: recoveryMessages,
      pendingCustomerResponses: pendingCustomerResponses,
    };
  }, [allCases]);

  // Filter transactions for merchant inbox
  const filteredCases = useMemo(() => {
    return allCases.filter((c) => {
      // 1. Text Search query
      if (searchQuery.trim()) {
        if (!matchCaseQuery(c, searchQuery)) return false;
      }

      const isSuccess = isTransactionSuccessful(c);
      const isOfflinePending = c.offline_verification_status === 'PENDING' || c.offline_verification_status === 'IN_REVIEW';
      const isOfflineConfirmed = c.offline_verification_status === 'CONFIRMED';

      // 2. Filter tabs
      switch (filterType) {
        case 'SUCCESSFUL':
          return isSuccess;
        case 'UNSUCCESSFUL':
          return !isSuccess;
        case 'RECOVERY_IN_PROGRESS':
          return !isSuccess && !isOfflinePending && c.status !== 'RESOLVED';
        case 'RECOVERED':
          return isSuccess && (c.retry_count > 0 || c.recovered_amount_minor > 0 || isOfflineConfirmed);
        case 'OFFLINE_VERIFICATION':
          return Boolean(c.offline_verification_status && c.offline_verification_status !== 'NONE');
        case 'PAYMENT_CONFIRMED':
          return isOfflineConfirmed || (isSuccess && c.status === 'RESOLVED');
        case 'PENDING_CUSTOMER_RESPONSE':
          return !isSuccess && (c.status === 'OPEN' || c.status === 'IN_RECOVERY' || isOfflinePending);
        case 'ALL':
        default:
          return true;
      }
    });
  }, [allCases, searchQuery, filterType]);

  // Filter cases for customer experience selector
  const customerExpFilteredCases = useMemo(() => {
    if (!customerExpSearch.trim()) return allCases;
    return allCases.filter((c) => matchCaseQuery(c, customerExpSearch));
  }, [allCases, customerExpSearch]);

  // Get active case messages for merchant timeline
  const activeMessages: CustomerRecoveryMessage[] = useMemo(() => {
    if (!activeCase) return [];
    return recoveryService.getCustomerMessages(activeCase.id);
  }, [activeCase, allCases]);

  // Get last message snippet for a case
  const getLastMessageSnippet = (c: RecoveryCase) => {
    const msgs = recoveryService.getCustomerMessages(c.id);
    if (msgs && msgs.length > 0) {
      const last = msgs[msgs.length - 1];
      const cleanText = last.text.replace(/\n+/g, ' ').slice(0, 75);
      return `"${cleanText}..."`;
    }
    const isSuccess = isTransactionSuccessful(c);
    const amountStr = formatINR(c.transaction?.amount_minor ?? c.revenue_at_risk_minor ?? 0);
    if (isSuccess) {
      return `"Your payment of ${amountStr} was successfully completed."`;
    }
    return `"Your payment of ${amountStr} could not be completed. Would you like to try again?"`;
  };

  // Helper to format Recovery Status Label
  const getRecoveryStatusText = (c: RecoveryCase) => {
    const isSuccess = isTransactionSuccessful(c);
    if (isSuccess) {
      return { label: 'RECOVERED', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    }
    if (c.offline_verification_status === 'PENDING' || c.offline_verification_status === 'IN_REVIEW') {
      return { label: 'OFFLINE VERIFICATION PENDING', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    }
    if (c.offline_verification_status === 'REJECTED') {
      return { label: 'VERIFICATION REJECTED', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
    }
    if (c.retry_count >= 2) {
      return { label: 'ALTERNATIVE METHODS OFFERED', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
    }
    if (c.retry_count === 1) {
      return { label: 'RETRY ATTEMPTED', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' };
    }
    return { label: 'RETRY AVAILABLE', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
  };

  // Simulate a realistic payment event to demonstrate live end-to-end automation
  const handleSimulateEvent = async () => {
    setIsSimulatingEvent(true);
    setSimulationNotice(null);
    try {
      const result = await recoveryService.generateOneClickSimulatedEvent();
      setActiveCaseId(result.caseItem.id);
      setSimulationNotice(`Simulated payment event: ${result.caseItem.transaction_id} registered. Automated recovery prompt dispatched.`);
      setTimeout(() => setSimulationNotice(null), 5000);
    } catch (err) {
      console.error('Failed to simulate event:', err);
    } finally {
      setIsSimulatingEvent(false);
    }
  };

  // Switch to customer experience mode for a specific case
  const handleSwitchToCustomerExperience = (caseItem: RecoveryCase) => {
    setActiveCaseId(caseItem.id);
    setPerspectiveMode('customer');
  };

  // Customer Experience Details for active case
  const isCustSuccess = activeCase ? isTransactionSuccessful(activeCase) : false;
  const isCustOfflinePending = activeCase ? (activeCase.offline_verification_status === 'PENDING' || activeCase.offline_verification_status === 'IN_REVIEW') : false;
  const isCustOfflineConfirmed = activeCase ? activeCase.offline_verification_status === 'CONFIRMED' : false;
  const isCustOfflineRejected = activeCase ? activeCase.offline_verification_status === 'REJECTED' : false;
  const hasCustMultipleRetries = activeCase ? (activeCase.retry_count >= 2 || Boolean(activeCase.alternative_methods_offered)) : false;

  const custAmountStr = activeCase ? formatINR(activeCase.transaction?.amount_minor ?? activeCase.revenue_at_risk_minor ?? 0) : '₹0';
  const custTxId = activeCase ? (activeCase.transaction_id || activeCase.id.replace('rc-', 'PX-')) : 'N/A';
  const custDisplayName = activeCase ? getCustomerDisplayName(activeCase.customer) : 'Customer';
  const custMerchantName = activeCase?.merchant?.name || 'PayNexa Enterprise Merchant';
  const custFriendlyReason = activeCase ? getCustomerFriendlyFailureReason(activeCase.transaction?.failure_reason) : 'Payment processing timeout';

  return (
    <div id="customer-communications-hub" className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* ============================================================ */}
      {/* 1. TOP HEADER & PROMINENT PERSPECTIVE SWITCH (MERCHANT vs CUSTOMER) */}
      {/* ============================================================ */}
      <div className="bg-[#0B1222] border border-[#223554] rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Title & Subtitle */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-blue-400" />
                <span>CUSTOMER COMMUNICATIONS</span>
              </h1>
              
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                perspectiveMode === 'merchant'
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
              }`}>
                {perspectiveMode === 'merchant' ? 'MERCHANT-SIDE INTERFACE' : 'READ-ONLY CUSTOMER PREVIEW'}
              </span>
            </div>
            
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              {perspectiveMode === 'merchant'
                ? 'Monitor automated customer communications throughout the payment recovery lifecycle.'
                : 'This is the experience delivered to the customer after a payment event (Web-based link • No app download required).'}
            </p>
          </div>

          {/* PROMINENT TOP-LEVEL VIEW SWITCH (🏢 MERCHANT VIEW / 👤 CUSTOMER EXPERIENCE) */}
          <div className="flex items-center gap-3 flex-wrap">
            
            {/* The Actual Functional Switch */}
            <div 
              id="perspective-view-switch"
              className="inline-flex p-1 bg-[#070D1A] border-2 border-[#22385C] rounded-xl shadow-lg"
              role="tablist"
              aria-label="Perspective Switch"
            >
              <button
                id="switch-merchant-view-tab"
                type="button"
                role="tab"
                aria-selected={perspectiveMode === 'merchant'}
                onClick={() => setPerspectiveMode('merchant')}
                className={`px-4 sm:px-5 py-2 rounded-lg text-xs font-black tracking-wide flex items-center gap-2 transition-all cursor-pointer select-none ${
                  perspectiveMode === 'merchant'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40 ring-1 ring-blue-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#142038]'
                }`}
              >
                <span className="text-sm">🏢</span>
                <span>MERCHANT VIEW</span>
              </button>

              <button
                id="switch-customer-experience-tab"
                type="button"
                role="tab"
                aria-selected={perspectiveMode === 'customer'}
                onClick={() => setPerspectiveMode('customer')}
                className={`px-4 sm:px-5 py-2 rounded-lg text-xs font-black tracking-wide flex items-center gap-2 transition-all cursor-pointer select-none ${
                  perspectiveMode === 'customer'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/40 ring-1 ring-purple-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#142038]'
                }`}
              >
                <span className="text-sm">👤</span>
                <span>CUSTOMER EXPERIENCE</span>
              </button>
            </div>

            {/* Simulation Trigger Button */}
            <button
              id="simulate-payment-event-btn"
              type="button"
              onClick={handleSimulateEvent}
              disabled={isSimulatingEvent}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50"
              title="Simulate a new payment failure event to test automated customer messaging"
            >
              <Zap className={`w-3.5 h-3.5 ${isSimulatingEvent ? 'animate-spin' : 'text-amber-300'}`} />
              <span>{isSimulatingEvent ? 'Dispatching...' : 'Simulate Event'}</span>
            </button>

            {onBackToDashboard && (
              <button
                id="back-to-dashboard-btn"
                type="button"
                onClick={onBackToDashboard}
                className="px-3 py-2 rounded-xl bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
            )}

          </div>

        </div>

        {/* Simulation Feedback Alert */}
        {simulationNotice && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{simulationNotice}</span>
            </div>
            <button onClick={() => setSimulationNotice(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

      </div>

      {/* ============================================================ */}
      {/* PERSPECTIVE 1: MERCHANT VIEW */}
      {/* ============================================================ */}
      {perspectiveMode === 'merchant' && (
        <div id="merchant-view-container" className="space-y-6 animate-in fade-in duration-200">
          
          {/* 5 Summary Statistics Metric Cards */}
          <div 
            id="customer-communication-summary-bar"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
          >
            <div className="bg-[#0F172A] border border-[#223554] rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                TOTAL CUSTOMERS
              </span>
              <div className="text-xl font-bold font-mono text-white">
                {summaryStats.totalCustomers}
              </div>
              <span className="text-[10px] text-slate-400">Unique consumer accounts</span>
            </div>

            <div className="bg-[#0F172A] border border-[#223554] rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                MESSAGES SENT
              </span>
              <div className="text-xl font-bold font-mono text-blue-400">
                {summaryStats.messagesSent}
              </div>
              <span className="text-[10px] text-slate-400">Automated & events</span>
            </div>

            <div className="bg-[#0F172A] border border-[#223554] rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                SUCCESSFUL PAYMENT MESSAGES
              </span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {summaryStats.successfulPaymentMessages}
              </div>
              <span className="text-[10px] text-slate-400">Receipts & confirmations</span>
            </div>

            <div className="bg-[#0F172A] border border-[#223554] rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                RECOVERY MESSAGES
              </span>
              <div className="text-xl font-bold font-mono text-purple-400">
                {summaryStats.recoveryMessages}
              </div>
              <span className="text-[10px] text-slate-400">AI recovery prompts</span>
            </div>

            <div className="bg-[#0F172A] border border-[#223554] rounded-xl p-3.5 space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                PENDING CUSTOMER RESPONSES
              </span>
              <div className="text-xl font-bold font-mono text-amber-400">
                {summaryStats.pendingCustomerResponses}
              </div>
              <span className="text-[10px] text-slate-400">Awaiting customer action</span>
            </div>
          </div>

          {/* Filter Tabs Bar */}
          <div className="bg-[#0F172A] border border-[#223554] rounded-xl p-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <Filter className="w-4 h-4 text-slate-400 ml-2 shrink-0 hidden sm:inline" />
            
            {[
              { id: 'ALL', label: 'ALL' },
              { id: 'SUCCESSFUL', label: 'SUCCESSFUL' },
              { id: 'UNSUCCESSFUL', label: 'UNSUCCESSFUL' },
              { id: 'RECOVERY_IN_PROGRESS', label: 'RECOVERY IN PROGRESS' },
              { id: 'RECOVERED', label: 'RECOVERED' },
              { id: 'OFFLINE_VERIFICATION', label: 'OFFLINE VERIFICATION' },
              { id: 'PAYMENT_CONFIRMED', label: 'PAYMENT CONFIRMED' },
              { id: 'PENDING_CUSTOMER_RESPONSE', label: 'PENDING CUSTOMER RESPONSE' },
            ].map((tab) => {
              const isActive = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`filter-tab-${tab.id.toLowerCase()}`}
                  type="button"
                  onClick={() => setFilterType(tab.id as CommunicationFilter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#16213A]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Main Two-Column Merchant Communication Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: Customer & Transaction Inbox (5 cols) */}
            <div className="lg:col-span-5 bg-[#0F172A] border border-[#223554] rounded-2xl overflow-hidden shadow-lg flex flex-col h-[750px]">
              
              {/* Inbox Header & Search */}
              <div className="p-4 bg-[#121B30] border-b border-[#223554] space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wide">
                      Customer & Transaction Inbox
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {filteredCases.length} {filteredCases.length === 1 ? 'record' : 'records'}
                  </span>
                </div>

                {/* Inbox Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="customer-inbox-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search customers, transaction IDs (e.g. PX-OFF-001), status..."
                    className="w-full bg-[#0B1020] border border-[#223554] hover:border-slate-600 focus:border-blue-500 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Inbox Customer List */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#1A2642] p-2 space-y-1">
                {filteredCases.length > 0 ? (
                  filteredCases.map((c) => {
                    const isSelected = c.id === activeCase?.id;
                    const isSuccess = isTransactionSuccessful(c);
                    const isOfflinePending = c.offline_verification_status === 'PENDING' || c.offline_verification_status === 'IN_REVIEW';
                    const isOfflineConfirmed = c.offline_verification_status === 'CONFIRMED';
                    const amountMinor = c.transaction?.amount_minor ?? c.revenue_at_risk_minor ?? 0;
                    const custName = getCustomerDisplayName(c.customer);
                    const txId = c.transaction_id || c.id.replace('rc-', 'PX-');
                    const lastSnippet = getLastMessageSnippet(c);
                    const statusMeta = getRecoveryStatusText(c);

                    // Determine indicator dot color
                    let dotColor = 'bg-sky-400';
                    if (isSuccess || isOfflineConfirmed) dotColor = 'bg-emerald-400 shadow-emerald-500/50 shadow-sm';
                    else if (isOfflinePending) dotColor = 'bg-amber-400 animate-pulse';
                    else if (c.status === 'ESCALATED' || c.status === 'FAILED') dotColor = 'bg-rose-400';

                    return (
                      <div
                        key={c.id}
                        id={`inbox-item-${txId}`}
                        className={`p-3.5 rounded-xl transition-all border ${
                          isSelected
                            ? 'bg-[#15223E] border-blue-500/50 shadow-md ring-1 ring-blue-500/30'
                            : 'bg-[#0F172A] hover:bg-[#121E36] border-transparent'
                        }`}
                      >
                        {/* Top Row: Customer Name, Status Dot, & Amount */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                            <span className="text-xs font-bold text-white truncate">
                              {searchQuery ? highlightMatch(custName, searchQuery) : custName}
                            </span>
                          </div>

                          <span className="text-xs font-bold font-mono text-white shrink-0">
                            {formatINR(amountMinor)}
                          </span>
                        </div>

                        {/* Meta Row: Transaction ID & Status Badges */}
                        <div className="flex items-center gap-2 flex-wrap text-[11px] mb-2 font-mono">
                          <span className="text-blue-400 font-bold">
                            {searchQuery ? highlightMatch(txId, searchQuery) : txId}
                          </span>
                          
                          <span className="text-slate-400">•</span>

                          {isSuccess ? (
                            <span className="text-emerald-400 font-bold">
                              PAYMENT SUCCESSFUL
                            </span>
                          ) : isOfflinePending ? (
                            <span className="text-amber-400 font-bold">
                              OFFLINE VERIFICATION
                            </span>
                          ) : (
                            <span className="text-rose-400 font-bold">
                              PAYMENT FAILED
                            </span>
                          )}

                          <span className="text-slate-400">•</span>

                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${statusMeta.color}`}>
                            {statusMeta.label}
                          </span>
                        </div>

                        {/* Last Communication Snippet */}
                        <div className="bg-[#0B1020] rounded-lg p-2 text-xs text-slate-300 border border-[#1E2B45] mb-2.5 flex items-start gap-1.5">
                          <span className="text-blue-400 font-bold text-[10px] uppercase shrink-0 mt-0.5">Last:</span>
                          <p className="text-[11px] text-slate-300 italic line-clamp-2 leading-relaxed">
                            {lastSnippet}
                          </p>
                        </div>

                        {/* Footer Row: Timestamp & Action Buttons */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1C2945]">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatTimeAgo(c.updated_at || c.created_at)}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* 1. VIEW CONVERSATION Button */}
                            <button
                              id={`view-conversation-btn-${txId}`}
                              type="button"
                              onClick={() => setActiveCaseId(c.id)}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                              }`}
                            >
                              VIEW CONVERSATION
                            </button>

                            {/* 2. VIEW CUSTOMER EXPERIENCE Button */}
                            <button
                              id={`view-customer-exp-btn-${txId}`}
                              type="button"
                              onClick={() => handleSwitchToCustomerExperience(c)}
                              className="px-2.5 py-1 rounded text-[11px] font-bold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 flex items-center gap-1 transition-all cursor-pointer"
                              title="Switch to Customer Experience Preview tab for this transaction"
                            >
                              <Eye className="w-3 h-3" />
                              <span>VIEW CUSTOMER EXPERIENCE</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <MessageSquare className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
                    <h4 className="text-xs font-bold text-slate-300">No matching conversations found</h4>
                    <p className="text-[11px] text-slate-400">
                      Try adjusting your filter or search query.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Merchant Communication Timeline (7 cols) */}
            <div className="lg:col-span-7 bg-[#0F172A] border border-[#223554] rounded-2xl overflow-hidden shadow-lg flex flex-col h-[750px]">
              
              {activeCase ? (
                <>
                  {/* Merchant View Header */}
                  <div className="p-4 sm:p-5 bg-[#121B30] border-b border-[#223554] space-y-3 shrink-0">
                    
                    {/* Header Top: Perspective Banner & Actions */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase tracking-wide">
                          MERCHANT VIEW
                        </span>
                        <span className="text-xs text-slate-300">
                          Monitoring automated customer communications
                        </span>
                      </div>

                      {/* Primary Trigger to Switch to Customer Experience Tab */}
                      <button
                        id="merchant-view-customer-preview-trigger"
                        type="button"
                        onClick={() => handleSwitchToCustomerExperience(activeCase)}
                        className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>VIEW CUSTOMER EXPERIENCE</span>
                      </button>
                    </div>

                    {/* Case Details Summary Grid */}
                    <div className="bg-[#0B1020] border border-[#223554] rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">Customer</span>
                        <span className="font-bold text-white truncate block">
                          {getCustomerDisplayName(activeCase.customer)}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate block">
                          {activeCase.customer?.email || 'N/A'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">Transaction</span>
                        <span className="font-bold font-mono text-blue-400 block">
                          {activeCase.transaction_id || activeCase.id}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate block">
                          {activeCase.merchant?.name || 'Enterprise'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">Amount</span>
                        <span className="font-bold font-mono text-emerald-400 text-sm block">
                          {formatINR(activeCase.transaction?.amount_minor ?? activeCase.revenue_at_risk_minor ?? 0)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {getPaymentMethodLabel(activeCase.transaction?.payment_method as any)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">Current Status</span>
                        <div className="mt-0.5">
                          {isTransactionSuccessful(activeCase) ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>SUCCESSFUL</span>
                            </span>
                          ) : activeCase.offline_verification_status === 'PENDING' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                              <Clock className="w-3 h-3 animate-pulse" />
                              <span>OFFLINE PENDING</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                              <AlertTriangle className="w-3 h-3" />
                              <span>FAILED</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          {getRecoveryStatusText(activeCase).label}
                        </span>
                      </div>
                    </div>

                    {/* Quick Link to Offline Verification if pending */}
                    {activeCase.offline_verification_status === 'PENDING' && onOpenOfflineVerification && (
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between text-xs text-amber-300">
                        <div className="flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-amber-400" />
                          <span>This customer reported offline payment. Verification is required.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenOfflineVerification(activeCase.id)}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] rounded transition-colors cursor-pointer"
                        >
                          Review Verification
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Communication Timeline Feed */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#0B1020]/60">
                    
                    {/* Timeline Header Badge */}
                    <div className="flex items-center justify-center">
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-[#141F38] text-slate-400 border border-[#223554] uppercase tracking-wider font-mono">
                        COMMUNICATION TIMELINE • REAL-TIME AUDIT LOG
                      </span>
                    </div>

                    {activeMessages.map((msg, index) => {
                      const isPayNexaAI = msg.sender === 'paynexa';
                      const isCustomer = msg.sender === 'customer';
                      const isMerchant = msg.sender === 'merchant';

                      return (
                        <div
                          key={msg.id || index}
                          id={`timeline-msg-${msg.id || index}`}
                          className={`p-4 rounded-xl border transition-all ${
                            isPayNexaAI
                              ? 'bg-[#0F172A] border-blue-500/30 ml-0 sm:mr-6'
                              : isCustomer
                              ? 'bg-[#151D33] border-purple-500/30 ml-4 sm:ml-8'
                              : 'bg-[#1A2642] border-emerald-500/30 ml-0 sm:mr-4'
                          }`}
                        >
                          {/* Message Source & Timestamp Header */}
                          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[#1C2945]">
                            <div className="flex items-center gap-2">
                              {isPayNexaAI && (
                                <>
                                  <div className="w-5 h-5 rounded-md bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-[10px]">
                                    🤖
                                  </div>
                                  <span className="text-xs font-bold text-blue-300">
                                    PAYNEXA AI
                                  </span>
                                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                                    (Automatically generated & sent)
                                  </span>
                                </>
                              )}

                              {isCustomer && (
                                <>
                                  <div className="w-5 h-5 rounded-md bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400 font-bold text-[10px]">
                                    👤
                                  </div>
                                  <span className="text-xs font-bold text-purple-300">
                                    CUSTOMER
                                  </span>
                                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                                    ({getCustomerDisplayName(activeCase.customer)})
                                  </span>
                                </>
                              )}

                              {isMerchant && (
                                <>
                                  <div className="w-5 h-5 rounded-md bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-[10px]">
                                    🏢
                                  </div>
                                  <span className="text-xs font-bold text-emerald-300">
                                    MERCHANT
                                  </span>
                                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                                    (Operator Action)
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Timestamp & Delivery Indicators */}
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                              <span>{formatTimeAgo(msg.timestamp)}</span>
                              {isPayNexaAI && (
                                <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Automatically sent</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Message Content Body */}
                          <div className="text-xs text-slate-200 whitespace-pre-line leading-relaxed font-sans">
                            {msg.text}
                          </div>

                          {/* Automatic Delivery Tag */}
                          {isPayNexaAI && (
                            <div className="mt-2.5 pt-2 border-t border-[#1C2945] flex items-center justify-between text-[10px] text-slate-400">
                              <span className="flex items-center gap-1 text-slate-400">
                                <Sparkles className="w-3 h-3 text-blue-400" />
                                <span>Triggered by payment state change</span>
                              </span>
                              <span className="text-[9px] font-mono bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">
                                SIMULATED DELIVERY
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Merchant Timeline Footer */}
                  <div className="p-3.5 bg-[#121B30] border-t border-[#223554] flex items-center justify-between text-xs text-slate-400 shrink-0">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-400" />
                      <span>
                        PayNexa automatically orchestrates recovery messaging without requiring manual merchant typing.
                      </span>
                    </div>

                    {onSelectCase && (
                      <button
                        type="button"
                        onClick={() => onSelectCase(activeCase)}
                        className="text-blue-400 hover:text-blue-300 font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>Inspect Case</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-slate-400 my-auto space-y-3">
                  <MessageSquare className="w-12 h-12 text-slate-400 mx-auto opacity-40" />
                  <h4 className="text-sm font-bold text-white">Select a customer or transaction</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Choose a conversation from the left inbox to view the full automated merchant communication timeline.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PERSPECTIVE 2: CUSTOMER EXPERIENCE PREVIEW (READ-ONLY DEMO) */}
      {/* ============================================================ */}
      {perspectiveMode === 'customer' && activeCase && (
        <div id="customer-experience-preview-tab" className="space-y-6 animate-in fade-in duration-200">
          
          {/* Top Control Bar: Transaction Selector & Status */}
          <div className="bg-[#0F172A] border border-[#223554] rounded-2xl p-5 shadow-lg space-y-4">
            
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              
              {/* Perspective Indicator */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-white uppercase tracking-wide">
                      CUSTOMER EXPERIENCE PREVIEW
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                      READ-ONLY CUSTOMER PREVIEW
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    This is the experience delivered to the customer after a payment event.
                  </p>
                </div>
              </div>

              {/* Transaction Selector Dropdown */}
              <div className="relative min-w-[280px] sm:min-w-[340px]">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1 font-mono">
                  VIEWING CUSTOMER EXPERIENCE FOR:
                </label>
                
                <div className="relative">
                  <button
                    id="customer-experience-tx-selector-btn"
                    type="button"
                    onClick={() => setShowSelectorDropdown(!showSelectorDropdown)}
                    className="w-full bg-[#0B1020] border-2 border-purple-500/40 hover:border-purple-400 rounded-xl px-3.5 py-2 text-xs text-left text-white flex items-center justify-between shadow-inner transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold font-mono text-purple-300">{custTxId}</span>
                      <span className="text-slate-400">•</span>
                      <span className="truncate text-slate-200">{custDisplayName}</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-bold text-emerald-400 font-mono">{custAmountStr}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-purple-400 shrink-0 ml-2" />
                  </button>

                  {/* Dropdown Menu */}
                  {showSelectorDropdown && (
                    <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-[#0F172A] border border-[#2B3E68] rounded-xl shadow-2xl overflow-hidden animate-in fade-in">
                      <div className="p-2 border-b border-[#223554] bg-[#0A101D]">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={customerExpSearch}
                            onChange={(e) => setCustomerExpSearch(e.target.value)}
                            placeholder="Search transaction ID, customer..."
                            className="w-full bg-[#141F36] border border-[#2B3E68] rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-400 focus:outline-none"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto divide-y divide-[#1A2642]">
                        {customerExpFilteredCases.map((c) => {
                          const isSel = c.id === activeCase.id;
                          const tId = c.transaction_id || c.id.replace('rc-', 'PX-');
                          const name = getCustomerDisplayName(c.customer);
                          const amt = formatINR(c.transaction?.amount_minor ?? c.revenue_at_risk_minor ?? 0);
                          const isSucc = isTransactionSuccessful(c);
                          const isOff = c.offline_verification_status === 'PENDING';

                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setActiveCaseId(c.id);
                                setShowSelectorDropdown(false);
                              }}
                              className={`w-full text-left p-2.5 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                isSel ? 'bg-purple-600/30 text-white' : 'hover:bg-[#16223D] text-slate-300'
                              }`}
                            >
                              <div className="truncate mr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold font-mono text-purple-300">{tId}</span>
                                  <span className="text-white font-medium truncate">{name}</span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {isSucc ? '✓ Payment Successful' : isOff ? '● Offline Verification' : 'Payment Unsuccessful'}
                                </div>
                              </div>

                              <span className="font-mono font-bold text-emerald-400 shrink-0">{amt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Selected Transaction Details Header Bar */}
            <div className="bg-[#0B1020] border border-[#223554] rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Transaction</span>
                <span className="font-bold font-mono text-purple-400 block text-sm">{custTxId}</span>
                <span className="text-[10px] text-slate-400">{custMerchantName}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Customer</span>
                <span className="font-bold text-white block truncate">{custDisplayName}</span>
                <span className="text-[10px] text-slate-400 block truncate">{activeCase.customer?.email || 'N/A'}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Amount</span>
                <span className="font-bold font-mono text-emerald-400 block text-sm">{custAmountStr}</span>
                <span className="text-[10px] text-slate-400">{getPaymentMethodLabel(activeCase.transaction?.payment_method as any)}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Current Status</span>
                <div className="mt-0.5">
                  {isCustSuccess ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isCustOfflineConfirmed ? 'PAYMENT CONFIRMED' : 'PAYMENT SUCCESSFUL'}</span>
                    </span>
                  ) : isCustOfflinePending ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                      <Clock className="w-3.5 h-3.5 animate-pulse" />
                      <span>OFFLINE PENDING</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>PAYMENT FAILED</span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                  {getRecoveryStatusText(activeCase).label}
                </span>
              </div>
            </div>

          </div>

          {/* Customer-Facing Web Recovery Window Frame */}
          <div className="bg-[#0A0F1D] border border-[#223554] rounded-2xl p-6 sm:p-10 shadow-2xl flex flex-col items-center">
            
            {/* Interactive Functional Customer Experience Component */}
            <CustomerExperienceInteractive
              caseItem={activeCase}
              onNavigateToMerchantView={() => setPerspectiveMode('merchant')}
              onOpenOfflineVerification={(caseId) => {
                if (onOpenOfflineVerification) {
                  onOpenOfflineVerification(caseId);
                } else if (onSelectCaseId) {
                  onSelectCaseId(caseId);
                }
              }}
            />

            {/* Bottom Actions for Merchant Testing */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPerspectiveMode('merchant')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <span>🏢</span>
                <span>RETURN TO MERCHANT VIEW</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewModalCase(activeCase)}
                className="px-4 py-2 bg-[#1B2744] hover:bg-[#25355A] border border-[#2B3E68] text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Eye className="w-4 h-4 text-purple-400" />
                <span>OPEN FULLSCREEN PREVIEW</span>
              </button>
            </div>

          </div>

        </div>
      )}

      {/* Secondary Customer Experience Preview Modal (Read-Only) */}
      {previewModalCase && (
        <CustomerExperiencePreviewModal
          caseItem={previewModalCase}
          onClose={() => setPreviewModalCase(null)}
          onNavigateToMerchantView={() => {
            setActiveCaseId(previewModalCase.id);
            setPerspectiveMode('merchant');
            setPreviewModalCase(null);
          }}
        />
      )}

    </div>
  );
};
