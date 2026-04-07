"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("mail_messages", "reply_to_message_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "mail_messages", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.addIndex("mail_messages", ["reply_to_message_id"], { name: "idx_mail_messages_reply_to_message_id" });

    await queryInterface.addColumn("mail_threads", "parent_thread_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "mail_threads", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.addColumn("mail_threads", "parent_message_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "mail_messages", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.addIndex("mail_threads", ["parent_thread_id"], { name: "idx_mail_threads_parent_thread_id" });
    await queryInterface.addIndex("mail_threads", ["parent_message_id"], { name: "idx_mail_threads_parent_message_id" });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("mail_threads", "idx_mail_threads_parent_message_id");
    await queryInterface.removeIndex("mail_threads", "idx_mail_threads_parent_thread_id");
    await queryInterface.removeColumn("mail_threads", "parent_message_id");
    await queryInterface.removeColumn("mail_threads", "parent_thread_id");

    await queryInterface.removeIndex("mail_messages", "idx_mail_messages_reply_to_message_id");
    await queryInterface.removeColumn("mail_messages", "reply_to_message_id");
  }
};

