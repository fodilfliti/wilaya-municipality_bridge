"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("operation_palette_colors", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      palette_index: { type: Sequelize.INTEGER, allowNull: false, unique: true },
      hex: { type: Sequelize.STRING(7), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.createTable("operations", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      title: { type: Sequelize.STRING(500), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      created_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      target_kind: {
        type: Sequelize.STRING(32),
        allowNull: false
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addIndex("operations", ["created_at"], { name: "idx_operations_created_at" });
    await queryInterface.addIndex("operations", ["created_by_user_id"], { name: "idx_operations_created_by_user_id" });

    await queryInterface.createTable("operation_recipients", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      operation_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "operations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      recipient_kind: { type: Sequelize.STRING(32), allowNull: false },
      recipient_municipality_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "municipalities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addConstraint("operation_recipients", {
      fields: ["operation_id", "user_id"],
      type: "unique",
      name: "uniq_operation_recipients_operation_user"
    });
    await queryInterface.addIndex("operation_recipients", ["user_id"], { name: "idx_operation_recipients_user_id" });
    await queryInterface.addIndex("operation_recipients", ["operation_id"], { name: "idx_operation_recipients_operation_id" });

    await queryInterface.createTable("operation_columns", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      operation_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "operations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      key: { type: Sequelize.STRING(120), allowNull: false },
      label_ar: { type: Sequelize.STRING(500), allowNull: false },
      label_fr: { type: Sequelize.STRING(500), allowNull: true },
      column_type: { type: Sequelize.STRING(16), allowNull: false },
      position: { type: Sequelize.INTEGER, allowNull: false },
      is_result: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      default_value: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addConstraint("operation_columns", {
      fields: ["operation_id", "key"],
      type: "unique",
      name: "uniq_operation_columns_operation_key"
    });
    await queryInterface.addIndex("operation_columns", ["operation_id", "position"], { name: "idx_operation_columns_operation_position" });

    await queryInterface.createTable("operation_column_choices", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      column_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "operation_columns", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      value_key: { type: Sequelize.STRING(120), allowNull: false },
      label_ar: { type: Sequelize.STRING(500), allowNull: false },
      label_fr: { type: Sequelize.STRING(500), allowNull: true },
      color_hex: { type: Sequelize.STRING(7), allowNull: false },
      palette_index: { type: Sequelize.INTEGER, allowNull: true },
      position: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addConstraint("operation_column_choices", {
      fields: ["column_id", "value_key"],
      type: "unique",
      name: "uniq_operation_column_choices_column_value_key"
    });
    await queryInterface.addIndex("operation_column_choices", ["column_id", "position"], { name: "idx_operation_column_choices_column_position" });

    await queryInterface.createTable("operation_sheets", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      operation_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "operations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      municipality_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "municipalities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      updated_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addConstraint("operation_sheets", {
      fields: ["operation_id", "municipality_id"],
      type: "unique",
      name: "uniq_operation_sheets_operation_municipality"
    });
    await queryInterface.addIndex("operation_sheets", ["operation_id"], { name: "idx_operation_sheets_operation_id" });

    await queryInterface.createTable("operation_rows", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      sheet_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "operation_sheets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      row_index: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addConstraint("operation_rows", {
      fields: ["sheet_id", "row_index"],
      type: "unique",
      name: "uniq_operation_rows_sheet_row_index"
    });
    await queryInterface.addIndex("operation_rows", ["sheet_id"], { name: "idx_operation_rows_sheet_id" });

    await queryInterface.createTable("operation_cell_values", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      row_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "operation_rows", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      column_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "operation_columns", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      value_json: { type: Sequelize.JSONB, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addConstraint("operation_cell_values", {
      fields: ["row_id", "column_id"],
      type: "unique",
      name: "uniq_operation_cell_values_row_column"
    });
    await queryInterface.addIndex("operation_cell_values", ["column_id"], { name: "idx_operation_cell_values_column_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("operation_cell_values");
    await queryInterface.dropTable("operation_rows");
    await queryInterface.dropTable("operation_sheets");
    await queryInterface.dropTable("operation_column_choices");
    await queryInterface.dropTable("operation_columns");
    await queryInterface.dropTable("operation_recipients");
    await queryInterface.dropTable("operations");
    await queryInterface.dropTable("operation_palette_colors");
  }
};
