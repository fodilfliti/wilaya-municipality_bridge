const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const { User } = require("../db");
const { audit } = require("../services/audit");
const { getEnv } = require("../config/env");

const authRouter = express.Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "username and password are required" });

    const user = await User.findOne({ where: { username } });
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;

    await audit(user?.id, "LOGIN_ATTEMPT", { username, success: ok }, { req });

    if (!user || !ok) return res.status(401).json({ error: "Invalid credentials" });
    if (user.is_blocked) return res.status(403).json({ error: "Blocked" });

    const env = getEnv();
    const token = jwt.sign({ sub: String(user.id), role: user.role }, env.jwtSecret, {
      expiresIn: "12h"
    });

    res.json({ token, user: { id: user.id, username: user.username, role: user.role, municipality_id: user.municipality_id } });
  } catch (e) {
    next(e);
  }
});

module.exports = { authRouter };

