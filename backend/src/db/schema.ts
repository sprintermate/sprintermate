import sequelize from './database';
import User from './models/User';
import Project from './models/Project';
import Sprint from './models/Sprint';
import Room from './models/Room';
import ReferenceScore from './models/ReferenceScore';
import UserAISettings from './models/UserAISettings';
import WorkItemAIEstimate from './models/WorkItemAIEstimate';
import WorkItemScoreRecord from './models/WorkItemScoreRecord';
import RetroSession from './models/RetroSession';
import RetroItem from './models/RetroItem';
import RetroAction from './models/RetroAction';

// Define associations
Project.hasMany(Sprint, { foreignKey: 'project_id', onDelete: 'CASCADE' });
Sprint.belongsTo(Project, { foreignKey: 'project_id' });

Project.hasMany(Room, { foreignKey: 'project_id', onDelete: 'CASCADE' });
Room.belongsTo(Project, { foreignKey: 'project_id' });

Sprint.hasMany(Room, { foreignKey: 'sprint_id', as: 'rooms', onDelete: 'CASCADE' });
Room.belongsTo(Sprint, { foreignKey: 'sprint_id', as: 'sprint' });

Project.hasMany(ReferenceScore, { foreignKey: 'project_id', onDelete: 'CASCADE' });
ReferenceScore.belongsTo(Project, { foreignKey: 'project_id' });

User.hasOne(UserAISettings, { foreignKey: 'user_id', onDelete: 'CASCADE' });
UserAISettings.belongsTo(User, { foreignKey: 'user_id' });

Project.hasMany(WorkItemAIEstimate, { foreignKey: 'project_id', onDelete: 'CASCADE' });
WorkItemAIEstimate.belongsTo(Project, { foreignKey: 'project_id' });

Project.hasMany(WorkItemScoreRecord, { foreignKey: 'project_id', onDelete: 'CASCADE' });
WorkItemScoreRecord.belongsTo(Project, { foreignKey: 'project_id' });

// Retro associations
User.hasMany(RetroSession, { foreignKey: 'created_by', onDelete: 'CASCADE' });
RetroSession.belongsTo(User, { foreignKey: 'created_by' });

async function runMigrations(): Promise<void> {
  // Add columns that may be missing from existing DBs (safe, idempotent)
  const dialect = sequelize.getDialect();
  const migrations: Array<{ check: string; run: string }> = [
    {
      check: dialect === 'postgres'
        ? "SELECT column_name FROM information_schema.columns WHERE table_name='retro_sessions' AND column_name='project_id'"
        : "SELECT name FROM pragma_table_info('retro_sessions') WHERE name='project_id'",
      run: "ALTER TABLE retro_sessions ADD COLUMN project_id TEXT",
    },
  ];

  for (const m of migrations) {
    const [rows] = await sequelize.query(m.check) as [Array<Record<string, unknown>>, unknown];
    if (rows.length === 0) {
      await sequelize.query(m.run);
    }
  }
}

export async function initSchema(): Promise<void> {
  // sync() only creates missing tables — never alters existing ones (safe for prod data)
  await sequelize.sync();
  await runMigrations();
  console.log('[db] schema synced');
}

export { sequelize, User, Project, Sprint, Room, ReferenceScore, UserAISettings, WorkItemAIEstimate, WorkItemScoreRecord, RetroSession, RetroItem, RetroAction };
