import sequelize from './database';
import User from './models/User';
import Project from './models/Project';
import Sprint from './models/Sprint';
import Room from './models/Room';
import ReferenceScore from './models/ReferenceScore';
import UserAISettings from './models/UserAISettings';

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

export async function initSchema(): Promise<void> {
  await sequelize.sync();
  console.log('[db] schema synced');
}

export { sequelize, User, Project, Sprint, Room, ReferenceScore, UserAISettings };
