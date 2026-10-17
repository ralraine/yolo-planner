import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTask } from "@/lib/task-validation";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail, uuidOk } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };
const FIELDS = "id, title, notes, status, priority, subject_id, due_date, due_time, schedule_type, end_date, end_time, links, completed_at, created_at, updated_at, recurrence_id, occurrence_date";

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const guard = devOnly() || rejectWrongOrigin(request) || jsonRequired(request); if (guard) return guard;
  const { id } = await ctx.params; if (!uuidOk(id)) return fail("Invalid task ID.");
  const body = await parseJsonObject(request); if (!body) return fail("Invalid body.");
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const supabase = createAdminClient();
    const { data: oldTask, error: oldError } = await supabase.from("tasks")
      .select(FIELDS).eq("id", id).eq("user_id", user.id).maybeSingle();
    if (oldError) throw oldError;
    if (!oldTask) return fail("Task not found.", 404);
    const parsed = parseTask({ ...oldTask, ...body });
    if (!parsed.value) return fail(parsed.error ?? "Invalid task.");
    if (parsed.value.subject_id) {
      const { data: subj, error: subjectError } = await supabase.from("subjects").select("id")
        .eq("id", parsed.value.subject_id).eq("user_id", user.id).maybeSingle();
      if (subjectError) throw subjectError;
      if (!subj) return fail("Subject not found.");
    }
    const { data, error } = await supabase.from("tasks")
      .update({ ...parsed.value, completed_at: parsed.value.status === "done" ? (oldTask.status === "done" ? oldTask.completed_at ?? new Date().toISOString() : new Date().toISOString()) : null, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id).select(FIELDS).maybeSingle();
    if (error) throw error;
    if (!data) return fail("Task not found.", 404);
    return NextResponse.json({ task: data });
  } catch (err) { console.error("PATCH task:", err); return fail("Unable to update task.", 500); }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const guard = devOnly() || rejectWrongOrigin(request); if (guard) return guard;
  const { id } = await ctx.params; if (!uuidOk(id)) return fail("Invalid task ID.");
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const supabase = createAdminClient();
    // Deleted recurrence instances must stay skipped on future generation runs.
    const { data: existing, error: existingErr } = await supabase.from("tasks")
      .select("recurrence_id, occurrence_date").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (existingErr) throw existingErr;
    if (!existing) return fail("Task not found.", 404);
    if (existing.recurrence_id && existing.occurrence_date) {
      const { error: skipErr } = await supabase.from("recurrence_skips").upsert({
        user_id: user.id, recurrence_id: existing.recurrence_id,
        occurrence_date: existing.occurrence_date,
      }, { onConflict: "recurrence_id,occurrence_date" });
      if (skipErr) throw skipErr;
    }
    const { data: attachments, error: attachErr } = await supabase.from("task_attachments")
      .select("storage_path").eq("task_id", id).eq("user_id", user.id);
    if (attachErr) throw attachErr;
    if (attachments?.length) {
      const { error: storageError } = await supabase.storage.from("daybloom-attachments")
        .remove(attachments.map(item => item.storage_path));
      if (storageError) throw storageError;
    }
    const { data, error } = await supabase.from("tasks")
      .delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return fail("Task not found.", 404);
    return NextResponse.json({ success: true });
  } catch (err) { console.error("DELETE task:", err); return fail("Unable to delete task.", 500); }
}
