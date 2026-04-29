import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

/** Per-user AI provider configuration for story point estimation. */
class UserAISettings extends Model {
  declare id: string;
  declare user_id: string;
  /** 'copilot' | 'claude' | 'codex' | 'gemini' | 'chatgpt' | 'azure-openai' */
  declare provider: string;
  /** AES-256-GCM encrypted API key; null for CLI-based providers */
  declare encrypted_api_key: string | null;
  /** AES-256-GCM encrypted Azure endpoint URL; null for non-Azure providers */
  declare encrypted_endpoint: string | null;
  /** Azure resource / organisation name (e.g. "dt-is-cozumleri-ai-power"); not secret */
  declare azure_organization: string | null;
  /** Azure OpenAI API version (e.g. "2024-02-01"); not secret */
  declare azure_api_version: string | null;
  /** Azure deployment name (e.g. "gpt-4o"); not secret */
  declare azure_deployment_name: string | null;
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
    encrypted_endpoint: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    azure_organization: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    azure_api_version: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    azure_deployment_name: {
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
