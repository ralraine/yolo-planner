import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTask } from "@/lib/task-validation";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail } from "@/lib/api-helpers";

const FIELDS = "id, title, notes, status, priority, subject_id, due_date, due_time, schedule_type, end_date, end_time, links, completed_at, created_at, updated_at, recurrence_id, occurrence_date";
export async function GET() {
  const guard = devOnly(); if (guard) return guard;
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const { data, error } = await createAdminClient().from("tasks")
      .select(FIELDS).eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ tasks: data ?? [] });
  } catch (err) { console.error("GET tasks:", err); return fail("Unable to load tasks.", 500); }
}

export async function POST(request: NextRequest) {
  const guard = devOnly() || rejectWrongOrigin(request) || jsonRequired(request); if (guard) return guard;
  const body = await parseJsonObject(request); if (!body) return fail("Invalid body.");
  const parsed = parseTask(body); if (!parsed.value) return fail(parsed.error ?? "Invalid task.");
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const supabase = createAdminClient();
    if (parsed.value.subject_id) {
      const { data: subject, error: subjectError } = await supabase.from("subjects").select("id")
        .eq("id", parsed.value.subject_id).eq("user_id", user.id).maybeSingle();
      if (subjectError) throw subjectError;
      if (!subject) return fail("Subject not found.");
    }
    const { data, error } = await supabase.from("tasks")
      .insert({ ...parsed.value, user_id: user.id, completed_at: parsed.value.status === "done" ? new Date().toISOString() : null }).select(FIELDS).single();
    if (error) throw error;
    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err) { console.error("POST tasks:", err); return fail("Unable to create task.", 500); }
}
