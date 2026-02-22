import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

class Project extends Model {
  declare id: string;
  declare user_id: string;
  declare name: string;
  declare organization: string;
  declare team: string | null;
  declare ado_url: string | null;
  declare encrypted_pat: string | null;
  declare created_at: string;
}

Project.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    organization: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    team: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ado_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    encrypted_pat: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'projects',
    timestamps: false,
  },
);

export default Project;
