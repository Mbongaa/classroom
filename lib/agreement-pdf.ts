/**
 * Generates the signed Pay.nl Samenwerkingsovereenkomst as a PDF.
 *
 * Three-party template:
 *   - Merchant  → dynamic from organizations + signee form
 *   - PAY       → static (TinTel BV)
 *   - Alliance  → static (Cyberlife B.V., Hassan Najem)
 *
 * The admin draws their signature in the dashboard; that PNG is embedded on
 * the "Voor akkoord" line in the Merchant signature column. A second page
 * captures the digital signature record (timestamp, IP, eIDAS reference).
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  AGREEMENT_ARTICLES,
  PAY_LOCATIONS,
  PAY_PARTY,
  buildMerchantParagraph,
  buildPayParagraph,
  type MerchantParagraphInput,
} from './agreement-text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgreementOrgData = MerchantParagraphInput;

export interface AgreementSignature {
  signeeName: string;
  signeeTitle: string;
  signedPlace: string;
  signedAt: string;            // ISO timestamp
  signaturePng: Uint8Array;    // decoded PNG bytes from the signature canvas
  ipAddress?: string;
}

// Aliases so the rest of this file can keep its original short names.
const PAY = PAY_PARTY;
const LOCATIONS = PAY_LOCATIONS;

// ---------------------------------------------------------------------------
// Layout constants (A4 portrait, all units in pt)
// ---------------------------------------------------------------------------

const PAGE_W = 595;
const PAGE_H = 842;

const ML = 60;                // left margin (content)
const MT = 55;                // top margin
const MB = 50;                // bottom margin

const CONTENT_W = 330;        // left content column width → ends at x=390
const SIDEBAR_X = 435;        // right sidebar left edge
const SIDEBAR_W = 120;        // right sidebar width → ends at x=555

const SIZE_TITLE   = 12;
const SIZE_HEADING = 9.5;
const SIZE_BODY    = 9;
const SIZE_LABEL   = 7.5;
const SIZE_SMALL   = 8;

const LINE_H_BODY = 12;
const LINE_H_HEAD = 14;
const PARA_GAP = 6;
const SECTION_GAP = 10;

const COLOR_TEXT   = rgb(0, 0, 0);
const COLOR_MUTED  = rgb(0.45, 0.45, 0.45);
const COLOR_ACCENT = rgb(0.28, 0.38, 0.98); // Pay.nl-style accent blue
const COLOR_LINE   = rgb(0.65, 0.65, 0.65);

// ---------------------------------------------------------------------------
// Renderer context
// ---------------------------------------------------------------------------

interface Ctx {
  doc: PDFDocument;
  bold: PDFFont;
  regular: PDFFont;
  pages: PDFPage[];
  y: number;                   // cursor from top of current page
  logo: PDFImage | null;
  sigImg: PDFImage;
}

function currentPage(ctx: Ctx): PDFPage {
  return ctx.pages[ctx.pages.length - 1];
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
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

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y + needed > PAGE_H - MB) {
    addPage(ctx, /* withSidebar */ false);
  }
}

function addPage(ctx: Ctx, withSidebar = true): void {
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pages.push(page);
  ctx.y = MT;
  if (ctx.logo) drawLogo(page, ctx.logo);
  if (withSidebar) drawSidebar(page, ctx.bold, ctx.regular);
}

function drawBody(ctx: Ctx, text: string, indent = 0): void {
  const lines = wrapText(text, ctx.regular, SIZE_BODY, CONTENT_W - indent);
  for (const line of lines) {
    ensureSpace(ctx, LINE_H_BODY);
    currentPage(ctx).drawText(line, {
      x: ML + indent,
      y: PAGE_H - ctx.y - SIZE_BODY,
      size: SIZE_BODY,
      font: ctx.regular,
      color: COLOR_TEXT,
    });
    ctx.y += LINE_H_BODY;
  }
}

function drawHeading(ctx: Ctx, text: string): void {
  ctx.y += SECTION_GAP;
  ensureSpace(ctx, LINE_H_HEAD);
  currentPage(ctx).drawText(text, {
    x: ML,
    y: PAGE_H - ctx.y - SIZE_HEADING,
    size: SIZE_HEADING,
    font: ctx.bold,
    color: COLOR_TEXT,
  });
  ctx.y += LINE_H_HEAD;
}

function drawTitle(ctx: Ctx, text: string): void {
  ensureSpace(ctx, LINE_H_HEAD + 6);
  currentPage(ctx).drawText(text, {
    x: ML,
    y: PAGE_H - ctx.y - SIZE_TITLE,
    size: SIZE_TITLE,
    font: ctx.bold,
    color: COLOR_TEXT,
  });
  ctx.y += LINE_H_HEAD + 6;
}

// ---------------------------------------------------------------------------
// Logo + sidebar (drawn once per page at fixed positions)
// ---------------------------------------------------------------------------

function drawLogo(page: PDFPage, logo: PDFImage): void {
  const targetW = 72;
  const ratio = logo.height / logo.width;
  const h = targetW * ratio;
  page.drawImage(logo, {
    x: PAGE_W - 60 - targetW,
    y: PAGE_H - 45 - h,
    width: targetW,
    height: h,
  });
}

function drawSidebar(page: PDFPage, bold: PDFFont, regular: PDFFont): void {
  // Contact table: label (bold, muted) + value
  let y = PAGE_H - 140;
  const rows: Array<[string, string]> = [
    ['TEL',  PAY.tel],
    ['KVK',  PAY.kvk],
    ['BTW',  PAY.btw],
    ['IBAN', PAY.iban],
    ['BIC',  PAY.bic],
  ];
  for (const [label, value] of rows) {
    page.drawText(label, {
      x: SIDEBAR_X,
      y,
      size: SIZE_LABEL,
      font: bold,
      color: COLOR_MUTED,
    });
    page.drawText(value, {
      x: SIDEBAR_X + 28,
      y,
      size: SIZE_LABEL,
      font: regular,
      color: COLOR_TEXT,
    });
    y -= 13;
  }

  // Locations stacked further down the sidebar
  y -= 20;
  for (const loc of LOCATIONS) {
    page.drawText(loc.label, {
      x: SIDEBAR_X,
      y,
      size: SIZE_LABEL,
      font: bold,
      color: COLOR_ACCENT,
    });
    y -= 12;
    for (const line of loc.lines) {
      page.drawText(line, {
        x: SIDEBAR_X,
        y,
        size: SIZE_LABEL,
        font: regular,
        color: COLOR_TEXT,
      });
      y -= 10;
    }
    y -= 10;
  }
}

// ---------------------------------------------------------------------------
// Signature block (two columns: Merchant | PAY)
// ---------------------------------------------------------------------------

function drawSignatureRow(
  ctx: Ctx,
  xBase: number,
  colW: number,
  label: string,
  value: string,
  yOffset: number,
  italic = true,
): void {
  const labelFont = italic ? ctx.regular : ctx.regular;
  const labelText = `${label}:`;
  currentPage(ctx).drawText(labelText, {
    x: xBase,
    y: PAGE_H - yOffset - SIZE_BODY,
    size: SIZE_BODY,
    font: labelFont,
    color: COLOR_MUTED,
  });
  const labelW = labelFont.widthOfTextAtSize(labelText + ' ', SIZE_BODY);

  // Dotted line the full remaining width of the column
  const lineStart = xBase + labelW + 30;
  const lineEnd = xBase + colW;
  currentPage(ctx).drawLine({
    start: { x: lineStart, y: PAGE_H - yOffset - 2 },
    end:   { x: lineEnd,   y: PAGE_H - yOffset - 2 },
    thickness: 0.4,
    color: COLOR_LINE,
    dashArray: [1.5, 1.5],
  });

  if (value) {
    currentPage(ctx).drawText(value, {
      x: lineStart + 4,
      y: PAGE_H - yOffset - SIZE_BODY + 2,
      size: SIZE_BODY,
      font: ctx.regular,
      color: COLOR_TEXT,
    });
  }
}

function drawSignatureColumn(
  ctx: Ctx,
  xBase: number,
  colW: number,
  party: string,
  filled: { naam?: string; datum?: string; plaats?: string; signature?: PDFImage } = {},
): void {
  // Party header (italic-ish muted, matches Pay.nl sample)
  currentPage(ctx).drawText(party, {
    x: xBase,
    y: PAGE_H - ctx.y - SIZE_BODY,
    size: SIZE_BODY,
    font: ctx.regular,
    color: COLOR_MUTED,
  });
  const rowStartY = ctx.y + 30;

  // Rows — each takes 20pt vertical space
  drawSignatureRow(ctx, xBase, colW, 'Naam',   filled.naam   ?? '', rowStartY);
  drawSignatureRow(ctx, xBase, colW, 'Datum',  filled.datum  ?? '', rowStartY + 22);
  drawSignatureRow(ctx, xBase, colW, 'Plaats', filled.plaats ?? '', rowStartY + 44);
  drawSignatureRow(ctx, xBase, colW, 'Voor akkoord', '', rowStartY + 76);

  if (filled.signature) {
    const sig = filled.signature;
    const maxW = colW - 70;
    const maxH = 36;
    const ratio = sig.height / sig.width;
    let w = maxW;
    let h = w * ratio;
    if (h > maxH) {
      h = maxH;
      w = h / ratio;
    }
    currentPage(ctx).drawImage(sig, {
      x: xBase + 70,
      y: PAGE_H - rowStartY - 76 - 6,
      width: w,
      height: h,
    });
  }
}

// ---------------------------------------------------------------------------
// Formatter helpers
// ---------------------------------------------------------------------------

function formatNlDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function formatIsoHuman(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

// ---------------------------------------------------------------------------
// Page numbers + footer
// ---------------------------------------------------------------------------

function addPageNumbers(ctx: Ctx): void {
  const total = ctx.pages.length;
  ctx.pages.forEach((page, i) => {
    page.drawText(`Pagina ${i + 1} / ${total}`, {
      x: ML,
      y: 24,
      size: SIZE_SMALL,
      font: ctx.regular,
      color: COLOR_MUTED,
    });
    page.drawText('Samenwerkingsovereenkomst — PAY × Alliance × Merchant', {
      x: ML + 60,
      y: 24,
      size: SIZE_SMALL,
      font: ctx.regular,
      color: COLOR_MUTED,
    });
  });
}

// ---------------------------------------------------------------------------
// Logo loader (fail-soft)
// ---------------------------------------------------------------------------

async function loadLogo(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    const logoPath = path.join(
      process.cwd(),
      'public',
      'images',
      'paynl',
      'brand',
      '400x400',
      'logo_pay_standard.png',
    );
    const bytes = await fs.readFile(logoPath);
    return await doc.embedPng(bytes);
  } catch (err) {
    console.warn('[agreement-pdf] Pay.nl logo not found, rendering without logo', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateAgreementPdf(
  org: AgreementOrgData,
  sig: AgreementSignature,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  const logo = await loadLogo(doc);
  const sigImg = await doc.embedPng(sig.signaturePng);

  const ctx: Ctx = { doc, bold, regular, pages: [], y: MT, logo, sigImg };
  addPage(ctx, /* withSidebar */ true);

  // ── Title ────────────────────────────────────────────────────────────────
  drawTitle(ctx, 'SAMENWERKINGSOVEREENKOMST');

  // ── ONDERGETEKENDEN ──────────────────────────────────────────────────────
  drawHeading(ctx, 'ONDERGETEKENDEN');

  drawBody(ctx, buildMerchantParagraph(org, sig.signeeName));
  ctx.y += PARA_GAP;

  drawBody(ctx, '&');
  ctx.y += PARA_GAP / 2;

  drawBody(ctx, buildPayParagraph());
  ctx.y += PARA_GAP;

  // ── VERKLAREN TE ZIJN OVEREENGEKOMEN ALS VOLGT ───────────────────────────
  drawHeading(ctx, 'VERKLAREN TE ZIJN OVEREENGEKOMEN ALS VOLGT');

  for (const article of AGREEMENT_ARTICLES) {
    drawBody(ctx, `${article.id}  ${article.body}`);
    ctx.y += PARA_GAP;
  }

  // ── ALDUS GELEZEN EN AKKOORD BEVONDEN ────────────────────────────────────
  ctx.y += SECTION_GAP;
  drawHeading(ctx, 'ALDUS GELEZEN EN AKKOORD BEVONDEN');

  // Two-column signature block
  const colW = (CONTENT_W - 20) / 2; // ~155pt each
  const col1X = ML;
  const col2X = ML + colW + 20;

  const sigStartY = ctx.y + 6;
  ctx.y = sigStartY;
  drawSignatureColumn(ctx, col1X, colW, 'Merchant', {
    naam: sig.signeeName,
    datum: formatNlDate(sig.signedAt),
    plaats: sig.signedPlace,
    signature: sigImg,
  });
  // Reset cursor to same row to draw PAY column at the same y
  ctx.y = sigStartY;
  drawSignatureColumn(ctx, col2X, colW, 'PAY');

  // Move cursor below both columns
  ctx.y = sigStartY + 110;

  // ── Digital signature record (separate page, no sidebar) ─────────────────
  addPage(ctx, /* withSidebar */ false);
  drawTitle(ctx, 'DIGITAAL ONDERTEKEND — DIGITAL SIGNATURE RECORD');
  drawBody(
    ctx,
    `Dit document is op ${formatIsoHuman(sig.signedAt)} digitaal ondertekend door ` +
      `${sig.signeeName} (${sig.signeeTitle}) namens ${org.name}, te ${sig.signedPlace}.`,
  );
  ctx.y += PARA_GAP;
  drawBody(
    ctx,
    `This document was digitally signed on ${formatIsoHuman(sig.signedAt)} by ` +
      `${sig.signeeName} (${sig.signeeTitle}) on behalf of ${org.name}, at ${sig.signedPlace}.`,
  );
  ctx.y += PARA_GAP;
  if (sig.ipAddress) {
    drawBody(ctx, `IP address at time of signing / IP-adres bij ondertekening: ${sig.ipAddress}`);
    ctx.y += PARA_GAP;
  }
  drawBody(
    ctx,
    'Deze digitale handtekening heeft dezelfde rechtskracht als een handgeschreven handtekening ' +
      'onder Verordening (EU) Nr. 910/2014 (eIDAS), artikel 25(1) — eenvoudige elektronische handtekening.',
  );
  ctx.y += PARA_GAP;
  drawBody(
    ctx,
    'This digital signature has the same legal effect as a handwritten signature under ' +
      'EU Regulation 910/2014 (eIDAS), Article 25(1) — simple electronic signature.',
  );

  addPageNumbers(ctx);

  return doc.save();
}
