import "server-only";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getCurrentUser() {
  const token = (await cookies()).get("daybloom_session")?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = createAdminClient();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("user_id")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error("Session verification failed");
  if (!session) return null;
  const { data: user, error: userError } = await supabase
    .from("accounts")
    .select("id, display_name, username")
    .eq("id", session.user_id)
    .maybeSingle();
  if (userError) throw new Error("Account lookup failed");
  return user ?? null;
}
