/**
 * Generates the signed Cyberlife Sub-Merchant Services Agreement as a PDF.
 *
 * Cyberlife identity (KvK 80663052) is hardcoded. The merchant side is filled
 * from DB data. The admin only supplies their name and title. The resulting
 * PDF is uploaded to Pay.nl as the "agreement" KYC document.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgreementOrgData {
  name: string;
  kvk_number: string | null;
  address_street: string | null;
  address_house_number: string | null;
  address_postal_code: string | null;
  city: string | null;
  country: string;
  contact_email: string | null;
}

export interface AgreementSignature {
  signeeName: string;
  signeeTitle: string;
  signedAt: string; // ISO timestamp
  ipAddress?: string;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PAGE_W = 595;   // A4 width  (pt)
const PAGE_H = 842;   // A4 height (pt)
const ML = 60;        // left margin
const MR = 60;        // right margin
const MT = 60;        // top margin
const MB = 60;        // bottom margin
const CONTENT_W = PAGE_W - ML - MR;

const SIZE_TITLE    = 14;
const SIZE_HEADING  = 11;
const SIZE_BODY     = 9.5;
const SIZE_SMALL    = 8;
const LINE_H_TITLE  = 20;
const LINE_H_H      = 16;
const LINE_H_BODY   = 13;
const PARA_GAP      = 7;
const SECTION_GAP   = 14;

// ---------------------------------------------------------------------------
// Renderer state
// ---------------------------------------------------------------------------

interface Ctx {
  doc: PDFDocument;
  bold: PDFFont;
  regular: PDFFont;
  pages: PDFPage[];
  y: number;           // current cursor (from top)
}

function currentPage(ctx: Ctx): PDFPage {
  return ctx.pages[ctx.pages.length - 1];
}

function addPage(ctx: Ctx): void {
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pages.push(page);
  ctx.y = MT;
}

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y + needed > PAGE_H - MB) {
    addPage(ctx);
  }
}

/** Wrap text into lines that fit within maxWidth using the given font/size. */
function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawText(
  ctx: Ctx,
  text: string,
  font: PDFFont,
  size: number,
  lineH: number,
  indent = 0,
  color = rgb(0, 0, 0),
): void {
  const lines = wrapText(text, font, size, CONTENT_W - indent);
  for (const line of lines) {
    ensureSpace(ctx, lineH);
    currentPage(ctx).drawText(line, {
      x: ML + indent,
      y: PAGE_H - ctx.y - size,
      size,
      font,
      color,
    });
    ctx.y += lineH;
  }
}

function drawTitle(ctx: Ctx, text: string): void {
  ctx.y += SECTION_GAP;
  ensureSpace(ctx, LINE_H_TITLE * 2);
  drawText(ctx, text, ctx.bold, SIZE_TITLE, LINE_H_TITLE);
  ctx.y += PARA_GAP;
}

function drawHeading(ctx: Ctx, text: string): void {
  ctx.y += SECTION_GAP;
  ensureSpace(ctx, LINE_H_H);
  drawText(ctx, text, ctx.bold, SIZE_HEADING, LINE_H_H);
  ctx.y += PARA_GAP;
}

function drawBody(ctx: Ctx, text: string, indent = 0): void {
  drawText(ctx, text, ctx.regular, SIZE_BODY, LINE_H_BODY, indent);
  ctx.y += PARA_GAP;
}

function drawSmall(ctx: Ctx, text: string): void {
  drawText(ctx, text, ctx.regular, SIZE_SMALL, 11);
  ctx.y += PARA_GAP;
}

function drawHR(ctx: Ctx): void {
  ctx.y += SECTION_GAP;
  const page = currentPage(ctx);
  page.drawLine({
    start: { x: ML, y: PAGE_H - ctx.y },
    end: { x: PAGE_W - MR, y: PAGE_H - ctx.y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  ctx.y += SECTION_GAP;
}

function drawLabelValue(ctx: Ctx, label: string, value: string): void {
  const lw = ctx.bold.widthOfTextAtSize(`${label}: `, SIZE_BODY);
  ensureSpace(ctx, LINE_H_BODY);
  currentPage(ctx).drawText(`${label}: `, {
    x: ML,
    y: PAGE_H - ctx.y - SIZE_BODY,
    size: SIZE_BODY,
    font: ctx.bold,
  });
  currentPage(ctx).drawText(value, {
    x: ML + lw,
    y: PAGE_H - ctx.y - SIZE_BODY,
    size: SIZE_BODY,
    font: ctx.regular,
  });
  ctx.y += LINE_H_BODY;
}

// ---------------------------------------------------------------------------
// Page footer
// ---------------------------------------------------------------------------

function addPageNumbers(ctx: Ctx): void {
  const total = ctx.pages.length;
  ctx.pages.forEach((page, i) => {
    page.drawText(`Page ${i + 1} of ${total}`, {
      x: ML,
      y: 30,
      size: SIZE_SMALL,
      font: ctx.regular,
      color: rgb(0.5, 0.5, 0.5),
    });
    page.drawText('Cyberlife B.V. Sub-Merchant Services Agreement — Confidential', {
      x: ML + 80,
      y: 30,
      size: SIZE_SMALL,
      font: ctx.regular,
      color: rgb(0.5, 0.5, 0.5),
    });
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateAgreementPdf(
  org: AgreementOrgData,
  sig: AgreementSignature,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const ctx: Ctx = { doc: pdfDoc, bold, regular, pages: [], y: MT };
  addPage(ctx);

  const cyberlife = {
    kvk:    '80663052',
    email:  'info@bayaan.ai',
    signee: 'Cyberlife B.V.',
    title:  'Director',
  };

  const merchantAddr = [
    org.address_street,
    org.address_house_number,
    org.address_postal_code,
    org.city,
    org.country,
  ]
    .filter(Boolean)
    .join(' ');

  const agreementDate = new Date(sig.signedAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // ── Cover / title ──────────────────────────────────────────────────────────

  drawTitle(ctx, 'CYBERLIFE B.V.\nSub-Merchant Services Agreement');
  drawBody(ctx, 'Payment Facilitation via Pay.nl Alliance');
  drawHR(ctx);

  // ── Parties ────────────────────────────────────────────────────────────────

  drawHeading(ctx, 'AGREEMENT PARTIES');

  drawBody(ctx, 'Service Provider');
  drawLabelValue(ctx, 'Company', 'Cyberlife B.V.');
  drawLabelValue(ctx, 'KvK', cyberlife.kvk);
  drawLabelValue(ctx, 'Contact', cyberlife.email);
  ctx.y += PARA_GAP;

  drawBody(ctx, 'Merchant');
  drawLabelValue(ctx, 'Legal name', org.name);
  drawLabelValue(ctx, 'Country', org.country);
  drawLabelValue(ctx, 'KvK / CoC', org.kvk_number ?? '—');
  drawLabelValue(ctx, 'Address', merchantAddr || '—');
  drawLabelValue(ctx, 'Email', org.contact_email ?? '—');
  ctx.y += PARA_GAP;

  drawLabelValue(ctx, 'Agreement date', agreementDate);
  drawHR(ctx);

  // ── Recitals ───────────────────────────────────────────────────────────────

  drawHeading(ctx, 'RECITALS');
  drawBody(ctx, 'WHEREAS, Cyberlife B.V. holds a Pay.nl Alliance account and is authorised to onboard sub-merchants onto the Pay.nl payment platform pursuant to its agreement with Pay. B.V. ("Pay.nl"), a licensed payment institution regulated under the Dutch Financial Supervision Act (Wet op het financieel toezicht, Wft);');
  drawBody(ctx, 'WHEREAS, the Merchant wishes to use Cyberlife\'s multilingual voice translation SaaS platform ("the Cyberlife Platform") and to process payments through Pay.nl via Cyberlife\'s Alliance integration;');
  drawBody(ctx, 'WHEREAS, Pay.nl, as a licensed financial institution, is required to perform Know Your Customer (KYC) and Anti-Money Laundering (AML) checks on all sub-merchants prior to and during the business relationship;');
  drawBody(ctx, 'NOW, THEREFORE, in consideration of the mutual covenants set out herein, the parties agree as follows:');
  drawHR(ctx);

  // ── Articles ───────────────────────────────────────────────────────────────

  const articles: Array<{ heading: string; body: string[] }> = [
    {
      heading: 'ARTICLE 1 — DEFINITIONS',
      body: [
        '"Agreement" means this Sub-Merchant Services Agreement, including any addenda or amendments.',
        '"Alliance Account" means Cyberlife\'s licensed partner account with Pay.nl that enables the onboarding and management of sub-merchants.',
        '"Bayaan Platform" means the multilingual AI voice translation software-as-a-service provided by Cyberlife, enabling real-time translation and communication between speakers of different languages.',
        '"Book Balance" means the total amount of funds held by Pay.nl on behalf of the Merchant, through Stichting Derdengelden Pay.nl, net of applicable fees and deductions.',
        '"KYC" means Know Your Customer procedures, including identity verification, business verification (KYB), and AML/CFT checks required by applicable law and Pay.nl\'s policies.',
        '"Monthly Platform Fee" means the recurring fee of €39.99 (excl. VAT) per calendar month charged by Cyberlife for access to the Cyberlife Platform.',
        '"Pay.nl" means Pay. B.V., a payment institution licensed by De Nederlandsche Bank (DNB), registered in the Netherlands, which provides the underlying payment processing and settlement infrastructure.',
        '"Pay.nl Terms" means the general terms and conditions of Pay. B.V. as published at www.pay.nl/en/terms-conditions, as amended from time to time.',
        '"Settlement" means the transfer of processed transaction funds to the Merchant\'s designated IBAN bank account, net of Pay.nl fees and the Monthly Platform Fee.',
        '"Sub-Merchant Account" means the merchant account created for the Merchant within Pay.nl\'s platform under Cyberlife\'s Alliance Account.',
        '"Transaction" means any payment initiated by an end customer of the Merchant and processed through the Pay.nl payment gateway.',
      ],
    },
    {
      heading: 'ARTICLE 2 — SCOPE OF SERVICES',
      body: [
        '2.1 Cyberlife Platform Services — Cyberlife shall provide the Merchant with access to the Cyberlife Platform, including real-time multilingual voice translation services, tenant onboarding, and technical integration support, subject to the subscription terms set out in this Agreement.',
        '2.2 Payment Facilitation — Cyberlife shall, acting as a Pay.nl Alliance partner, facilitate the creation and management of the Merchant\'s Sub-Merchant Account with Pay.nl. Cyberlife\'s role is limited to: registering the Merchant as a sub-merchant under Cyberlife\'s Alliance Account; configuring the technical integration between the Merchant\'s environment and the Pay.nl payment gateway; deducting the Monthly Platform Fee from the Merchant\'s Book Balance via the Pay.nl Alliance invoice mechanism (settleBalance); and providing first-line technical support for the payment integration. Cyberlife does not itself process, clear, or settle payment transactions. All payment processing, clearing, and settlement to the Merchant\'s bank account is performed exclusively by Pay.nl, subject to Pay.nl\'s Terms and applicable Dutch and EU payment services law.',
        '2.3 Cyberlife is Not a Payment Institution — The Merchant acknowledges and agrees that Cyberlife is acting as a technical platform and commercial intermediary only. Cyberlife is not a payment institution, does not hold client funds, and does not guarantee the availability of payment processing services. Payment services are provided by Pay.nl as the licensed payment institution.',
      ],
    },
    {
      heading: 'ARTICLE 3 — MERCHANT ONBOARDING & KYC CONSENT',
      body: [
        '3.1 Sub-Merchant Registration — By signing this Agreement, the Merchant expressly authorises Cyberlife to: register the Merchant as a sub-merchant under Cyberlife\'s Pay.nl Alliance Account; submit the Merchant\'s business and personal information to Pay.nl for the purposes of account creation, KYC verification, and ongoing compliance monitoring; and access the Merchant\'s Sub-Merchant Account, transaction statistics, and book balance solely for the purpose of deducting the Monthly Platform Fee and providing technical support.',
        '3.2 KYC Obligations — The Merchant acknowledges that Pay.nl, as a licensed financial institution, is legally required to perform KYC and AML/CFT checks on all sub-merchants. The Merchant agrees to provide accurate, complete, and up-to-date information and documentation as requested by Pay.nl or Cyberlife for KYC purposes, including but not limited to: an extract from the Chamber of Commerce (KvK uittreksel), identification documents of directors and UBOs, proof of bank account (IBAN confirmation), and proof of business address; promptly notify Cyberlife of any material changes to the Merchant\'s business, legal structure, beneficial ownership, or bank account details; cooperate fully with Pay.nl\'s onboarding team and comply with any enhanced due diligence requests; and accept that Pay.nl may suspend or terminate the Sub-Merchant Account if KYC requirements are not met within a reasonable timeframe.',
        '3.3 Acceptance of Pay.nl Terms — The Merchant acknowledges that by being onboarded as a sub-merchant under Pay.nl, the Merchant is subject to the Pay.nl Terms (www.pay.nl/en/terms-conditions) as they apply to merchants. The Merchant agrees to comply with the Pay.nl Terms and all applicable card scheme rules, PSD2 requirements, and Dutch and EU payment regulations. In the event of conflict between this Agreement and the Pay.nl Terms regarding payment processing, clearing, and settlement obligations, the Pay.nl Terms shall prevail.',
      ],
    },
    {
      heading: 'ARTICLE 4 — FEES, SETTLEMENT & BALANCE DEDUCTIONS',
      body: [
        '4.1 Monthly Platform Fee — In consideration for access to the Cyberlife Platform, the Merchant shall pay Cyberlife a Monthly Platform Fee of €39.99 (excl. VAT) per calendar month. Dutch VAT (BTW) at the applicable rate (currently 21%) applies where applicable under Dutch tax law. The fee is billed monthly, deducted from the Merchant\'s Book Balance on or after the 1st day of each calendar month.',
        '4.2 Deduction from Book Balance (settleBalance) — The Merchant expressly authorises Cyberlife to deduct the Monthly Platform Fee directly from the Merchant\'s Pay.nl Book Balance using the Pay.nl Alliance invoice mechanism ("settleBalance"). Cyberlife will submit an invoice to Pay.nl through the Alliance API for the amount of €39.99 (excl. VAT) per month; Pay.nl will deduct this amount from the Merchant\'s Book Balance prior to Settlement; and Cyberlife will provide the Merchant with a corresponding invoice document by email. The Merchant confirms that this deduction method has been explained and is agreed to as the primary billing mechanism. The Merchant will not dispute Book Balance deductions made in accordance with this clause provided the fee amount matches this Agreement.',
        '4.3 Pay.nl Transaction Fees — Transaction fees, interchange fees, and any other costs charged by Pay.nl for payment processing are separate from and in addition to the Monthly Platform Fee. These are charged by Pay.nl directly against the Merchant\'s Book Balance in accordance with the Pay.nl Terms and the Merchant\'s Pay.nl pricing agreement.',
        '4.4 Disputed Deductions — If the Merchant believes a deduction has been made in error, the Merchant shall notify Cyberlife in writing within fourteen (14) days of the deduction. Cyberlife shall investigate and respond within ten (10) business days. Undisputed fees are deemed accepted by the Merchant.',
      ],
    },
    {
      heading: 'ARTICLE 5 — SETTLEMENT & MONEY FLOW',
      body: [
        '5.1 Settlement by Pay.nl — Settlement of transaction funds to the Merchant\'s IBAN bank account is performed exclusively by Pay.nl through Stichting Derdengelden Pay.nl, in accordance with the Pay.nl Terms and the settlement schedule agreed between the Merchant and Pay.nl. Cyberlife is not a party to the settlement process and does not hold, transmit, or guarantee Merchant funds.',
        '5.2 Net Settlement — Funds settled to the Merchant\'s bank account will be net of: Pay.nl\'s applicable transaction fees and costs; the Monthly Platform Fee deducted by Cyberlife pursuant to Article 4.2; and any chargebacks, refunds, or penalties as defined by Pay.nl\'s Terms.',
        '5.3 Merchant IBAN — The Merchant shall provide and maintain a valid IBAN bank account registered in the Merchant\'s own name for settlement purposes. Cyberlife accepts no liability for settlement delays or errors arising from incorrect IBAN information.',
      ],
    },
    {
      heading: 'ARTICLE 6 — DATA SHARING, PRIVACY & GDPR',
      body: [
        '6.1 Data Sharing with Pay.nl — The Merchant acknowledges and consents to the following personal and business data being shared with Pay.nl for the purposes of sub-merchant registration, KYC verification, and payment processing: company name, registration number (KvK), and registered address; name, date of birth, nationality, and identity documents of directors and UBOs; bank account details (IBAN); business description, website URL, and transaction volumes; and any additional documents requested by Pay.nl\'s compliance team. Pay.nl\'s processing of this data is governed by Pay.nl\'s privacy policy.',
        '6.2 GDPR Compliance — Both parties shall comply with the General Data Protection Regulation (EU) 2016/679 (GDPR) and the Dutch Implementation Act (UAVG). Cyberlife maintains appropriate technical and organisational measures to protect Merchant data. Data is stored on EU-based infrastructure (Frankfurt, Germany) and is not transferred outside the EEA without appropriate safeguards. Cyberlife processes Merchant data as a data processor under its own privacy policy and Data Processing Agreement (DPA), available upon request.',
        '6.3 Confidentiality — Each party agrees to treat the other party\'s confidential business information, technical data, and pricing as strictly confidential and not to disclose such information to third parties, except as required by law or to Pay.nl for the purposes of this Agreement.',
      ],
    },
    {
      heading: 'ARTICLE 7 — MERCHANT OBLIGATIONS & WARRANTIES',
      body: [
        'The Merchant represents, warrants, and agrees that: (a) it is a duly registered legal entity with authority to enter into this Agreement; (b) all information and documents provided to Cyberlife and Pay.nl are accurate, complete, and genuine; (c) it will operate its business in compliance with all applicable laws, regulations, and card scheme rules; (d) it will not use the payment integration for any prohibited business activities as defined in Pay.nl\'s Terms or applicable law (including but not limited to: money laundering, terrorist financing, fraud, or prohibited goods and services); (e) it will promptly notify Cyberlife of any changes to its business, legal structure, beneficial ownership, or bank account; (f) it will maintain adequate chargeback and dispute handling procedures and respond promptly to any chargeback notifications from Pay.nl; (g) it will comply with PCI-DSS requirements to the extent applicable to its payment processing activities; and (h) it accepts the Pay.nl Terms as binding upon it as a sub-merchant.',
      ],
    },
    {
      heading: 'ARTICLE 8 — LIABILITY & INDEMNIFICATION',
      body: [
        '8.1 Limitation of Liability — Cyberlife\'s liability to the Merchant under or in connection with this Agreement shall be limited to direct damages not exceeding the total Monthly Platform Fees paid by the Merchant in the three (3) months immediately preceding the event giving rise to the claim. Cyberlife shall not be liable for: any interruption, suspension, or termination of Pay.nl\'s services; any failure by Pay.nl to settle funds to the Merchant\'s bank account; chargebacks, fraud losses, or disputes arising from the Merchant\'s transactions; or indirect, consequential, punitive, or special damages of any kind.',
        '8.2 Indemnification by Merchant — The Merchant shall indemnify, defend, and hold harmless Cyberlife from and against any claims, losses, damages, fines, and costs (including legal fees) arising from: (i) the Merchant\'s breach of this Agreement; (ii) the Merchant\'s breach of the Pay.nl Terms; (iii) fraud, chargebacks, or prohibited activities by the Merchant; or (iv) incorrect information provided by the Merchant during KYC.',
        '8.3 Force Majeure — Neither party shall be liable for any delay or failure to perform its obligations under this Agreement to the extent caused by circumstances beyond its reasonable control, including but not limited to acts of God, government actions, cyberattacks, or failure of third-party infrastructure (including Pay.nl\'s systems).',
      ],
    },
    {
      heading: 'ARTICLE 9 — TERM & TERMINATION',
      body: [
        '9.1 Term — This Agreement commences on the Agreement Date and continues on a monthly rolling basis unless terminated in accordance with this Article.',
        '9.2 Termination by Either Party — Either party may terminate this Agreement at any time by providing thirty (30) days\' written notice to the other party. Written notice may be given by email to the addresses set out in Article 11.',
        '9.3 Immediate Termination — Cyberlife may terminate this Agreement with immediate effect, without prior notice, if: the Merchant is in material breach of this Agreement or the Pay.nl Terms; Pay.nl suspends or terminates the Merchant\'s Sub-Merchant Account; the Merchant engages in fraudulent, illegal, or prohibited activities; or the Merchant becomes insolvent, is placed in administration, or enters into a debt restructuring process.',
        '9.4 Effects of Termination — Upon termination: (i) access to the Cyberlife Platform shall cease; (ii) Cyberlife shall instruct Pay.nl to close the Merchant\'s Sub-Merchant Account subject to Pay.nl\'s procedures; (iii) any outstanding Monthly Platform Fees accrued up to the termination date shall remain due and payable; (iv) the Merchant\'s right to receive settlement payments for transactions processed before termination is not affected. Clauses relating to confidentiality, liability, indemnification, and governing law shall survive termination.',
      ],
    },
    {
      heading: 'ARTICLE 10 — GOVERNING LAW & DISPUTE RESOLUTION',
      body: [
        '10.1 Governing Law — This Agreement is governed by and construed in accordance with the laws of the Netherlands, without regard to its conflict of law provisions.',
        '10.2 Disputes — In the event of a dispute arising out of or in connection with this Agreement, the parties shall first attempt to resolve the dispute amicably through good-faith negotiations within thirty (30) days of written notice of the dispute. If the dispute cannot be resolved amicably, it shall be submitted to the exclusive jurisdiction of the competent court in the Netherlands (Rechtbank).',
      ],
    },
    {
      heading: 'ARTICLE 11 — GENERAL PROVISIONS',
      body: [
        '11.1 Notices — All notices under this Agreement shall be in writing and sent by email or registered post to the addresses set out in this Agreement.',
        '11.2 Entire Agreement — This Agreement constitutes the entire agreement between the parties regarding its subject matter and supersedes all prior discussions, representations, and agreements.',
        '11.3 Severability — If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.',
        '11.4 Assignment — The Merchant may not assign or transfer its rights or obligations under this Agreement without Cyberlife\'s prior written consent. Cyberlife may assign this Agreement to an affiliate or successor entity upon thirty (30) days\' written notice.',
        '11.5 Waiver — No failure or delay by either party to enforce any right under this Agreement shall constitute a waiver of that right.',
        '11.6 Language — This Agreement is drawn up in English. In the event of a dispute regarding interpretation, the English version shall prevail.',
      ],
    },
  ];

  for (const article of articles) {
    drawHeading(ctx, article.heading);
    for (const para of article.body) {
      drawBody(ctx, para);
    }
  }

  // ── Signature page ─────────────────────────────────────────────────────────

  drawHR(ctx);
  drawHeading(ctx, 'SIGNATURES');
  drawBody(ctx, 'By signing below, both parties confirm they have read, understood, and agree to be bound by the terms of this Sub-Merchant Services Agreement.');
  ctx.y += SECTION_GAP;

  // Two-column signature block
  const col2X = ML + CONTENT_W / 2 + 10;
  const colW  = CONTENT_W / 2 - 20;

  function drawSigColumn(
    xBase: number,
    party: string,
    name: string,
    title: string,
    date: string,
    note?: string,
  ): void {
    ensureSpace(ctx, 120);
    const yBase = PAGE_H - ctx.y - SIZE_BODY;

    currentPage(ctx).drawText(party, { x: xBase, y: yBase + 4, size: SIZE_BODY, font: bold });
    ctx.y += LINE_H_BODY + 4;

    // Signature line
    const lineY = PAGE_H - ctx.y - 10;
    currentPage(ctx).drawLine({
      start: { x: xBase, y: lineY },
      end:   { x: xBase + colW, y: lineY },
      thickness: 0.5,
      color: rgb(0.3, 0.3, 0.3),
    });
    ctx.y += 14;

    // Name
    currentPage(ctx).drawText(name, { x: xBase, y: PAGE_H - ctx.y - SIZE_BODY, size: SIZE_BODY, font: regular });
    ctx.y += LINE_H_BODY;

    // Title
    currentPage(ctx).drawText(title, { x: xBase, y: PAGE_H - ctx.y - SIZE_SMALL, size: SIZE_SMALL, font: regular, color: rgb(0.4, 0.4, 0.4) });
    ctx.y += LINE_H_BODY;

    // Date
    currentPage(ctx).drawText(`Date: ${date}`, { x: xBase, y: PAGE_H - ctx.y - SIZE_SMALL, size: SIZE_SMALL, font: regular });
    ctx.y += LINE_H_BODY;

    if (note) {
      currentPage(ctx).drawText(note, { x: xBase, y: PAGE_H - ctx.y - SIZE_SMALL, size: SIZE_SMALL, font: regular, color: rgb(0.4, 0.4, 0.4) });
      ctx.y += LINE_H_BODY;
    }
  }

  const cyberlifeSignDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  // Save cursor before drawing first column so second column starts at same Y
  const sigStartY = ctx.y;
  drawSigColumn(ML, 'FOR CYBERLIFE B.V.', cyberlife.signee, cyberlife.title, cyberlifeSignDate);
  const afterLeftY = ctx.y;
  ctx.y = sigStartY;
  drawSigColumn(col2X, 'FOR THE MERCHANT', sig.signeeName, sig.signeeTitle, agreementDate);
  ctx.y = Math.max(afterLeftY, ctx.y);

  // Digital signature metadata block
  ctx.y += SECTION_GAP * 2;
  drawHR(ctx);
  drawHeading(ctx, 'DIGITAL SIGNATURE RECORD');
  drawSmall(ctx, `This agreement was executed digitally on ${sig.signedAt} by ${sig.signeeName} (${sig.signeeTitle}) on behalf of ${org.name}.`);
  if (sig.ipAddress) {
    drawSmall(ctx, `IP address at time of signing: ${sig.ipAddress}`);
  }
  drawSmall(ctx, 'This digital signature has the same legal effect as a handwritten signature under EU Regulation No. 910/2014 (eIDAS) — Article 25(1) — simple electronic signature.');
  drawSmall(ctx, 'NOTICE: This Agreement is a template for use between Cyberlife B.V. and each individual Merchant. Each signed copy constitutes a separate binding agreement. Cyberlife recommends that the Merchant seeks independent legal advice before signing.');

  addPageNumbers(ctx);

  return pdfDoc.save();
}
