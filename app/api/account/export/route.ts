import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, fail } from "@/lib/api-helpers";

const COLLECTIONS = ["subjects", "tasks", "class_meetings", "task_recurrences", "recurrence_skips", "journal_entries", "focus_sessions", "task_attachments"] as const;
export async function GET() {
  const guard = devOnly(); if (guard) return guard;
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.",401);
    const db = createAdminClient();
    const data: Record<string, unknown[]> = {};
    for (const table of COLLECTIONS) {
      const all: unknown[] = [];
      for (let from=0;from<10000;from+=500) {
        const {data: chunk,error} = await db.from(table).select("*").eq("user_id",user.id).range(from,from+499);
        if (error) throw error;
        all.push(...(chunk ?? []));
        if ((chunk ?? []).length < 500) break;
        if (from===9500) throw new Error(`Export limit exceeded for ${table}`);
      }
      data[table]=all;
    }
    // Only account profile details are included; PIN hashes, recovery code hashes,
    // session tokens, and Supabase secrets are intentionally excluded.
    const exportData = JSON.stringify({format:"YOLO-export-v5.3",exported_at:new Date().toISOString(),account:{display_name:user.display_name,username:user.username},data,notice:"Attachments are metadata only; file bytes are not included. Import is not supported."},null,2);
    return new NextResponse(exportData,{headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":`attachment; filename="YOLO-backup-${new Date().toISOString().slice(0,10)}.json"`,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  } catch (err) { console.error("Export",err); return fail("Could not create backup. Check server logs.",500); }
}
