const express = require("express");
const wilayaAdminsService = require("../modules/organization/wilayaAdminsService");

const wilayaAdminsAdminRouter = express.Router();

wilayaAdminsAdminRouter.get("/wilaya-admins", async (req, res, next) => {
  try {
    if (req.query.brief === "1" || req.query.brief === "true") {
      const admins = await wilayaAdminsService.listAllBrief();
      return res.json({ admins });
    }
    const out = await wilayaAdminsService.listWilaya({
      page: req.query.page,
      pageSize: req.query.pageSize,
      q: req.query.q
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

module.exports = { wilayaAdminsAdminRouter };
