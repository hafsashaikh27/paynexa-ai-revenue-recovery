import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Eye,
  Info
} from 'lucide-react';
import { RecoveryCase } from '../types';
import { getCustomerDisplayName } from '../utils/searchUtils';
import { CustomerExperienceInteractive } from './CustomerExperienceInteractive';
import { recoveryService } from '../services/recoveryService';

interface CustomerExperiencePreviewModalProps {
  caseItem: RecoveryCase;
  onClose: () => void;
  onNavigateToMerchantView?: () => void;
  onOpenOfflineVerification?: (caseId: string) => void;
}

export const CustomerExperiencePreviewModal: React.FC<CustomerExperiencePreviewModalProps> = ({
  caseItem: initialCaseItem,
  onClose,
  onNavigateToMerchantView,
  onOpenOfflineVerification,
}) => {
  // Listen to live updates from recoveryService
  const [liveCaseItem, setLiveCaseItem] = useState<RecoveryCase>(initialCaseItem);

  useEffect(() => {
    const unsub = recoveryService.subscribe(() => {
      const found = recoveryService.getCases().find((c) => c.id === initialCaseItem.id);
      if (found) {
        setLiveCaseItem({ ...found });
      }
    });
    return unsub;
  }, [initialCaseItem.id]);

  const custName = getCustomerDisplayName(liveCaseItem.customer);

  return (
    <div 
      id="customer-experience-preview-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
    >
      <div 
        id="customer-experience-preview-modal"
        className="bg-[#0B1222] border border-[#223554] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col my-auto"
      >
        {/* Top Header: Perspective Indicator */}
        <div className="bg-[#121B30] border-b border-[#223554] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                  CUSTOMER EXPERIENCE PREVIEW
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase">
                  INTERACTIVE DEMO
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Live interactive simulation of frictionless recovery link for <span className="text-slate-200 font-medium">{custName}</span> (No app download required)
              </p>
            </div>
          </div>

          <button
            id="close-customer-preview-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Perspective Callout */}
        <div className="bg-indigo-950/40 border-b border-indigo-900/30 px-5 py-2.5 flex items-center justify-between text-xs text-indigo-200/90">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <strong>Frictionless Experience:</strong> Test any customer action (Try Again, UPI, Cards, Net Banking, Pay Offline).
            </span>
          </div>
          <span className="hidden sm:inline text-[11px] text-indigo-300/70 font-mono">
            Direct Web Session
          </span>
        </div>

        {/* Customer-Facing Experience Container */}
        <div className="p-5 sm:p-7 bg-[#070D1A] overflow-y-auto max-h-[70vh]">
          <CustomerExperienceInteractive
            caseItem={liveCaseItem}
            onNavigateToMerchantView={() => {
              onClose();
              onNavigateToMerchantView?.();
            }}
            onOpenOfflineVerification={(cId) => {
              onClose();
              onOpenOfflineVerification?.(cId);
            }}
          />
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-[#121B30] border-t border-[#223554] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>Customer actions update the real-time merchant ledger and recovery analytics.</span>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToMerchantView && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToMerchantView();
                }}
                className="px-3.5 py-1.5 bg-[#1B2744] hover:bg-[#25355A] border border-[#2B3E68] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Switch to Merchant View
              </button>
            )}

            <button
              id="close-preview-modal-action-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
