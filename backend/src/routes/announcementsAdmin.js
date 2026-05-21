const express = require("express");
const announcementService = require("../modules/announcements/announcementService");
const { validateBody } = require("../middleware/validateBody");
const { requirePermission } = require("../middleware/requirePermission");
const {
  announcementCreateSchema,
  announcementPatchSchema
} = require("../validation/schemas/announcement");
const { audit } = require("../services/audit");

function sendServiceError(res, out, req) {
  if (out.fieldErrors) {
    return res.status(out.status || 400).json({
      error: "VALIDATION_ERROR",
      fieldErrors: out.fieldErrors,
      requestId: req.requestId
    });
  }
  return res.status(out.status || 400).json({ error: out.error, requestId: req.requestId });
}

const announcementsAdminRouter = express.Router();

announcementsAdminRouter.get(
  "/announcements",
  requirePermission("announcements.view", "view"),
  async (req, res, next) => {
    try {
      const out = await announcementService.listWilaya(req.query);
      res.json(out);
    } catch (e) {
      next(e);
    }
  }
);

announcementsAdminRouter.post(
  "/announcements",
  requirePermission("announcements.manage", "manage"),
  validateBody(announcementCreateSchema),
  async (req, res, next) => {
    try {
      const out = await announcementService.createWilaya(req.validatedBody || {}, req.user.id);
      if (out.error || out.fieldErrors) return sendServiceError(res, out, req);
      await audit(req.user.id, "ANNOUNCEMENT_CREATE", {
        id: out.announcement.id,
        municipality_id: out.announcement.municipality_id,
        priority: out.announcement.priority,
        status: out.announcement.status
      }, { req });
      res.status(201).json(out);
    } catch (e) {
      next(e);
    }
  }
);

announcementsAdminRouter.patch(
  "/announcements/:id",
  requirePermission("announcements.manage", "manage"),
  validateBody(announcementPatchSchema),
  async (req, res, next) => {
    try {
      const out = await announcementService.updateWilaya(req.params.id, req.validatedBody || {});
      if (out.error || out.fieldErrors) return sendServiceError(res, out, req);
      await audit(req.user.id, "ANNOUNCEMENT_UPDATE", {
        id: out.announcement.id,
        municipality_id: out.announcement.municipality_id,
        priority: out.announcement.priority,
        status: out.announcement.status
      }, { req });
      res.json(out);
    } catch (e) {
      next(e);
    }
  }
);

module.exports = { announcementsAdminRouter };
