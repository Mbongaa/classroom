/**
 * Static text and party data for the Pay.nl Samenwerkingsovereenkomst.
 *
 * Shared between the server-side PDF generator (lib/agreement-pdf.ts) and the
 * client-side preview (settings → Payments). Must stay free of Node-only
 * imports so it can be bundled for the browser.
 */

// ---------------------------------------------------------------------------
// Static parties
// ---------------------------------------------------------------------------

export const PAY_PARTY = {
  name: 'TinTel BV',
  city: 'Spijkenisse',
  kvk: '24283498',
  btw: 'NL807960147B01',
  iban: 'NL35RABO0117713678',
  bic: 'RABONL2U',
  tel: '+31 (0)88 88 666 66',
  representative: 'de heer O.W.H. Kok',
} as const;

export const ALLIANCE_PARTY = {
  name: 'Cyberlife B.V.',
  addressLine: 'Diamantring 48, EINDHOVEN',
  city: 'EINDHOVEN',
  kvk: '80663052',
  representative: 'Hassan Najem',
} as const;

export const PAY_LOCATIONS = [
  { label: 'LOCATIE ENSCHEDE',   lines: ['Hengelosestraat 113', '7514 AE Enschede',    'Nederland'] },
  { label: 'LOCATIE AMSTERDAM',  lines: ['Dalsteindreef 141',   '1112 XJ Diemen',      'Nederland'] },
  { label: 'LOCATIE SPIJKENISSE', lines: ['Curieweg 19',         '3208 KJ Spijkenisse', 'Nederland'] },
] as const;

// ---------------------------------------------------------------------------
// Article text (verbatim from Pay.nl's template)
// ---------------------------------------------------------------------------

export const AGREEMENT_ARTICLES: ReadonlyArray<{ id: string; body: string }> = [
  {
    id: '1.1',
    body:
      `Als alliance zal optreden: ${ALLIANCE_PARTY.name} gevestigd te ${ALLIANCE_PARTY.city}, ` +
      `${ALLIANCE_PARTY.addressLine}, ingeschreven in het handelsregister onder nummer ` +
      `${ALLIANCE_PARTY.kvk}, hierbij rechtsgeldig vertegenwoordigd door ` +
      `${ALLIANCE_PARTY.representative}, hierna te noemen "Alliance".`,
  },
  {
    id: '1.2',
    body:
      'PAY stelt haar dienstverlening als Payment Service Provider via Alliance pakket beschikbaar ' +
      'aan Merchant voor onbeperkte duur. Opzegging van de Overeenkomst is te allen tijde mogelijk, ' +
      'zonder opzegtermijn, via het Administratie paneel van PAY.',
  },
  {
    id: '1.3',
    body:
      'PAY zal de vergoedingen, waartegen zij haar diensten levert, doorbelasten aan Alliance ' +
      'zolang overeenkomst met Alliance loopt. Bij ontbinding van de overeenkomst tussen Merchant ' +
      'en Alliance, op verzoek van Alliance of op verzoek van Merchant kan deze overeenkomst worden ' +
      'omgezet in een standaard overeenkomst tussen Merchant en PAY.',
  },
  {
    id: '1.4',
    body:
      `Merchant verklaart akkoord te zijn met de Algemene Voorwaarden van PAY zoals deze zijn ` +
      `gedeponeerd bij de Kamer van Koophandel onder nummer ${PAY_PARTY.kvk}. Toepasselijkheidverklaring ` +
      `van Algemene Voorwaarden van Merchant wordt uitdrukkelijk van de hand gewezen en mist enig ` +
      `rechtsgevolg. Merchant verklaart kennis te hebben genomen van de Algemene Voorwaarden, deze ` +
      `te hebben ontvangen en deze te accepteren.`,
  },
  {
    id: '1.5',
    body:
      'PAY zal de voor Merchant geïnde bedragen periodiek, integraal doorstorten op de zakelijke ' +
      'bankrekening van Merchant, zoals geregistreerd in het Administratie paneel, aangehouden bij ' +
      'een financiële instelling binnen de EU (SEPA).',
  },
];

// ---------------------------------------------------------------------------
// Paragraph builders
// ---------------------------------------------------------------------------

export interface MerchantParagraphInput {
  name: string;
  city: string | null;
  address_street: string | null;
  address_house_number: string | null;
  kvk_number: string | null;
}

/** Dynamic merchant paragraph. City intentionally appears twice (after
 *  "gevestigd te" and after the address) — matches Pay.nl's template. */
export function buildMerchantParagraph(
  org: MerchantParagraphInput,
  representativeName: string,
): string {
  const city = (org.city ?? '').trim();
  const street = [org.address_street, org.address_house_number]
    .filter((p) => p && p.trim())
    .join(' ')
    .trim();

  const parts: string[] = [org.name];
  if (city) parts.push(`gevestigd te ${city}`);
  if (street) parts.push(street);
  if (city) parts.push(city);
  parts.push(
    `ingeschreven in het handelsregister onder nummer ${org.kvk_number ?? '—'}`,
    `hierbij rechtsgeldig vertegenwoordigd door ${representativeName || '—'}`,
    'hierna te noemen "Merchant"',
  );
  return parts.join(', ') + ';';
}

/** Static PAY paragraph. */
export function buildPayParagraph(): string {
  return (
    `${PAY_PARTY.name}, gevestigd te ${PAY_PARTY.city}, ingeschreven in het handelsregister onder ` +
    `nummer ${PAY_PARTY.kvk}, vergunninghouder betaalinstelling bij De Nederlandse Bank, hierbij ` +
    `rechtsgeldig vertegenwoordigd door ${PAY_PARTY.representative}, volgens Handelsregister ` +
    `Tekenbevoegde, hierna te noemen "PAY";`
  );
}
