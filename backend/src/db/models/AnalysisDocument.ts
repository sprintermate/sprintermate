import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

class AnalysisDocument extends Model {
  declare id: string;
  declare user_id: string;
  declare title: string;
  declare pdf_filename: string;
  declare pdf_text: string;
  declare user_message: string | null;
  declare azure_repos: string | null;   // JSON stringified array
  declare md_context: string | null;    // concatenated MD file content
  declare md_filenames: string | null;  // JSON stringified array of uploaded MD filenames
  declare md_output: string | null;
  declare status: string;               // 'pending' | 'analyzing' | 'completed' | 'error'
  declare created_at: string;
  declare updated_at: string;
}

AnalysisDocument.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    pdf_filename: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    pdf_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    user_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    azure_repos: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    md_context: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    md_filenames: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    md_output: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'pending',
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'analysis_documents',
    timestamps: false,
  },
);

export default AnalysisDocument;
