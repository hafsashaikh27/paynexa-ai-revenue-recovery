import React, { useState } from 'react';
import {
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Smartphone,
  CreditCard,
  Building2,
  Banknote,
  ArrowLeft,
  ShieldCheck,
  Lock,
  Zap,
  Check,
  ExternalLink,
  ChevronRight,
  Info,
  Sparkles
} from 'lucide-react';
import { RecoveryCase } from '../types';
import { formatINR, getPaymentMethodLabel } from '../utils/formatters';
import { 
  isTransactionSuccessful, 
  getCustomerFriendlyFailureReason 
} from '../utils/customerChatUtils';
import { getCustomerDisplayName } from '../utils/searchUtils';
import { recoveryService } from '../services/recoveryService';

export type CustomerSubScreen = 
  | 'initial' 
  | 'retry_selection' 
  | 'other_options' 
  | 'upi_simulation' 
  | 'card_simulation' 
  | 'netbanking_simulation' 
  | 'offline_payment'
  | 'processing';

interface CustomerExperienceInteractiveProps {
  caseItem: RecoveryCase;
  onNavigateToMerchantView?: () => void;
  onOpenOfflineVerification?: (caseId: string) => void;
}

export const CustomerExperienceInteractive: React.FC<CustomerExperienceInteractiveProps> = ({
  caseItem,
  onNavigateToMerchantView,
  onOpenOfflineVerification,
}) => {
  const [subScreen, setSubScreen] = useState<CustomerSubScreen>('initial');
  const [processingMethod, setProcessingMethod] = useState<string>('');
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>('Google Pay');
  const [selectedBank, setSelectedBank] = useState<string>('HDFC Bank');
  const [lastActionResult, setLastActionResult] = useState<{ success: boolean; message: string } | null>(null);

  // Derived state directly from current caseItem
  const isSuccess = isTransactionSuccessful(caseItem);
  const isOfflinePending = caseItem.offline_verification_status === 'PENDING' || caseItem.offline_verification_status === 'IN_REVIEW';
  const isOfflineConfirmed = caseItem.offline_verification_status === 'CONFIRMED';
  const isOfflineRejected = caseItem.offline_verification_status === 'REJECTED';

  const amountStr = formatINR(caseItem.transaction?.amount_minor ?? caseItem.revenue_at_risk_minor ?? 0);
  const txId = caseItem.transaction_id || caseItem.id.replace('rc-', 'PX-');
  const custName = getCustomerDisplayName(caseItem.customer);
  const merchantName = caseItem.merchant?.name || 'PayNexa Merchant';
  const friendlyReason = getCustomerFriendlyFailureReason(caseItem.transaction?.failure_reason);

  // Handler for simulating payment retry
  const handleExecutePaymentSimulation = async (methodName: string) => {
    setProcessingMethod(methodName);
    setSubScreen('processing');
    setLastActionResult(null);

    // Realistic processing animation delay
    await new Promise((r) => setTimeout(r, 1200));

    try {
      const result = await recoveryService.customerRetryPayment(caseItem.id, methodName);
      setLastActionResult(result);
      // Return to initial screen which dynamically renders the updated transaction status
      setSubScreen('initial');
    } catch (err: any) {
      console.error('Payment simulation error:', err);
      setSubScreen('initial');
    }
  };

  // Handler for reporting offline payment
  const handleReportOfflinePayment = async () => {
    setProcessingMethod('OFFLINE');
    setSubScreen('processing');

    await new Promise((r) => setTimeout(r, 800));

    try {
      await recoveryService.customerReportOfflinePayment(caseItem.id, 'Customer confirmed offline payment via web recovery experience');
      setSubScreen('initial');
    } catch (err: any) {
      console.error('Offline report error:', err);
      setSubScreen('initial');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-[#0F172A] border border-[#223554] rounded-2xl shadow-2xl overflow-hidden transition-all">
      
      {/* 1. Header Bar: Web Browser Recovery Session */}
      <div className="bg-[#121B30] border-b border-[#223554] p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
            PX
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>PayNexa Secure Web Recovery</span>
            </h4>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400">
              <Lock className="w-2.5 h-2.5" />
              <span>256-Bit Encrypted • No App Download Required</span>
            </div>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
          WEB LINK
        </span>
      </div>

      {/* 2. Merchant & Payment Context Header */}
      <div className="px-4 py-2 bg-[#0B1020] border-b border-[#1E2B45] flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-1.5 truncate">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate font-medium">{merchantName}</span>
        </div>
        <span className="text-[11px] text-emerald-400 font-mono font-bold shrink-0">
          {amountStr}
        </span>
      </div>

      {/* 3. Dynamic Interactive Container */}
      <div className="p-5 sm:p-6 min-h-[380px] flex flex-col justify-between">
        
        {/* ============================================================ */}
        {/* SUB-SCREEN: PROCESSING STATE */}
        {/* ============================================================ */}
        {subScreen === 'processing' && (
          <div className="py-12 text-center space-y-4 my-auto animate-in fade-in">
            <div className="w-14 h-14 rounded-full bg-blue-500/20 border-2 border-blue-500/40 flex items-center justify-center mx-auto">
              <RotateCw className="w-7 h-7 text-blue-400 animate-spin" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-white uppercase tracking-wider">
                PROCESSING PAYMENT...
              </h5>
              <p className="text-xs text-slate-400 mt-1">
                {processingMethod === 'OFFLINE'
                  ? 'Submitting offline payment declaration to merchant...'
                  : `Connecting to ${processingMethod || 'payment'} gateway network...`}
              </p>
            </div>
            <div className="inline-block px-3 py-1 bg-slate-800 rounded-full text-[10px] text-slate-400 font-mono border border-slate-700">
              Simulating encrypted transaction handshake
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SUB-SCREEN: INITIAL (STATE-AWARE VIEW) */}
        {/* ============================================================ */}
        {subScreen === 'initial' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* STATE 1: PAYMENT SUCCESSFUL / RECOVERED */}
            {isSuccess && (
              <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-5 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h5 className="text-base font-bold text-emerald-300 uppercase tracking-wide">
                    {isOfflineConfirmed ? '✓ PAYMENT CONFIRMED' : '✓ PAYMENT SUCCESSFUL'}
                  </h5>
                  <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                    {isOfflineConfirmed
                      ? `Your offline payment of ${amountStr} has been verified and confirmed by ${merchantName}.`
                      : `Your payment of ${amountStr} has been successfully completed.`}
                  </p>
                </div>

                <div className="bg-[#0B1222] border border-emerald-500/20 rounded-lg p-3 text-left text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Transaction:</span>
                    <span className="font-bold text-white">{txId}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Amount:</span>
                    <span className="font-bold text-emerald-400">{amountStr}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-bold text-emerald-400">
                      {isOfflineConfirmed ? 'Verified & Settled' : 'Successful & Settled'}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  A receipt has been issued for <strong className="text-slate-200">{custName}</strong>. No further action needed.
                </p>
              </div>
            )}

            {/* STATE 2: OFFLINE VERIFICATION PENDING */}
            {!isSuccess && isOfflinePending && (
              <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-5 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto border border-amber-500/40 animate-pulse">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-amber-300 uppercase tracking-wide">
                    ✓ OFFLINE PAYMENT SUBMITTED
                  </h5>
                  <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                    Your payment of <strong className="text-white">{amountStr}</strong> has been submitted for merchant verification.
                  </p>
                </div>

                <div className="bg-[#0B1222] border border-amber-500/20 rounded-lg p-3 text-left text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-bold text-amber-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      Awaiting Merchant Verification
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Transaction:</span>
                    <span className="font-bold text-slate-200">{txId}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  The merchant will verify your payment in their dashboard. You will receive automatic confirmation upon completion.
                </p>

                {onOpenOfflineVerification && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => onOpenOfflineVerification(caseItem.id)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Switch to Merchant Offline Verification →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STATE 3: OFFLINE VERIFICATION REJECTED */}
            {!isSuccess && isOfflineRejected && (
              <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-4 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-rose-300 uppercase tracking-wide">
                    OFFLINE PAYMENT NOT VERIFIED
                  </h5>
                  <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                    The merchant was unable to verify this offline transaction.
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSubScreen('retry_selection')}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Try Electronic Payment
                  </button>
                </div>
              </div>
            )}

            {/* STATE 4: PAYMENT FAILED (VISIBLE & FULLY FUNCTIONAL ACTIONS) */}
            {!isSuccess && !isOfflinePending && !isOfflineRejected && (
              <div className="space-y-4">
                
                {/* Failure Banner Card */}
                <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold text-rose-300 uppercase tracking-wide">
                        PAYMENT UNSUCCESSFUL
                      </h5>
                      <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                        Your payment of <strong className="text-white">{amountStr}</strong> could not be completed.
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#0B1222]/90 border border-rose-500/20 rounded-lg p-2.5 text-xs text-slate-300 mt-2 space-y-1">
                    <div className="text-[10px] text-slate-400 uppercase font-mono">Reason:</div>
                    <div className="text-slate-100 font-medium">{friendlyReason}</div>
                    <div className="text-[10px] text-emerald-400 font-mono mt-1">
                      ✓ Your account was not charged by {merchantName}.
                    </div>
                  </div>
                </div>

                {/* Question & Interactive Action Buttons */}
                <div className="p-4 bg-[#111A30] border border-[#223554] rounded-xl space-y-3">
                  <p className="text-xs text-slate-200 font-medium">
                    Would you like to try again?
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                    
                    {/* 1. Functional [ TRY AGAIN ] Button */}
                    <button
                      id="customer-action-try-again-btn"
                      type="button"
                      onClick={() => setSubScreen('retry_selection')}
                      className="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg text-xs font-black text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer ring-1 ring-blue-400/50"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>[ TRY AGAIN ]</span>
                    </button>

                    {/* 2. Functional [ OTHER PAYMENT OPTIONS ] Button */}
                    <button
                      id="customer-action-other-options-btn"
                      type="button"
                      onClick={() => setSubScreen('other_options')}
                      className="py-2.5 px-4 bg-[#1B2844] hover:bg-[#23355C] border border-[#2B3E68] rounded-lg text-xs font-bold text-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>[ OTHER PAYMENT OPTIONS ]</span>
                    </button>

                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ============================================================ */}
        {/* SUB-SCREEN: RETRY PAYMENT METHOD SELECTION */}
        {/* ============================================================ */}
        {subScreen === 'retry_selection' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* Navigation & Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#223554]">
              <button
                type="button"
                onClick={() => setSubScreen('initial')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 font-mono">
                DEMO RETRY FLOW
              </span>
            </div>

            <div className="bg-[#111A30] border border-[#223554] rounded-xl p-3.5 space-y-2">
              <h5 className="text-xs font-bold text-white uppercase tracking-wide">
                RETRY PAYMENT
              </h5>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">Transaction</span>
                  <span className="font-bold text-blue-400">{txId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Amount</span>
                  <span className="font-bold text-emerald-400">{amountStr}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Choose payment method:
              </label>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setSubScreen('upi_simulation')}
                  className="p-3 bg-[#131F38] hover:bg-[#1A2C50] border border-blue-500/40 rounded-xl text-left flex items-center justify-between group transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">[ UPI ]</span>
                      <span className="text-[10px] text-blue-300">Instant UPI • Google Pay / PhonePe / Paytm</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                </button>

                <button
                  type="button"
                  onClick={() => setSubScreen('card_simulation')}
                  className="p-3 bg-[#131F38] hover:bg-[#1A2C50] border border-[#223554] rounded-xl text-left flex items-center justify-between group transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">[ CARD ]</span>
                      <span className="text-[10px] text-slate-400">Debit / Credit Card (Visa / Mastercard)</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                </button>

                <button
                  type="button"
                  onClick={() => setSubScreen('netbanking_simulation')}
                  className="p-3 bg-[#131F38] hover:bg-[#1A2C50] border border-[#223554] rounded-xl text-left flex items-center justify-between group transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">[ NET BANKING ]</span>
                      <span className="text-[10px] text-slate-400">Top 50+ Major Indian Banks</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* SUB-SCREEN: OTHER PAYMENT OPTIONS */}
        {/* ============================================================ */}
        {subScreen === 'other_options' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* Navigation & Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#223554]">
              <button
                type="button"
                onClick={() => setSubScreen('initial')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono">
                ALTERNATIVE CHANNELS
              </span>
            </div>

            <div>
              <h5 className="text-xs font-bold text-white uppercase tracking-wide">
                OTHER PAYMENT OPTIONS
              </h5>
              <p className="text-xs text-slate-300 mt-0.5">
                Choose another way to complete your payment of <strong className="text-emerald-400">{amountStr}</strong>:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              
              {/* Option 1: UPI */}
              <button
                type="button"
                onClick={() => setSubScreen('upi_simulation')}
                className="p-3 bg-[#131F38] hover:bg-[#1A2C50] border border-blue-500/40 rounded-xl text-left flex items-center justify-between group transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">[ UPI ]</span>
                    <span className="text-[10px] text-blue-300">GPay, PhonePe, Paytm, BHIM</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
              </button>

              {/* Option 2: Card */}
              <button
                type="button"
                onClick={() => setSubScreen('card_simulation')}
                className="p-3 bg-[#131F38] hover:bg-[#1A2C50] border border-[#223554] rounded-xl text-left flex items-center justify-between group transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">[ CARD ]</span>
                    <span className="text-[10px] text-slate-400">Debit or Credit Card</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
              </button>

              {/* Option 3: Net Banking */}
              <button
                type="button"
                onClick={() => setSubScreen('netbanking_simulation')}
                className="p-3 bg-[#131F38] hover:bg-[#1A2C50] border border-[#223554] rounded-xl text-left flex items-center justify-between group transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">[ NET BANKING ]</span>
                    <span className="text-[10px] text-slate-400">Direct Net Banking via Bank Portal</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
              </button>

              {/* Option 4: Offline Payment */}
              <button
                type="button"
                onClick={() => setSubScreen('offline_payment')}
                className="p-3 bg-[#1B1A28] hover:bg-[#252238] border-2 border-amber-500/50 rounded-xl text-left flex items-center justify-between group transition-all cursor-pointer shadow-md"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-300 block">[ OFFLINE PAYMENT ]</span>
                    <span className="text-[10px] text-slate-300">Pay directly with merchant / cash / store counter</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                  Select →
                </span>
              </button>

            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* SUB-SCREEN: UPI SIMULATION */}
        {/* ============================================================ */}
        {subScreen === 'upi_simulation' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* Header & Back */}
            <div className="flex items-center justify-between pb-2 border-b border-[#223554]">
              <button
                type="button"
                onClick={() => setSubScreen('other_options')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold font-mono">
                DEMO PAYMENT SIMULATION
              </span>
            </div>

            <div className="bg-[#111A30] border border-[#223554] rounded-xl p-3.5 space-y-2">
              <h5 className="text-xs font-bold text-white uppercase tracking-wide">
                UPI PAYMENT
              </h5>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">Transaction:</span>
                  <span className="font-bold text-blue-400">{txId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Amount:</span>
                  <span className="font-bold text-emerald-400">{amountStr}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">
                Select UPI App:
              </label>

              <div className="grid grid-cols-3 gap-2">
                {['Google Pay', 'PhonePe', 'Paytm'].map((app) => (
                  <button
                    key={app}
                    type="button"
                    onClick={() => setSelectedUpiApp(app)}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold border text-center transition-all cursor-pointer ${
                      selectedUpiApp === app
                        ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                        : 'bg-[#131F38] text-slate-300 border-[#223554] hover:bg-[#1A2B4C]'
                    }`}
                  >
                    {app}
                  </button>
                ))}
              </div>

              <div className="bg-[#0B1020] border border-[#223554] rounded-lg p-3 text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Virtual Payment Address:</span>
                  <span className="font-mono text-slate-200">customer@okhdfcbank</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Click below to simulate approval from your {selectedUpiApp} app.
                </div>
              </div>

              {/* SIMULATE PAYMENT Button */}
              <button
                id="simulate-upi-payment-submit-btn"
                type="button"
                onClick={() => handleExecutePaymentSimulation('UPI')}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-xs font-black text-white shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>[ SIMULATE PAYMENT ]</span>
              </button>
            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* SUB-SCREEN: CARD SIMULATION */}
        {/* ============================================================ */}
        {subScreen === 'card_simulation' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* Header & Back */}
            <div className="flex items-center justify-between pb-2 border-b border-[#223554]">
              <button
                type="button"
                onClick={() => setSubScreen('other_options')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold font-mono">
                DEMO PAYMENT SIMULATION
              </span>
            </div>

            <div className="bg-[#111A30] border border-[#223554] rounded-xl p-3.5 space-y-2">
              <h5 className="text-xs font-bold text-white uppercase tracking-wide">
                CARD PAYMENT
              </h5>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">Transaction:</span>
                  <span className="font-bold text-blue-400">{txId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Amount:</span>
                  <span className="font-bold text-emerald-400">{amountStr}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-[#0B1020] border border-[#223554] rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Card Number</span>
                  <span className="font-mono text-white font-bold">•••• •••• •••• 4242</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#1C2945]">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Expiry</span>
                    <span className="font-mono text-slate-200">12/28</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">CVV</span>
                    <span className="font-mono text-slate-200">•••</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 italic">
                Demo card simulation. No real financial data required.
              </p>

              {/* SIMULATE PAYMENT Button */}
              <button
                id="simulate-card-payment-submit-btn"
                type="button"
                onClick={() => handleExecutePaymentSimulation('CREDIT_CARD')}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl text-xs font-black text-white shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>[ SIMULATE PAYMENT ]</span>
              </button>
            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* SUB-SCREEN: NET BANKING SIMULATION */}
        {/* ============================================================ */}
        {subScreen === 'netbanking_simulation' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* Header & Back */}
            <div className="flex items-center justify-between pb-2 border-b border-[#223554]">
              <button
                type="button"
                onClick={() => setSubScreen('other_options')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-mono">
                DEMO PAYMENT SIMULATION
              </span>
            </div>

            <div className="bg-[#111A30] border border-[#223554] rounded-xl p-3.5 space-y-2">
              <h5 className="text-xs font-bold text-white uppercase tracking-wide">
                NET BANKING
              </h5>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">Transaction:</span>
                  <span className="font-bold text-blue-400">{txId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Amount:</span>
                  <span className="font-bold text-emerald-400">{amountStr}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">
                Select Bank:
              </label>

              <div className="grid grid-cols-2 gap-2">
                {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank'].map((bank) => (
                  <button
                    key={bank}
                    type="button"
                    onClick={() => setSelectedBank(bank)}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold border text-center transition-all cursor-pointer ${
                      selectedBank === bank
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                        : 'bg-[#131F38] text-slate-300 border-[#223554] hover:bg-[#1A2B4C]'
                    }`}
                  >
                    {bank}
                  </button>
                ))}
              </div>

              <div className="bg-[#0B1020] border border-[#223554] rounded-lg p-3 text-xs text-slate-400">
                Selected portal: <strong className="text-white">{selectedBank}</strong> Corporate Net Banking Gateway.
              </div>

              {/* SIMULATE PAYMENT Button */}
              <button
                id="simulate-netbanking-payment-submit-btn"
                type="button"
                onClick={() => handleExecutePaymentSimulation('NET_BANKING')}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-xs font-black text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>[ SIMULATE PAYMENT ]</span>
              </button>
            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* SUB-SCREEN: OFFLINE PAYMENT FLOW */}
        {/* ============================================================ */}
        {subScreen === 'offline_payment' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* Header & Back */}
            <div className="flex items-center justify-between pb-2 border-b border-[#223554]">
              <button
                type="button"
                onClick={() => setSubScreen('other_options')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold font-mono">
                OFFLINE SETTLEMENT
              </span>
            </div>

            <div className="bg-[#1C1A2B] border border-amber-500/40 rounded-xl p-4 space-y-2">
              <h5 className="text-xs font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                <Banknote className="w-4 h-4" />
                <span>OFFLINE PAYMENT</span>
              </h5>
              <p className="text-xs text-slate-200 leading-relaxed">
                You can complete this payment directly with the merchant.
              </p>
            </div>

            <div className="bg-[#0B1020] border border-[#223554] rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Pay To:</span>
                <span className="font-bold text-white">{merchantName}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Total Amount:</span>
                <span className="font-bold text-emerald-400">{amountStr}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Accepted:</span>
                <span className="text-slate-200">Cash / Store UPI QR / Direct Counter Settlement</span>
              </div>
            </div>

            <div className="p-3 bg-[#111A30] border border-[#223554] rounded-xl space-y-2.5">
              <p className="text-xs text-slate-300">
                After completing the payment, select:
              </p>

              {/* Functional [ I'VE PAID OFFLINE ] Button */}
              <button
                id="customer-action-ive-paid-offline-btn"
                type="button"
                onClick={handleReportOfflinePayment}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>[ I'VE PAID OFFLINE ]</span>
              </button>
            </div>

          </div>
        )}

      </div>

      {/* 4. Footer Note */}
      <div className="px-4 py-2.5 bg-[#0C1426] border-t border-[#1E2B45] flex items-center justify-between text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-blue-400" />
          <span>PayNexa Autonomous Recovery System</span>
        </span>
        <span className="font-mono text-slate-400">Web Client</span>
      </div>

    </div>
  );
};
