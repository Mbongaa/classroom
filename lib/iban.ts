/**
 * IBAN validation and bank lookup utility.
 *
 * Client-safe — no server dependencies. Provides:
 *   1. Mod-97 checksum validation (ISO 13616)
 *   2. Country-specific length checks
 *   3. Dutch/Belgian bank code → bank name + BIC lookup
 *   4. Pretty formatting (NL12 ABCD 0123 4567 89)
 */

// ---------------------------------------------------------------------------
// Country IBAN lengths (ISO 13616)
// ---------------------------------------------------------------------------

const IBAN_LENGTHS: Record<string, number> = {
  AL: 28, AD: 24, AT: 20, AZ: 28, BH: 22, BY: 28, BE: 16, BA: 20,
  BR: 29, BG: 22, CR: 22, HR: 21, CY: 28, CZ: 24, DK: 18, DO: 28,
  EG: 29, SV: 28, EE: 20, FO: 18, FI: 18, FR: 27, GE: 22, DE: 22,
  GI: 23, GR: 27, GL: 18, GT: 28, HU: 28, IS: 26, IQ: 23, IE: 22,
  IL: 23, IT: 27, JO: 30, KZ: 20, XK: 20, KW: 30, LV: 21, LB: 28,
  LI: 21, LT: 20, LU: 20, MT: 31, MR: 27, MU: 30, MD: 24, MC: 27,
  ME: 22, NL: 18, MK: 19, NO: 15, PK: 24, PS: 29, PL: 28, PT: 25,
  QA: 29, RO: 24, LC: 32, SM: 27, SA: 24, RS: 22, SC: 31, SK: 24,
  SI: 19, ES: 24, SE: 24, CH: 21, TL: 23, TN: 24, TR: 26, UA: 29,
  AE: 23, GB: 22, VA: 22, VG: 24,
};

// ---------------------------------------------------------------------------
// Dutch bank codes → bank name + BIC
// ---------------------------------------------------------------------------

interface BankInfo {
  name: string;
  bic: string;
  /** Pay.nl issuer ID — used for logo display */
  issuerId?: string;
}

const NL_BANK_CODES: Record<string, BankInfo> = {
  ABNA: { name: 'ABN AMRO', bic: 'ABNANL2A', issuerId: '1' },
  ASNB: { name: 'ASN Bank', bic: 'ASNBNL21', issuerId: '8' },
  BUNQ: { name: 'bunq', bic: 'BUNQNL2A', issuerId: '12' },
  FVLB: { name: 'Van Lanschot', bic: 'FVLBNL22', issuerId: '11' },
  HAND: { name: 'Handelsbanken', bic: 'HANDNL2A', issuerId: '15' },
  INGB: { name: 'ING', bic: 'INGBNL2A', issuerId: '4' },
  KNAB: { name: 'Knab', bic: 'KNABNL2H', issuerId: '9' },
  RABO: { name: 'Rabobank', bic: 'RABONL2U', issuerId: '2' },
  RBRB: { name: 'RegioBank', bic: 'RBRBNL21', issuerId: '13' },
  REVO: { name: 'Revolut', bic: 'REVOLT21', issuerId: '17' },
  SNSB: { name: 'SNS', bic: 'SNSBNL2A', issuerId: '10' },
  TRIO: { name: 'Triodos Bank', bic: 'TRIONL2U', issuerId: '5' },
};

const BE_BANK_CODES: Record<string, BankInfo> = {
  GEBA: { name: 'BNP Paribas Fortis', bic: 'GEBABEBB' },
  BBRB: { name: 'ING Belgium', bic: 'BBRUBEBB' },
  KRED: { name: 'KBC', bic: 'KREDBEBB' },
  ARSP: { name: 'Argenta', bic: 'ARSPBE22' },
  BNAG: { name: 'BNP Paribas', bic: 'BNAGBEBB' },
  CPHB: { name: 'CPH Banque', bic: 'CPHBBE75' },
  CITI: { name: 'Citibank', bic: 'CITIBEBX' },
};

const DE_BANK_CODES: Record<string, BankInfo> = {
  COBADEFF: { name: 'Commerzbank', bic: 'COBADEFFXXX' },
  DEUTDEDB: { name: 'Deutsche Bank', bic: 'DEUTDEDBXXX' },
};

// ---------------------------------------------------------------------------
// Mod-97 checksum (ISO 7064)
// ---------------------------------------------------------------------------

/**
 * Converts a letter to its numeric value for IBAN checksum (A=10, B=11, ..., Z=35).
 */
function letterToDigits(char: string): string {
  return String(char.charCodeAt(0) - 55);
}

/**
 * Calculates mod 97 for a large numeric string (digit-by-digit to avoid BigInt).
 */
function mod97(numericString: string): number {
  let remainder = 0;
  for (let i = 0; i < numericString.length; i++) {
    remainder = (remainder * 10 + parseInt(numericString[i], 10)) % 97;
  }
  return remainder;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface IBANValidationResult {
  valid: boolean;
  error?: string;
  /** Cleaned, uppercased IBAN (no spaces) */
  iban?: string;
  /** ISO 3166-1 alpha-2 country code */
  country?: string;
  /** 4-letter bank code extracted from IBAN (NL/BE) */
  bankCode?: string;
}

/**
 * Validates an IBAN using the ISO 13616 mod-97 algorithm.
 *
 * Steps:
 *   1. Clean input (strip spaces, uppercase)
 *   2. Check country code and length
 *   3. Rearrange: move first 4 chars to end
 *   4. Convert letters to digits
 *   5. Compute mod 97 — result must be 1
 */
export function validateIBAN(raw: string): IBANValidationResult {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'IBAN is required' };
  }

  const cleaned = raw.replace(/\s+/g, '').toUpperCase();

  if (cleaned.length < 5) {
    return { valid: false, error: 'IBAN is too short' };
  }

  // Must start with 2 letters + 2 digits
  if (!/^[A-Z]{2}\d{2}/.test(cleaned)) {
    return { valid: false, error: 'IBAN must start with a country code and check digits' };
  }

  const country = cleaned.slice(0, 2);
  const expectedLength = IBAN_LENGTHS[country];

  if (!expectedLength) {
    return { valid: false, error: `Country code "${country}" is not supported for IBAN` };
  }

  if (cleaned.length !== expectedLength) {
    return {
      valid: false,
      error: `${country} IBAN must be ${expectedLength} characters (got ${cleaned.length})`,
    };
  }

  // Must be alphanumeric only
  if (!/^[A-Z0-9]+$/.test(cleaned)) {
    return { valid: false, error: 'IBAN can only contain letters and numbers' };
  }

  // Mod-97 check: move first 4 chars to end, convert letters → digits
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numericString = rearranged
    .split('')
    .map((ch) => (/[A-Z]/.test(ch) ? letterToDigits(ch) : ch))
    .join('');

  if (mod97(numericString) !== 1) {
    return { valid: false, error: 'IBAN check digits are incorrect' };
  }

  // Extract bank code (position varies by country, but NL/BE/DE use chars 4-7)
  const bankCode = country === 'NL' || country === 'BE' ? cleaned.slice(4, 8) : undefined;

  return {
    valid: true,
    iban: cleaned,
    country,
    bankCode,
  };
}

/**
 * Looks up the bank name and BIC from a validated IBAN.
 * Currently supports Dutch and Belgian bank codes.
 */
export function lookupBankByIBAN(iban: string): BankInfo | null {
  const cleaned = iban.replace(/\s+/g, '').toUpperCase();
  const country = cleaned.slice(0, 2);
  const bankCode = cleaned.slice(4, 8);

  if (country === 'NL') {
    return NL_BANK_CODES[bankCode] ?? null;
  }
  if (country === 'BE') {
    return BE_BANK_CODES[bankCode] ?? null;
  }
  return null;
}

/**
 * Formats an IBAN with spaces every 4 characters for readability.
 * e.g. "NL91ABNA0417164300" → "NL91 ABNA 0417 1643 00"
 */
export function formatIBAN(raw: string): string {
  const cleaned = raw.replace(/\s+/g, '').toUpperCase();
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}
