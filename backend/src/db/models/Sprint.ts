import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

class Sprint extends Model {
  declare id: string;
  declare ado_sprint_id: string | null;
  declare project_id: string;
  declare name: string;
  declare path: string | null;
  declare start_date: string | null;
  declare finish_date: string | null;
  declare created_at: string;
}

Sprint.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    ado_sprint_id: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    project_id: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    path: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    start_date: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    finish_date: {
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
    tableName: 'sprints',
    timestamps: false,
  },
);

export default Sprint;
