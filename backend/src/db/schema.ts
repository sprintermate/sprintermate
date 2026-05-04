import sequelize from './database';
import { childLogger } from '../utils/logger';
import User from './models/User';
import UserAgentPrompt from './models/UserAgentPrompt';
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
import PasswordResetCode from './models/PasswordResetCode';
import AnalysisSession from './models/AnalysisSession';
import AnalysisMessage from './models/AnalysisMessage';

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


// Analysis agent associations
User.hasMany(AnalysisSession, { foreignKey: 'user_id', onDelete: 'CASCADE' });
AnalysisSession.belongsTo(User, { foreignKey: 'user_id' });
AnalysisSession.belongsTo(Project, { foreignKey: 'project_id' });
AnalysisSession.hasMany(AnalysisMessage, { foreignKey: 'session_id', onDelete: 'CASCADE' });
AnalysisMessage.belongsTo(AnalysisSession, { foreignKey: 'session_id' });

// UserAgentPrompt associations
User.hasMany(UserAgentPrompt, { foreignKey: 'user_id', onDelete: 'CASCADE' });
UserAgentPrompt.belongsTo(User, { foreignKey: 'user_id' });

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
    // Azure OpenAI columns on user_ai_settings
    {
      check: dialect === 'postgres'
        ? "SELECT column_name FROM information_schema.columns WHERE table_name='user_ai_settings' AND column_name='encrypted_endpoint'"
        : "SELECT name FROM pragma_table_info('user_ai_settings') WHERE name='encrypted_endpoint'",
      run: "ALTER TABLE user_ai_settings ADD COLUMN encrypted_endpoint TEXT",
    },
    {
      check: dialect === 'postgres'
        ? "SELECT column_name FROM information_schema.columns WHERE table_name='user_ai_settings' AND column_name='azure_organization'"
        : "SELECT name FROM pragma_table_info('user_ai_settings') WHERE name='azure_organization'",
      run: "ALTER TABLE user_ai_settings ADD COLUMN azure_organization TEXT",
    },
    {
      check: dialect === 'postgres'
        ? "SELECT column_name FROM information_schema.columns WHERE table_name='user_ai_settings' AND column_name='azure_api_version'"
        : "SELECT name FROM pragma_table_info('user_ai_settings') WHERE name='azure_api_version'",
      run: "ALTER TABLE user_ai_settings ADD COLUMN azure_api_version TEXT",
    },
    {
      check: dialect === 'postgres'
        ? "SELECT column_name FROM information_schema.columns WHERE table_name='user_ai_settings' AND column_name='azure_deployment_name'"
        : "SELECT name FROM pragma_table_info('user_ai_settings') WHERE name='azure_deployment_name'",
      run: "ALTER TABLE user_ai_settings ADD COLUMN azure_deployment_name TEXT",
    },
  ];

  for (const m of migrations) {
    const [rows] = await sequelize.query(m.check) as [Array<Record<string, unknown>>, unknown];
    if (rows.length === 0) {
      await sequelize.query(m.run);
    }
  }
}

const log = childLogger('db');

export async function initSchema(): Promise<void> {
  // sync() only creates missing tables — never alters existing ones (safe for prod data)
  await sequelize.sync();
  await runMigrations();
  log.info('schema synced');
}

export { sequelize, User, Project, Sprint, Room, ReferenceScore, UserAISettings, WorkItemAIEstimate, WorkItemScoreRecord, RetroSession, RetroItem, RetroAction, PasswordResetCode, AnalysisSession, AnalysisMessage, UserAgentPrompt };
