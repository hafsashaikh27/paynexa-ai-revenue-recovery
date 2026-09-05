import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  ShieldCheck, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Bot, 
  ArrowRight, 
  Layers, 
  Cpu, 
  CreditCard, 
  Clock,
  ArrowRightLeft,
  Send,
  UserCheck,
  Ban,
  Activity
} from 'lucide-react';
import { 
  PaymentMethod, 
  FailureReason, 
  RecoveryCase, 
  Merchant 
} from '../types';
import { INITIAL_MERCHANTS } from '../data/seedCases';
import { recoveryService } from '../services/recoveryService';
import { formatINR } from '../utils/formatters';

interface SimulateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCase?: (newCase: RecoveryCase) => void;
  onCaseCreated?: (newCase: RecoveryCase) => void;
}

const REALISTIC_SCENARIOS = [
  {
    name: 'UPI Gateway Network Timeout',
    description: 'Transient network failure on primary UPI gateway switch.',
    merchantId: 'm-1',
    amountINR: 48900,
    paymentMethod: 'UPI' as PaymentMethod,
    failureType: 'NETWORK_TIMEOUT' as FailureReason,
    customerProfile: 'LOYAL' as const,
    initialRetries: 0,
  },
  {
    name: '3DS/OTP Authentication Timeout',
    description: 'Customer dropped off at OTP authorization stage during checkout.',
    merchantId: 'm-2',
    amountINR: 85000,
    paymentMethod: 'CREDIT_CARD' as PaymentMethod,
    failureType: 'AUTH_FAILED' as FailureReason,
    customerProfile: 'LOYAL' as const,
    initialRetries: 0,
  },
  {
    name: 'Insufficient Funds / Soft Decline',
    description: 'Customer account balance low. Eligible for 1-click WhatsApp recovery.',
    merchantId: 'm-3',
    amountINR: 12500,
    paymentMethod: 'UPI' as PaymentMethod,
    failureType: 'INSUFFICIENT_FUNDS' as FailureReason,
    customerProfile: 'LOYAL' as const,
    initialRetries: 1,
  },
  {
    name: 'Hard Card Decline (Exhausted Retries)',
    description: '3 failed attempts recorded. Policy engine blocks 4th automated retry.',
    merchantId: 'm-1',
    amountINR: 24500,
    paymentMethod: 'CREDIT_CARD' as PaymentMethod,
    failureType: 'CARD_DECLINED' as FailureReason,
    customerProfile: 'LOYAL' as const,
    initialRetries: 3,
  },
  {
    name: 'Customer Privacy Opt-Out (DND Active)',
    description: 'Active opt-out preference on record. Policy suppresses dunning contacts.',
    merchantId: 'm-2',
    amountINR: 18500,
    paymentMethod: 'UPI' as PaymentMethod,
    failureType: 'INSUFFICIENT_FUNDS' as FailureReason,
    customerProfile: 'OPTED_OUT' as const,
    initialRetries: 1,
  },
  {
    name: 'High-Value B2B Gateway Outage',
    description: 'Bank processor unavailable. Tests VIP secondary acquirer routing.',
    merchantId: 'm-4',
    amountINR: 125000,
    paymentMethod: 'NET_BANKING' as PaymentMethod,
    failureType: 'BANK_ERROR' as FailureReason,
    customerProfile: 'LOYAL' as const,
    initialRetries: 0,
  },
  {
    name: 'Suspected Fraud Risk Flag',
    description: 'Issuer security alert triggered. Automated retries strictly prohibited.',
    merchantId: 'm-3',
    amountINR: 32000,
    paymentMethod: 'CREDIT_CARD' as PaymentMethod,
    failureType: 'FRAUD_REVIEW' as FailureReason,
    customerProfile: 'NEW' as const,
    initialRetries: 0,
  },
];

export const SimulateEventModal: React.FC<SimulateEventModalProps> = ({
  isOpen,
  onClose,
  onOpenCase,
  onCaseCreated,
}) => {
  // Mode toggle: 'quick' (default 1-click) vs 'advanced'
  const [simulationMode, setSimulationMode] = useState<'quick' | 'advanced'>('quick');

  // Form Configuration State
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>(INITIAL_MERCHANTS[0].id);
  const [amountINR, setAmountINR] = useState<number>(48900);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [failureType, setFailureType] = useState<FailureReason>('NETWORK_TIMEOUT');
  const [customerProfile, setCustomerProfile] = useState<'LOYAL' | 'NEW' | 'OPTED_OUT' | 'HIGH_DECLINE'>('LOYAL');
  const [initialRetries, setInitialRetries] = useState<number>(0);

  // Execution Workflow State
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [executionResult, setExecutionResult] = useState<{
    caseId: string;
    transactionId: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recoverabilityScore: number;
    recommendedAction: string;
    actionType: 'SMART_RETRY' | 'ALTERNATE_ROUTE' | 'CUSTOMER_REAUTH' | 'ESCALATION' | 'NO_ACTION';
    expectedRecoveryINR: number;
    policyStatus: 'APPROVED' | 'BLOCKED';
    policyReason: string;
    outcome: 'RECOVERED' | 'RETRY_SCHEDULED' | 'BLOCKED_BY_POLICY' | 'ESCALATED' | 'STOPPED';
    outcomeMessage: string;
    stoppingReason: string;
    createdCase?: RecoveryCase;
  } | null>(null);

  // Trigger auto-simulation on mount or when opened in quick mode if no result
  React.useEffect(() => {
    if (isOpen && !executionResult && !isExecuting && simulationMode === 'quick') {
      // Pick a random realistic scenario from pool or use currently selected
      const scenario = REALISTIC_SCENARIOS[Math.floor(Math.random() * REALISTIC_SCENARIOS.length)];
      setSelectedMerchantId(scenario.merchantId);
      setAmountINR(scenario.amountINR);
      setPaymentMethod(scenario.paymentMethod);
      setFailureType(scenario.failureType);
      setCustomerProfile(scenario.customerProfile);
      setInitialRetries(scenario.initialRetries);

      runSimulationWithParams(
        scenario.merchantId,
        scenario.amountINR,
        scenario.paymentMethod,
        scenario.failureType,
        scenario.customerProfile,
        scenario.initialRetries
      );
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const timelineSteps = [
    { num: 1, title: 'PAYMENT FAILURE DETECTED', desc: 'Gateway failure webhook intercepted in real-time' },
    { num: 2, title: 'FAILURE DIAGNOSED', desc: 'Gemini 3.7 Flash parses issuer reason and latency trace' },
    { num: 3, title: 'RECOVERABILITY CALCULATED', desc: 'ML model scores probability across 12 feature signals' },
    { num: 4, title: 'RECOVERY ACTION SELECTED', desc: 'Autonomous agent determines highest-yield recovery path' },
    { num: 5, title: 'POLICY GUARDRAILS CHECKED', desc: 'Deterministic policy engine tests 5 safety rules' },
    { num: 6, title: 'RECOVERY ACTION EXECUTED', desc: 'Policy-guarded recovery route triggered' },
    { num: 7, title: 'RESULT MONITORED', desc: 'Settlement state and acquirer feedback verified' },
    { num: 8, title: 'AUDIT EVENT RECORDED', desc: 'Immutable cryptographic event written to audit trail' },
  ];

  const runSimulationWithParams = async (
    mId: string,
    amtINR: number,
    pm: PaymentMethod,
    ft: FailureReason,
    cp: 'LOYAL' | 'NEW' | 'OPTED_OUT' | 'HIGH_DECLINE',
    retries: number
  ) => {
    setIsExecuting(true);
    setCurrentStep(1);
    setExecutionResult(null);

    const merchant = INITIAL_MERCHANTS.find(m => m.id === mId) || INITIAL_MERCHANTS[0];
    const amountMinor = amtINR * 100;
    const caseId = `rc-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`;
    const transactionId = `tx-${Math.floor(1000 + Math.random() * 9000)}`;

    // Fast, crisp stepped execution animation
    for (let i = 1; i <= 8; i++) {
      setCurrentStep(i);
      await new Promise(r => setTimeout(r, 220));
    }

    // Determine deterministic behavior based on input parameters
    const isOptedOut = cp === 'OPTED_OUT';
    const isMaxRetriesExceeded = retries >= 3;
    const isFraudFlag = ft === 'FRAUD_REVIEW';
    const isHighValue = amtINR >= 50000;

    let policyStatus: 'APPROVED' | 'BLOCKED' = 'APPROVED';
    let policyReason = 'All 5 deterministic policy rules passed. Retry limit valid, cooldown satisfied, DND clear.';
    let actionType: 'SMART_RETRY' | 'ALTERNATE_ROUTE' | 'CUSTOMER_REAUTH' | 'ESCALATION' | 'NO_ACTION' = 'SMART_RETRY';
    let recommendedAction = 'Smart Retry (Secondary Acquirer Rail)';
    let outcome: 'RECOVERED' | 'RETRY_SCHEDULED' | 'BLOCKED_BY_POLICY' | 'ESCALATED' | 'STOPPED' = 'RECOVERED';
    let outcomeMessage = `Successfully recovered ${formatINR(amountMinor)} via secondary acquirer failover.`;
    let stoppingReason = 'Case Closed: Payment successfully settled and credited.';
    let recoverabilityScore = 0.86;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'HIGH';

    if (isOptedOut) {
      policyStatus = 'BLOCKED';
      policyReason = 'Policy POL-REV-v1.0 Violation: Customer has explicitly opted out of dunning contacts.';
      actionType = 'NO_ACTION';
      recommendedAction = 'Suppress Automated Dunning';
      outcome = 'BLOCKED_BY_POLICY';
      outcomeMessage = 'Recovery halted: DND opt-out active. Contact prohibited by privacy policy.';
      stoppingReason = 'Recovery Stopped: Customer opt-out preference enforced.';
      recoverabilityScore = 0.22;
      riskLevel = 'CRITICAL';
    } else if (isMaxRetriesExceeded) {
      policyStatus = 'BLOCKED';
      policyReason = 'Policy POL-REV-v1.0 Ceiling: Maximum automated retries (3) reached. Automated retry prohibited.';
      actionType = 'ESCALATION';
      recommendedAction = 'Escalate to Merchant Account Ops';
      outcome = 'ESCALATED';
      outcomeMessage = 'Case escalated to Senior Ops: Retry threshold exhausted without settlement.';
      stoppingReason = 'Recovery Stopped: Maximum retry threshold reached. Routed to human desk.';
      recoverabilityScore = 0.38;
      riskLevel = 'HIGH';
    } else if (isFraudFlag) {
      policyStatus = 'BLOCKED';
      policyReason = 'Policy POL-REV-v1.0 Safety: Issuer fraud review alert prevents automated retry.';
      actionType = 'NO_ACTION';
      recommendedAction = 'Halt & Flag for Fraud Operations';
      outcome = 'BLOCKED_BY_POLICY';
      outcomeMessage = 'Transaction locked: High fraud risk score. Retries suppressed to protect merchant.';
      stoppingReason = 'Recovery Stopped: Fraud prevention threshold triggered.';
      recoverabilityScore = 0.12;
      riskLevel = 'CRITICAL';
    } else if (isHighValue) {
      policyStatus = 'APPROVED';
      policyReason = 'High-value transaction (≥ ₹50,000). Priority recovery approved with VIP routing.';
      actionType = 'ALTERNATE_ROUTE';
      recommendedAction = 'Dynamic Priority Routing (Secondary VIP Switch)';
      outcome = 'RECOVERED';
      outcomeMessage = `High-value settlement secured: ${formatINR(amountMinor)} recovered on secondary VIP rail.`;
      stoppingReason = 'Case Closed: High-value payment recovered successfully.';
      recoverabilityScore = 0.91;
      riskLevel = 'CRITICAL';
    } else if (ft === 'INSUFFICIENT_FUNDS') {
      policyStatus = 'APPROVED';
      policyReason = 'Soft decline (Insufficient Funds). Policy permits 1-click WhatsApp dunning link.';
      actionType = 'CUSTOMER_REAUTH';
      recommendedAction = 'WhatsApp 1-Click Payment Link (48h Grace Period)';
      outcome = 'RETRY_SCHEDULED';
      outcomeMessage = 'Payment recovery link dispatched via WhatsApp & SMS. Awaiting customer authorization.';
      stoppingReason = 'Active Schedule: 48-hour invoice hold window open.';
      recoverabilityScore = 0.68;
      riskLevel = 'MEDIUM';
    } else if (ft === 'AUTH_FAILED') {
      policyStatus = 'APPROVED';
      policyReason = 'UPI Session Expiry. Direct customer re-authentication permitted.';
      actionType = 'CUSTOMER_REAUTH';
      recommendedAction = 'Instant UPI Intent Re-authentication Link';
      outcome = 'RECOVERED';
      outcomeMessage = `Customer re-authenticated via UPI: ${formatINR(amountMinor)} settled.`;
      stoppingReason = 'Case Closed: Customer completed 1-click re-authorization.';
      recoverabilityScore = 0.88;
      riskLevel = 'MEDIUM';
    } else {
      // Default: Network Timeout / Bank Error
      policyStatus = 'APPROVED';
      policyReason = 'Transient gateway timeout diagnosed. Secondary acquirer retry authorized.';
      actionType = 'SMART_RETRY';
      recommendedAction = 'Smart Retry with Acquirer Failover';
      outcome = 'RECOVERED';
      outcomeMessage = `Automated retry successful: ${formatINR(amountMinor)} recovered.`;
      stoppingReason = 'Case Closed: Payment successfully recovered.';
      recoverabilityScore = 0.86;
      riskLevel = 'HIGH';
    }

    const expectedRecoveryINR = Math.round(amtINR * recoverabilityScore);

    // Create the case in recoveryService so all views stay in sync
    const createdCase: RecoveryCase = {
      id: caseId,
      transaction_id: transactionId,
      merchant_id: merchant.id,
      customer_id: `cust-${Math.floor(100 + Math.random() * 900)}`,
      policy_version: '1.0.0',
      status: outcome === 'RECOVERED' ? 'RESOLVED' : outcome === 'ESCALATED' ? 'ESCALATED' : outcome === 'BLOCKED_BY_POLICY' ? 'FAILED' : 'IN_PROGRESS',
      priority: riskLevel,
      retry_count: isMaxRetriesExceeded ? 3 : retries + (outcome === 'RECOVERED' ? 1 : 0),
      contact_count: actionType === 'CUSTOMER_REAUTH' ? 1 : 0,
      revenue_at_risk_minor: amountMinor,
      recovered_amount_minor: outcome === 'RECOVERED' ? amountMinor : 0,
      currency: 'INR',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      merchant: merchant,
      customer: {
        id: `cust-${Math.floor(100 + Math.random() * 900)}`,
        merchant_id: merchant.id,
        external_customer_id: `CUST-SIM-${Math.floor(1000 + Math.random() * 9000)}`,
        email: `customer.${Math.floor(100 + Math.random() * 900)}@${merchant.category.toLowerCase().replace(/\s+/g, '')}.com`,
        lifetime_value_minor: amountMinor * (cp === 'LOYAL' ? 6 : 2),
        successful_payments_count: cp === 'LOYAL' ? 8 : cp === 'NEW' ? 0 : 2,
        failed_payments_count: 1,
        has_opted_out: isOptedOut,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
      },
      transaction: {
        id: transactionId,
        merchant_id: merchant.id,
        customer_id: `cust-${Math.floor(100 + Math.random() * 900)}`,
        amount_minor: amountMinor,
        currency: 'INR',
        payment_method: pm,
        status: outcome === 'RECOVERED' ? 'SUCCESS' : 'FAILED',
        failure_reason: ft,
        is_subscription: pm === 'CREDIT_CARD' || pm === 'UPI',
        invoice_age_days: 0,
        checkout_duration_sec: Math.floor(Math.random() * 45 + 15),
        device_type: 'mobile',
        days_since_last_payment: 30,
        created_at: new Date().toISOString(),
      },
      predictions: [
        {
          id: `pred-sim-${Date.now()}`,
          recovery_case_id: caseId,
          model_name: 'recovery_probability_model',
          model_version: '1.0.0',
          feature_version: '1.0.0',
          prediction: recoverabilityScore,
          feature_importance: {
            failure_reason: { impact: isFraudFlag ? 'NEGATIVE' : 'POSITIVE', weight: 0.38, description: `Diagnosed ${ft} error.` },
            customer_history: { impact: cp === 'LOYAL' ? 'POSITIVE' : 'NEUTRAL', weight: 0.28, description: `${cp} profile tier.` },
            policy_check: { impact: policyStatus === 'APPROVED' ? 'POSITIVE' : 'NEGATIVE', weight: 0.24, description: policyReason },
          },
          inference_latency_ms: 3.8,
          prediction_timestamp: new Date().toISOString(),
        }
      ],
      explanations: [
        {
          id: `exp-sim-${Date.now()}`,
          recovery_case_id: caseId,
          summary: `Payment failed due to ${ft}. Gemini reasoning indicates ${Math.round(recoverabilityScore * 100)}% clearance potential under policy POL-REV-v1.0.`,
          risk_level: riskLevel,
          recovery_likelihood: recoverabilityScore >= 0.75 ? 'HIGH' : recoverabilityScore >= 0.45 ? 'MEDIUM' : 'LOW',
          key_factors: [
            { feature: 'Error Category', impact: isFraudFlag ? 'NEGATIVE' : 'POSITIVE', explanation: `${ft} evaluation.` },
            { feature: 'Policy Guardrail', impact: policyStatus === 'APPROVED' ? 'POSITIVE' : 'NEGATIVE', explanation: policyReason }
          ],
          recommended_next_step: recommendedAction,
          confidence: 0.94,
          model_version: '1.0.0',
          feature_version: '1.0.0',
          created_at: new Date().toISOString(),
        }
      ]
    };

    // Add to shared service
    recoveryService.addCase(createdCase);

    setExecutionResult({
      caseId,
      transactionId,
      riskLevel,
      recoverabilityScore,
      recommendedAction,
      actionType,
      expectedRecoveryINR,
      policyStatus,
      policyReason,
      outcome,
      outcomeMessage,
      stoppingReason,
      createdCase,
    });

    setIsExecuting(false);
  };

  const handleRunSimulation = () => {
    runSimulationWithParams(
      selectedMerchantId,
      amountINR,
      paymentMethod,
      failureType,
      customerProfile,
      initialRetries
    );
  };

  const handleTriggerRandomScenario = () => {
    const scenario = REALISTIC_SCENARIOS[Math.floor(Math.random() * REALISTIC_SCENARIOS.length)];
    setSelectedMerchantId(scenario.merchantId);
    setAmountINR(scenario.amountINR);
    setPaymentMethod(scenario.paymentMethod);
    setFailureType(scenario.failureType);
    setCustomerProfile(scenario.customerProfile);
    setInitialRetries(scenario.initialRetries);

    runSimulationWithParams(
      scenario.merchantId,
      scenario.amountINR,
      scenario.paymentMethod,
      scenario.failureType,
      scenario.customerProfile,
      scenario.initialRetries
    );
  };

  const handleReset = () => {
    setExecutionResult(null);
    setCurrentStep(0);
  };

  return (
    <div 
      id="simulate-event-modal-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        id="simulate-event-dialog"
        className="bg-[#0F172A] border border-[#263553] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#263553] bg-[#111A30] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Simulate Payment Failure Event</h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  Interactive Evaluation Mode
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Dispatch a payment failure to evaluate the end-to-end PayNexa Agent workflow: Diagnosis → Recoverability → Policy Guardrails → Action Execution → Audit Recording.
              </p>
            </div>
          </div>

          <button
            id="close-simulation-modal-btn"
            onClick={onClose}
            className="p-2 rounded-lg bg-[#16213A] hover:bg-[#1E293B] border border-[#263553] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#080D1A] space-y-6">
          {/* Mode Switcher Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#111A30] border border-[#263553] rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase">Evaluation Mode:</span>
              <div className="flex bg-[#0F172A] p-1 rounded-lg border border-[#263553]">
                <button
                  type="button"
                  id="tab-quick-simulation-btn"
                  onClick={() => setSimulationMode('quick')}
                  className={`px-3 py-1 text-xs font-bold font-mono rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    simulationMode === 'quick'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                  <span>⚡ Quick Simulation (1-Click)</span>
                </button>
                <button
                  type="button"
                  id="tab-advanced-simulation-btn"
                  onClick={() => setSimulationMode('advanced')}
                  className={`px-3 py-1 text-xs font-bold font-mono rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    simulationMode === 'advanced'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-slate-300" />
                  <span>⚙ Advanced Configuration</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              id="quick-instant-simulate-btn"
              onClick={handleTriggerRandomScenario}
              disabled={isExecuting}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold font-mono flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
              <span>Generate Random Event</span>
            </button>
          </div>

          {!executionResult ? (
            /* CONFIGURATION FORM */
            <div className="space-y-6">
              {/* Quick Evaluation Presets */}
              <div className="p-4 bg-[#111A30] border border-[#263553] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    1-Click Scenario Evaluation Presets
                  </span>
                  <span className="text-[10px] text-blue-400 font-mono font-medium">Click any preset to simulate instantly</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMerchantId('m-1');
                      setAmountINR(48900);
                      setPaymentMethod('UPI');
                      setFailureType('NETWORK_TIMEOUT');
                      setCustomerProfile('LOYAL');
                      setInitialRetries(0);
                      runSimulationWithParams('m-1', 48900, 'UPI', 'NETWORK_TIMEOUT', 'LOYAL', 0);
                    }}
                    className="p-2.5 rounded-lg bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] hover:border-blue-500/50 text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-blue-400 group-hover:text-blue-300 flex items-center justify-between">
                      <span>1. ₹48,900 UPI Timeout</span>
                      <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">Smart Retry</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Transient failure (0/3). Tests autonomous failover retry.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMerchantId('m-2');
                      setAmountINR(85000);
                      setPaymentMethod('CREDIT_CARD');
                      setFailureType('AUTH_FAILED');
                      setCustomerProfile('LOYAL');
                      setInitialRetries(0);
                      runSimulationWithParams('m-2', 85000, 'CREDIT_CARD', 'AUTH_FAILED', 'LOYAL', 0);
                    }}
                    className="p-2.5 rounded-lg bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] hover:border-indigo-500/50 text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-indigo-400 group-hover:text-indigo-300 flex items-center justify-between">
                      <span>2. ₹85,000 3DS Drop</span>
                      <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">VIP Route</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Critical risk (0/3). Tests VIP secondary routing.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMerchantId('m-3');
                      setAmountINR(12500);
                      setPaymentMethod('UPI');
                      setFailureType('INSUFFICIENT_FUNDS');
                      setCustomerProfile('LOYAL');
                      setInitialRetries(1);
                      runSimulationWithParams('m-3', 12500, 'UPI', 'INSUFFICIENT_FUNDS', 'LOYAL', 1);
                    }}
                    className="p-2.5 rounded-lg bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] hover:border-sky-500/50 text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-sky-400 group-hover:text-sky-300 flex items-center justify-between">
                      <span>3. ₹12,500 Low Balance</span>
                      <span className="text-[9px] font-mono bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">WhatsApp</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Soft decline (1/3). Tests 1-click WhatsApp dunning link.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMerchantId('m-1');
                      setAmountINR(24500);
                      setPaymentMethod('CREDIT_CARD');
                      setFailureType('CARD_DECLINED');
                      setCustomerProfile('LOYAL');
                      setInitialRetries(3);
                      runSimulationWithParams('m-1', 24500, 'CREDIT_CARD', 'CARD_DECLINED', 'LOYAL', 3);
                    }}
                    className="p-2.5 rounded-lg bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] hover:border-amber-500/50 text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-amber-400 group-hover:text-amber-300 flex items-center justify-between">
                      <span>4. Max Retries (3/3)</span>
                      <span className="text-[9px] font-mono bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">Escalate</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">3 prior attempts. Tests human desk escalation rule.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMerchantId('m-2');
                      setAmountINR(18500);
                      setPaymentMethod('UPI');
                      setFailureType('INSUFFICIENT_FUNDS');
                      setCustomerProfile('OPTED_OUT');
                      setInitialRetries(1);
                      runSimulationWithParams('m-2', 18500, 'UPI', 'INSUFFICIENT_FUNDS', 'OPTED_OUT', 1);
                    }}
                    className="p-2.5 rounded-lg bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] hover:border-rose-500/50 text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-rose-400 group-hover:text-rose-300 flex items-center justify-between">
                      <span>5. Customer DND Opt-Out</span>
                      <span className="text-[9px] font-mono bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">Suppressed</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Privacy flag active. Tests contact suppression guardrail.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMerchantId('m-3');
                      setAmountINR(32000);
                      setPaymentMethod('CREDIT_CARD');
                      setFailureType('FRAUD_REVIEW');
                      setCustomerProfile('NEW');
                      setInitialRetries(0);
                      runSimulationWithParams('m-3', 32000, 'CREDIT_CARD', 'FRAUD_REVIEW', 'NEW', 0);
                    }}
                    className="p-2.5 rounded-lg bg-[#0F172A] hover:bg-[#16213A] border border-[#263553] hover:border-red-500/50 text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-red-400 group-hover:text-red-300 flex items-center justify-between">
                      <span>6. Fraud Review Flag</span>
                      <span className="text-[9px] font-mono bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">Security Halt</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Issuer security alert. Tests automated retry freeze.</p>
                  </button>
                </div>
              </div>

              {/* Optional Advanced Manual Controls (Only if Advanced Mode is selected) */}
              {simulationMode === 'advanced' && (
                <div className="space-y-4 p-4 bg-[#111A30]/50 border border-[#263553] rounded-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-[#263553]">
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold">
                      Custom Parameter Tuning (Optional)
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">Fine-tune simulation variables</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 1. Merchant Selection */}
                    <div className="p-3 bg-[#0F172A] border border-[#263553] rounded-xl space-y-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
                        Merchant Gateway
                      </label>
                      <select
                        id="sim-merchant-select"
                        value={selectedMerchantId}
                        onChange={(e) => setSelectedMerchantId(e.target.value)}
                        className="w-full bg-[#111A30] border border-[#263553] text-xs font-semibold text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        {INITIAL_MERCHANTS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.category})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Transaction Amount */}
                    <div className="p-3 bg-[#0F172A] border border-[#263553] rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
                          Amount at Risk (₹)
                        </label>
                        <span className="font-mono text-xs font-bold text-rose-400">
                          {formatINR(amountINR * 100)}
                        </span>
                      </div>
                      <input
                        type="number"
                        min="500"
                        max="500000"
                        step="500"
                        value={amountINR}
                        onChange={(e) => setAmountINR(Number(e.target.value))}
                        className="w-full bg-[#111A30] border border-[#263553] text-sm font-bold font-mono text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* 3. Payment Method */}
                    <div className="p-3 bg-[#0F172A] border border-[#263553] rounded-xl space-y-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
                        Payment Rail
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['UPI', 'CREDIT_CARD', 'NET_BANKING', 'DEBIT_CARD', 'WALLET'] as PaymentMethod[]).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setPaymentMethod(method)}
                            className={`p-1.5 rounded-lg border text-[11px] font-mono font-bold transition-all text-center cursor-pointer ${
                              paymentMethod === method
                                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                : 'bg-[#111A30] text-slate-300 border-[#263553] hover:bg-[#16213A]'
                            }`}
                          >
                            {method.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 4. Failure Reason */}
                    <div className="p-3 bg-[#0F172A] border border-[#263553] rounded-xl space-y-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
                        Gateway Failure Reason
                      </label>
                      <select
                        id="sim-failure-select"
                        value={failureType}
                        onChange={(e) => setFailureType(e.target.value as FailureReason)}
                        className="w-full bg-[#111A30] border border-[#263553] text-xs font-semibold text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="NETWORK_TIMEOUT">UPI / Bank Network Timeout (Transient)</option>
                        <option value="BANK_ERROR">Bank Processor Unavailable (Acquirer Outage)</option>
                        <option value="INSUFFICIENT_FUNDS">Insufficient Funds (Soft Decline)</option>
                        <option value="AUTH_FAILED">3DS / UPI Session Expired (Auth Drop)</option>
                        <option value="CARD_DECLINED">Card Issuer Hard Decline (Do Not Honor)</option>
                        <option value="FRAUD_REVIEW">Suspected Fraud Risk Flag (Security Block)</option>
                      </select>
                    </div>

                    {/* 5. Customer Profile Tier */}
                    <div className="p-3 bg-[#0F172A] border border-[#263553] rounded-xl space-y-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
                        Customer Cohort & Privacy
                      </label>
                      <select
                        id="sim-customer-tier"
                        value={customerProfile}
                        onChange={(e) => setCustomerProfile(e.target.value as any)}
                        className="w-full bg-[#111A30] border border-[#263553] text-xs font-semibold text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="LOYAL">Loyal Repeat Buyer (8+ Clearances, High LTV)</option>
                        <option value="NEW">New Customer (First transaction)</option>
                        <option value="OPTED_OUT">Opted-Out Customer (DND Active)</option>
                        <option value="HIGH_DECLINE">Frequent Decline History</option>
                      </select>
                    </div>

                    {/* 6. Prior Retry Attempts */}
                    <div className="p-3 bg-[#0F172A] border border-[#263553] rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
                          Prior Retries Completed
                        </label>
                        <span className="font-mono text-xs font-bold text-slate-300">
                          {initialRetries} / 3 Limit
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[0, 1, 2, 3].map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setInitialRetries(r)}
                            className={`p-1.5 rounded-lg border text-xs font-mono font-bold transition-all text-center cursor-pointer ${
                              initialRetries === r
                                ? r >= 3 
                                  ? 'bg-rose-600 text-white border-rose-500'
                                  : 'bg-blue-600 text-white border-blue-500'
                                : 'bg-[#111A30] text-slate-300 border-[#263553] hover:bg-[#16213A]'
                            }`}
                          >
                            {r} {r === 3 ? '(Limit)' : 'retries'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Trigger Button */}
              <div className="pt-2 flex items-center justify-between border-t border-[#263553]">
                <div className="text-xs text-slate-400 font-medium">
                  Simulation Dataset • Deterministic Policy Engine POL-REV-v1.0
                </div>
                <button
                  id="run-recoverai-agent-btn"
                  type="button"
                  onClick={handleRunSimulation}
                  disabled={isExecuting}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-blue-900/40 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-blue-200" />
                  <span>RUN RECOVERAI AGENT</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ) : (
            /* EXECUTION & OUTCOME WORKSPACE */
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Top Execution Summary Badge */}
              <div className="p-5 rounded-2xl bg-[#111A30] border border-[#263553] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-white">{executionResult.caseId}</span>
                    <span className="text-xs font-mono text-slate-400">({executionResult.transactionId})</span>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                      executionResult.policyStatus === 'APPROVED'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    }`}>
                      POLICY {executionResult.policyStatus}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-medium">
                    At Risk: <strong className="text-rose-400 font-mono">{formatINR(amountINR * 100)}</strong> • Method: <span className="font-mono text-slate-200 font-bold">{paymentMethod}</span> • Failure: <span className="text-amber-400 font-mono font-semibold">{failureType}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold">Recoverability Score</div>
                  <div className="text-2xl font-bold font-mono text-blue-400">
                    {(executionResult.recoverabilityScore * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    Expected Recovery: {formatINR(executionResult.expectedRecoveryINR * 100)}
                  </div>
                </div>
              </div>

              {/* 8-Step Agent Execution Timeline */}
              <div className="p-5 bg-[#111A30] border border-[#263553] rounded-2xl space-y-4 shadow-md">
                <div className="flex items-center justify-between pb-3 border-b border-[#263553]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                      Agent Execution Timeline (8 Steps)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                    COMPLETE • AUDITED
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {timelineSteps.map((step) => {
                    const isPassed = true;
                    return (
                      <div 
                        key={step.num}
                        className="p-3 bg-[#0F172A] border border-[#263553] rounded-xl space-y-1 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            STEP {step.num}
                          </span>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        </div>
                        <div className="text-xs font-bold text-slate-200 font-mono">
                          {step.title}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          {step.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Decision & Outcome Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AI & Policy Recommendation */}
                <div className="p-5 bg-[#111A30] border border-[#263553] rounded-2xl space-y-3 shadow-md">
                  <div className="flex items-center gap-2 text-purple-400">
                    <Bot className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase font-mono tracking-wider">
                      PayNexa Agent Decision & Policy
                    </h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-[#0F172A] rounded-xl border border-[#263553] space-y-1">
                      <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold">Recommended Action:</div>
                      <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
                        <span>{executionResult.recommendedAction}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#0F172A] rounded-xl border border-[#263553] space-y-1">
                      <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold">Policy Guardrail Check:</div>
                      <p className="text-slate-200 text-xs font-medium leading-relaxed">
                        {executionResult.policyReason}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Final Outcome & Stopping Logic */}
                <div className="p-5 bg-[#111A30] border border-[#263553] rounded-2xl space-y-3 shadow-md">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase font-mono tracking-wider">
                      Recovery Outcome & Controlled Stopping
                    </h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className={`p-3 rounded-xl border space-y-1 ${
                      executionResult.outcome === 'RECOVERED'
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                        : executionResult.outcome === 'BLOCKED_BY_POLICY'
                        ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                        : executionResult.outcome === 'ESCALATED'
                        ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                        : 'bg-blue-950/40 border-blue-800/60 text-blue-300'
                    }`}>
                      <div className="text-[10px] uppercase font-mono font-bold">Outcome Status:</div>
                      <div className="text-sm font-bold font-mono">
                        {executionResult.outcome.replace(/_/g, ' ')}
                      </div>
                      <p className="text-xs font-medium mt-0.5">
                        {executionResult.outcomeMessage}
                      </p>
                    </div>

                    <div className="p-3 bg-[#0F172A] rounded-xl border border-[#263553] space-y-1">
                      <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold">Controlled Stopping Condition:</div>
                      <div className="text-xs font-mono font-bold text-slate-200">
                        {executionResult.stoppingReason}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div className="pt-3 border-t border-[#263553] flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl bg-[#111A30] hover:bg-[#16213A] border border-[#263553] text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  ← Simulate Another Scenario
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (executionResult.createdCase && onCaseCreated) {
                        onCaseCreated(executionResult.createdCase);
                      }
                      onClose();
                    }}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    View Recovery Case ({executionResult.caseId})
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
