import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail } from "@/lib/api-helpers";

export async function GET() {
  const guard = devOnly(); if (guard) return guard;
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Please sign in.", 401);
    const { data, error } = await createAdminClient().from("subjects")
      .select("id, name, code, color, created_at").eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ subjects: data ?? [] });
  } catch (err) { console.error("GET subjects:", err); return fail("Unable to load subjects.", 500); }
}

export async function POST(request: NextRequest) {
  const guard = devOnly() || rejectWrongOrigin(request) || jsonRequired(request); if (guard) return guard;
  const body = await parseJsonObject(request); if (!body) return fail("Invalid request body.");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.toUpperCase().trim() : "";
  const color = typeof body.color === "string" ? body.color : "#E7A1C8";
  if (!name || name.length > 60) return fail("Subject name must be 1–60 characters.");
  if (code && !/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(code)) return fail("Subject code, when provided, must be 2–20 letters, numbers, - or _.");
  if (!/^#[A-Fa-f0-9]{6}$/.test(color)) return fail("Invalid color.");
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const { data, error } = await createAdminClient().from("subjects")
      .insert({ name, code: code || null, color, user_id: user.id })
      .select("id, name, code, color, created_at").single();
    if (error?.code === "23505") return fail("Subject name or code already exists.", 409);
    if (error) throw error;
    return NextResponse.json({ subject: data }, { status: 201 });
  } catch (err) { console.error("POST subjects:", err); return fail("Unable to save subject.", 500); }
}
