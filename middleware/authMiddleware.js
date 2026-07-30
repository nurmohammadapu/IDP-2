const { getDB } = require("../db");
const { findUserById } = require("../models/userModel");

async function getAuthenticatedUser(req) {
  const sessionId = req.cookies?.sessionId;
  if (!sessionId) return null;

  const db = getDB();
  return new Promise((resolve) => {
    db.get(
      "SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')",
      [sessionId],
      async (err, session) => {
        if (err || !session) {
          resolve(null);
          return;
        }
        try {
          const user = await findUserById(session.user_id);
          resolve(user || null);
        } catch (error) {
          resolve(null);
        }
      }
    );
  });
}

async function authenticate(req, res, allowedRoles = []) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not authenticated" }));
    return null;
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Access denied" }));
    return null;
  }
  return user;
}

module.exports = {
  getAuthenticatedUser,
  authenticate
};
