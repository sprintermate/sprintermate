import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface AppConfig {
  ngrokAuthToken: string;
  sessionSecret: string;
  encryptionKey: string;
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export function loadConfig(): AppConfig | null {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return null;
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as AppConfig;
    if (!parsed.ngrokAuthToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function generateSecrets(): Pick<AppConfig, 'sessionSecret' | 'encryptionKey'> {
  return {
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    encryptionKey: crypto.randomBytes(32).toString('hex'),
  };
}

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'sprintermate.db');
}
