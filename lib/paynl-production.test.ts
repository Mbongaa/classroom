import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  shouldAllowPlatformPayNLFallback,
  validatePayNLProductionConfig,
} from './paynl-production';

const originalEnv = { ...process.env };

function setProductionLiveEnv(): void {
  process.env.NODE_ENV = 'production';
  process.env.PAYNL_SANDBOX_MODE = 'false';
}

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('validatePayNLProductionConfig', () => {
  it('is permissive outside live production payments', () => {
    process.env.NODE_ENV = 'development';
    process.env.PAYNL_SANDBOX_MODE = 'true';

    expect(validatePayNLProductionConfig()).toEqual({ ok: true, issues: [] });
  });

  it('requires Alliance live-payment configuration in production', () => {
    setProductionLiveEnv();
    delete process.env.PAYNL_TOKEN_CODE;
    delete process.env.PAYNL_API_TOKEN;
    delete process.env.PAYNL_EXCHANGE_SECRET;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.CRON_SECRET;
    delete process.env.PAYNL_REFERRAL_PROFILE_CODE;
    delete process.env.HOST_CAPABILITY_SECRET;
    process.env.PAYNL_ALLIANCE_ENABLED = 'false';
    process.env.PAYNL_REPORTING_ENABLED = 'false';

    const result = validatePayNLProductionConfig();

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'PAYNL_TOKEN_CODE is required',
        'PAYNL_API_TOKEN is required',
        'PAYNL_EXCHANGE_SECRET is required',
        'NEXT_PUBLIC_SITE_URL is required',
        'CRON_SECRET is required',
        'PAYNL_REFERRAL_PROFILE_CODE is required',
        'HOST_CAPABILITY_SECRET is required',
        'PAYNL_ALLIANCE_ENABLED must be true for live merchant routing',
        'PAYNL_REPORTING_ENABLED must be true after Pay.nl settlement/reporting permissions are confirmed',
      ]),
    );
  });

  it('accepts complete live-production configuration', () => {
    setProductionLiveEnv();
    process.env.PAYNL_TOKEN_CODE = 'AT-1234-5678';
    process.env.PAYNL_API_TOKEN = 'secret';
    process.env.PAYNL_EXCHANGE_SECRET = 'exchange-secret';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.example.com';
    process.env.CRON_SECRET = 'cron-secret';
    process.env.PAYNL_REFERRAL_PROFILE_CODE = 'RP-1234-5678';
    process.env.HOST_CAPABILITY_SECRET = 'host-capability-secret';
    process.env.PAYNL_ALLIANCE_ENABLED = 'true';
    process.env.PAYNL_REPORTING_ENABLED = 'true';

    expect(validatePayNLProductionConfig()).toEqual({ ok: true, issues: [] });
  });
});

describe('shouldAllowPlatformPayNLFallback', () => {
  it('allows platform fallback in sandbox', () => {
    process.env.NODE_ENV = 'production';
    process.env.PAYNL_SANDBOX_MODE = 'true';

    expect(shouldAllowPlatformPayNLFallback()).toBe(true);
  });

  it('blocks platform fallback for live production unless explicitly overridden', () => {
    setProductionLiveEnv();
    delete process.env.PAYNL_ALLOW_PLATFORM_FALLBACK;

    expect(shouldAllowPlatformPayNLFallback()).toBe(false);

    process.env.PAYNL_ALLOW_PLATFORM_FALLBACK = 'true';
    expect(shouldAllowPlatformPayNLFallback()).toBe(true);
  });
});
