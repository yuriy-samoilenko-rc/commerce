import { Workbook } from 'exceljs';
import { companyBlock } from '../documents/document-builders';
import { DocumentData, money } from '../documents/document-data';
import { renderPdf } from '../documents/pdf-renderer';
import { CompanySettings, Prisma } from '../generated/prisma/client';

// Report headers and titles are shown to people: Montenegrin, Latin script.

export type ColumnType = 'text' | 'int' | 'money' | 'percent';

export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
}

export type Cell = string | number | Prisma.Decimal | null;

export interface Report {
  title: string;
  /** e.g. "01.09.2026. – 26.09.2026." */
  subtitle: string;
  columns: ReportColumn[];
  rows: Record<string, Cell>[];
  totals?: Record<string, Cell>;
}

export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'pdf';

const asNumber = (v: Cell) =>
  v === null || v === ''
    ? null
    : v instanceof Prisma.Decimal
      ? v.toNumber()
      : Number(v);

/** Montenegrin display: 1.357,90 / 23,5% */
function display(v: Cell, type: ColumnType) {
  if (v === null || v === undefined) return '';
  if (type === 'money') return money(v);
  if (type === 'percent')
    return `${new Prisma.Decimal(v).toFixed(1).replace('.', ',')}%`;
  return String(v);
}

// ---------- CSV ----------

export function toCsv(report: Report): Buffer {
  const quote = (s: string) =>
    /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  // Plain numbers with a decimal comma import cleanly into Excel with Montenegrin settings.
  const cell = (v: Cell, type: ColumnType) =>
    type === 'text' || v === null
      ? quote(v === null ? '' : String(v))
      : display(v, type).replace(/\./g, '');
  const lines = [
    report.columns.map((c) => quote(c.label)).join(';'),
    ...report.rows.map((r) =>
      report.columns.map((c) => cell(r[c.key] ?? null, c.type)).join(';'),
    ),
  ];
  if (report.totals) {
    lines.push(
      report.columns
        .map((c) => cell(report.totals![c.key] ?? null, c.type))
        .join(';'),
    );
  }
  // The BOM makes Excel read UTF-8, so č, ć, ž, š and đ survive.
  return Buffer.from('﻿' + lines.join('\r\n') + '\r\n', 'utf8');
}

// ---------- XLSX ----------

const NUMBER_FORMAT: Record<ColumnType, string | undefined> = {
  text: undefined,
  int: '#,##0',
  money: '#,##0.00',
  percent: '0.0"%"',
};

export async function toXlsx(report: Report): Promise<Buffer> {
  const wb = new Workbook();
  const ws = wb.addWorksheet(report.title.slice(0, 31));
  ws.addRow([report.title]).font = { bold: true, size: 13 };
  ws.addRow([report.subtitle]);
  ws.addRow([]);
  const header = ws.addRow(report.columns.map((c) => c.label));
  header.font = { bold: true };
  header.eachCell((c) => {
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEEEEEE' },
    };
  });

  // Real numbers, not text: the accountant can sum and pivot them.
  const values = (r: Record<string, Cell>) =>
    report.columns.map((c) =>
      c.type === 'text' ? (r[c.key] ?? '') : asNumber(r[c.key] ?? null),
    );
  for (const r of report.rows) ws.addRow(values(r));
  if (report.totals) ws.addRow(values(report.totals)).font = { bold: true };

  report.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.numFmt = NUMBER_FORMAT[c.type] ?? '@';
    col.width = c.type === 'text' ? 34 : 16;
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------- PDF ----------

export function toPdf(
  report: Report,
  company: CompanySettings,
): Promise<Buffer> {
  const data: DocumentData = {
    title: report.title,
    company: companyBlock(company),
    parties: [],
    meta: [],
    columns: report.columns.map((c) => ({
      key: c.key,
      label: c.label,
      // numeric headers such as "Nabavna vrijednost" need room to wrap between words
      width: c.type === 'text' ? 20 : 12,
      align: c.type === 'text' ? 'left' : 'right',
    })),
    rows: report.rows.map((r) => ({
      cells: Object.fromEntries(
        report.columns.map((c) => [c.key, display(r[c.key] ?? null, c.type)]),
      ),
    })),
    totals: report.totals
      ? report.columns
          .filter(
            (c) =>
              c.type !== 'text' &&
              report.totals![c.key] !== undefined &&
              report.totals![c.key] !== null,
          )
          .map((c, i, all) => ({
            label: c.label,
            value: display(report.totals![c.key], c.type),
            bold: i === all.length - 1,
          }))
      : [],
    notes: [],
    signatures: [],
  };
  return renderPdf({
    number: report.subtitle,
    issuedAt: new Date(),
    cancelled: false,
    data,
    landscape: report.columns.length > 6,
  });
}

export const EXPORT_TYPES: Record<
  Exclude<ExportFormat, 'json'>,
  { contentType: string; extension: string }
> = {
  csv: { contentType: 'text/csv; charset=utf-8', extension: 'csv' },
  xlsx: {
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
  },
  pdf: { contentType: 'application/pdf', extension: 'pdf' },
};
