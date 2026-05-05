import { describe, expect, it } from 'vitest';
import { evaluateMerchantReadiness } from './paynl-readiness';

const readyInput = {
  merchantStatus: 'ACTIVE' as const,
  boardingStatus: 'ACCEPTED' as const,
  payoutStatus: 'ENABLED' as const,
  serviceId: 'SL-1234-5678',
  services: [{ code: 'SL-1234-5678', status: 'ACTIVE' }],
  clearingAccounts: [{ code: 'CA-1234-5678', status: 'APPROVED' }],
};

describe('evaluateMerchantReadiness', () => {
  it('marks a fully accepted Pay.nl merchant ready', () => {
    expect(evaluateMerchantReadiness(readyInput)).toEqual({
      ready: true,
      state: 'ready',
      reasons: [],
    });
  });

  it('blocks activation when the service is missing or blocked', () => {
    expect(
      evaluateMerchantReadiness({
        ...readyInput,
        services: [{ code: 'SL-1234-5678', status: 'BLOCKED' }],
      }),
    ).toMatchObject({
      ready: false,
      reasons: expect.arrayContaining(['service_not_active_or_missing']),
    });

    expect(
      evaluateMerchantReadiness({
        ...readyInput,
        serviceId: null,
      }),
    ).toMatchObject({
      ready: false,
      reasons: expect.arrayContaining(['service_not_active_or_missing']),
    });
  });

  it('blocks activation until boarding, clearing, and payout are safe', () => {
    const result = evaluateMerchantReadiness({
      ...readyInput,
      merchantStatus: 'INACTIVE',
      boardingStatus: 'ONBOARDING',
      payoutStatus: 'DISABLED',
      clearingAccounts: [{ code: 'CA-1234-5678', status: 'PENDING' }],
    });

    expect(result.ready).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'merchant_status_not_active',
        'boarding_not_accepted',
        'clearing_account_not_approved_or_missing',
        'payout_not_enabled',
      ]),
    );
  });

  it('allows an explicit manual-payout approval while still reporting that state', () => {
    expect(
      evaluateMerchantReadiness({
        ...readyInput,
        payoutStatus: 'DISABLED',
        manualPayoutApproved: true,
      }),
    ).toEqual({
      ready: true,
      state: 'manual_payout_ready',
      reasons: [],
    });
  });
});
