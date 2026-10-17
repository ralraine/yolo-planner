import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, rejectWrongOrigin, fail } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  const guard = devOnly() || rejectWrongOrigin(request);
  if (guard) return guard;
  try {
    const token = request.cookies.get("daybloom_session")?.value;
    if (token && /^[0-9a-f]{64}$/.test(token)) {
      const hash = createHash("sha256").update(token).digest("hex");
      const { error } = await createAdminClient().from("sessions").delete().eq("token_hash", hash);
      if (error) throw error;
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set("daybloom_session", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
    return response;
  } catch (err) {
    console.error("Logout:", err);
    return fail("Unable to log out.", 500);
  }
}
