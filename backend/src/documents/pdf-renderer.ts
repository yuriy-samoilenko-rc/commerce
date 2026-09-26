import * as path from 'node:path';
import PDFDocument = require('pdfkit');
import { day, DocumentData } from './document-data';

// Fixed labels of the printed form, in Montenegrin (Latin script).
const CANCELLED = 'STORNIRANO';

// DejaVu covers Latin, Serbian Latin and Cyrillic; PDF's built-in fonts do not.
const FONT_DIR = path.join(
  path.dirname(require.resolve('dejavu-fonts-ttf/package.json')),
  'ttf',
);
const REGULAR = path.join(FONT_DIR, 'DejaVuSans.ttf');
const BOLD = path.join(FONT_DIR, 'DejaVuSans-Bold.ttf');

const MARGIN = 40;
const BOTTOM_RESERVE = 50; // footer space
const GRAY = '#666666';
const LINE = '#cccccc';

export interface RenderInput {
  number: string;
  issuedAt: Date;
  cancelled: boolean;
  data: DocumentData;
  /** Wide tables (reports) are printed across the page. */
  landscape?: boolean;
}

export function renderPdf({
  number,
  issuedAt,
  cancelled,
  data,
  landscape = false,
}: RenderInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    layout: landscape ? 'landscape' : 'portrait',
    margin: MARGIN,
    bufferPages: true,
    info: { Title: `${data.title} ${number}`, Author: data.company.name },
  });
  doc.registerFont('regular', REGULAR);
  doc.registerFont('bold', BOLD);

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const width = doc.page.width - 2 * MARGIN;
  const bottom = () => doc.page.height - MARGIN - BOTTOM_RESERVE;
  const ensureSpace = (height: number, onNewPage?: () => void) => {
    if (doc.y + height > bottom()) {
      doc.addPage();
      onNewPage?.();
    }
  };

  // --- header: company left, document right
  const top = MARGIN;
  doc
    .font('bold')
    .fontSize(13)
    .fillColor('black')
    .text(data.company.name, MARGIN, top, { width: width * 0.55 });
  doc.font('regular').fontSize(8).fillColor(GRAY);
  for (const line of data.company.lines)
    doc.text(line, { width: width * 0.55 });
  const leftBottom = doc.y;

  const rightX = MARGIN + width * 0.55;
  const rightW = width * 0.45;
  doc
    .font('bold')
    .fontSize(16)
    .fillColor('black')
    .text(data.title, rightX, top, { width: rightW, align: 'right' });
  doc.fontSize(10).text(number, { width: rightW, align: 'right' });
  doc
    .font('regular')
    .fontSize(9)
    .fillColor(GRAY)
    .text(`Datum: ${day(issuedAt)}`, {
      width: rightW,
      align: 'right',
    });
  if (cancelled)
    doc
      .font('bold')
      .fillColor('#c62828')
      .text(CANCELLED, { width: rightW, align: 'right' });

  doc.y = Math.max(leftBottom, doc.y) + 12;
  rule(doc, width);

  // --- parties and document details side by side
  const blocks = [
    ...data.parties,
    ...(data.meta.length
      ? [
          {
            label: 'Podaci',
            lines: data.meta.map((m) => `${m.label}: ${m.value}`),
          },
        ]
      : []),
  ];
  const blockW = width / Math.max(blocks.length, 3);
  const blocksTop = doc.y + 8;
  let blocksBottom = blocksTop;
  blocks.forEach((b, i) => {
    const x = MARGIN + i * blockW;
    doc
      .font('bold')
      .fontSize(7)
      .fillColor(GRAY)
      .text(b.label.toUpperCase(), x, blocksTop, { width: blockW - 10 });
    doc.font('regular').fontSize(9).fillColor('black');
    for (const line of b.lines)
      doc.text(line, x, doc.y, { width: blockW - 10 });
    blocksBottom = Math.max(blocksBottom, doc.y);
  });
  doc.x = MARGIN;
  doc.y = blocks.length ? blocksBottom + 14 : doc.y + 10;

  // --- items table
  const totalWeight = data.columns.reduce((s, c) => s + c.width, 0);
  const cols = data.columns.map((c) => ({
    ...c,
    w: (c.width / totalWeight) * width,
  }));
  const PAD = 3;
  const drawHeader = () => {
    const y = doc.y;
    doc.font('bold').fontSize(7.5);
    const h =
      Math.max(
        ...cols.map((c) =>
          doc.heightOfString(c.label, { width: c.w - 2 * PAD }),
        ),
      ) +
      2 * PAD;
    doc.rect(MARGIN, y, width, h).fill('#eeeeee');
    let x = MARGIN;
    doc.fillColor('black');
    for (const c of cols) {
      doc.text(c.label, x + PAD, y + PAD, {
        width: c.w - 2 * PAD,
        align: c.align ?? 'left',
      });
      x += c.w;
    }
    doc.x = MARGIN;
    doc.y = y + h;
  };
  drawHeader();

  for (const row of data.rows) {
    doc.font('regular').fontSize(8.5);
    const cellH = Math.max(
      ...cols.map((c) =>
        doc.heightOfString(row.cells[c.key] ?? '', { width: c.w - 2 * PAD }),
      ),
    );
    doc.fontSize(7.5);
    const noteH = row.note
      ? doc.heightOfString(row.note, { width: width - 2 * PAD }) + 2
      : 0;
    const h = cellH + noteH + 2 * PAD;
    ensureSpace(h, drawHeader);

    const y = doc.y;
    let x = MARGIN;
    doc.font('regular').fontSize(8.5).fillColor('black');
    for (const c of cols) {
      doc.text(row.cells[c.key] ?? '', x + PAD, y + PAD, {
        width: c.w - 2 * PAD,
        align: c.align ?? 'left',
      });
      x += c.w;
    }
    if (row.note) {
      doc
        .fontSize(7.5)
        .fillColor(GRAY)
        .text(row.note, MARGIN + PAD, y + PAD + cellH + 2, {
          width: width - 2 * PAD,
        });
    }
    doc
      .moveTo(MARGIN, y + h)
      .lineTo(MARGIN + width, y + h)
      .lineWidth(0.5)
      .strokeColor(LINE)
      .stroke();
    doc.x = MARGIN;
    doc.y = y + h;
  }

  // --- totals, right-aligned
  doc.moveDown(0.6);
  const labelW = 260;
  const valueW = 90;
  const tx = MARGIN + width - labelW - valueW;
  for (const t of data.totals) {
    doc
      .font(t.bold ? 'bold' : 'regular')
      .fontSize(t.bold ? 10 : 9)
      .fillColor('black');
    // A long label may wrap: the next line starts below whatever was drawn.
    const h = Math.max(
      doc.heightOfString(t.label, { width: labelW - 8 }),
      doc.heightOfString(t.value, { width: valueW }),
    );
    ensureSpace(h + 4);
    const y = doc.y;
    doc.text(t.label, tx, y, { width: labelW - 8, align: 'right' });
    doc.text(t.value, tx + labelW, y, { width: valueW, align: 'right' });
    doc.x = MARGIN;
    doc.y = y + h + (t.bold ? 5 : 3);
  }

  // --- notes
  if (data.notes.length) {
    doc.moveDown(0.8);
    doc.font('regular').fontSize(8).fillColor(GRAY);
    for (const note of data.notes) {
      ensureSpace(24);
      doc.text(note, MARGIN, doc.y, { width });
    }
  }

  // --- signatures
  if (data.signatures.length) {
    ensureSpace(60);
    doc.y += 36;
    // Short lines even when there is a single signature.
    const sigW = Math.min(width / data.signatures.length, 260);
    const y = doc.y;
    data.signatures.forEach((label, i) => {
      const x = MARGIN + i * sigW;
      doc
        .moveTo(x, y)
        .lineTo(x + sigW - 30, y)
        .lineWidth(0.5)
        .strokeColor('black')
        .stroke();
      doc
        .font('regular')
        .fontSize(8)
        .fillColor(GRAY)
        .text(label, x, y + 4, { width: sigW - 30 });
    });
  }

  // --- footer and "cancelled" watermark on every page
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // writing below the margin must not open a new page
    if (cancelled) {
      doc.save();
      doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
      // Fit the word on one line whatever its length.
      doc.font('bold').fontSize(100);
      const size = Math.min(
        100,
        (100 * doc.page.width * 0.8) / doc.widthOfString(CANCELLED),
      );
      doc.fontSize(size).fillColor('#c62828').opacity(0.12);
      doc.text(CANCELLED, 0, doc.page.height / 2 - size / 2, {
        width: doc.page.width,
        align: 'center',
        lineBreak: false,
      });
      doc.restore();
      doc.opacity(1);
    }
    doc.font('regular').fontSize(7).fillColor(GRAY);
    doc.text(
      `${number} · strana ${i - range.start + 1} od ${range.count}`,
      MARGIN,
      doc.page.height - MARGIN - 10,
      {
        width,
        align: 'center',
      },
    );
  }

  doc.end();
  return done;
}

function rule(doc: PDFKit.PDFDocument, width: number) {
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + width, doc.y)
    .lineWidth(1)
    .strokeColor('black')
    .stroke();
}
