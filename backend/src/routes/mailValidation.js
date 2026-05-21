const express = require("express");
const mailSendRequestService = require("../modules/mail/mailSendRequestService");

function createMailValidationRouter({ uploadMailAttachments }) {
  const router = express.Router();

  router.get("/validator-candidates", async (req, res, next) => {
    try {
      const users = await mailSendRequestService.listValidatorCandidates(req);
      res.json({ users });
    } catch (e) {
      next(e);
    }
  });

  router.get("/validation-pending-count", async (req, res, next) => {
    try {
      const counts = await mailSendRequestService.pendingValidationCount(req);
      res.json(counts);
    } catch (e) {
      next(e);
    }
  });

  router.get("/send-requests", async (req, res, next) => {
    try {
      const view = String(req.query.view || "author") === "validator" ? "validator" : "author";
      const page = Math.max(1, Number(req.query.page || 1));
      const pageSize = Math.min(Math.max(1, Number(req.query.pageSize || 20)), 100);
      const status = req.query.status ? String(req.query.status) : null;
      const q = req.query.q ? String(req.query.q) : "";
      const out = await mailSendRequestService.listSendRequests(req, { view, status, page, pageSize, q });
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  router.get("/send-requests/:id", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const loaded = await mailSendRequestService.loadSendRequestForUser(req, id);
      res.json({
        send_request: mailSendRequestService.serializeSendRequest(loaded.row, loaded),
      });
    } catch (e) {
      next(e);
    }
  });

  router.patch(
    "/send-requests/:id",
    uploadMailAttachments.array("attachments", 10),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        const hasSubject = req.body?.subject != null && String(req.body.subject).trim() !== "";
        const hasBody = req.body?.body_html != null && String(req.body.body_html).trim() !== "";
        const subject = hasSubject ? String(req.body.subject).trim().slice(0, 500) : null;
        const body_html = hasBody ? String(req.body.body_html).trim() : null;
        if (!subject && !body_html && !(req.files || []).length) {
          return res.status(400).json({ error: "subject and body_html are required" });
        }
        await mailSendRequestService.resubmitSendRequest(req, id, {
          subject,
          body_html,
          attachments: req.files || [],
        });
        const loaded = await mailSendRequestService.loadSendRequestForUser(req, id);
        res.json({
          send_request: mailSendRequestService.serializeSendRequest(loaded.row, loaded),
        });
      } catch (e) {
        next(e);
      }
    },
  );

  router.post("/send-requests/:id/discussion", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const body_html = String(req.body?.body_html || "").trim();
      if (!body_html) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          fieldErrors: { body_html: "mailBodyRequired" },
          requestId: req.requestId
        });
      }
      await mailSendRequestService.addDiscussion(req, id, body_html);
      const loaded = await mailSendRequestService.loadSendRequestForUser(req, id);
      res.json({
        send_request: mailSendRequestService.serializeSendRequest(loaded.row, loaded),
      });
    } catch (e) {
      next(e);
    }
  });

  router.post("/send-requests/:id/approve", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const out = await mailSendRequestService.approveSendRequest(req, id);
      const loaded = await mailSendRequestService.loadSendRequestForUser(req, id);
      res.json({
        finalized: Boolean(out?.finalized),
        thread_id: out?.thread?.id || loaded.row.thread_id,
        send_request: mailSendRequestService.serializeSendRequest(loaded.row, loaded),
      });
    } catch (e) {
      next(e);
    }
  });

  router.post("/send-requests/:id/reject", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const feedback_html = String(req.body?.feedback_html || "").trim();
      if (!feedback_html) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          fieldErrors: { feedback_html: "mailValidationFeedbackRequired" },
          requestId: req.requestId
        });
      }
      await mailSendRequestService.rejectSendRequest(req, id, feedback_html);
      const loaded = await mailSendRequestService.loadSendRequestForUser(req, id);
      res.json({
        send_request: mailSendRequestService.serializeSendRequest(loaded.row, loaded),
      });
    } catch (e) {
      next(e);
    }
  });

  router.post("/send-requests/:id/send-without-validation", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const out = await mailSendRequestService.finalizeSendRequest(req, id, { withoutValidation: true });
      res.json({ thread_id: out.thread.id, finalized: true });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

module.exports = { createMailValidationRouter };
