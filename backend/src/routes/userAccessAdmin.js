const express = require("express");
const userProfileService = require("../modules/access/userProfileService");

const userAccessAdminRouter = express.Router();

userAccessAdminRouter.get("/users/:userId/access-profile", async (req, res, next) => {
  try {
    const out = await userProfileService.getUserAccessProfile(req.params.userId);
    if (!out) return res.status(404).json({ error: "User not found" });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

userAccessAdminRouter.patch("/users/:userId/access-profile", async (req, res, next) => {
  try {
    const out = await userProfileService.updateUserAccessProfile(req.params.userId, req.body || {});
    if (out.error) return res.status(out.status).json({ error: out.error });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

module.exports = { userAccessAdminRouter };
