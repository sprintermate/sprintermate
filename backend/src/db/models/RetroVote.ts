import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

/** A single dot-vote cast by a participant (user or guest) on a retro card. */
class RetroVote extends Model {
  declare id: string;
  declare session_code: string;
  declare item_id: string;
  declare voter_id: string;
  declare voter_name: string;
  declare created_at: string;
}

RetroVote.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    session_code: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    item_id: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    voter_id: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    voter_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'retro_votes',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['item_id', 'voter_id'] },
      { fields: ['session_code', 'voter_id'] },
    ],
  },
);

export default RetroVote;
