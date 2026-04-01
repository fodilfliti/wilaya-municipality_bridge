"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("municipalities", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      name_ar: { type: Sequelize.STRING(255), allowNull: false },
      name_fr: { type: Sequelize.STRING(255), allowNull: false },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.createTable("users", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      username: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      role: { type: Sequelize.ENUM("SUPER_ADMIN", "MUNI_ADMIN"), allowNull: false },
      municipality_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "municipalities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      is_blocked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }
    });

    await queryInterface.createTable("applications", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      app_name: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      logo_url: { type: Sequelize.STRING(1024), allowNull: true },
      current_version_id: { type: Sequelize.BIGINT, allowNull: true }
    });

    await queryInterface.createTable("app_versions", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      app_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "applications", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      version_number: { type: Sequelize.STRING(50), allowNull: false },
      file_url: { type: Sequelize.STRING(1024), allowNull: false },
      release_notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addConstraint("app_versions", {
      type: "unique",
      fields: ["app_id", "version_number"],
      name: "uniq_app_versions_app_id_version_number"
    });

    await queryInterface.addConstraint("applications", {
      type: "foreign key",
      fields: ["current_version_id"],
      name: "fk_applications_current_version_id",
      references: { table: "app_versions", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.createTable("downloads", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      version_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "app_versions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      timestamp: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      ip_address: { type: Sequelize.STRING(100), allowNull: true }
    });

    await queryInterface.createTable("audit_logs", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      actor_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      action_type: { type: Sequelize.STRING(100), allowNull: false },
      details: { type: Sequelize.JSONB, allowNull: true },
      timestamp: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("audit_logs");
    await queryInterface.dropTable("downloads");
    await queryInterface.removeConstraint("applications", "fk_applications_current_version_id");
    await queryInterface.dropTable("app_versions");
    await queryInterface.dropTable("applications");
    await queryInterface.dropTable("users");
    await queryInterface.dropTable("municipalities");

    // enums created by Sequelize for users.role
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
  }
};

