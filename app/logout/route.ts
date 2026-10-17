
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // Only accept requests from our own website.
  const origin = request.headers.get("origin");

  if (origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    );
  }

  try {
    const sessionToken =
      request.cookies.get("daybloom_session")?.value;

    // If a valid-looking session token exists,
    // remove it from the database.
    if (
      sessionToken &&
      /^[0-9a-f]{64}$/.test(sessionToken)
    ) {
      const tokenHash = createHash("sha256")
        .update(sessionToken)
        .digest("hex");

      const supabase = createAdminClient();

      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("token_hash", tokenHash);

      if (error) {
        throw error;
      }
    }

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully!",
    });

    // Clear the session cookie from the browser.
    response.cookies.set("daybloom_session", "", {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to log out. Please try again.",
      },
      { status: 500 }
    );
  }
}
