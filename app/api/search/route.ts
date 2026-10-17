import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, fail } from "@/lib/api-helpers";

type Result = { type: "task" | "subject" | "class" | "journal"; id: string; title: string; detail: string; date?: string };
export async function GET(request: NextRequest) {
  const guard = devOnly(); if (guard) return guard;
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ results: [] });
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const db = createAdminClient();
    // Keep the data scoped to the signed-in account. This basic search checks
    // at most 500 recent entries per collection; not a full-text index.
    const [tasks, subjects, meetings, entries] = await Promise.all([
      db.from("tasks").select("id,title,notes,due_date,status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
      db.from("subjects").select("id,name,code").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
      db.from("class_meetings").select("id,subject_id,room,weekday,start_time").eq("user_id", user.id).limit(500),
      db.from("journal_entries").select("id,entry_date,title,content,mood").eq("user_id", user.id).order("entry_date", { ascending: false }).limit(500),
    ]);
    for (const value of [tasks,subjects,meetings,entries]) if (value.error) throw value.error;
    const list: Result[] = [];
    const match = (...strings: (string | null | undefined)[]) => strings.some(v => (v ?? "").toLowerCase().includes(q));
    for (const t of tasks.data ?? []) if (match(t.title, t.notes)) list.push({type:"task",id:t.id,title:t.title,detail:`${t.status.replaceAll("_"," ")} · ${t.due_date ?? "No date"}`});
    for (const s of subjects.data ?? []) if (match(s.name,s.code)) list.push({type:"subject",id:s.id,title:s.name,detail:s.code ?? "Subject"});
    const names = new Map<string,string>((subjects.data ?? []).map((s: {id:string; name:string; code:string|null}):[string,string] => [s.id,`${s.name} (${s.code ?? ""})`]));
    for (const m of meetings.data ?? []) if (match(names.get(m.subject_id),m.room)) list.push({type:"class",id:m.id,title:names.get(m.subject_id) ?? "Class",detail:`${m.room || "No room"} · ${m.start_time?.slice(0,5) ?? ""}`});
    for (const e of entries.data ?? []) if (match(e.title,e.content,e.mood)) list.push({type:"journal",id:e.id,title:e.title || `Journal · ${e.entry_date}`,detail:`${e.entry_date} · ${e.mood}`,date:e.entry_date});
    return NextResponse.json({results:list.slice(0,40), limited:true});
  } catch(err) { console.error("Global search",err); return fail("Unable to search right now.",500); }
}
