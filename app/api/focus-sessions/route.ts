import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail, uuidOk } from "@/lib/api-helpers";

const FIELDS = "id, focus_minutes, completed_at, task_id, session_key";
export async function GET() {
  const guard = devOnly(); if (guard) return guard;
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const { data, error } = await createAdminClient().from("focus_sessions")
      .select(FIELDS).eq("user_id", user.id).order("completed_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ sessions: data ?? [] });
  } catch (error) { console.error("GET focus", error); return fail("Unable to load focus sessions.", 500); }
}
export async function POST(request: NextRequest) {
  const guard = devOnly() || rejectWrongOrigin(request) || jsonRequired(request); if (guard) return guard;
  const body = await parseJsonObject(request); if (!body) return fail("Invalid JSON.");
  const minutes = body.focus_minutes;
  const sessionKey = body.session_key === undefined ? null : body.session_key;
  if (sessionKey !== null && (typeof sessionKey !== "string" || !uuidOk(sessionKey))) return fail("Invalid session key.");
  const task = body.task_id === null || body.task_id === "" ? null : body.task_id;
  if (!Number.isInteger(minutes) || Number(minutes) < 1 || Number(minutes) > 240) return fail("Invalid focus duration.");
  if (task !== null && (typeof task !== "string" || !uuidOk(task))) return fail("Invalid task.");
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const supabase = createAdminClient();
    if (task) {
      const { data, error } = await supabase.from("tasks").select("id").eq("id", task).eq("user_id", user.id).maybeSingle();
      if (error) throw error; if (!data) return fail("Task not found.");
    }
    if (sessionKey) {
      const { data: existing, error: existingError } = await supabase.from("focus_sessions")
        .select(FIELDS).eq("user_id", user.id).eq("session_key", sessionKey).maybeSingle();
      if (existingError) throw existingError;
      if (existing) return NextResponse.json({session: existing});
    }
    const { data, error } = await supabase.from("focus_sessions")
      .insert({ user_id: user.id, task_id: task, focus_minutes: minutes, session_key: sessionKey }).select(FIELDS).single();
    if (error?.code === "23505" && sessionKey) {
      const retry = await supabase.from("focus_sessions").select(FIELDS)
        .eq("user_id",user.id).eq("session_key",sessionKey).single();
      if (retry.error) throw retry.error;
      return NextResponse.json({session:retry.data});
    }
    if (error) throw error;
    return NextResponse.json({ session: data }, { status: 201 });
  } catch (error) { console.error("POST focus", error); return fail("Unable to save focus session.", 500); }
}
