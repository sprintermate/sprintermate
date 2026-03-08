import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

class Room extends Model {
  declare id: string;
  declare code: string;
  declare project_id: string;
  declare sprint_id: string;
  declare moderator_id: string;
  declare status: string;
  declare created_at: string;
}

Room.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    code: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    sprint_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    moderator_id: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'waiting',
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'rooms',
    timestamps: false,
  },
);

export default Room;
