import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  RefreshCw, 
  Sparkles, 
  ChevronDown, 
  PlusCircle,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Merchant, RecoveryCase } from '../types';
import { formatINR } from '../utils/formatters';
import { GlobalSearchBar } from './GlobalSearchBar';
import { soundService } from '../services/soundService';

interface HeaderProps {
  merchants: Merchant[];
  selectedMerchantId: string | 'ALL';
  setSelectedMerchantId: (id: string | 'ALL') => void;
  revenueAtRiskMinor: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  onSimulateNewFailure: () => void;
  isSimulating?: boolean;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  onOpenAssistant: () => void;
  cases: RecoveryCase[];
  onSelectCase: (caseItem: RecoveryCase) => void;
  onNavigateToHistory?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  merchants,
  selectedMerchantId,
  setSelectedMerchantId,
  revenueAtRiskMinor,
  onRefresh,
  isRefreshing,
  onSimulateNewFailure,
  isSimulating = false,
  onOpenAssistant,
  cases,
  onSelectCase,
  onNavigateToHistory,
}) => {
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => soundService.isEnabled());

  useEffect(() => {
    const unsubscribe = soundService.subscribe(() => {
      setIsSoundEnabled(soundService.isEnabled());
    });
    return unsubscribe;
  }, []);

  const handleToggleSound = () => {
    const newState = soundService.toggleSound();
    setIsSoundEnabled(newState);
  };
  return (
    <header 
      id="top-header" 
      className="h-16 bg-[#0F172A] border-b border-[#263553] px-6 flex items-center justify-between shrink-0 z-20 shadow-md gap-4"
    >
      {/* Left: Merchant Selector & Context */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <div className="relative">
            <select
              id="merchant-selector"
              value={selectedMerchantId}
              onChange={(e) => setSelectedMerchantId(e.target.value)}
              className="appearance-none bg-[#111A30] border border-[#263553] text-xs font-semibold text-slate-200 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-blue-500 focus:bg-[#16213A] cursor-pointer hover:bg-[#16213A] transition-colors"
            >
              <option value="ALL">All Merchants (Consolidated View)</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.category})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-rose-500/15 rounded-lg border border-rose-500/30">
          <span className="text-[11px] text-rose-400 uppercase font-mono font-medium">Active At-Risk:</span>
          <span className="text-xs font-mono font-bold text-rose-400">
            {formatINR(revenueAtRiskMinor)}
          </span>
        </div>
      </div>

      {/* Center: Live Global Search Component */}
      <div className="flex-1 max-w-md mx-2">
        <GlobalSearchBar 
          cases={cases}
          onSelectCase={onSelectCase}
          onNavigateToHistory={onNavigateToHistory}
        />
      </div>

      {/* Right: Action Buttons & AI Copilot Trigger */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Prominent AI Recovery Copilot Button */}
        <button
          id="open-ai-copilot-header-btn"
          onClick={onOpenAssistant}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-blue-900/30 transition-all active:scale-95 cursor-pointer"
          title="Open AI Recovery Assistant powered by Gemini 3.7 Flash"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-200 animate-pulse" />
          <span>AI Copilot</span>
          <span className="hidden sm:inline-block text-[9px] font-mono px-1.5 py-0.2 bg-white/20 text-white rounded font-medium">
            Gemini 3.7
          </span>
        </button>

        {/* Global Sound Control Switch */}
        <button
          id="global-sound-toggle-btn"
          type="button"
          onClick={handleToggleSound}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold tracking-tight transition-all active:scale-95 cursor-pointer select-none ${
            isSoundEnabled
              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 hover:bg-blue-600/30 hover:border-blue-400 shadow-xs'
              : 'bg-[#111A30] border-[#263553] text-slate-400 hover:text-slate-200 hover:bg-[#16213A]'
          }`}
          title={isSoundEnabled ? 'Sound is ON (Click to mute UI sounds)' : 'Sound is OFF (Click to unmute UI sounds)'}
        >
          {isSoundEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="font-semibold">Sound On</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-400">Sound Off</span>
            </>
          )}
        </button>

        {/* Simulate New Failed Payment Transaction button (1-Click) */}
        <button
          id="simulate-failure-btn"
          onClick={onSimulateNewFailure}
          disabled={isSimulating}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111A30] hover:bg-[#16213A] active:bg-[#1E2C4A] text-slate-200 border border-[#263553] hover:border-blue-500/50 text-xs font-medium transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
          title="Simulate a realistic incoming payment failure event (1-Click)"
        >
          {isSimulating ? (
            <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          ) : (
            <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
          )}
          <span>{isSimulating ? 'Simulating...' : '+ Simulate Event'}</span>
        </button>

        {/* Refresh button */}
        <button
          id="refresh-feed-btn"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg bg-[#111A30] hover:bg-[#16213A] border border-[#263553] text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          title="Refresh telemetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
        </button>
      </div>
    </header>
  );
};

