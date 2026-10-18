import { NextResponse } from "next/server";
// V6.1 returns to username + four-digit PIN. Do not accept password changes via the former endpoint.
export async function POST() {
  return NextResponse.json({ error: "Password login is no longer used by YOLO." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
