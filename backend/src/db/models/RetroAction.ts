import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

/** An action item (AI-suggested or manually added) for a retro session. */
class RetroAction extends Model {
  declare id: string;
  declare session_code: string;
  declare content: string;
  declare ai_suggested: boolean;
  declare is_accepted: boolean;
  declare created_at: string;
}

RetroAction.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    session_code: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    ai_suggested: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_accepted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'retro_actions',
    timestamps: false,
  },
);

export default RetroAction;
