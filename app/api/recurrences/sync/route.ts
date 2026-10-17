import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, rejectWrongOrigin, fail } from "@/lib/api-helpers";
const asDate = (d:Date)=>d.toISOString().slice(0,10);
export async function POST(request:NextRequest) {
  const guard = devOnly() || rejectWrongOrigin(request); if (guard) return guard;
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const now = Date.now();
    const { data, error } = await createAdminClient().rpc("generate_yolo_occurrences", {
      p_user_id:user.id,
      p_from: asDate(new Date(now - 7 * 86400_000)),
      p_through: asDate(new Date(now + 60 * 86400_000)),
    });
    if (error) throw error;
    return NextResponse.json({ created: data ?? 0 });
  } catch (error) { console.error("SYNC recurrences", error); return fail("Unable to sync recurring tasks.", 500); }
}
