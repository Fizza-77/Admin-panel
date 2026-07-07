import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import { getSmtpConfig } from '@/lib/email/smtpConfig';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const config = getSmtpConfig();
  if (!config) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  return transporter;
}

export async function sendMail(options: Mail.Options): Promise<void> {
  const config = getSmtpConfig();
  const transport = getTransporter();

  if (!config || !transport) {
    throw new Error('SMTP is not configured');
  }

  await transport.sendMail({
    from: config.from,
    ...options,
  });
}
