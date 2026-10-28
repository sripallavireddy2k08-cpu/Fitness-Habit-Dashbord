const express = require("express");
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();
router.use(requireAuth);
const categories = ["Movement", "Strength", "Hydration", "Mindfulness", "Sleep", "Nutrition", "Other"];
const colors = ["mint", "peach", "lilac", "blue"];
function validateHabit(body, partial = false) {
  const clean = {};
  if (!partial || Object.hasOwn(body, "name")) {
    if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 70) return { error: "Habit name must be between 2 and 70 characters." };
    clean.name = body.name.trim();
  }
  if (!partial || Object.hasOwn(body, "category")) {
    if (typeof (body.category ?? "Movement") !== "string" || !categories.includes(body.category ?? "Movement")) return { error: "Choose a valid category." };
    clean.category = body.category ?? "Movement";
  }
  if (!partial || Object.hasOwn(body, "target")) {
    if (body.target != null && (typeof body.target !== "string" || body.target.trim().length > 80)) return { error: "Daily target must be 80 characters or fewer." };
    clean.target = (body.target || "").trim();
  }
  if (!partial || Object.hasOwn(body, "color")) {
    if (!colors.includes(body.color ?? "mint")) return { error: "Choose a valid accent color." };
    clean.color = body.color ?? "mint";
  }
  return { clean };
}
function validDate(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value; }
router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("habits").select("id,user_id,name,category,target,color,archived_at,created_at,updated_at").eq("user_id", req.user.id).order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ habits: data });
  } catch (error) { next(error); }
});
router.post("/", async (req, res, next) => {
  try {
    const { clean, error: validationError } = validateHabit(req.body || {});
    if (validationError) return res.status(400).json({ error: validationError });
    const { data, error } = await supabase.from("habits").insert({ ...clean, user_id: req.user.id }).select().single();
    if (error) throw error;
    res.status(201).json({ habit: data });
  } catch (error) { next(error); }
});
router.patch("/:id", async (req, res, next) => {
  try {
    const patch = {};
    if (Object.hasOwn(req.body || {}, "archived")) {
      if (typeof req.body.archived !== "boolean") return res.status(400).json({ error: "Archived must be true or false." });
      patch.archived_at = req.body.archived ? new Date().toISOString() : null;
    }
    const fields = ["name", "category", "target", "color"];
    if (fields.some(field => Object.hasOwn(req.body || {}, field))) {
      const { clean, error: validationError } = validateHabit(req.body, true);
      if (validationError) return res.status(400).json({ error: validationError });
      Object.assign(patch, clean);
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: "Provide at least one field to update." });
    patch.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from("habits").update(patch).eq("id", req.params.id).eq("user_id", req.user.id).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Habit not found." });
    res.json({ habit: data });
  } catch (error) { next(error); }
});
router.delete("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("habits").delete().eq("id", req.params.id).eq("user_id", req.user.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Habit not found." });
    res.json({ message: "Habit deleted." });
  } catch (error) { next(error); }
});
router.post("/:id/check-in", async (req, res, next) => {
  try {
    const date = req.body?.date || new Date().toISOString().slice(0,10);
    if (!validDate(date)) return res.status(400).json({ error: "Date must be a valid YYYY-MM-DD date." });
    if (typeof req.body?.completed !== "boolean") return res.status(400).json({ error: "Completed must be true or false." });
    const { data: habit, error: habitError } = await supabase.from("habits").select("id").eq("id", req.params.id).eq("user_id", req.user.id).is("archived_at", null).maybeSingle();
    if (habitError) throw habitError;
    if (!habit) return res.status(404).json({ error: "Active habit not found." });
    const { data, error } = await supabase.from("habit_logs").upsert({ habit_id: habit.id, user_id: req.user.id, log_date: date, completed: req.body.completed }, { onConflict: "habit_id,log_date" }).select().single();
    if (error) throw error;
    res.json({ log: data });
  } catch (error) { next(error); }
});
module.exports = router;
