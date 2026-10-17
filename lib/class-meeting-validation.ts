import { uuidOk } from "@/lib/api-helpers";
export const MEETING_FIELDS = "id, subject_id, weekday, start_time, end_time, room";
export function parseMeeting(body: Record<string, unknown>) {
  const subject_id = body.subject_id;
  const weekday = body.weekday;
  const start_time = body.start_time;
  const end_time = body.end_time;
  const room = typeof body.room === "string" ? body.room.trim() : "";
  if (typeof subject_id !== "string" || !uuidOk(subject_id)) return { error: "Choose a subject." };
  if (!Number.isInteger(weekday) || Number(weekday) < 0 || Number(weekday) > 6) return { error: "Choose a valid weekday." };
  if (typeof start_time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start_time)) return { error: "Invalid start time." };
  if (typeof end_time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end_time) || end_time <= start_time) return { error: "End time must be later than start time." };
  if (room.length > 100) return { error: "Room name is too long." };
  return { value: { subject_id, weekday: Number(weekday), start_time, end_time, room } };
}
