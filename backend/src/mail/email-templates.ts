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

export function passwordReset(
  company: CompanySettings,
  user: { name: string },
  link: string,
  minutes: number,
): EmailContent {
  return wrap(company, 'Nova lozinka za vaš nalog', [
    `Poštovani/a ${user.name},`,
    'primili smo zahtjev za novu lozinku za vaš nalog u internet prodavnici. Novu lozinku postavljate na ovoj stranici:',
    link,
    `Link važi ${minutes} minuta i može se iskoristiti samo jednom. Ako niste tražili novu lozinku, zanemarite ovu poruku — vaša lozinka ostaje ista.`,
  ]);
}

/** A manager made the account (e.g. for a phone customer); the customer sets the password. */
export function accountCreated(
  company: CompanySettings,
  user: { name: string; email: string },
  link: string,
  days: number,
): EmailContent {
  return wrap(company, 'Vaš nalog u internet prodavnici', [
    `Poštovani/a ${user.name},`,
    `otvorili smo vam nalog u našoj internet prodavnici sa email adresom ${user.email}. U nalogu vidite svoje narudžbe, račune i garantne listove, a kupovina je brža jer su vaši podaci već upisani.`,
    'Lozinku za prijavu postavljate na ovoj stranici:',
    link,
    `Link važi ${days} dana i može se iskoristiti samo jednom. Ako vam nalog ne treba, zanemarite ovu poruku.`,
  ]);
}

export function backInStock(
  company: CompanySettings,
  product: { name: string },
  link: string,
): EmailContent {
  return wrap(company, `„${product.name}“ je ponovo na stanju`, [
    'Poštovani,',
    `proizvod „${product.name}“ koji ste čekali ponovo je na stanju i možete ga poručiti:`,
    link,
    'Količine su ograničene, pa ga ne možemo rezervisati unaprijed. Ovo je jedino obavještenje — vaša email adresa je nakon slanja obrisana sa liste čekanja.',
  ]);
}

export function questionAnswered(
  company: CompanySettings,
  user: { name: string },
  product: { name: string },
  qa: { question: string; answer: string },
  link: string,
): EmailContent {
  return wrap(company, `Odgovor na vaše pitanje o „${product.name}“`, [
    `Poštovani/a ${user.name},`,
    `odgovorili smo na vaše pitanje o proizvodu „${product.name}“.`,
    `Pitanje: ${qa.question}`,
    `Odgovor: ${qa.answer}`,
    `Pitanje i odgovor vidljivi su i na stranici proizvoda: ${link}`,
  ]);
}
