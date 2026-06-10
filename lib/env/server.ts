import { config } from 'dotenv';
import { resolve } from 'path';

const projectRoot = process.cwd();

// Load env files. In production, .env on disk wins over stale PM2-injected values.
const dotenvOpts = { quiet: true as const };
config({ path: resolve(projectRoot, '.env.local'), ...dotenvOpts });
config({ path: resolve(projectRoot, '.env'), ...dotenvOpts });
if (process.env.NODE_ENV === 'production') {
  config({ path: resolve(projectRoot, '.env'), override: true, ...dotenvOpts });
}

const requiredServerEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

type ServerEnvKey = (typeof requiredServerEnv)[number];

function getEnv(name: ServerEnvKey): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Check your .env.local (for local) or deployment environment configuration.',
    );
  }

  return value.trim();
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: getEnv('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  CLOUDINARY_CLOUD_NAME: getEnv('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: getEnv('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: getEnv('CLOUDINARY_API_SECRET'),
} as const;
