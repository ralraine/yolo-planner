import { NextRequest, NextResponse } from "next/server";

export function devOnly() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "DayBloom PIN demo is not available in production." }, { status: 404 });
  }
  return null;
}

export function sameOrigin(request: NextRequest) {
  const expected = request.nextUrl.origin;
  return request.headers.get("origin") === expected;
}

export function rejectWrongOrigin(request: NextRequest) {
  return sameOrigin(request) ? null : NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
}

export function uuidOk(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function jsonRequired(request: NextRequest) {
  return request.headers.get("content-type")?.includes("application/json")
    ? null : NextResponse.json({ error: "JSON body required." }, { status: 415 });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function parseJsonObject(request: NextRequest) {
  try {
    const text = await request.text();
    if (text.length > 25_000) return null;
    const body: unknown = JSON.parse(text);
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? body as Record<string, unknown> : null;
  } catch { return null; }
}
