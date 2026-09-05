import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  X, 
  ArrowRight, 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Building2, 
  User, 
  Banknote,
  FileText,
  CornerDownLeft
} from 'lucide-react';
import { RecoveryCase } from '../types';
import { 
  formatINR, 
  getPaymentMethodLabel, 
  getFailureReasonLabel, 
  isTransactionSuccessful,
  getOfflineVerificationStatusLabel,
  getPriorityStyles
} from '../utils/formatters';
import { 
  filterTransactions, 
  getCustomerDisplayName, 
  highlightMatch 
} from '../utils/searchUtils';

interface GlobalSearchBarProps {
  cases: RecoveryCase[];
  onSelectCase: (caseItem: RecoveryCase) => void;
  onNavigateToHistory?: (query: string) => void;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  cases,
  onSelectCase,
  onNavigateToHistory,
}) => {
  const [query, setQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Live filter transactions from authoritative dataset
  const results = useMemo(() => {
    return filterTransactions(cases, query);
  }, [cases, query]);

  // Open dropdown when query has at least 1 character
  useEffect(() => {
    if (query.trim().length > 0) {
      setIsOpen(true);
      setSelectedIndex(-1);
    } else {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  }, [query]);

  // Click outside listener to dismiss suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && query.trim().length > 0) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev < results.length - 1 ? prev + 1 : 0;
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : results.length - 1;
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectItem(results[selectedIndex]);
      } else if (results.length > 0) {
        handleSelectItem(results[0]);
      } else if (onNavigateToHistory && query.trim()) {
        onNavigateToHistory(query);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-search-item]');
      if (items[selectedIndex]) {
        (items[selectedIndex] as HTMLElement).scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex]);

  const handleSelectItem = (caseItem: RecoveryCase) => {
    onSelectCase(caseItem);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const getStatusBadge = (caseItem: RecoveryCase) => {
    const isSuccess = isTransactionSuccessful(caseItem);
    if (isSuccess) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" />
          <span>Recovered</span>
        </span>
      );
    }

    if (caseItem.offline_verification_status && caseItem.offline_verification_status !== 'NONE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <Banknote className="w-3 h-3" />
          <span>Offline Verification</span>
        </span>
      );
    }

    if (caseItem.status === 'ESCALATED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <AlertTriangle className="w-3 h-3" />
          <span>Escalated</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30">
        <Clock className="w-3 h-3" />
        <span>Failed: {getFailureReasonLabel(caseItem.transaction?.failure_reason as any)}</span>
      </span>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          id="global-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search Transaction ID, customer, method, status..."
          className="w-full bg-[#111A30] border border-[#263553] hover:border-slate-600 focus:border-blue-500 focus:bg-[#16213A] rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none transition-all shadow-inner"
          autoComplete="off"
        />

        {query && (
          <button
            type="button"
            id="clear-search-btn"
            onClick={handleClear}
            className="absolute right-2.5 p-0.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700/50 transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Live Suggestions Dropdown Popover */}
      {isOpen && query.trim().length > 0 && (
        <div 
          id="search-suggestions-dropdown"
          className="absolute left-0 right-0 top-full mt-1.5 bg-[#0F172A] border border-[#263553] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[440px] animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Dropdown Header with result counter */}
          <div className="px-3.5 py-2 bg-[#141E38] border-b border-[#263553] flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-1.5 font-medium">
              <Search className="w-3.5 h-3.5 text-blue-400" />
              <span>
                <strong className="text-white font-semibold">{results.length}</strong> {results.length === 1 ? 'matching transaction' : 'matching transactions'}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400">
              <span className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[9px]">↑↓</span>
              <span>to navigate</span>
              <span className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[9px]">↵</span>
              <span>to open</span>
            </div>
          </div>

          {/* Results List */}
          <div ref={listRef} className="overflow-y-auto flex-1 divide-y divide-[#1A2642] p-1">
            {results.length > 0 ? (
              results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const custName = getCustomerDisplayName(item.customer);
                const amountMinor = item.transaction?.amount_minor ?? item.revenue_at_risk_minor;
                const paymentMethod = getPaymentMethodLabel(item.transaction?.payment_method as any);
                const pStyles = getPriorityStyles(item.priority);

                return (
                  <div
                    key={item.id}
                    data-search-item
                    id={`search-result-item-${item.transaction_id || item.id}`}
                    onClick={() => handleSelectItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected 
                        ? 'bg-blue-600/20 border border-blue-500/40 text-white shadow-sm' 
                        : 'hover:bg-[#16223E] text-slate-200 border border-transparent'
                    }`}
                  >
                    {/* Left: ID, Customer, and Payment Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono font-bold text-xs text-blue-400">
                          {highlightMatch(item.transaction_id || item.id, query)}
                        </span>
                        
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                          {highlightMatch(paymentMethod, query)}
                        </span>

                        <span className="text-[11px] text-slate-400 truncate max-w-[140px] flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                          {highlightMatch(item.merchant?.name || 'Merchant', query)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <div className="flex items-center gap-1 font-medium text-slate-100 truncate">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{highlightMatch(custName, query)}</span>
                        </div>
                        {item.customer?.email && (
                          <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                            • {highlightMatch(item.customer.email, query)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Amount & Status Badge */}
                    <div className="text-right flex flex-col items-end gap-1 shrink-0">
                      <span className="font-mono font-bold text-xs text-slate-100">
                        {formatINR(amountMinor)}
                      </span>
                      {getStatusBadge(item)}
                    </div>
                  </div>
                );
              })
            ) : (
              /* No matching transactions found */
              <div 
                id="search-no-results"
                className="p-6 text-center text-slate-400 flex flex-col items-center justify-center gap-2"
              >
                <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 mb-1 border border-slate-700">
                  <Search className="w-5 h-5 text-slate-400" />
                </div>
                <h4 className="text-sm font-semibold text-slate-200">No matching transactions found</h4>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Try searching by:
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                  <span className="px-2 py-0.5 bg-slate-800/80 rounded border border-slate-700 text-[11px] text-slate-300">Transaction ID</span>
                  <span className="px-2 py-0.5 bg-slate-800/80 rounded border border-slate-700 text-[11px] text-slate-300">Customer</span>
                  <span className="px-2 py-0.5 bg-slate-800/80 rounded border border-slate-700 text-[11px] text-slate-300">Payment Method</span>
                  <span className="px-2 py-0.5 bg-slate-800/80 rounded border border-slate-700 text-[11px] text-slate-300">Status</span>
                  <span className="px-2 py-0.5 bg-slate-800/80 rounded border border-slate-700 text-[11px] text-slate-300">Failure Reason</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer with shortcut/action */}
          {results.length > 0 && onNavigateToHistory && (
            <div className="px-3 py-2 bg-[#121B33] border-t border-[#263553] flex items-center justify-between text-xs text-slate-400">
              <span>Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px] text-slate-300">Enter</kbd> to open selected</span>
              <button
                id="search-view-all-history-btn"
                type="button"
                onClick={() => {
                  onNavigateToHistory(query);
                  setIsOpen(false);
                }}
                className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View all in Transaction History</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
