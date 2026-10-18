"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { CalendarRange, Clock3, Pencil, Plus, Trash2, X, ScanLine, RotateCcw } from "lucide-react";

type Subject = { id: string; name: string; code: string | null; color: string };
type Meeting = { id: string; subject_id: string; weekday: number; start_time: string; end_time: string; room: string };
type Draft = Omit<Meeting, "id"> & { id?: string };
type LaidOutMeeting = { meeting: Meeting; lane: number; totalLanes: number };

const DAYS = ["Suckday", "Moanday", "Tongueday", "Wetday", "Thirstday", "Freakday", "Sexday"];
const PX_PER_HOUR = 72;
const DEFAULT_RANGE = { start: 7 * 60, end: 19 * 60 };
const RANGE_OPTIONS = Array.from({ length: 49 }, (_, halfHour) => halfHour * 30);
const blank = (subject?: Subject): Draft => ({ subject_id: subject?.id ?? "", weekday: 1, start_time: "09:00", end_time: "10:30", room: "" });

function minutes(t: string) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}
function minuteLabel(value: number) {
  if (value === 1440) return "12:00 AM (next day)";
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function timeLabel(t: string) { return minuteLabel(minutes(t)); }
function hourLabel(hour: number) {
  if (hour === 24) return "12 AM";
  return `${hour % 12 || 12} ${hour >= 12 ? "PM" : "AM"}`;
}
function safeSubjectColor(value: string | undefined) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#7691b8";
}
// Use the higher-contrast ink for both pastel and dark custom subject colors.
function textOn(background: string) {
  const comps = [1, 3, 5].map(pos => {
    const channel = parseInt(background.slice(pos, pos + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const lum = comps[0] * 0.2126 + comps[1] * 0.7152 + comps[2] * 0.0722;
  const darkInkLum = 0.015;
  return (lum + 0.05) / (darkInkLum + 0.05) >= 1.05 / (lum + 0.05) ? "#152039" : "#ffffff";
}

// Lay overlapping classes next to one another rather than hiding either one.
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

export default function ClassSchedulePanel({ subjects, username, onAddSubject, openClassForSubjectId, onOpenClassHandled }: {
  subjects: Subject[];
  username: string;
  onAddSubject: () => void;
  openClassForSubjectId: string | null;
  onOpenClassHandled: () => void;
}) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState(DEFAULT_RANGE);
  const storageKey = `yolo:${username}:class-timetable-range-v64`;

  const byDay = useMemo(() => DAYS.map((_, i) => meetings.filter(m => m.weekday === i)), [meetings]);
  const subjectMap = useMemo(() => new Map(subjects.map(s => [s.id, s])), [subjects]);
  const height = (range.end - range.start) / 60 * PX_PER_HOUR;
  const outsideCount = meetings.filter(m => minutes(m.start_time) < range.start || minutes(m.end_time) > range.end).length;
  const hourLines = Array.from({ length: Math.floor(range.end / 60) - Math.ceil(range.start / 60) + 1 }, (_, i) => Math.ceil(range.start / 60) + i);
  const halfLines = Array.from({ length: Math.floor((range.end - range.start) / 30) + 1 }, (_, i) => range.start + i * 30).filter(t => t % 60 === 30 && t < range.end);

  useEffect(() => {
    if (!openClassForSubjectId) return;
    const subject = subjects.find(s => s.id === openClassForSubjectId);
    if (!subject) return;
    setError("");
    setDraft(blank(subject));
    onOpenClassHandled();
  }, [openClassForSubjectId, subjects, onOpenClassHandled]);

  function beginAddClass() {
    setError("");
    if (!subjects.length) { onAddSubject(); return; }
    setDraft(blank(subjects[0]));
  }

  useEffect(() => {
    try {
      const current = window.localStorage.getItem(storageKey);
      const parsed = JSON.parse(current ?? window.localStorage.getItem("yolo:class-timetable-range") ?? "null");
      if (Number.isInteger(parsed?.start) && Number.isInteger(parsed?.end)) {
        // Older versions stored hours; convert valid older local preferences if encountered.
        const start = parsed.start <= 24 && parsed.end <= 24 ? parsed.start * 60 : parsed.start;
        const end = parsed.start <= 24 && parsed.end <= 24 ? parsed.end * 60 : parsed.end;
        if (start >= 0 && end <= 1440 && start < end) setRange({ start, end });
      }
    } catch { /* optional local display preference */ }
    let live = true;
    request<{ meetings: Meeting[] }>("/api/class-meetings")
      .then(r => { if (live) setMeetings(r.meetings); })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : "Unable to load classes."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [storageKey]);

  function updateRange(start: number, end: number) {
    if (start < 0 || end > 1440 || start >= end) return;
    const next = { start, end };
    setRange(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* optional local preference */ }
  }
  function fitClasses() {
    if (!meetings.length) return;
    const earliest = Math.min(...meetings.map(m => minutes(m.start_time)));
    const latest = Math.max(...meetings.map(m => minutes(m.end_time)));
    const start = Math.max(0, Math.floor(earliest / 30) * 30 - 30);
    const end = Math.min(1440, Math.max(start + 30, Math.ceil(latest / 30) * 30 + 30));
    updateRange(start, end);
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
      const first = Math.min(range.start, Math.floor(minutes(res.meeting.start_time) / 30) * 30);
      const last = Math.max(range.end, Math.ceil(minutes(res.meeting.end_time) / 30) * 30);
      if (first !== range.start || last !== range.end) updateRange(first, last);
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

  return <section className="db-v5-section db-v64-page">
    <div className="db-v5-heading db-v64-heading">
      <div><span className="db-overline">YOUR WEEK AT A GLANCE</span><h2>Class Schedule</h2><p>A color-filled timetable, built around your subjects and your hours.</p></div>
      <button type="button" className="db-btn db-btn-primary" onClick={beginAddClass}><Plus size={16}/> Add class</button>
    </div>

    <div className="db-v64-range-toolbar">
      <div className="db-v64-range-title"><Clock3 size={17}/><div><strong>My timetable hours</strong><small>Choose the time window you want to see.</small></div></div>
      <label>From <select aria-label="Start of visible class schedule" value={range.start} onChange={e => updateRange(Number(e.target.value), Math.max(range.end, Number(e.target.value) + 30))}>{RANGE_OPTIONS.slice(0, -1).filter(t => t < range.end).map(t => <option key={t} value={t}>{minuteLabel(t)}</option>)}</select></label>
      <label>To <select aria-label="End of visible class schedule" value={range.end} onChange={e => updateRange(range.start, Number(e.target.value))}>{RANGE_OPTIONS.filter(t => t > range.start).map(t => <option key={t} value={t}>{minuteLabel(t)}</option>)}</select></label>
      <div className="db-v64-toolbar-buttons"><button type="button" disabled={!meetings.length} onClick={fitClasses} title="Automatically display all saved class times"><ScanLine size={15}/> Fit my classes</button><button type="button" onClick={() => updateRange(DEFAULT_RANGE.start, DEFAULT_RANGE.end)} title="Reset time range to 7 AM–7 PM"><RotateCcw size={14}/> Reset</button></div>
    </div>

    {!subjects.length && <p className="db-v5-message">No subjects yet. Click <strong>Add class</strong> to create your first subject and continue with the timetable.</p>}
    {error && <p className="db-error" role="alert">{error}</p>}
    {outsideCount > 0 && !loading && <p className="db-v51-outside" role="status">{outsideCount} class meeting(s) outside your selected hours. Choose <strong>Fit my classes</strong> or adjust From / To to see them all.</p>}

    {loading ? <p className="db-v5-message">Loading your class schedule…</p> :
      <div className="db-v64-scroll" aria-label="Weekly class timetable; scroll horizontally on smaller screens" tabIndex={0}>
        <div className="db-v64-timetable">
          <div className="db-v64-corner"><Clock3 size={14}/><span>TIME</span></div>
          {DAYS.map((day, index) => <div key={day} className="db-v64-day-head"><span className="db-v64-day-index">{String(index + 1).padStart(2, "0")}</span><strong>{day}</strong><small>{byDay[index].length} {byDay[index].length === 1 ? "class" : "classes"}</small></div>)}

          <div className="db-v64-hours" style={{ height }}>
            {hourLines.map(hour => <span key={hour} className="db-v64-hour-label" style={{ top: ((hour * 60 - range.start) / 60) * PX_PER_HOUR }}>{hourLabel(hour)}</span>)}
          </div>
          {DAYS.map((day, index) => {
            const visible = byDay[index].filter(m => minutes(m.end_time) > range.start && minutes(m.start_time) < range.end);
            return <div key={day} className="db-v64-day-column" style={{ height }} aria-label={`${day} class timetable`}>
              {hourLines.map(hour => <div key={hour} className="db-v64-hour-rule" style={{ top: ((hour * 60 - range.start) / 60) * PX_PER_HOUR }}/>) }
              {halfLines.map(minute => <div key={minute} className="db-v64-half-rule" style={{ top: ((minute - range.start) / 60) * PX_PER_HOUR }}/>) }
              {visible.length === 0 && <span className="db-v64-empty">—</span>}
              {layoutMeetings(visible).map(({ meeting, lane, totalLanes }) => {
                const subject = subjectMap.get(meeting.subject_id);
                const clippedStart = Math.max(minutes(meeting.start_time), range.start);
                const clippedEnd = Math.min(minutes(meeting.end_time), range.end);
                const top = ((clippedStart - range.start) / 60) * PX_PER_HOUR;
                const size = ((clippedEnd - clippedStart) / 60) * PX_PER_HOUR;
                const width = 100 / totalLanes;
                const bg = safeSubjectColor(subject?.color);
                const compact = size < 65;
                return <article key={meeting.id} className={`db-v64-class ${compact ? "db-v64-class-compact" : ""}`} title={`${subject?.name ?? "Deleted subject"} · ${timeLabel(meeting.start_time)} – ${timeLabel(meeting.end_time)} · ${meeting.room || "Room TBA"}`}
                  style={{ top: top + 2, height: Math.max(22, size - 4), left: `calc(${width * lane}% + 2px)`, width: `calc(${width}% - 4px)`, "--yolo-block-bg": bg, "--yolo-block-ink": textOn(bg) } as CSSProperties}>
                  <div className="db-v64-class-details">
                    <strong>{subject?.name ?? "Deleted subject"}</strong>
                    {!compact && <><span className="db-v64-class-time">{timeLabel(meeting.start_time)} – {timeLabel(meeting.end_time)}</span>{(subject?.code || meeting.room) && <small>{subject?.code ? `${subject.code}${meeting.room ? " · " : ""}` : ""}{meeting.room}</small>}</>}
                  </div>
                  <div className="db-v64-class-actions">
                    <button type="button" aria-label={`Edit ${subject?.name ?? "class"}`} title="Edit class" onClick={() => { setError(""); setDraft({ ...meeting, start_time: meeting.start_time.slice(0, 5), end_time: meeting.end_time.slice(0, 5) }); }}><Pencil size={13}/></button>
                    <button type="button" aria-label={`Delete ${subject?.name ?? "class"}`} title="Delete class" onClick={() => void remove(meeting)}><Trash2 size={13}/></button>
                  </div>
                </article>;
              })}
            </div>;
          })}
        </div>
      </div>}

    <p className="db-help db-v5-under"><CalendarRange size={16}/> Each solid-colored block represents a weekly class. Times and sizes follow the actual start and end times; this schedule is separate from the Tasks Calendar.</p>

    {draft && <div className="db-overlay"><div role="dialog" aria-modal="true" aria-labelledby="db-v5-class-title" className="db-dialog">
      <div className="db-dialog-head"><div><h2 id="db-v5-class-title">{draft.id ? "Edit class" : "Add a class"}</h2><p>Linked to your existing subjects and their colors.</p></div><button disabled={saving} onClick={() => setDraft(null)} aria-label="Close"><X size={20}/></button></div>
      <form className="db-form" onSubmit={e => void save(e)}>
        <label><span className="db-field-label">Subject</span><select required className="db-input" value={draft.subject_id} onChange={e => setDraft(v => v && ({ ...v, subject_id: e.target.value }))}>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` · ${s.code}` : ""}</option>)}</select></label>
        <label><span className="db-field-label">Weekday</span><select className="db-input" value={draft.weekday} onChange={e => setDraft(v => v && ({ ...v, weekday: Number(e.target.value) }))}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
        <div className="db-grid-two"><label><span className="db-field-label">Class starts</span><input className="db-input" required type="time" value={draft.start_time} onChange={e => setDraft(v => v && ({ ...v, start_time: e.target.value }))}/></label><label><span className="db-field-label">Class ends</span><input className="db-input" required type="time" value={draft.end_time} onChange={e => setDraft(v => v && ({ ...v, end_time: e.target.value }))}/></label></div>
        <label><span className="db-field-label">Room number / location</span><input className="db-input" maxLength={100} placeholder="e.g. Room 402 / Online" value={draft.room} onChange={e => setDraft(v => v && ({ ...v, room: e.target.value }))}/></label>
        {error && <p className="db-error" role="alert">{error}</p>}
        <div className="db-dialog-actions"><button type="button" className="db-btn db-btn-outline" disabled={saving} onClick={() => setDraft(null)}>Cancel</button><button className="db-btn db-btn-primary" disabled={saving}>{saving ? "Saving…" : "Save class"}</button></div>
      </form></div></div>}
  </section>;
}
