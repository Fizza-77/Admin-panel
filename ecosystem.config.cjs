/**
 * PM2 config for production. Loads /var/www/admin-panel/.env explicitly so
 * SUPABASE_SERVICE_ROLE_KEY is never a stale shell/PM2 value.
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
const path = require('path');
const fs = require('fs');

const appRoot = __dirname;
const envPath = path.join(appRoot, '.env');
const fileEnv = {};

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fileEnv[key] = value;
  }
}

module.exports = {
  apps: [
    {
      name: 'admin-panel',
      cwd: appRoot,
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: '3007',
        ...fileEnv,
      },
    },
  ],
};
