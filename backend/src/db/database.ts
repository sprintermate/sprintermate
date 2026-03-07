import { Sequelize } from 'sequelize';
import path from 'path';
import fs from 'fs';

const choice = (process.env.DB_CHOICE ?? 'sqlite').toLowerCase();

let sequelize: Sequelize;

if (choice === 'postgres') {
  const required = ['POSTGRES_DB_HOST', 'POSTGRES_DB_PORT', 'POSTGRES_DB_NAME', 'POSTGRES_DB_USER', 'POSTGRES_DB_PASSWORD'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`[db] DB_CHOICE=postgres but required env vars are missing: ${missing.join(', ')}`);
    process.exit(1);
  }

  sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.POSTGRES_DB_HOST,
    port: Number(process.env.POSTGRES_DB_PORT),
    database: process.env.POSTGRES_DB_NAME,
    username: process.env.POSTGRES_DB_USER,
    password: process.env.POSTGRES_DB_PASSWORD,
    logging: false,
  });
} else {
  const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'scrum-poker.db');
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false,
  });
}

export default sequelize;
