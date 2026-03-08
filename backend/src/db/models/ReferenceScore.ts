import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

/** A reference story-point example stored per project.
 *  Used during the room creation flow so the team can anchor estimates.
 */
class ReferenceScore extends Model {
  declare id: string;
  declare project_id: string;
  declare title: string;
  declare description: string | null;
  declare story_points: number;
  declare created_at: string;
}

ReferenceScore.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    story_points: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'reference_scores',
    timestamps: false,
  },
);

export default ReferenceScore;
