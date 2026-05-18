const express = require("express");
const communeAgentsService = require("../modules/organization/communeAgentsService");

const communeAgentsAdminRouter = express.Router();

communeAgentsAdminRouter.get("/commune-agents", async (req, res, next) => {
  try {
    const out = await communeAgentsService.listWilaya({
      page: req.query.page,
      pageSize: req.query.pageSize,
      q: req.query.q,
      municipality_id: req.query.municipality_id
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

module.exports = { communeAgentsAdminRouter };
