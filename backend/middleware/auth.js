const jwt = require("jsonwebtoken");
const supabase = require("../supabase");

async function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: "Please sign in to continue." });
  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload.sub) return res.status(401).json({ error: "Invalid session." });
    const { data: user, error } = await supabase.from("app_users").select("id,email,name").eq("id", payload.sub).maybeSingle();
    if (error || !user) return res.status(401).json({ error: "Your session is no longer valid. Please sign in again." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}
module.exports = { requireAuth };
