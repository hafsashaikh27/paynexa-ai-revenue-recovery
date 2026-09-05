import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './components/OverviewView';
import { CasesListView } from './components/CasesListView';
import { CaseDetailModal } from './components/CaseDetailModal';
import { RecoveryActionsView } from './components/RecoveryActionsView';
import { CustomerCommunicationsView } from './components/CustomerCommunicationsView';
import { SettingsView } from './components/SettingsView';
import { ModelExplorerView } from './components/ModelExplorerView';
import { SystemAuditView } from './components/SystemAuditView';
import { ExperimentsView } from './components/ExperimentsView';
import { AIAssistantDrawer } from './components/AIAssistantDrawer';
import { SimulateEventModal } from './components/SimulateEventModal';
import { NotificationToast, ToastMessage } from './components/NotificationToast';
import { recoveryService } from './services/recoveryService';
import { INITIAL_MERCHANTS } from './data/seedCases';
import { ActiveTab, RecoveryCase } from './types';
import { formatINR } from './utils/formatters';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCase, setSelectedCase] = useState<RecoveryCase | null>(null);
  const [chatCaseId, setChatCaseId] = useState<string | undefined>(undefined);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState<boolean>(false);
  const [cases, setCases] = useState<RecoveryCase[]>(() => recoveryService.getCases());

  const handleOpenCustomerChat = (caseId: string) => {
    setChatCaseId(caseId);
    setActiveTab('customer_chat');
  };

  // Subscribe to service state changes
  useEffect(() => {
    const unsubscribe = recoveryService.subscribe(() => {
      setCases([...recoveryService.getCases()]);
      // If a modal is open, keep its data fresh
      if (selectedCase) {
        const updated = recoveryService.getCaseById(selectedCase.id);
        if (updated) setSelectedCase(updated);
      }
    });
    return unsubscribe;
  }, [selectedCase]);

  // Add toast helper
  const addToast = useCallback((type: ToastMessage['type'], title: string, description?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Filtered cases by merchant if selected
  const displayedCases = useMemo(() => {
    if (selectedMerchantId === 'ALL') return cases;
    return cases.filter((c) => c.merchant_id === selectedMerchantId);
  }, [cases, selectedMerchantId]);

  const summary = useMemo(() => {
    return recoveryService.getSummary();
  }, [cases]);

  const criticalCount = useMemo(() => {
    return displayedCases.filter((c) => c.priority === 'CRITICAL' || c.priority === 'HIGH').length;
  }, [displayedCases]);

  // Actions
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((res) => setTimeout(res, 400));
    setCases([...recoveryService.getCases()]);
    setIsRefreshing(false);
    addToast('info', 'Telemetry Synced', 'Live recovery streams, ML scores, and audit logs updated.');
  };

  const handleRunML = async (caseId: string) => {
    try {
      const pred = await recoveryService.runPrediction(caseId);
      addToast(
        'success',
        'ML Inference Completed',
        `Score: ${(pred.prediction * 100).toFixed(1)}% (Latency: ${pred.inference_latency_ms}ms)`
      );
    } catch (e: any) {
      addToast('warning', 'ML Inference Error', e.message);
    }
  };

  const handleRunAI = async (caseId: string) => {
    try {
      const exp = await recoveryService.generateExplanation(caseId);
      addToast(
        'success',
        'Gemini 3.7 Flash Diagnosis Complete',
        `Risk: ${exp.risk_level} • Recommendation: ${exp.recommended_next_step.slice(0, 50)}...`
      );
    } catch (e: any) {
      addToast('warning', 'AI Reasoning Error', e.message);
    }
  };

  const handleSimulateRecovery = async (caseId: string, actionType: any = 'SMART_RETRY') => {
    const res = await recoveryService.executeRecoveryAction(caseId, actionType);
    if (res.success) {
      addToast('success', 'Simulated Recovery Succeeded!', res.message);
    } else {
      addToast(res.policyApproved ? 'warning' : 'danger' as any, res.policyApproved ? 'Recovery Attempt Declined' : 'Policy Guardrail Blocked', res.message);
    }
    return res;
  };

  const handleUpdateStatus = (caseId: string, status: RecoveryCase['status']) => {
    recoveryService.updateCaseStatus(caseId, status);
    addToast('info', 'Case Status Updated', `Case ${caseId} marked as ${status}`);
  };

  // 1-Click Simulate Event Handler: Directly generates and processes realistic failure in background
  const handleSimulateNewFailure = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    try {
      const result = await recoveryService.generateOneClickSimulatedEvent();
      
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      setToasts((prev) => [
        ...prev,
        {
          id,
          type: 'payment_event',
          title: 'New Payment Event',
          description: 'Payment failure detected',
          amountFormatted: result.amountFormatted,
          paymentRail: result.paymentRail,
          failureReason: result.failureReasonFormatted,
          actionLabel: 'View Details →',
          onAction: () => {
            setSelectedCase(result.caseItem);
          },
        },
      ]);

      // Auto dismiss after 7s
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 7000);
    } catch (err: any) {
      addToast('warning', 'Simulation Error', err.message || 'Failed to simulate payment event');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div 
      id="app-root-container" 
      className="min-h-screen bg-[#0B1020] text-[#F8FAFC] flex flex-col md:flex-row font-sans selection:bg-blue-500/30 selection:text-blue-200"
    >
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        casesCount={displayedCases.length}
        criticalCasesCount={criticalCount}
        onOpenAssistant={() => setIsAssistantOpen(true)}
      />

      {/* Main App Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          merchants={INITIAL_MERCHANTS}
          selectedMerchantId={selectedMerchantId}
          setSelectedMerchantId={setSelectedMerchantId}
          revenueAtRiskMinor={summary.revenue_at_risk_minor}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onSimulateNewFailure={handleSimulateNewFailure}
          isSimulating={isSimulating}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenAssistant={() => setIsAssistantOpen(true)}
          cases={displayedCases}
          onSelectCase={(item) => setSelectedCase(item)}
          onNavigateToHistory={(q) => {
            setSearchQuery(q);
            setActiveTab('overview');
          }}
        />

        {/* Dynamic Main Workspace Content */}
        <main className="flex-1 overflow-y-auto bg-[#0B1020]">
          {activeTab === 'overview' && (
            <OverviewView
              summary={summary}
              cases={displayedCases}
              onSelectCase={(item) => setSelectedCase(item)}
              onNavigateToCases={() => setActiveTab('revenue_at_risk')}
              onSimulateML={handleRunML}
              onSimulateAI={handleRunAI}
              onSimulateNewFailure={handleSimulateNewFailure}
              isSimulating={isSimulating}
              onOpenAssistant={() => setIsAssistantOpen(true)}
              onOpenCustomerChat={handleOpenCustomerChat}
            />
          )}

          {activeTab === 'customer_chat' && (
            <CustomerCommunicationsView
              initialCaseId={chatCaseId}
              onBackToDashboard={() => setActiveTab('overview')}
              onSelectCase={(item) => setSelectedCase(item)}
            />
          )}

          {(activeTab === 'revenue_at_risk' || activeTab === 'cases') && (
            <CasesListView
              cases={displayedCases}
              onSelectCase={(item) => setSelectedCase(item)}
              onSimulateML={handleRunML}
              onSimulateAI={handleRunAI}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}

          {activeTab === 'actions' && (
            <RecoveryActionsView
              cases={displayedCases}
              onExecuteAction={handleSimulateRecovery}
              onSelectCase={(item) => setSelectedCase(item)}
            />
          )}

          {activeTab === 'experiments' && (
            <div className="p-6">
              <ExperimentsView onOpenAssistant={(prompt) => setIsAssistantOpen(true)} />
            </div>
          )}

          {activeTab === 'models' && <ModelExplorerView />}

          {activeTab === 'audit' && <SystemAuditView />}

          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* AI Assistant Drawer (Gemini 3.7 Flash Copilot) */}
      <AIAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onSelectCase={(item) => {
          setSelectedCase(item);
          setIsAssistantOpen(false);
        }}
      />

      {/* Modal / Deep Dive Drawer */}
      <CaseDetailModal
        caseItem={selectedCase}
        onClose={() => setSelectedCase(null)}
        onRunML={handleRunML}
        onRunAI={handleRunAI}
        onSimulateRecovery={handleSimulateRecovery}
        onUpdateStatus={handleUpdateStatus}
        onOpenCustomerChat={handleOpenCustomerChat}
      />

      {/* Simulate Payment Failure Event Modal */}
      <SimulateEventModal
        isOpen={isSimulateModalOpen}
        onClose={() => setIsSimulateModalOpen(false)}
        onOpenCase={(caseItem) => {
          setSelectedCase(caseItem);
          setIsSimulateModalOpen(false);
        }}
      />

      {/* Notifications Toast */}
      <NotificationToast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
