import nodemailer from "nodemailer";
import { Resend } from "resend";

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
};

/*
 * Two free ways to send, chosen by what is set in the environment:
 *
 *   Resend (free up to 3,000 emails a month, 100 a day; needs your own
 *   verified domain to email other people):
 *     RESEND_API_KEY, EMAIL_FROM="RaqHub <hello@yourdomain.com>"
 *
 *   Any SMTP mailbox, e.g. a free Gmail account with an app password
 *   (Gmail allows about 500 recipients a day):
 *     SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER, SMTP_PASS,
 *     EMAIL_FROM="RaqHub <you@gmail.com>" (optional)
 *
 * With neither set, emails are only logged, so local development works.
 */

let smtp: nodemailer.Transporter | null = null;

function smtpTransport() {
  if (!smtp) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return smtp;
}

export function emailProvider(): "resend" | "smtp" | "none" {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "resend";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return "none";
}

/** Sends one email. Never throws: returns false when it couldn't be sent. */
export async function sendEmail(email: Email): Promise<boolean> {
  const provider = emailProvider();
  const replyTo = email.replyTo || undefined;

  try {
    if (provider === "resend") {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo,
      });
      if (error) {
        console.error("[email] Resend refused", email.to, error);
        return false;
      }
      return true;
    }

    if (provider === "smtp") {
      await smtpTransport().sendMail({
        from: process.env.EMAIL_FROM || `RaqHub <${process.env.SMTP_USER}>`,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo,
      });
      return true;
    }

    console.info(`[email] not configured, would send to ${email.to}: ${email.subject}`);
    return false;
  } catch (e) {
    console.error("[email] sending failed", email.to, e);
    return false;
  }
}
