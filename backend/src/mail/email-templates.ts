import { day, money } from '../documents/document-data';
import {
  CompanySettings,
  DeliveryMethod,
  PaymentMethod,
  Prisma,
  ReturnStatus,
} from '../generated/prisma/client';

// Customer emails, in Montenegrin (Latin script).

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

type OrderForEmail = Prisma.OrderGetPayload<{ include: { items: true } }>;

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

function wrap(
  company: CompanySettings,
  subject: string,
  paragraphs: string[],
): EmailContent {
  const signature = [
    company.legalName || company.name,
    company.phone,
    company.email,
  ]
    .filter(Boolean)
    .join(' · ');
  const text = [...paragraphs, '', 'Srdačan pozdrav,', signature]
    .join('\n\n')
    .replace(/\n\n\n+/g, '\n\n');
  // Every value is escaped: customer names and addresses must not turn into markup.
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">` +
    paragraphs
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
      .join('') +
    `<p>Srdačan pozdrav,<br>${escapeHtml(signature)}</p></div>`;
  return { subject, text, html };
}

const greeting = (o: { customerName: string }) =>
  `Poštovani/a ${o.customerName},`;

function itemLines(o: OrderForEmail) {
  const lines = o.items.map(
    (i) => `• ${i.productName} × ${i.quantity}: ${money(i.lineTotal)} EUR`,
  );
  if (o.deliveryFee.gt(0)) lines.push(`• Dostava: ${money(o.deliveryFee)} EUR`);
  lines.push(`Ukupno: ${money(o.total)} EUR`);
  return lines.join('\n');
}

export function orderReceived(
  company: CompanySettings,
  o: OrderForEmail,
  paymentMinutes: number,
): EmailContent {
  const payment = {
    [PaymentMethod.CARD_ONLINE]: `Narudžbu je potrebno platiti karticom u roku od ${paymentMinutes} minuta, u suprotnom će biti automatski otkazana.`,
    [PaymentMethod.BANK_TRANSFER]:
      'Nakon što potvrdimo narudžbu, poslaćemo vam račun sa podacima za uplatu.',
    [PaymentMethod.CASH_ON_DELIVERY]:
      'Plaćanje je pouzećem, prilikom preuzimanja.',
  }[o.paymentMethod];
  return wrap(company, `Primili smo vašu narudžbu br. ${o.number}`, [
    greeting(o),
    `hvala na kupovini! Primili smo vašu narudžbu br. ${o.number} od ${day(o.createdAt)}.`,
    itemLines(o),
    payment,
  ]);
}

export function orderConfirmed(
  company: CompanySettings,
  o: OrderForEmail,
): EmailContent {
  return wrap(
    company,
    `Narudžba br. ${o.number} je potvrđena`,
    [
      greeting(o),
      'vaša narudžba je potvrđena. U prilogu vam šaljemo račun.',
      o.paymentMethod === PaymentMethod.BANK_TRANSFER && company.bankAccount
        ? `Molimo uplatite ${money(o.total)} EUR na žiro račun ${company.bankAccount}, poziv na broj: narudžba ${o.number}.`
        : '',
    ].filter(Boolean),
  );
}

export function orderShipped(
  company: CompanySettings,
  o: OrderForEmail,
): EmailContent {
  if (o.deliveryMethod === DeliveryMethod.PICKUP) {
    return wrap(company, `Narudžba br. ${o.number} je preuzeta`, [
      greeting(o),
      'hvala što ste preuzeli narudžbu. U prilogu su otpremnica i garantni list, ako ga proizvod ima.',
    ]);
  }
  const tracking = [
    o.carrier && `Prevoznik: ${o.carrier}`,
    o.trackingNumber && `Broj pošiljke: ${o.trackingNumber}`,
  ]
    .filter(Boolean)
    .join('\n');
  return wrap(
    company,
    `Narudžba br. ${o.number} je poslata`,
    [
      greeting(o),
      'vaša narudžba je predata kurirskoj službi.',
      tracking,
      'U prilogu su otpremnica i garantni list, ako ga proizvod ima.',
    ].filter(Boolean),
  );
}

export function orderCancelled(
  company: CompanySettings,
  o: OrderForEmail,
): EmailContent {
  return wrap(
    company,
    `Narudžba br. ${o.number} je otkazana`,
    [
      greeting(o),
      `narudžba br. ${o.number} je otkazana.`,
      o.cancelReason ? `Razlog: ${o.cancelReason}` : '',
      o.paymentStatus === 'PAID'
        ? 'Uplaćeni iznos ćemo vam vratiti na isti način na koji ste platili.'
        : '',
    ].filter(Boolean),
  );
}

export function returnDecided(
  company: CompanySettings,
  r: {
    number: string;
    status: ReturnStatus;
    refundAmount: Prisma.Decimal | null;
  },
  o: { number: number; customerName: string },
): EmailContent {
  if (r.status === ReturnStatus.REJECTED) {
    return wrap(company, `Povraćaj ${r.number} nije odobren`, [
      greeting(o),
      `nakon provjere robe povraćaj ${r.number} (narudžba br. ${o.number}) nije odobren. Robu ćemo vam vratiti.`,
    ]);
  }
  return wrap(company, `Povraćaj ${r.number} je odobren`, [
    greeting(o),
    `odobrili smo povraćaj ${r.number} za narudžbu br. ${o.number}.`,
    `Iznos za povraćaj: ${money(r.refundAmount ?? 0)} EUR. Novac ćemo vratiti na isti način na koji ste platili.`,
    'U prilogu je povratnica.',
  ]);
}

export function documentEmail(
  company: CompanySettings,
  doc: { title: string; number: string },
): EmailContent {
  return wrap(company, `${doc.title} ${doc.number}`, [
    'Poštovani,',
    `u prilogu vam šaljemo dokument „${doc.title}” br. ${doc.number}.`,
  ]);
}
