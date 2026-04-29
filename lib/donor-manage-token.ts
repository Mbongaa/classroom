import crypto from 'crypto';

/**
 * Generates a URL-safe 32-character bearer token used to authorize donors
 * on `/donate/manage/[token]` (view/edit/cancel their own mandate). 24
 * random bytes ≈ 192 bits of entropy, base64url-encoded → 32 chars.
 */
export function generateManageToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/** Validates the shape we issue. Pure regex — does NOT verify existence. */
const MANAGE_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
export function isValidManageTokenShape(token: string): boolean {
  return MANAGE_TOKEN_RE.test(token);
}

/** Build the donor-facing URL for an email. siteUrl is required. */
export function buildManageUrl(siteUrl: string, token: string): string {
  const base = siteUrl.replace(/\/$/, '');
  return `${base}/donate/manage/${token}`;
}
