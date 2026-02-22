import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

class User extends Model {
  declare id: string;
  declare email: string;
  declare password_hash: string;
  declare display_name: string;
  declare created_at: string;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    email: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    display_name: {
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
    tableName: 'users',
    timestamps: false,
  },
);

export default User;
