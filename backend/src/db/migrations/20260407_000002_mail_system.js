"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mail_threads", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      subject: { type: Sequelize.STRING(500), allowNull: false },
      created_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      created_by_municipality_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "municipalities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      last_message_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addIndex("mail_threads", ["last_message_at"], { name: "idx_mail_threads_last_message_at" });
    await queryInterface.addIndex("mail_threads", ["created_by_user_id"], { name: "idx_mail_threads_created_by_user_id" });

    await queryInterface.createTable("mail_messages", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      thread_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "mail_threads", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      author_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      author_municipality_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "municipalities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      body_html: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addIndex("mail_messages", ["thread_id", "created_at"], { name: "idx_mail_messages_thread_created_at" });
    await queryInterface.addIndex("mail_messages", ["author_user_id"], { name: "idx_mail_messages_author_user_id" });

    await queryInterface.createTable("mail_attachments", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      message_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "mail_messages", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      filename: { type: Sequelize.STRING(1024), allowNull: false },
      mime_type: { type: Sequelize.STRING(255), allowNull: false },
      size_bytes: { type: Sequelize.BIGINT, allowNull: false },
      file_url: { type: Sequelize.STRING(2048), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addIndex("mail_attachments", ["message_id"], { name: "idx_mail_attachments_message_id" });

    await queryInterface.createTable("mail_recipients", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      thread_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "mail_threads", key: "id" },
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
      recipient_kind: {
        type: Sequelize.ENUM("DIRECT_USER", "MUNICIPALITY_TARGET", "ALL_MUNICIPALITIES"),
        allowNull: false
      },
      recipient_municipality_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "municipalities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      last_read_at: { type: Sequelize.DATE, allowNull: true },
      first_seen_at: { type: Sequelize.DATE, allowNull: true },
      last_seen_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addConstraint("mail_recipients", {
      type: "unique",
      fields: ["thread_id", "user_id"],
      name: "uniq_mail_recipients_thread_id_user_id"
    });

    await queryInterface.addIndex("mail_recipients", ["user_id", "thread_id"], { name: "idx_mail_recipients_user_thread" });
    await queryInterface.addIndex("mail_recipients", ["thread_id"], { name: "idx_mail_recipients_thread_id" });
    await queryInterface.addIndex("mail_recipients", ["user_id"], { name: "idx_mail_recipients_user_id" });
    await queryInterface.addIndex("mail_recipients", ["first_seen_at"], { name: "idx_mail_recipients_first_seen_at" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("mail_recipients");
    await queryInterface.dropTable("mail_attachments");
    await queryInterface.dropTable("mail_messages");
    await queryInterface.dropTable("mail_threads");

    // enum created by Sequelize for mail_recipients.recipient_kind
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_mail_recipients_recipient_kind";');
  }
};

