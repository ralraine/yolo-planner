import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail, uuidOk } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const guard = devOnly() || rejectWrongOrigin(request) || jsonRequired(request); if (guard) return guard;
  const { id } = await ctx.params; if (!uuidOk(id)) return fail("Invalid subject ID.");
  const body = await parseJsonObject(request); if (!body) return fail("Invalid body.");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.toUpperCase().trim() : "";
  const color = typeof body.color === "string" ? body.color : "";
  if (!name || name.length > 60) return fail("Invalid subject name.");
  if (code && !/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(code)) return fail("Subject code, when provided, must be 2–20 letters, numbers, - or _.");
  if (!/^#[a-fA-F0-9]{6}$/.test(color)) return fail("Invalid color.");
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const { data, error } = await createAdminClient().from("subjects")
      .update({ name, code: code || null, color }).eq("user_id", user.id).eq("id", id)
      .select("id, name, code, color, created_at").maybeSingle();
    if (error?.code === "23505") return fail("Subject name or code already exists.", 409);
    if (error) throw error;
    if (!data) return fail("Subject not found.", 404);
    return NextResponse.json({ subject: data });
  } catch (err) { console.error("PATCH subject:", err); return fail("Unable to update subject.", 500); }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const guard = devOnly() || rejectWrongOrigin(request); if (guard) return guard;
  const { id } = await ctx.params; if (!uuidOk(id)) return fail("Invalid subject ID.");
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const { data, error } = await createAdminClient().from("subjects")
      .delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return fail("Subject not found.", 404);
    // Existing tasks remain in the database with subject_id set to NULL by the foreign key.
    return NextResponse.json({ success: true });
  } catch (err) { console.error("DELETE subject:", err); return fail("Unable to delete subject.", 500); }
}
