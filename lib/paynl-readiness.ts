import type {
  BoardingStatus,
  MerchantClearingAccount,
  MerchantService,
  MerchantStatus,
  PayoutStatus,
} from './paynl-alliance';

export type MerchantReadinessState =
  | 'ready'
  | 'not_ready'
  | 'manual_payout_ready';

export interface MerchantReadinessInput {
  merchantStatus?: MerchantStatus | null;
  boardingStatus?: BoardingStatus | null;
  payoutStatus?: PayoutStatus | null;
  serviceId?: string | null;
  services?: MerchantService[];
  clearingAccounts?: MerchantClearingAccount[];
  manualPayoutApproved?: boolean | null;
}

export interface MerchantReadinessResult {
  ready: boolean;
  state: MerchantReadinessState;
  reasons: string[];
}

function hasUsableService(input: MerchantReadinessInput): boolean {
  const serviceId = input.serviceId?.trim();
  if (!serviceId) return false;
  const matching = input.services?.find((service) => service.code === serviceId);
  if (!matching) return true;
  return matching.status === undefined || matching.status === 'ACTIVE';
}

function hasApprovedClearingAccount(accounts: MerchantClearingAccount[] | undefined): boolean {
  if (!accounts || accounts.length === 0) return false;
  return accounts.some((account) => account.status === undefined || account.status === 'APPROVED');
}

export function evaluateMerchantReadiness(
  input: MerchantReadinessInput,
): MerchantReadinessResult {
  const reasons: string[] = [];

  if (input.merchantStatus !== 'ACTIVE') {
    reasons.push('merchant_status_not_active');
  }
  if (input.boardingStatus !== 'ACCEPTED') {
    reasons.push('boarding_not_accepted');
  }
  if (!hasUsableService(input)) {
    reasons.push('service_not_active_or_missing');
  }
  if (!hasApprovedClearingAccount(input.clearingAccounts)) {
    reasons.push('clearing_account_not_approved_or_missing');
  }

  const payoutEnabled = input.payoutStatus === 'ENABLED';
  const manualPayoutApproved = input.manualPayoutApproved === true;
  if (!payoutEnabled && !manualPayoutApproved) {
    reasons.push('payout_not_enabled');
  }

  const ready = reasons.length === 0;
  return {
    ready,
    state: ready
      ? manualPayoutApproved && !payoutEnabled
        ? 'manual_payout_ready'
        : 'ready'
      : 'not_ready',
    reasons,
  };
}
