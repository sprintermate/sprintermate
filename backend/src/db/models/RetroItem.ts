import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

/** A single post-it card in a retro session. */
class RetroItem extends Model {
  declare id: string;
  declare session_code: string;
  /** 'well' | 'improve' | 'ideas' */
  declare category: string;
  declare content: string;
  declare author_id: string;
  declare author_name: string;
  declare votes: number;
  declare created_at: string;
}

RetroItem.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    session_code: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    author_id: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    author_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    votes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'retro_items',
    timestamps: false,
  },
);

export default RetroItem;
