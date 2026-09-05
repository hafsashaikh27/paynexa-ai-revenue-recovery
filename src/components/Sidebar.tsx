import React from 'react';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  ArrowRightLeft, 
  FlaskConical, 
  Sparkles, 
  Activity, 
  Settings,
  MessageSquare
} from 'lucide-react';
import { ActiveTab } from '../types';
import { PayNexaLogo } from './PayNexaLogo';
import { recoveryService } from '../services/recoveryService';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  casesCount: number;
  criticalCasesCount: number;
  onOpenAssistant: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  casesCount,
  criticalCasesCount,
  onOpenAssistant,
}) => {
  const pendingOfflineCount = recoveryService.getPendingOfflineVerifications().length;

  const navItems = [
    {
      id: 'overview' as ActiveTab,
      label: 'Executive Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'customer_chat' as ActiveTab,
      label: 'Customer Communications',
      icon: MessageSquare,
      badge: pendingOfflineCount > 0 ? `${pendingOfflineCount} Pending` : 'Live Hub',
      badgeColor: pendingOfflineCount > 0 
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold animate-pulse' 
        : 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30',
    },
    {
      id: 'revenue_at_risk' as ActiveTab,
      label: 'Revenue at Risk',
      icon: ShieldAlert,
      badge: criticalCasesCount > 0 ? `${criticalCasesCount} critical` : `${casesCount}`,
      badgeColor: criticalCasesCount > 0 ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : 'bg-slate-800 text-slate-300 border-slate-700',
    },
    {
      id: 'actions' as ActiveTab,
      label: 'Recovery Actions',
      icon: ArrowRightLeft,
      badge: 'Action Center',
      badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    },
    {
      id: 'assistant' as ActiveTab,
      label: 'AI Assistant',
      icon: Sparkles,
      badge: 'Gemini 3.7',
      badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    },
    {
      id: 'experiments' as ActiveTab,
      label: 'Experiments',
      icon: FlaskConical,
      badge: '+25.8% Lift',
      badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'audit' as ActiveTab,
      label: 'Audit Trail',
      icon: Activity,
      badge: 'Protected',
      badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Settings',
      icon: Settings,
      badge: 'v1.0.0',
      badgeColor: 'bg-slate-800 text-slate-400 border-slate-700',
    },
  ];

  return (
    <aside 
      id="sidebar-container" 
      className="w-64 bg-[#0F172A] border-r border-[#263553] flex flex-col justify-between p-4 shrink-0 select-none z-20 shadow-lg"
    >
      {/* Top Section: Brand */}
      <div className="space-y-6">
        {/* Brand Header */}
        <div id="brand-header" className="px-2 py-1.5 flex items-center">
          <PayNexaLogo size={34} showText={true} />
        </div>

        {/* Navigation Items */}
        <nav id="main-navigation" className="space-y-1">
          <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold">
            Core Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'revenue_at_risk' && activeTab === 'cases');
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => {
                  if (item.id === 'assistant') {
                    onOpenAssistant();
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-xs font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-medium ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: PayNexa Engine Status Panel */}
      <div className="space-y-2 pt-3 border-t border-[#263553]">
        <div 
          id="paynexa-engine-status"
          className="p-3 rounded-xl bg-[#111A30] border border-[#263553] space-y-2.5 shadow-xs"
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              PayNexa Engine
            </span>
          </div>

          {/* Engine Components Status List */}
          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                Recovery Engine
              </span>
              <span className="text-[11px] font-semibold text-emerald-400">
                ONLINE
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                AI Engine
              </span>
              <span className="text-[11px] font-semibold text-emerald-400">
                ONLINE
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                Policy Engine
              </span>
              <span className="text-[11px] font-semibold text-teal-300">
                ACTIVE
              </span>
            </div>
          </div>

          {/* Overall System Status Footer */}
          <div className="pt-2 border-t border-[#1C2844] flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">System Status:</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              Operational
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
