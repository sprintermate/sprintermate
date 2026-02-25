import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

/** Persisted AI estimate for a specific ADO work item within a project. */
class WorkItemAIEstimate extends Model {
  declare id: string;
  declare project_id: string;
  declare work_item_id: number;
  declare story_point: number;
  declare confidence: string;
  declare analysis: string;
  declare similar_items: string; // JSON serialized
  declare created_at: string;
  declare updated_at: string;
}

WorkItemAIEstimate.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    project_id: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    work_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    story_point: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    confidence: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    analysis: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    similar_items: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
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
    tableName: 'work_item_ai_estimates',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['project_id', 'work_item_id'] },
    ],
  },
);

export default WorkItemAIEstimate;
