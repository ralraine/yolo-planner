import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, fail, rejectWrongOrigin, uuidOk } from "@/lib/api-helpers";

type Context = { params: Promise<{ id: string }> };
const BUCKET = "daybloom-attachments";

async function accessAttachment(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.from("task_attachments")
    .select("id, task_id, file_name, storage_path, mime_type")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data ? { admin, data, user } : null;
}

// Download via authenticated server, never through a public storage URL.
export async function GET(_request: NextRequest, ctx: Context) {
  const guard = devOnly(); if (guard) return guard;
  const { id } = await ctx.params; if (!uuidOk(id)) return fail("Invalid attachment ID.");
  try {
    const found = await accessAttachment(id); if (!found) return fail("Attachment not found.", 404);
    const { data, error } = await found.admin.storage.from(BUCKET).download(found.data.storage_path);
    if (error || !data) throw error ?? new Error("File missing");
    const clean = found.data.file_name.replace(/[\r\n"\\]/g, "_");
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${clean}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) { console.error("Download attachment:", error); return fail("Unable to download attachment.", 500); }
}

export async function DELETE(request: NextRequest, ctx: Context) {
  const guard = devOnly() || rejectWrongOrigin(request); if (guard) return guard;
  const { id } = await ctx.params; if (!uuidOk(id)) return fail("Invalid attachment ID.");
  try {
    const found = await accessAttachment(id); if (!found) return fail("Attachment not found.", 404);
    const { error: storageError } = await found.admin.storage.from(BUCKET).remove([found.data.storage_path]);
    if (storageError) throw storageError;
    const { error } = await found.admin.from("task_attachments").delete()
      .eq("id", id).eq("user_id", found.user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) { console.error("Delete attachment:", error); return fail("Unable to delete attachment.", 500); }
}
