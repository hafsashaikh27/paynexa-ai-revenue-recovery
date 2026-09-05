export type CaseStatus = 'NEW' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'FAILED';
export type CasePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type PaymentMethod = 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'NET_BANKING' | 'WALLET' | 'OFFLINE' | 'CASH';
export type FailureReason = 
  | 'NETWORK_TIMEOUT' 
  | 'INSUFFICIENT_FUNDS' 
  | 'CARD_DECLINED' 
  | 'BANK_ERROR' 
  | 'EXPIRED_CARD' 
  | 'FRAUD_REVIEW' 
  | 'AUTH_FAILED';

export type MerchantCategory = 'E-commerce' | 'SaaS' | 'Digital Goods' | 'Services' | 'Retail';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RecoveryLikelihood = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Merchant {
  id: string;
  name: string;
  code: string;
  category: MerchantCategory;
  created_at: string;
}

export interface Customer {
  id: string;
  merchant_id: string;
  external_customer_id: string;
  name?: string;
  email: string;
  lifetime_value_minor: number;
  successful_payments_count: number;
  failed_payments_count: number;
  has_opted_out: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  merchant_id: string;
  customer_id: string;
  amount_minor: number;
  currency: string;
  payment_method: PaymentMethod;
  status: 'FAILED' | 'SUCCESS';
  failure_reason: FailureReason;
  is_subscription: boolean;
  invoice_age_days: number;
  checkout_duration_sec: number;
  device_type: 'mobile' | 'desktop' | 'tablet';
  days_since_last_payment: number;
  created_at: string;
}

export interface FeatureImpact {
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  weight: number;
  description?: string;
}

export interface ModelPrediction {
  id: string;
  recovery_case_id: string;
  model_name: string;
  model_version: string;
  feature_version: string;
  prediction: number; // 0.0 - 1.0
  feature_importance: Record<string, FeatureImpact>;
  inference_latency_ms: number;
  prediction_timestamp: string;
}

export interface KeyFactor {
  feature: string;
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  explanation: string;
}

export interface LLMExplanation {
  id: string;
  recovery_case_id: string;
  model_prediction_id?: string;
  summary: string;
  risk_level: RiskLevel;
  recovery_likelihood: RecoveryLikelihood;
  key_factors: KeyFactor[];
  recommended_next_step: string;
  confidence: number;
  model_version: string;
  feature_version: string;
  created_at: string;
}

export interface RecoveryCase {
  id: string;
  transaction_id: string;
  merchant_id: string;
  customer_id: string;
  policy_version: string;
  status: CaseStatus;
  priority: CasePriority;
  retry_count: number;
  contact_count: number;
  revenue_at_risk_minor: number;
  recovered_amount_minor: number;
  currency: string;
  escalation_reason?: string;
  created_at: string;
  updated_at: string;
  is_simulation?: boolean;
  simulation_scenario_name?: string;
  // Customer Recovery Chat & Offline Verification
  offline_verification_status?: 'NONE' | 'PENDING' | 'IN_REVIEW' | 'CONFIRMED' | 'REJECTED';
  offline_verification_step?: 1 | 2 | 3;
  offline_step1_checks?: OfflineStep1Checks;
  offline_checklist?: OfflineVerificationChecklist;
  offline_verification_history?: OfflineVerificationHistoryItem[];
  offline_started_at?: string;
  offline_completed_at?: string;
  offline_reviewer?: string;
  offline_evidence_notes?: string;
  customer_chat_messages?: CustomerRecoveryMessage[];
  last_customer_action?: string;
  alternative_methods_offered?: boolean;
  offline_reported_at?: string;
  offline_notes?: string;
  // Joined entities
  merchant?: Merchant;
  customer?: Customer;
  transaction?: Transaction;
  predictions?: ModelPrediction[];
  explanations?: LLMExplanation[];
}

export interface DashboardSummary {
  total_cases: number;
  total_transactions: number;
  successful_transactions: number;
  unsuccessful_transactions: number;
  // Authoritative Revenue Metrics
  total_transaction_value_minor: number;
  total_transaction_value_inr: number;
  initial_revenue_at_risk_minor: number;
  initial_revenue_at_risk_inr: number;
  recovered_revenue_minor: number;
  recovered_revenue_inr: number;
  current_revenue_at_risk_minor: number;
  current_revenue_at_risk_inr: number;
  blended_recovery_rate: number;
  recovery_rate: number;
  average_recovery_probability: number;
  high_risk_cases: number;
  explanations_generated: number;
  // Impact Fields
  revenue_at_risk_minor: number;
  revenue_at_risk_inr: number;
  before_revenue_at_risk_minor?: number;
  current_revenue_at_risk_minor_val?: number;
  revenue_risk_reduction_minor?: number;
  revenue_risk_reduction_pct?: number;
}

export type ActiveTab = 'overview' | 'revenue_at_risk' | 'actions' | 'customer_chat' | 'assistant' | 'experiments' | 'audit' | 'settings' | 'cases' | 'models';

export type CustomerChatSender = 'paynexa' | 'customer' | 'system' | 'merchant';

export interface CustomerRecoveryMessage {
  id: string;
  sender: CustomerChatSender;
  text: string;
  timestamp: string;
  type?: 'status_update' | 'retry_prompt' | 'alternative_methods' | 'offline_instructions' | 'offline_pending' | 'success_confirmation' | 'rejection_notice' | 'customer_response';
  actionTaken?: string;
  payload?: any;
}

export interface Experiment {
  id: string;
  title: string;
  description: string;
  strategyType: 'SMART_RETRY' | 'UPI_DYNAMIC_ROUTING' | 'WHATSAPP_1CLICK' | 'SALARY_CYCLE_SYNC' | 'SMART_CARD_FALLBACK';
  status: 'RUNNING' | 'CONCLUDED' | 'DRAFT';
  controlStrategy: string;
  variantStrategy: string;
  eligibleTransactionsCount: number;
  controlRecoveryRate: number;
  variantRecoveryRate: number;
  liftPercentage: number;
  incrementalRecoveredINR: number;
  statisticalSignificance: number;
  startDate: string;
}

export interface OfflineStep1Checks {
  txIdMatches: boolean;
  amountMatches: boolean;
  customerMatches: boolean;
  offlineRequested: boolean;
}

export interface OfflineVerificationChecklist {
  txIdMatched: boolean;
  customerMatched: boolean;
  amountMatched: boolean;
  originalFailedTxVerified: boolean;
  offlineMethodVerified: boolean;
  customerDeclarationReviewed: boolean;
  paymentEvidenceReviewed: boolean;
  merchantConfirmedReceived: boolean;
}

export interface OfflineVerificationHistoryItem {
  step: 1 | 2 | 3;
  step_title: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'REJECTED';
  timestamp: string;
  actor: string;
  notes?: string;
  details?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  case_id: string;
  transaction_id: string;
  action_type: 
    | 'ANALYSIS' 
    | 'AI_DIAGNOSIS' 
    | 'POLICY_VALIDATION' 
    | 'SMART_RETRY' 
    | 'ALTERNATE_ROUTE' 
    | 'CUSTOMER_REAUTH' 
    | 'ESCALATION' 
    | 'STATUS_CHANGE' 
    | 'OFFLINE_PAYMENT_SELECTED'
    | 'OFFLINE_PAYMENT_REPORTED' 
    | 'VERIFICATION_STARTED'
    | 'PAYMENT_DETAILS_REVIEWED'
    | 'TRANSACTION_REVIEWED'
    | 'FINAL_CONFIRMATION_REQUESTED'
    | 'OFFLINE_VERIFICATION_CONFIRMED' 
    | 'OFFLINE_VERIFICATION_REJECTED'
    | 'PAYMENT_CONFIRMED'
    | 'PAYMENT_NOT_VERIFIED'
    | 'REVENUE_RECOVERED';
  actor: 'AI_AGENT' | 'POLICY_ENGINE' | 'SYSTEM' | 'MERCHANT_ADMIN' | 'CUSTOMER' | 'CUSTOMER_ASSISTANT';
  summary: string;
  decision: 'APPROVED' | 'BLOCKED' | 'FLAGGED' | 'SUCCESS' | 'DECLINED';
  details?: Record<string, any>;
  timestamp: string;
  correlation_id: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  suggestedActions?: string[];
  caseIdRef?: string;
  modelUsed?: string;
}

export interface FilterState {
  search: string;
  status: CaseStatus | 'ALL';
  priority: CasePriority | 'ALL';
  paymentMethod: PaymentMethod | 'ALL';
  failureReason: FailureReason | 'ALL';
  merchantCategory: MerchantCategory | 'ALL';
  sortBy: 'created_at' | 'revenue' | 'probability' | 'priority';
  sortOrder: 'asc' | 'desc';
}
