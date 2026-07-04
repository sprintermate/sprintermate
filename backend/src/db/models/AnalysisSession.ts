import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

/** A business analysis chat session owned by a user. */
class AnalysisSession extends Model {
  declare id: string;
  declare user_id: string;
  declare title: string;
  declare project_id: string | null;
  /** JSON-stringified array of selected ADO repo IDs */
  declare selected_repos: string | null;
  declare created_at: string;
  declare updated_at: string;
}

AnalysisSession.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'New Analysis',
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    selected_repos: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
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
    tableName: 'analysis_sessions',
    timestamps: false,
  },
);

export default AnalysisSession;
