"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mail_send_requests", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      created_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      created_by_municipality_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "municipalities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      subject: { type: Sequelize.STRING(500), allowNull: false },
      body_html: { type: Sequelize.TEXT, allowNull: false },
      target_json: { type: Sequelize.JSONB, allowNull: false },
      status: {
        type: Sequelize.ENUM(
          "PENDING_VALIDATION",
          "CHANGES_REQUESTED",
          "SENT",
          "SENT_WITHOUT_VALIDATION",
          "CANCELLED",
        ),
        allowNull: false,
        defaultValue: "PENDING_VALIDATION",
      },
      revision: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      thread_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "mail_threads", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      sent_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex("mail_send_requests", ["created_by_user_id"], {
      name: "idx_mail_send_requests_created_by",
    });
    await queryInterface.addIndex("mail_send_requests", ["status"], { name: "idx_mail_send_requests_status" });

    await queryInterface.createTable("mail_send_request_validators", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      send_request_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "mail_send_requests", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      validator_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      decision: {
        type: Sequelize.ENUM("PENDING", "APPROVED", "REJECTED"),
        allowNull: false,
        defaultValue: "PENDING",
      },
      feedback_html: { type: Sequelize.TEXT, allowNull: true },
      decided_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addConstraint("mail_send_request_validators", {
      type: "unique",
      fields: ["send_request_id", "validator_user_id"],
      name: "uniq_mail_send_request_validators_request_user",
    });
    await queryInterface.addIndex("mail_send_request_validators", ["validator_user_id"], {
      name: "idx_mail_send_request_validators_user",
    });

    await queryInterface.createTable("mail_send_request_discussion", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      send_request_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "mail_send_requests", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      author_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      body_html: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addIndex("mail_send_request_discussion", ["send_request_id", "created_at"], {
      name: "idx_mail_send_request_discussion_request_created",
    });

    await queryInterface.createTable("mail_send_request_attachments", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      send_request_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "mail_send_requests", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      filename: { type: Sequelize.STRING(1024), allowNull: false },
      mime_type: { type: Sequelize.STRING(255), allowNull: false },
      size_bytes: { type: Sequelize.BIGINT, allowNull: false },
      file_url: { type: Sequelize.STRING(2048), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addIndex("mail_send_request_attachments", ["send_request_id"], {
      name: "idx_mail_send_request_attachments_request",
    });

    await queryInterface.addColumn("mail_threads", "send_request_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "mail_send_requests", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.addColumn("mail_threads", "validation_outcome", {
      type: Sequelize.ENUM("VALIDATED", "SENT_WITHOUT_VALIDATION"),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("mail_threads", "validation_outcome");
    await queryInterface.removeColumn("mail_threads", "send_request_id");
    await queryInterface.dropTable("mail_send_request_attachments");
    await queryInterface.dropTable("mail_send_request_discussion");
    await queryInterface.dropTable("mail_send_request_validators");
    await queryInterface.dropTable("mail_send_requests");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_mail_send_requests_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_mail_send_request_validators_decision";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_mail_threads_validation_outcome";');
  },
};
