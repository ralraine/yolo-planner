import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, rejectWrongOrigin, fail } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const guard = devOnly() || rejectWrongOrigin(req); if (guard) return guard;
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.",401);
    const pepper = process.env.DAYBLOOM_PIN_PEPPER;
    if (!pepper || pepper.length < 32) return fail("Server secret missing.",500);
    const code = randomBytes(20).toString("hex").toUpperCase();
    const recovery_hash = createHash("sha256").update(`${pepper}:recovery:${code}`).digest("hex");
    const {data,error} = await createAdminClient().from("pin_credentials").update({recovery_hash}).eq("user_id",user.id).select("user_id").maybeSingle();
    if (error) throw error;
    if (!data) return fail("Account credentials missing.",404);
    return NextResponse.json({code,warning:"Save offline now. This replaces the previous recovery code, and we cannot show it again."},{headers:{"Cache-Control":"no-store"}});
  } catch(err) {console.error("Recovery code creation",err);return fail("Unable to generate recovery code.",500);}
}
