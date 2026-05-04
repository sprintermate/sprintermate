import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

export interface UserAgentPromptAttributes {
  id: string;
  user_id: string;
  name: string;
  markdown: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserAgentPromptCreationAttributes extends Optional<UserAgentPromptAttributes, 'id' | 'created_at' | 'updated_at'> {}

export class UserAgentPrompt extends Model<UserAgentPromptAttributes, UserAgentPromptCreationAttributes> implements UserAgentPromptAttributes {
  public id!: string;
  public user_id!: string;
  public name!: string;
  public markdown!: string;
  public created_at!: Date;
  public updated_at!: Date;
}

UserAgentPrompt.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    markdown: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'user_agent_prompts',
    timestamps: false,
    underscored: true,
  }
);

export default UserAgentPrompt;
