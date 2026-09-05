import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'info' | 'payment_event';
  title: string;
  description?: string;
  amountFormatted?: string;
  paymentRail?: string;
  failureReason?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface NotificationToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div 
      id="notification-toast-container"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((t) => {
        const isPaymentEvent = t.type === 'payment_event';

        return (
          <div
            key={t.id}
            id={`toast-${t.id}`}
            className={`pointer-events-auto p-4 rounded-xl border shadow-2xl backdrop-blur-md flex flex-col gap-2.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${
              isPaymentEvent
                ? 'bg-[#0F172A]/95 border-blue-500/40 text-white shadow-blue-950/50 ring-1 ring-blue-500/20'
                : t.type === 'success'
                ? 'bg-[#0F172A]/95 border-emerald-500/40 text-white shadow-emerald-950/40'
                : t.type === 'warning'
                ? 'bg-[#0F172A]/95 border-amber-500/40 text-white shadow-amber-950/40'
                : 'bg-[#0F172A]/95 border-[#263553] text-slate-100 shadow-slate-950/60'
            }`}
          >
            {/* Top Bar: Icon + Title + Close Button */}
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2">
                {isPaymentEvent ? (
                  <span className="flex h-5 w-5 rounded-full bg-blue-500/20 items-center justify-center text-blue-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  </span>
                ) : t.type === 'success' ? (
                  <span className="flex h-5 w-5 rounded-full bg-emerald-500/20 items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </span>
                ) : t.type === 'warning' ? (
                  <span className="flex h-5 w-5 rounded-full bg-amber-500/20 items-center justify-center text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  </span>
                ) : (
                  <span className="flex h-5 w-5 rounded-full bg-indigo-500/20 items-center justify-center text-indigo-400">
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                  </span>
                )}
                <span className="text-xs font-bold font-mono tracking-tight text-slate-100">
                  {t.title}
                </span>
              </div>

              <button
                type="button"
                id={`toast-dismiss-${t.id}`}
                onClick={() => onDismiss(t.id)}
                className="text-slate-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                title="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Event Body Content */}
            <div className="space-y-1.5 pl-7">
              {t.description && (
                <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                  {t.description}
                </p>
              )}

              {/* Specific Payment Event Details Line */}
              {(t.amountFormatted || t.paymentRail || t.failureReason) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {t.amountFormatted && (
                    <span className="text-xs font-bold font-mono text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30">
                      {t.amountFormatted}
                    </span>
                  )}
                  {t.paymentRail && (
                    <span className="text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      • {t.paymentRail}
                    </span>
                  )}
                  {t.failureReason && (
                    <span className="text-[11px] font-medium text-slate-300 block w-full mt-0.5">
                      {t.failureReason}
                    </span>
                  )}
                </div>
              )}

              {/* Action Button: View Details → */}
              {t.onAction && (
                <div className="pt-2">
                  <button
                    type="button"
                    id={`toast-action-${t.id}`}
                    onClick={() => {
                      if (t.onAction) t.onAction();
                      onDismiss(t.id);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold font-mono text-blue-400 hover:text-blue-300 transition-colors group cursor-pointer"
                  >
                    <span>{t.actionLabel || 'View Details →'}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
