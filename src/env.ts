// Loads backend/.env into process.env before anything else is imported (Node 20.12+).
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
}
