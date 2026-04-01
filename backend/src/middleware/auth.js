const jwt = require("jsonwebtoken");
const { User, Municipality } = require("../db");
const { getEnv } = require("../config/env");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const env = getEnv();
    const payload = jwt.verify(token, env.jwtSecret);
    req.auth = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function attachUser(req, res, next) {
  if (!req.auth?.sub) return res.status(401).json({ error: "Invalid token payload" });
  const user = await User.findByPk(req.auth.sub, { include: [{ model: Municipality }] });
  if (!user) return res.status(401).json({ error: "User not found" });
  req.user = user;
  next();
}

function requireRole(roles) {
  const allow = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) return res.status(500).json({ error: "User not loaded" });
    if (!allow.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

function checkBlocked(req, res, next) {
  if (!req.user) return res.status(500).json({ error: "User not loaded" });
  if (req.user.is_blocked) return res.status(403).json({ error: "Blocked" });
  next();
}

module.exports = { requireAuth, attachUser, requireRole, checkBlocked };

