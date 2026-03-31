import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

class PasswordResetCode extends Model {
  declare id: string;
  declare email: string;
  declare code: string;
  declare expires_at: string;
  declare attempts: number;
  declare used: boolean;
  declare created_at: string;
}

PasswordResetCode.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    email: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    code: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    used: {
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
    tableName: 'password_reset_codes',
    timestamps: false,
  },
);

export default PasswordResetCode;
