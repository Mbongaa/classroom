import { NextResponse } from 'next/server';
import { paynlRequest } from '@/lib/paynl';

/**
 * GET /api/donate/ideal-issuers
 *
 * Returns the list of iDEAL banks (issuers) available for donation payments.
 * Calls Pay.nl's Transaction::getBanks endpoint and caches the result for
 * 1 hour — banks rarely change.
 *
 * No auth required — public donation flow.
 */

interface PayNLBank {
  id: number;
  name: string;
  visibleName: string;
}

interface BankResponse {
  [key: string]: PayNLBank;
}

export interface IdealIssuer {
  id: string;
  name: string;
}

// In-memory cache (serverless: per-instance, ~1h TTL)
let cache: { issuers: IdealIssuer[]; expires: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET() {
  // Return cached if fresh
  if (cache && Date.now() < cache.expires) {
    return NextResponse.json({ issuers: cache.issuers });
  }

  try {
    const data = await paynlRequest<BankResponse>(
      'https://rest-api.pay.nl',
      '/v7/Transaction/getBanks/json',
      'POST',
    );

    // Pay.nl returns an object keyed by bank id, each with id/name/visibleName
    const issuers: IdealIssuer[] = Object.values(data)
      .filter((b) => b && typeof b === 'object' && b.id && b.name)
      .map((b) => ({
        id: String(b.id),
        name: b.visibleName || b.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    cache = { issuers, expires: Date.now() + CACHE_TTL_MS };

    return NextResponse.json({ issuers });
  } catch (error) {
    console.error('[iDEAL Issuers] Failed to fetch banks', error);
    // Return a hardcoded fallback so the UI doesn't break
    const fallback: IdealIssuer[] = [
      { id: '1', name: 'ABN Amro' },
      { id: '4', name: 'ING' },
      { id: '2', name: 'Rabobank' },
    ];
    return NextResponse.json({ issuers: fallback });
  }
}
