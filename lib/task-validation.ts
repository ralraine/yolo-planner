export type TaskPayload = {
  title: string;
  notes: string;
  status: "todo" | "in_progress" | "done";
  priority: "none" | "low" | "medium" | "high";
  subject_id: string | null;
  due_date: string | null;
  due_time: string | null;
  schedule_type: "deadline" | "duration" | "none";
  end_date: string | null;
  end_time: string | null;
  links: string[];
};

export function parseTask(body: Record<string, unknown>): { value?: TaskPayload; error?: string } {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const status = body.status ?? "todo";
  const priority = body.priority ?? "none";
  const subject = body.subject_id || null;
  const date = body.due_date || null;
  const rawTime = body.due_time || null;
  const time = typeof rawTime === "string" && /^([01]\d|2[0-3]):[0-5]\d:00$/.test(rawTime) ? rawTime.slice(0, 5) : rawTime;
  const schedule_type = body.schedule_type ?? "deadline";
  const end_date = body.end_date || null;
  const rawEndTime = body.end_time || null;
  const end_time = typeof rawEndTime === "string" && /^([01]\d|2[0-3]):[0-5]\d:00$/.test(rawEndTime) ? rawEndTime.slice(0, 5) : rawEndTime;
  const links = body.links ?? [];
  if (!title || title.length > 180) return { error: "Task title must be 1–180 characters." };
  if (notes.length > 10_000) return { error: "Task notes are too long." };
  if (!["todo", "in_progress", "done"].includes(String(status))) return { error: "Invalid status." };
  if (!["none", "low", "medium", "high"].includes(String(priority))) return { error: "Invalid priority." };
  if (subject !== null && (typeof subject !== "string" || !/^[0-9a-f-]{36}$/i.test(subject))) return { error: "Invalid subject." };
  if (date !== null) {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid due date." };
    const parsed = new Date(date + "T00:00:00Z");
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return { error: "Invalid due date." };
  }
  if (time !== null && (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return { error: "Invalid due time." };
  if (time && !date) return { error: "Choose a due date when setting a time." };
  if (!["deadline", "duration", "none"].includes(String(schedule_type))) return { error: "Invalid scheduling type." };
  if (end_date !== null) {
    if (typeof end_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) return { error: "Invalid end date." };
    const endD = new Date(end_date + "T00:00:00Z");
    if (Number.isNaN(endD.getTime()) || endD.toISOString().slice(0, 10) !== end_date) return { error: "Invalid end date." };
  }
  if (end_time !== null && (typeof end_time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end_time))) return { error: "Invalid end time." };
  if (schedule_type === "deadline" && (end_date || end_time)) return { error: "Deadline tasks must not have an end time." };
  if (schedule_type === "none" && (date || time || end_date || end_time)) return { error: "Unscheduled tasks must not have a date or time." };
  if (schedule_type === "duration") {
    if (!date || !time || !end_date || !end_time) return { error: "A duration requires start and end dates and times." };
    const startValue = Date.parse(`${date}T${time}:00Z`);
    const endValue = Date.parse(`${end_date}T${end_time}:00Z`);
    const delta = endValue - startValue;
    if (delta <= 0 || delta > 48 * 3600_000) return { error: "End must be after start (maximum 48 hours)." };
  }
  if (!Array.isArray(links) || links.length > 12 || links.some(link => typeof link !== "string" || link.length > 2048)) {
    return { error: "Add at most 12 links (2,048 characters per link)." };
  }
  const cleanLinks: string[] = [];
  for (const raw of links as string[]) {
    try {
      const u = new URL(raw.trim());
      if (u.protocol !== "https:" && u.protocol !== "http:") return { error: "Only http:// and https:// links are supported." };
      if (u.username || u.password) return { error: "Links cannot contain login credentials." };
      cleanLinks.push(u.href);
    } catch { return { error: "Invalid link URL." }; }
  }
  return { value: {
    title, notes,
    status: status as TaskPayload["status"],
    priority: priority as TaskPayload["priority"],
    subject_id: subject as string | null,
    due_date: date as string | null,
    due_time: time as string | null,
    schedule_type: schedule_type as TaskPayload["schedule_type"],
    end_date: end_date as string | null,
    end_time: end_time as string | null,
    links: [...new Set(cleanLinks)],
  } };
}
