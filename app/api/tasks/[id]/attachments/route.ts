import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, fail, rejectWrongOrigin, uuidOk } from "@/lib/api-helpers";

const BUCKET = "daybloom-attachments";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip", "application/x-zip-compressed",
]);
type Context = { params: Promise<{ id: string }> };

async function owner(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.from("tasks").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data ? { user, admin } : null;
}

export async function GET(_request: NextRequest, ctx: Context) {
  const guard = devOnly(); if (guard) return guard;
  const { id } = await ctx.params; if (!uuidOk(id)) return fail("Invalid task ID.");
  try {
    const access = await owner(id); if (!access) return fail("Not found or not signed in.", 404);
    const { data, error } = await access.admin.from("task_attachments")
      .select("id, file_name, size_bytes, mime_type, created_at")
      .eq("user_id", access.user.id).eq("task_id", id).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ attachments: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("List attachments:", error); return fail("Unable to load attachments.", 500); }
}

export async function POST(request: NextRequest, ctx: Context) {
  const guard = devOnly() || rejectWrongOrigin(request); if (guard) return guard;
  const { id } = await ctx.params; if (!uuidOk(id)) return fail("Invalid task ID.");
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES + 128 * 1024) return fail("File is too large (5 MB limit).", 413);
  try {
    const access = await owner(id); if (!access) return fail("Not found or not signed in.", 404);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return fail("Select a file up to 5 MB.");
    if (!ALLOWED.has(file.type)) return fail("This file type is not supported.");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-110).replace(/^\.+/, "") || "attachment";
    const path = `${access.user.id}/${id}/${randomUUID()}-${safeName}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await access.admin.storage.from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await access.admin.from("task_attachments")
      .insert({ user_id: access.user.id, task_id: id, storage_path: path,
        file_name: safeName, size_bytes: file.size, mime_type: file.type })
      .select("id, file_name, size_bytes, mime_type, created_at").single();
    if (error) {
      await access.admin.storage.from(BUCKET).remove([path]);
      throw error;
    }
    return NextResponse.json({ attachment: data }, { status: 201 });
  } catch (error) { console.error("Upload attachment:", error); return fail("Unable to upload attachment. Did you run the v3 SQL migration?", 500); }
}
