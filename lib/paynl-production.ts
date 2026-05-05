import { isSandboxMode } from './paynl';

export interface PayNLProductionConfigResult {
  ok: boolean;
  issues: string[];
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

function isProductionPaymentsRuntime(): boolean {
  return isProductionRuntime() && !isSandboxMode();
}

function requireEnv(name: string, issues: string[]): void {
  if (!process.env[name]) issues.push(`${name} is required`);
}

/**
 * Runtime guard for live Pay.nl money movement.
 *
 * This is deliberately lazy so local builds and preview deploys can compile
 * without live Pay.nl credentials. The guard only becomes strict when the app
 * is running in production with PAYNL_SANDBOX_MODE=false.
 */
export function validatePayNLProductionConfig(): PayNLProductionConfigResult {
  const issues: string[] = [];

  if (!isProductionPaymentsRuntime()) {
    return { ok: true, issues };
  }

  requireEnv('PAYNL_TOKEN_CODE', issues);
  requireEnv('PAYNL_API_TOKEN', issues);
  requireEnv('PAYNL_EXCHANGE_SECRET', issues);
  requireEnv('NEXT_PUBLIC_SITE_URL', issues);
  requireEnv('CRON_SECRET', issues);
  requireEnv('PAYNL_REFERRAL_PROFILE_CODE', issues);

  if (process.env.PAYNL_ALLIANCE_ENABLED !== 'true') {
    issues.push('PAYNL_ALLIANCE_ENABLED must be true for live merchant routing');
  }
  if (process.env.PAYNL_SANDBOX_MODE === 'true') {
    issues.push('PAYNL_SANDBOX_MODE must be false for live production payments');
  }
  if (process.env.PAYNL_REPORTING_ENABLED !== 'true') {
    issues.push(
      'PAYNL_REPORTING_ENABLED must be true after Pay.nl settlement/reporting permissions are confirmed',
    );
  }

  return { ok: issues.length === 0, issues };
}

export function assertPayNLProductionConfig(): string | null {
  const result = validatePayNLProductionConfig();
  if (!result.ok) {
    return `Pay.nl production config is incomplete: ${result.issues.join('; ')}`;
  }
  return null;
}

export function shouldAllowPlatformPayNLFallback(): boolean {
  if (isSandboxMode()) return true;
  if (process.env.PAYNL_ALLOW_PLATFORM_FALLBACK === 'true') return true;
  return !isProductionRuntime();
}

export function redactPayNLIssueList(issues: string[]): string[] {
  return issues.map((issue) => issue.replace(/=.*/g, '=***'));
}
