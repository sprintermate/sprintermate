import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

class RetroSession extends Model {
  declare id: string;
  declare code: string;
  declare title: string;
  declare created_by: string;  // user id
  declare project_id: string | null; // optional link to a Project
  declare theme: string;       // 'dark' | 'light'
  declare status: string;      // 'writing' | 'analyzing' | 'closed'
  declare duration_minutes: number;
  declare created_at: string;
}

RetroSession.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    code: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    project_id: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    theme: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'dark',
    },
    status: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'writing',
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'retro_sessions',
    timestamps: false,
  },
);

export default RetroSession;
