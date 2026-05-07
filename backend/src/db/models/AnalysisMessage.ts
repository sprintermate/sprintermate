import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

/** A single message in a business analysis chat session. */
class AnalysisMessage extends Model {
  declare id: string;
  declare session_id: string;
  /** 'user' | 'assistant' */
  declare role: string;
  /** User message text or AI HTML output */
  declare content: string;
  /** JSON-stringified attachment metadata: [{name, type, textPreview}] */
  declare attachments: string | null;
  declare created_at: string;
}

AnalysisMessage.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    session_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    role: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    attachments: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'analysis_messages',
    timestamps: false,
  },
);

export default AnalysisMessage;
