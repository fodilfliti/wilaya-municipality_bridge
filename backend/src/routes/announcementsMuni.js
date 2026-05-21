const express = require("express");
const announcementService = require("../modules/announcements/announcementService");
const { requirePermission } = require("../middleware/requirePermission");

const announcementsMuniRouter = express.Router();

announcementsMuniRouter.get(
  "/announcements/revision",
  requirePermission("announcements.view", "view"),
  async (req, res, next) => {
    try {
      const mid = req.user.municipality_id;
      if (!mid) return res.status(403).json({ error: "Forbidden" });
      const out = await announcementService.revisionForMunicipality(mid);
      res.json(out);
    } catch (e) {
      next(e);
    }
  }
);

announcementsMuniRouter.get(
  "/announcements/active",
  requirePermission("announcements.view", "view"),
  async (req, res, next) => {
    try {
      const mid = req.user.municipality_id;
      if (!mid) return res.status(403).json({ error: "Forbidden" });
      const announcements = await announcementService.listActiveForMunicipality(mid);
      res.json({ announcements });
    } catch (e) {
      next(e);
    }
  }
);

module.exports = { announcementsMuniRouter };
