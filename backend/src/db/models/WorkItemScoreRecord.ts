import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

/** Persisted scoring record for a work item - stores AI estimate vs user final score. */
class WorkItemScoreRecord extends Model {
  declare id: string;
  declare project_id: string;
  declare work_item_id: number;
  declare ai_score: number;
  declare user_avg_score: number;
  declare sprint_id: string | null;
  declare created_at: string;
  declare updated_at: string;
}

WorkItemScoreRecord.init(
  {
    id: {
      type: DataTypes.TEXT,
      primaryKey: true,
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    work_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ai_score: {
      type: DataTypes.REAL,
      allowNull: false,
    },
    user_avg_score: {
      type: DataTypes.REAL,
      allowNull: false,
    },
    sprint_id: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'work_item_score_records',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['project_id', 'work_item_id'] },
    ],
  },
);

export default WorkItemScoreRecord;
