"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { CalendarRange, Clock3, DoorOpen, Pencil, Plus, Trash2, X } from "lucide-react";

type Subject = { id: string; name: string; code: string | null; color: string };
type Meeting = { id: string; subject_id: string; weekday: number; start_time: string; end_time: string; room: string };
type Draft = Omit<Meeting, "id"> & { id?: string };
type LaidOutMeeting = { meeting: Meeting; lane: number; totalLanes: number };

const DAYS = ["Suckday", "Moanday", "Tongueday", "Wetday", "Thirstday", "Freakday", "Sexday"];
const PX_PER_HOUR = 76;
const HOUR_OPTIONS = Array.from({ length: 25 }, (_, hour) => hour);
const blank = (subject?: Subject): Draft => ({ subject_id: subject?.id ?? "", weekday: 1, start_time: "09:00", end_time: "10:30", room: "" });

function minutes(t: string) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}
function timeLabel(t: string) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function hourLabel(hour: number) {
  if (hour === 24) return "12 AM";
  return `${hour % 12 || 12} ${hour >= 12 ? "PM" : "AM"}`;
}

// Avoid hiding overlapping classes: allocate side-by-side lanes within each collision group.
function layoutMeetings(meetings: Meeting[]): LaidOutMeeting[] {
  const ordered = [...meetings].sort((a, b) => minutes(a.start_time) - minutes(b.start_time) || minutes(a.end_time) - minutes(b.end_time));
  const result: LaidOutMeeting[] = [];
  let group: Meeting[] = [];
  let groupEnd = -1;
  const finish = () => {
    if (!group.length) return;
    const endByLane: number[] = [];
    const entries = group.map(meeting => {
      const start = minutes(meeting.start_time);
      let lane = endByLane.findIndex(end => end <= start);
      if (lane < 0) lane = endByLane.length;
      endByLane[lane] = minutes(meeting.end_time);
      return { meeting, lane };
    });
    result.push(...entries.map(entry => ({ ...entry, totalLanes: endByLane.length })));
    group = [];
  };
  for (const meeting of ordered) {
    const start = minutes(meeting.start_time);
    if (group.length && start >= groupEnd) finish();
    group.push(meeting);
    groupEnd = Math.max(groupEnd, minutes(meeting.end_time));
  }
  finish();
  return result;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error ?? `Request failed (${resp.status})`);
  return body as T;
}

export default function ClassSchedulePanel({ subjects }: { subjects: Subject[] }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [startHour, setStartHour] = useState(7);
  const [endHour, setEndHour] = useState(19);

  const byDay = useMemo(() => DAYS.map((_, i) => meetings.filter(m => m.weekday === i)), [meetings]);
  const subjectMap = useMemo(() => new Map(subjects.map(s => [s.id, s])), [subjects]);
  const height = (endHour - startHour) * PX_PER_HOUR;
  const hours = HOUR_OPTIONS.filter(h => h >= startHour && h <= endHour);
  const outsideCount = meetings.filter(m => minutes(m.start_time) < startHour * 60 || minutes(m.end_time) > endHour * 60).length;

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem("yolo:class-timetable-range") ?? "null");
      if (Number.isInteger(stored?.start) && Number.isInteger(stored?.end) && stored.start >= 0 && stored.end <= 24 && stored.start < stored.end) {
        setStartHour(stored.start); setEndHour(stored.end);
      }
    } catch { /* range preferences are optional */ }
    let live = true;
    request<{ meetings: Meeting[] }>("/api/class-meetings")
      .then(r => { if (live) setMeetings(r.meetings); })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : "Unable to load classes."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  function updateHours(start: number, end: number) {
    if (start < 0 || end > 24 || start >= end) return;
    setStartHour(start); setEndHour(end);
    try { window.localStorage.setItem("yolo:class-timetable-range", JSON.stringify({ start, end })); } catch { /* ignore */ }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || saving) return;
    setSaving(true); setError("");
    try {
      const res = await request<{ meeting: Meeting }>(draft.id ? `/api/class-meetings/${draft.id}` : "/api/class-meetings", {
        method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      });
      setMeetings(previous => draft.id ? previous.map(m => m.id === res.meeting.id ? res.meeting : m) : [...previous, res.meeting]);
      // Automatically expand to include the newly saved class, even when it is outside 7 AM–7 PM.
      const start = Math.min(startHour, Math.floor(minutes(res.meeting.start_time) / 60));
      const end = Math.max(endHour, Math.ceil(minutes(res.meeting.end_time) / 60));
      if (start !== startHour || end !== endHour) updateHours(start, end);
      setDraft(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save class."); }
    finally { setSaving(false); }
  }

  async function remove(meeting: Meeting) {
    if (!window.confirm("Delete this class meeting? Your subject and tasks will be kept.")) return;
    setError("");
    try {
      await request(`/api/class-meetings/${meeting.id}`, { method: "DELETE" });
      setMeetings(previous => previous.filter(m => m.id !== meeting.id));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to delete class meeting."); }
  }

  return <section className="db-v5-section">
    <div className="db-v5-heading">
      <div><span className="db-overline">YOUR WEEKLY TIMETABLE</span><h2>Class Schedule</h2><p>Subjects keep their colors · Class meetings stay separate from the task calendar</p></div>
      <button className="db-btn db-btn-primary" onClick={() => { setError(""); setDraft(blank(subjects[0])); }} disabled={!subjects.length}><Plus size={16}/> Add class</button>
    </div>

    <div className="db-v51-schedule-toolbar">
      <div><Clock3 size={18}/><strong>Hours displayed</strong></div>
      <label>From <select aria-label="Timetable visible start hour" value={startHour} onChange={e => { const s = Number(e.target.value); updateHours(s, Math.max(endHour, s + 1)); }}>{HOUR_OPTIONS.slice(0, 24).map(h => <option key={h} value={h} disabled={h >= 24}>{hourLabel(h)}</option>)}</select></label>
      <label>To <select aria-label="Timetable visible end hour" value={endHour} onChange={e => updateHours(startHour, Number(e.target.value))}>{HOUR_OPTIONS.filter(h => h > startHour).map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></label>
      <button type="button" onClick={() => updateHours(7, 19)}>Reset 7 AM – 7 PM</button>
    </div>

    {!subjects.length && <p className="db-v5-message">Create a subject first, then add a class for it.</p>}
    {error && <p className="db-error" role="alert">{error}</p>}
    {outsideCount > 0 && !loading && <p className="db-v51-outside" role="status">{outsideCount} class meeting(s) extend outside the visible hours. Adjust the From / To controls to show them fully.</p>}

    {loading ? <p className="db-v5-message">Loading your class schedule…</p> :
      <div className="db-v51-scroll" aria-label="Weekly class schedule, scroll horizontally to see all days">
        <div className="db-v51-timeline" style={{ "--yolo-hour-height": `${PX_PER_HOUR}px` } as CSSProperties}>
          <div className="db-v51-corner">TIME</div>
          {DAYS.map((day, i) => <div key={day} className="db-v51-day-head"><strong>{day}</strong><span>{byDay[i].length} {byDay[i].length === 1 ? "class" : "classes"}</span></div>)}
          <div className="db-v51-hours" style={{ height }}>
            {hours.map(h => <div key={h} className="db-v51-hour-label" style={{ top: (h - startHour) * PX_PER_HOUR }}>{hourLabel(h)}</div>)}
          </div>
          {DAYS.map((day, i) => {
            const visible = byDay[i].filter(m => minutes(m.end_time) > startHour * 60 && minutes(m.start_time) < endHour * 60);
            return <div key={day} className="db-v51-day-column" style={{ height }} aria-label={`${day} classes`}>
              {Array.from({ length: endHour - startHour }, (_, hour) => <div key={hour} className="db-v51-hour-rule" style={{ top: hour * PX_PER_HOUR }} />)}
              {visible.length === 0 && <span className="db-v51-no-class">No classes</span>}
              {layoutMeetings(visible).map(({ meeting, lane, totalLanes }) => {
                const s = subjectMap.get(meeting.subject_id);
                const clippedStart = Math.max(minutes(meeting.start_time), startHour * 60);
                const clippedEnd = Math.min(minutes(meeting.end_time), endHour * 60);
                const top = ((clippedStart - startHour * 60) / 60) * PX_PER_HOUR;
                const size = ((clippedEnd - clippedStart) / 60) * PX_PER_HOUR;
                const width = 100 / totalLanes;
                return <article key={meeting.id} className="db-v51-class" title={`${s?.name ?? "Deleted subject"} · ${timeLabel(meeting.start_time)} – ${timeLabel(meeting.end_time)} · ${meeting.room || "Room TBA"}`}
                  style={{ top: top + 3, height: Math.max(28, size - 6), left: `calc(${width * lane}% + 3px)`, width: `calc(${width}% - 6px)`, borderLeftColor: s?.color ?? "#b8bdcf" }}>
                  <time>{timeLabel(meeting.start_time)} – {timeLabel(meeting.end_time)}</time>
                  <strong>{s?.name ?? "Deleted subject"}</strong>
                  <small>{s?.code ?? "Unassigned"} · {meeting.room || "Room TBA"}</small>
                  <div className="db-v51-class-actions">
                    <button type="button" aria-label={`Edit ${s?.name ?? "class"}`} title="Edit class" onClick={() => { setError(""); setDraft({ ...meeting, start_time: meeting.start_time.slice(0, 5), end_time: meeting.end_time.slice(0, 5) }); }}><Pencil size={15}/></button>
                    <button type="button" aria-label={`Delete ${s?.name ?? "class"}`} title="Delete class" onClick={() => void remove(meeting)}><Trash2 size={15}/></button>
                  </div>
                </article>;
              })}
            </div>;
          })}
        </div>
      </div>}

    <p className="db-help db-v5-under"><CalendarRange size={16}/> Add Class lets you choose each meeting's start and end times. Classes repeat weekly here and do not appear in the main Calendar.</p>

    {draft && <div className="db-overlay"><div role="dialog" aria-modal="true" aria-labelledby="db-v5-class-title" className="db-dialog">
      <div className="db-dialog-head"><div><h2 id="db-v5-class-title">{draft.id ? "Edit class" : "Add a class"}</h2><p>Linked to your existing subjects and their colors.</p></div><button disabled={saving} onClick={() => setDraft(null)} aria-label="Close"><X size={20}/></button></div>
      <form className="db-form" onSubmit={e => void save(e)}>
        <label><span className="db-field-label">Subject</span><select required className="db-input" value={draft.subject_id} onChange={e => setDraft(v => v && ({ ...v, subject_id: e.target.value }))}>{subjects.map(s => <option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}</select></label>
        <label><span className="db-field-label">Weekday</span><select className="db-input" value={draft.weekday} onChange={e => setDraft(v => v && ({ ...v, weekday: Number(e.target.value) }))}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
        <div className="db-grid-two"><label><span className="db-field-label">Class starts</span><input className="db-input" required type="time" value={draft.start_time} onChange={e => setDraft(v => v && ({ ...v, start_time: e.target.value }))}/></label><label><span className="db-field-label">Class ends</span><input className="db-input" required type="time" value={draft.end_time} onChange={e => setDraft(v => v && ({ ...v, end_time: e.target.value }))}/></label></div>
        <label><span className="db-field-label">Room number / location</span><input className="db-input" maxLength={100} placeholder="e.g. Room 402 / Online" value={draft.room} onChange={e => setDraft(v => v && ({ ...v, room: e.target.value }))}/></label>
        {error && <p className="db-error" role="alert">{error}</p>}
        <div className="db-dialog-actions"><button type="button" className="db-btn db-btn-outline" disabled={saving} onClick={() => setDraft(null)}>Cancel</button><button className="db-btn db-btn-primary" disabled={saving}>{saving ? "Saving…" : "Save class"}</button></div>
      </form></div></div>}
  </section>;
}
