import React from 'react';
import { CustomerCommunicationsView } from './CustomerCommunicationsView';
import { RecoveryCase } from '../types';

interface CustomerRecoveryChatViewProps {
  cases?: RecoveryCase[];
  initialCaseId?: string | null;
  selectedCaseId?: string | null;
  onSelectCaseId?: (caseId: string) => void;
  onNavigateToAudit?: () => void;
  onBackToDashboard?: () => void;
  onSelectCase?: (caseItem: RecoveryCase) => void;
  onOpenOfflineVerification?: (caseId: string) => void;
}

/**
 * CustomerRecoveryChatView has been upgraded to CustomerCommunicationsView
 * with two clearly separated perspectives:
 * 1. Merchant Communication View (Merchant-side timeline & inbox)
 * 2. Customer Experience Preview (Read-only customer assistant preview)
 */
export const CustomerRecoveryChatView: React.FC<CustomerRecoveryChatViewProps> = (props) => {
  return <CustomerCommunicationsView {...props} />;
};
