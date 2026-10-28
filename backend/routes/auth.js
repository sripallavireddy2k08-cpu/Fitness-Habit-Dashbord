const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: "Too many sign-in attempts. Please wait 15 minutes." } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function issueToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "12h", issuer: "fitness-habit-dashboard", audience: "fitness-habit-dashboard-user" });
}
router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Name must be between 2 and 60 characters." });
    if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ error: "Password must be 8–72 characters long." });
    const password_hash = await bcrypt.hash(password, 12);
    const { data, error } = await supabase.from("app_users").insert({ name, email, password_hash }).select("id,name,email").single();
    if (error?.code === "23505") return res.status(409).json({ error: "An account with that email already exists." });
    if (error) throw error;
    return res.status(201).json({ token: issueToken(data), user: data });
  } catch (error) { next(error); }
});
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!emailPattern.test(email) || !password) return res.status(400).json({ error: "Enter your email and password." });
    const { data: user, error } = await supabase.from("app_users").select("id,name,email,password_hash").eq("email", email).maybeSingle();
    if (error) throw error;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "Email or password is incorrect." });
    const publicUser = { id: user.id, name: user.name, email: user.email };
    return res.json({ token: issueToken(publicUser), user: publicUser });
  } catch (error) { next(error); }
});
router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));
module.exports = router;
