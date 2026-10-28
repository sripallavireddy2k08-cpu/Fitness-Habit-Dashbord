require("dotenv").config();
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth");
const habitRoutes = require("./routes/habits");
const supabase = require("./supabase");
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"");
const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", "data:"],
  connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"]
} } }));
app.use(cors({ origin: false }));
app.use(express.json({ limit: "20kb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.get("/api/health", async (req, res) => {
  try {
    const { error } = await supabase.from("app_users").select("id", { head: true, count: "exact" });
    if (error) throw error;
    res.json({ status: "ok", database: "connected" });
  } catch { res.status(503).json({ status: "error", database: "unavailable" }); }
});
app.use("/api/auth", authRoutes);
app.use("/api/habits", habitRoutes);
app.get("/api/logs", require("./middleware/auth").requireAuth, async (req, res, next) => {
  try {
    const { date, from, to } = req.query;
    const validDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;
    if (date && !validDate(date)) return res.status(400).json({ error: "Date must use YYYY-MM-DD." });
    if (from && !validDate(from) || to && !validDate(to)) return res.status(400).json({ error: "Date range must use YYYY-MM-DD." });
    let query = supabase.from("habit_logs").select("id,habit_id,user_id,log_date,completed,created_at").eq("user_id", req.user.id).order("log_date", { ascending: false });
    if (date) query = query.eq("log_date", date);
    else { if (from) query = query.gte("log_date", from); if (to) query = query.lte("log_date", to); }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ logs: data });
  } catch (error) { next(error); }
});
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});
app.use((req, res) => res.status(404).json({ error: "The requested endpoint was not found." }));
app.use((error, req, res, next) => {
  console.error("Request failed:", error?.message || "Unknown error");
  if (res.headersSent) return next(error);
  res.status(500).json({ error: "A server error occurred. Check server configuration and database availability." });
});
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Fitness Habit Dashboard running at http://localhost:${port}`));
