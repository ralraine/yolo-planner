import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail } from "@/lib/api-helpers";
import { parseTask } from "@/lib/task-validation";

const RULE_FIELDS = "id, title, frequency, weekdays, start_date, end_date, active, subject_id, priority, due_time";
const TASK_FIELDS = "id, title, notes, status, priority, subject_id, due_date, due_time, schedule_type, end_date, end_time, links, completed_at, created_at, updated_at, recurrence_id, occurrence_date";
const asDate = (d: Date) => d.toISOString().slice(0,10);
export async function GET() {
  const guard = devOnly(); if (guard) return guard;
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const { data, error } = await createAdminClient().from("task_recurrences").select(RULE_FIELDS)
      .eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ rules: data ?? [] });
  } catch (error) { console.error("GET recurrences", error); return fail("Unable to load recurring tasks.", 500); }
}
export async function POST(request: NextRequest) {
  const guard = devOnly() || rejectWrongOrigin(request) || jsonRequired(request); if (guard) return guard;
  const body = await parseJsonObject(request); if (!body) return fail("Invalid JSON.");
  const parsed = parseTask(body);
  if (!parsed.value) return fail(parsed.error || "Invalid task details.");
  const task = parsed.value;
  if (task.schedule_type !== "deadline") return fail("Recurring tasks currently support Deadline scheduling only.");
  const frequency = body.frequency;
  const weekdays = body.weekdays;
  const end_date = body.repeat_until === "" || body.repeat_until === null || body.repeat_until === undefined ? null : body.repeat_until;
  if (!task.due_date) return fail("Select the first due date for a repeating task.");
  if (!["daily","weekly","monthly"].includes(String(frequency))) return fail("Choose how often this task repeats.");
  if (!Array.isArray(weekdays) || weekdays.length > 7 || weekdays.some(v=> !Number.isInteger(v) || v < 0 || v > 6)) return fail("Invalid repeat weekdays.");
  if (end_date !== null && (typeof end_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(end_date) || end_date < task.due_date)) return fail("Invalid repeat end date.");
  const now = new Date();
  const maxStart = new Date(now.getTime() + 180 * 86400_000);
  if (task.due_date > asDate(maxStart)) return fail("First occurrence must be within the next 180 days.");
  const firstDay = new Date(task.due_date + "T12:00:00Z").getUTCDay();
  const selectedDays = frequency === "weekly" ? [...new Set(weekdays.length ? weekdays : [firstDay])] : [];
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const supabase = createAdminClient();
    if (task.subject_id) {
      const { data, error } = await supabase.from("subjects").select("id")
        .eq("id", task.subject_id).eq("user_id", user.id).maybeSingle();
      if (error) throw error; if (!data) return fail("Subject not found.");
    }
    const { data: rule, error: ruleError } = await supabase.from("task_recurrences").insert({
      user_id: user.id, subject_id: task.subject_id, title: task.title, notes: task.notes,
      links: task.links, priority: task.priority, start_date: task.due_date,
      due_time: task.due_time, frequency, weekdays: selectedDays, end_date,
    }).select(RULE_FIELDS).single();
    if (ruleError) throw ruleError;
    const generationEnd = new Date(Math.max(now.getTime() + 60 * 86400_000, new Date(task.due_date + "T12:00:00Z").getTime() + 30 * 86400_000));
    const safeEnd = new Date(Math.min(generationEnd.getTime(), now.getTime() + 180 * 86400_000));
    const { error: genError } = await supabase.rpc("generate_yolo_occurrences", {
      p_user_id: user.id, p_from: asDate(new Date(now.getTime() - 7 * 86400_000)), p_through: asDate(safeEnd),
    });
    if (genError) {
      // Don't leave a broken rule on failure.
      const { error: cleanupError } = await supabase.from("task_recurrences").delete().eq("id", rule.id).eq("user_id", user.id);
      if (cleanupError) console.error("Could not clean up recurrence", cleanupError);
      throw genError;
    }
    const { data: generated, error: loadError } = await supabase.from("tasks").select(TASK_FIELDS)
      .eq("user_id", user.id).eq("recurrence_id", rule.id).order("due_date");
    if (loadError) throw loadError;
    return NextResponse.json({ rule, tasks: generated ?? [] }, { status: 201 });
  } catch (error) { console.error("POST recurrence", error); return fail("Unable to create repeating task.", 500); }
}
