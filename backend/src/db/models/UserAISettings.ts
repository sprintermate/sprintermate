import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

/** Per-user AI provider configuration for story point estimation. */
class UserAISettings extends Model {
  declare id: string;
  declare user_id: string;
  /** 'copilot' | 'claude' | 'codex' | 'gemini' | 'chatgpt' */
  declare provider: string;
  /** AES-256-GCM encrypted API key; null for CLI-based providers */
  declare encrypted_api_key: string | null;
  declare created_at: string;
}

UserAISettings.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    provider: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    encrypted_api_key: {
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
    tableName: 'user_ai_settings',
    timestamps: false,
  },
);

export default UserAISettings;
