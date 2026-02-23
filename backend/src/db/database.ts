import { Sequelize } from 'sequelize';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'scrum-poker.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
});

export default sequelize;
