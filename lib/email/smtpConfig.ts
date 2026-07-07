export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = readOptionalEnv('SMTP_HOST');
  const user = readOptionalEnv('SMTP_USER');
  const pass = readOptionalEnv('SMTP_PASS');

  if (!host || !user || !pass) {
    return null;
  }

  const portRaw = readOptionalEnv('SMTP_PORT');
  const port = portRaw ? Number(portRaw) : 587;
  const secure =
    readOptionalEnv('SMTP_SECURE') === 'true' || port === 465;

  const from = readOptionalEnv('SMTP_FROM') ?? `Skyen Admin <${user}>`;

  return { host, port, secure, user, pass, from };
}

export function getAdminPanelUrl(): string | null {
  const url = readOptionalEnv('ADMIN_PANEL_URL');
  if (!url) {
    return null;
  }
  return url.replace(/\/+$/, '');
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}
