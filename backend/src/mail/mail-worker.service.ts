import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { DocumentsService } from '../documents/documents.service';
import { EmailStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

const MAX_ATTEMPTS = 5;
const BATCH = 20;

interface ClaimedEmail {
  id: string;
  to: string;
  subject: string;
  text: string;
  html: string | null;
  documentIds: string[];
  attempts: number;
}

/** Sends queued emails with retries: 1, 2, 4, 8 minutes apart, then gives up (FAILED). */
@Injectable()
export class MailWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(MailWorker.name);
  private transport!: Transporter;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  onApplicationBootstrap() {
    const user = process.env.SMTP_USER;
    this.transport = createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port: num('SMTP_PORT', 1025),
      secure: process.env.SMTP_SECURE === 'true',
      auth: user ? { user, pass: process.env.SMTP_PASS } : undefined,
    });
    this.timer = setInterval(
      () => void this.tick(),
      num('MAIL_WORKER_INTERVAL_SECONDS', 10) * 1000,
    );
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
    this.transport?.close();
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      for (const email of await this.claim()) await this.send(email);
    } catch (e) {
      this.logger.error('Mail worker failed', e instanceof Error ? e.stack : e);
    } finally {
      this.running = false;
    }
  }

  /**
   * Takes a batch and pushes its sendAfter 5 minutes ahead as a lease. SKIP LOCKED lets
   * several servers run the worker at once without sending the same email twice.
   */
  private claim() {
    return this.prisma.$queryRaw<ClaimedEmail[]>`
      UPDATE "email_outbox"
      SET "attempts" = "attempts" + 1, "sendAfter" = now() + interval '5 minutes'
      WHERE "id" IN (
        SELECT "id" FROM "email_outbox"
        WHERE "status" = 'PENDING' AND "sendAfter" <= now()
        ORDER BY "createdAt"
        LIMIT ${BATCH}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "to", "subject", "text", "html", "documentIds", "attempts"`;
  }

  private async send(email: ClaimedEmail) {
    try {
      const attachments = [];
      for (const id of email.documentIds) {
        const pdf = await this.documents.pdf(id);
        attachments.push({
          filename: pdf.fileName,
          content: pdf.buffer,
          contentType: 'application/pdf',
        });
      }
      await this.transport.sendMail({
        from: process.env.MAIL_FROM ?? 'TechStore <no-reply@techstore.me>',
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html ?? undefined,
        attachments,
      });
      await this.prisma.emailOutbox.update({
        where: { id: email.id },
        data: { status: EmailStatus.SENT, sentAt: new Date(), lastError: null },
      });
    } catch (e) {
      const failed = email.attempts >= MAX_ATTEMPTS;
      const retryInMinutes = 2 ** (email.attempts - 1);
      await this.prisma.emailOutbox.update({
        where: { id: email.id },
        data: {
          status: failed ? EmailStatus.FAILED : EmailStatus.PENDING,
          lastError: (e instanceof Error ? e.message : String(e)).slice(
            0,
            1000,
          ),
          sendAfter: new Date(Date.now() + retryInMinutes * 60_000),
        },
      });
      this.logger.warn(
        `Email ${email.id} to ${email.to} failed (attempt ${email.attempts}): ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
