"use client";

import { useEffect, useMemo, useState, type CSSProperties, type DragEvent, type FormEvent } from "react";
import {
  ArrowRight, ArrowUpRight, CalendarClock, CalendarDays, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Circle, ClipboardList, Clock3, Columns3,
  FileDown, FilePlus2, Flag, Flower2, Heart, LayoutDashboard, Link2,
  ListTodo, LoaderCircle, LogOut, Moon, Palette, Paperclip, Pencil,
  Plus, Search, Settings2, Sparkles, Sun, Target, Trash2, UserRound, X,
  Repeat2, CalendarRange, Timer, BookHeart, Rocket,
} from "lucide-react";
import ClassSchedulePanel from "./ClassSchedulePanel";
import TimedCalendar from "./TimedCalendar";
import PomodoroPanel from "./PomodoroPanel";
import JournalPanel from "./JournalPanel";
import SpotifyPlaylistWidget from "./SpotifyPlaylistWidget";
import PomodoroQuickControls from "./PomodoroQuickControls";
import RecurringRulesPanel from "./RecurringRulesPanel";
import RoadmapPanel from "./RoadmapPanel";
import { DashboardCustomizeModal, TodayClassesWidget, DEFAULT_DASHBOARD_WIDGETS, normalizeDashboardWidgets, type DashboardWidgetId, type DashboardWidgetSetting } from "./DashboardTools";
import type { ReactNode } from "react";
import { GlobalSearch, ReminderCenter, AccountTools } from "./ProductivityTools";

type View = "dashboard" | "tasks" | "completed" | "calendar" | "board" | "classes" | "pomodoro" | "journal" | "settings" | "roadmap";
type Status = "todo" | "in_progress" | "done";
type Priority = "none" | "low" | "medium" | "high";
type Period = "day" | "week" | "month";
type Mode = "light" | "dark";
type Subject = { id: string; name: string; code: string | null; color: string; created_at: string };
type Task = { id: string; title: string; notes: string; links: string[]; status: Status; priority: Priority; subject_id: string | null; due_date: string | null; due_time: string | null; schedule_type: "deadline" | "duration" | "none"; end_date: string | null; end_time: string | null; completed_at: string | null; created_at: string; updated_at: string; recurrence_id?: string | null; occurrence_date?: string | null };
type TaskDraft = Pick<Task, "title" | "notes" | "links" | "status" | "priority" | "subject_id" | "due_date" | "due_time" | "schedule_type" | "end_date" | "end_time"> & { id?: string; frequency?: "none" | "daily" | "weekly" | "monthly"; weekdays?: number[]; repeat_until?: string | null };
type SubjectDraft = { id?: string; name: string; code: string; color: string };
type Attachment = { id: string; file_name: string; size_bytes: number; mime_type: string; created_at: string };
type ThemeChoice = { id: string; name: string; accent: string; companion: string };

const DAYS = ["Suckday", "Moanday", "Tongueday", "Wetday", "Thirstday", "Freakday", "Sexday"];
const THEMES: ThemeChoice[] = [
  { id: "pinkblue", name: "Pink + Blue", accent: "#d57cac", companion: "#91b9ee" },
  { id: "baby-pink", name: "Baby Pink", accent: "#e28fba", companion: "#f4bfd6" },
  { id: "rose", name: "Rose Pink", accent: "#bb558f", companion: "#e5a7c5" },
  { id: "mauve", name: "Dusty Pink", accent: "#b68aa8", companion: "#dac1d4" },
  { id: "baby-blue", name: "Baby Blue", accent: "#719fd8", companion: "#b7d4f7" },
  { id: "ocean", name: "Deep Blue", accent: "#477cb9", companion: "#77bdd9" },
];
const STATUS: { id: Status; title: string }[] = [
  { id: "todo", title: "To Do" }, { id: "in_progress", title: "In Progress" }, { id: "done", title: "Done" },
];
const ACTIVE_STATUS = STATUS.filter(s => s.id !== "done");
const PRIORITIES: { id: Priority; title: string }[] = [
  { id: "none", title: "None" }, { id: "low", title: "Low" }, { id: "medium", title: "Medium" }, { id: "high", title: "High" },
];
const COLORS = ["#e7a1c8", "#8bbcec", "#b5a3e6", "#e8bf7f", "#91cdb0", "#daa4a7"];
const pad = (n: number) => String(n).padStart(2, "0");
function iso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fromISO(value: string) { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(date: Date, delta: number) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta); }
function humanDate(date: string | null) { return date ? fromISO(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No due date"; }
function fullDate(d: Date) { return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
function blankTask(due_date: string | null = null): TaskDraft { return { title: "", notes: "", links: [], priority: "none", status: "todo", subject_id: null, due_date, due_time: null, schedule_type:"deadline", end_date:null, end_time:null, frequency:"none", weekdays:[], repeat_until:null }; }
function taskDateLabel(task:Task) {
  if (task.schedule_type === "none" || !task.due_date) return "No schedule";
  if (task.schedule_type === "duration") return `${humanDate(task.due_date)} · ${task.due_time?.slice(0,5) ?? ""} – ${task.end_date !== task.due_date ? `${humanDate(task.end_date)} ` : ""}${task.end_time?.slice(0,5) ?? ""}`;
  return `Due ${humanDate(task.due_date)}${task.due_time ? ` · ${task.due_time.slice(0,5)}` : ""}`;
}
function sorted(tasks: Task[]) { return [...tasks].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.title.localeCompare(b.title)); }
function taskRank(p: Priority) { return { high: 0, medium: 1, low: 2, none: 3 }[p]; }
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `Request failed (${response.status})`);
  return json as T;
}
const jsonOptions = (method: string, data: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

function PriorityChip({ priority }: { priority: Priority }) {
  return <span className={`db-priority db-priority-${priority}`}><Flag size={12}/>{PRIORITIES.find(p => p.id === priority)?.title}</span>;
}
function SubjectChip({ subject }: { subject?: Subject }) {
  return <span className="db-subject-chip"><i style={{ backgroundColor: subject?.color ?? "#b8bdcf" }}/>{subject?.code || subject?.name || "Personal"}</span>;
}
function TaskTile({ task, subject, edit, dragStart }: { task: Task; subject?: Subject; edit: () => void; dragStart?: (id: string) => void }) {
  return <button type="button" draggable={!!dragStart} onDragStart={e => { e.dataTransfer.setData("text/plain", task.id); dragStart?.(task.id); }} onClick={edit} className="db-task-tile">
    <div className="db-tile-top"><SubjectChip subject={subject}/><PriorityChip priority={task.priority}/></div>
    <p className={`db-tile-title ${task.status === "done" ? "db-strike" : ""}`}>{task.title} {task.recurrence_id && <Repeat2 size={13} aria-label="Recurring" className="db-v5-repeat-icon"/>}</p>
    {task.notes && <p className="db-tile-desc">{task.notes}</p>}
    <div className="db-tile-bottom"><CalendarDays size={14}/>{taskDateLabel(task)}{task.links?.length > 0 && <><Link2 size={13}/>{task.links.length}</>}</div>
  </button>;
}

function AttachmentPanel({ taskId, readOnly = false }: { taskId: string; readOnly?: boolean }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => {
    let alive = true;
    api<{ attachments: Attachment[] }>(`/api/tasks/${taskId}/attachments`)
      .then(r => { if (alive) setItems(r.attachments); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Unable to load files."); });
    return () => { alive = false; };
  }, [taskId]);
  async function upload(file?: File) {
    if (!file || working) return;
    if (file.size > 5 * 1024 * 1024) { setError("Maximum file size is 5 MB."); return; }
    setWorking(true); setError("");
    try {
      const form = new FormData(); form.set("file", file);
      const result = await api<{ attachment: Attachment }>(`/api/tasks/${taskId}/attachments`, { method: "POST", body: form });
      setItems(old => [result.attachment, ...old]);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setWorking(false); }
  }
  async function remove(item: Attachment) {
    if (!window.confirm(`Remove ${item.file_name}?`)) return;
    setWorking(true); setError("");
    try { await api(`/api/attachments/${item.id}`, { method: "DELETE" }); setItems(old => old.filter(a => a.id !== item.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Cannot remove file."); }
    finally { setWorking(false); }
  }
  return <section className="db-attachment-panel">
    <div className="db-between"><div><h3 className="db-field-label">Attachments</h3><p className="db-help">Private files · PDF, images, DOCX, XLSX, TXT, ZIP · max 5 MB each</p></div>
      {!readOnly && <label className={`db-btn db-btn-outline ${working ? "db-disabled" : ""}`}><FilePlus2 size={15}/> {working ? "Uploading..." : "Attach file"}
        <input aria-label="Upload attachment" type="file" disabled={working} className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.xlsx,.zip" onChange={e => { void upload(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }}/>
      </label>}
    </div>
    {error && <p role="alert" className="db-error">{error}</p>}
    {items.length > 0 && <div className="db-files">{items.map(a => <div key={a.id} className="db-file-row"><Paperclip size={14}/><span title={a.file_name}>{a.file_name}</span><small>{Math.round(a.size_bytes / 1024)} KB</small><a href={`/api/attachments/${a.id}`} title="Download file" aria-label={`Download ${a.file_name}`}><FileDown size={16}/></a>{!readOnly && <button type="button" disabled={working} title="Remove file" aria-label={`Remove ${a.file_name}`} onClick={() => void remove(a)}><X size={16}/></button>}</div>)}</div>}
    {!items.length && <p className="db-help">No files attached yet.</p>}
  </section>;
}

function TaskModal({ initial, subjects, busy, error, save, close }: { initial: TaskDraft; subjects: Subject[]; busy: boolean; error: string; save: (draft: TaskDraft) => void; close: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [urlText, setUrlText] = useState("");
  const [urlError, setUrlError] = useState("");
  const editing = !!initial.id;
  function addLink() {
    setUrlError("");
    try {
      const u = new URL(urlText.trim());
      if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) throw new Error("Use an http:// or https:// URL without credentials.");
      if (draft.links.length >= 12) throw new Error("Maximum 12 links per task.");
      if (!draft.links.includes(u.href)) setDraft(v => ({ ...v, links: [...v.links, u.href] }));
      setUrlText("");
    } catch (e) { setUrlError(e instanceof Error ? e.message : "Invalid URL."); }
  }
  return <div className="db-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busy) close(); }}><div role="dialog" aria-modal="true" aria-labelledby="db-task-title" className="db-dialog db-dialog-wide">
    <div className="db-dialog-head"><div><h2 id="db-task-title">{editing ? "Edit task" : "New task"}</h2><p>Details, links and attachments, all in one place.</p></div><button type="button" disabled={busy} onClick={close} aria-label="Close"><X size={20}/></button></div>
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); save(draft); }} className="db-form">
      <label><span className="db-field-label">Task name</span><input className="db-input" autoFocus required maxLength={180} value={draft.title} placeholder="What needs to get done?" onChange={e => setDraft(v => ({ ...v, title: e.target.value }))}/></label>
      <label><span className="db-field-label">Subject</span><select className="db-input" value={draft.subject_id ?? ""} onChange={e => setDraft(v => ({ ...v, subject_id: e.target.value || null }))}><option value="">Personal / Unassigned</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}</select></label>
      <div className="db-grid-two"><label><span className="db-field-label">Status</span><select className="db-input" value={draft.status} onChange={e => setDraft(v => ({ ...v, status: e.target.value as Status }))}>{STATUS.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label><span className="db-field-label">Priority</span><select className="db-input" value={draft.priority} onChange={e => setDraft(v => ({ ...v, priority: e.target.value as Priority }))}>{PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label></div>
      <div className="db-field-label">When does this task happen?</div>
      <div className="db54-schedule-type" role="group" aria-label="Schedule type">
        {([{id:"deadline",label:"Due / Deadline"},{id:"duration",label:"Duration / Event"},{id:"none",label:"No schedule"}] as const).map(opt=><button key={opt.id} type="button" aria-pressed={draft.schedule_type===opt.id} className={`db54-type-option ${draft.schedule_type===opt.id?"active":""}`} onClick={()=>setDraft(v=>({
          ...v,schedule_type:opt.id,
          due_date:opt.id==="none"?null:v.due_date??iso(new Date()),
          due_time:opt.id==="duration"?(v.due_time??"09:00"):opt.id==="none"?null:v.due_time,
          end_date:opt.id==="duration"?(v.end_date??v.due_date??iso(new Date())):null,
          end_time:opt.id==="duration"?(v.end_time??"10:00"):null,
          frequency:opt.id==="deadline"?v.frequency:"none",
        }))}>{opt.label}</button>)}
      </div>
      {draft.schedule_type==="deadline"&&<>
        <p className="db54-schedule-hint">A deadline is one moment on the calendar, e.g. project due at 9:00 PM. Time is optional.</p>
        <div className="db-grid-two"><label><span className="db-field-label">Due date</span><input type="date" className="db-input" value={draft.due_date??""} onChange={e=>setDraft(v=>({...v,due_date:e.target.value||null,due_time:e.target.value?v.due_time:null}))}/></label><label><span className="db-field-label">Due time (optional)</span><input type="time" className="db-input" disabled={!draft.due_date} value={draft.due_time??""} onChange={e=>setDraft(v=>({...v,due_time:e.target.value||null}))}/></label></div>
      </>}
      {draft.schedule_type==="duration"&&<>
        <p className="db54-schedule-hint">An event occupies time on the calendar, e.g. quiz from 8:00 to 10:00 AM. Cross-midnight events are supported.</p>
        <div className="db-grid-two"><label><span className="db-field-label">Start date</span><input required type="date" className="db-input" value={draft.due_date??""} onChange={e=>setDraft(v=>({...v,due_date:e.target.value||null,end_date:!v.end_date||v.end_date<(e.target.value||"")?e.target.value:v.end_date}))}/></label><label><span className="db-field-label">Start time</span><input required type="time" className="db-input" value={draft.due_time??""} onChange={e=>setDraft(v=>({...v,due_time:e.target.value||null}))}/></label></div>
        <div className="db-grid-two"><label><span className="db-field-label">End date</span><input required type="date" min={draft.due_date??undefined} className="db-input" value={draft.end_date??""} onChange={e=>setDraft(v=>({...v,end_date:e.target.value||null}))}/></label><label><span className="db-field-label">End time</span><input required type="time" className="db-input" value={draft.end_time??""} onChange={e=>setDraft(v=>({...v,end_time:e.target.value||null}))}/></label></div>
      </>}
      {draft.schedule_type==="none"&&<p className="db54-schedule-hint">This task stays in My Tasks but won't appear on a calendar date until you schedule it.</p>}
      {draft.schedule_type!=="none"&&<div className="db-quick-dates"><span>{draft.schedule_type==="deadline"?"Quick due date:":"Quick start date:"}</span>{[{label:"Today",offset:0},{label:"Tomorrow",offset:1},{label:"Next week",offset:7}].map(v=><button key={v.label} type="button" onClick={()=>setDraft(d=>{const date=iso(addDays(new Date(),v.offset));return {...d,due_date:date,end_date:d.schedule_type==="duration"?date:null};})}>{v.label}</button>)}</div>}
      {!editing && draft.schedule_type==="deadline" && <section className="db-v5-repeat-form"><div className="db-v5-inline"><Repeat2 size={17}/><strong>Repeat this task</strong></div>
        <label><span className="db-field-label">Repeat</span><select className="db-input" value={draft.frequency??"none"} onChange={e=>setDraft(v=>({...v,frequency:e.target.value as TaskDraft["frequency"],weekdays:e.target.value==="weekly"?[v.due_date?fromISO(v.due_date).getDay():new Date().getDay()]:[]}))}><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week (choose days)</option><option value="monthly">Every month (same date)</option></select></label>
        {draft.frequency && draft.frequency!=="none"&&<><p className="db-help">Choose a first due date above. Each occurrence has its own status and can be completed individually.</p>
          {draft.frequency==="weekly"&&<div className="db-v5-week-buttons"><span className="db-field-label">Repeat on</span><div>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d,i)=><button type="button" key={d} aria-pressed={draft.weekdays?.includes(i)??false} className={draft.weekdays?.includes(i)?"active":""} onClick={()=>setDraft(v=>({...v,weekdays:(v.weekdays??[]).includes(i)?(v.weekdays??[]).filter(n=>n!==i):[...(v.weekdays??[]),i].sort()}))}>{d}</button>)}</div></div>}
          <label><span className="db-field-label">End repeating (optional)</span><input className="db-input" type="date" min={draft.due_date??undefined} value={draft.repeat_until??""} onChange={e=>setDraft(v=>({...v,repeat_until:e.target.value||null}))}/></label>
        </>}
      </section>}
      <label><span className="db-field-label">Notes / instructions</span><textarea className="db-input db-textarea" maxLength={10000} value={draft.notes} placeholder="Requirements, steps, ideas..." onChange={e => setDraft(v => ({ ...v, notes: e.target.value }))}/></label>
      <section className="db-links-section"><h3 className="db-field-label">Related links</h3><div className="db-link-add"><input className="db-input" type="url" placeholder="https://..." value={urlText} onChange={e => setUrlText(e.target.value)}/><button type="button" className="db-btn db-btn-outline" disabled={!urlText.trim()} onClick={addLink}><Plus size={15}/> Add</button></div>{urlError && <p className="db-error">{urlError}</p>}{draft.links.map(link => <div className="db-link-row" key={link}><a href={link} target="_blank" rel="noopener noreferrer"><Link2 size={14}/>{link}</a><button type="button" title="Remove link" aria-label="Remove link" onClick={() => setDraft(v => ({ ...v, links: v.links.filter(item => item !== link) }))}><X size={15}/></button></div>)}</section>
      {editing && initial.id ? <AttachmentPanel taskId={initial.id}/> : <p className="db-help"><Paperclip size={14}/> Save the task first, then open it again to attach files.</p>}
      {error && <p className="db-error" role="alert">{error}</p>}
      <div className="db-dialog-actions"><button className="db-btn db-btn-outline" type="button" disabled={busy} onClick={close}>Cancel</button><button className="db-btn db-btn-primary" disabled={busy} type="submit">{busy ? "Saving..." : editing ? "Save changes" : "Create task"}</button></div>
    </form>
  </div></div>;
}


function TaskDetailsModal({ task, subject, close, edit, removeTask }: {
  task: Task;
  subject?: Subject;
  close: () => void;
  edit: () => void;
  removeTask: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  const currentStatus = STATUS.find(item => item.id === task.status)?.title ?? task.status;
  const currentPriority = PRIORITIES.find(item => item.id === task.priority)?.title ?? task.priority;
  return <div className="db-overlay db-v55-detail-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <section className="db-dialog db-dialog-wide db-v55-task-detail" role="dialog" aria-modal="true" aria-labelledby="db-v55-detail-title">
      <div className="db-dialog-head db-v55-detail-head">
        <div className="db-v55-detail-heading">
          <span className="db-overline">TASK DETAILS · READ ONLY</span>
          <h2 id="db-v55-detail-title">{task.title}</h2>
          <p>Everything you need to know about this task.</p>
        </div>
        <div className="db-v55-detail-tools">
          <button type="button" title="Edit task" aria-label="Edit task" onClick={edit}><Pencil size={18}/></button>
          <button type="button" title="Delete task" aria-label="Delete task" className="db-v55-danger-icon" onClick={removeTask}><Trash2 size={18}/></button>
          <button type="button" title="Close details" aria-label="Close details" onClick={close}><X size={20}/></button>
        </div>
      </div>
      <div className="db-v55-detail-content">
        <div className="db-v55-detail-chips"><SubjectChip subject={subject}/><span className={`db-v55-status db-v55-status-${task.status}`}>{currentStatus}</span><PriorityChip priority={task.priority}/></div>
        <div className="db-v55-detail-info-grid">
          <div className="db-v55-info-card"><span><CalendarDays size={15}/> Schedule</span><strong>{taskDateLabel(task)}</strong><small>{task.schedule_type === "duration" ? "Scheduled time block" : task.schedule_type === "deadline" ? "Deadline" : "Not scheduled"}</small></div>
          <div className="db-v55-info-card"><span><BookHeart size={15}/> Subject</span><strong>{subject?.name || "Personal / Unassigned"}</strong><small>{subject?.code || "No course code"}</small></div>
        </div>
        <section className="db-v55-detail-section"><h3>Notes / Instructions</h3><p className="db-v55-task-notes">{task.notes?.trim() || "No notes for this task yet."}</p></section>
        <section className="db-v55-detail-section"><h3>Related links</h3>{task.links?.length ? <div className="db-v55-link-list">{task.links.map(link => <a key={link} href={link} target="_blank" rel="noopener noreferrer"><Link2 size={15}/><span>{link}</span><ArrowUpRight size={15}/></a>)}</div> : <p className="db-v55-muted">No links added.</p>}</section>
        <AttachmentPanel taskId={task.id} readOnly />
      </div>
      <div className="db-v55-detail-footer"><span>Created {humanDate(task.created_at.slice(0,10))}</span><div><button type="button" className="db-btn db-btn-outline" onClick={close}>Close</button><button type="button" className="db-btn db-btn-primary" onClick={edit}><Pencil size={16}/> Edit task</button></div></div>
    </section>
  </div>;
}

function SubjectModal({ initial, busy, error, save, close }: { initial: SubjectDraft; busy: boolean; error: string; save: (v: SubjectDraft) => void; close: () => void }) {
  const [draft, setDraft] = useState(initial);
  return <div className="db-overlay"><div className="db-dialog" role="dialog" aria-modal="true" aria-labelledby="db-subject-title"><div className="db-dialog-head"><div><h2 id="db-subject-title">{initial.id ? "Edit subject" : "Add subject"}</h2><p>Give your subject a name, code and color.</p></div><button onClick={close} disabled={busy} aria-label="Close"><X size={20}/></button></div><form className="db-form" onSubmit={e => { e.preventDefault(); save({ ...draft, name: draft.name.trim(), code: draft.code.toUpperCase().trim() }); }}>
    <label><span className="db-field-label">Subject name</span><input autoFocus required maxLength={60} className="db-input" placeholder="Data Analytics" value={draft.name} onChange={e => setDraft(v => ({...v, name:e.target.value}))}/></label>
    <label><span className="db-field-label">Subject code</span><input required minLength={2} maxLength={20} className="db-input" placeholder="CS0073" value={draft.code} onChange={e => setDraft(v => ({...v, code:e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "")}))}/></label>
    <div><p className="db-field-label">Subject color</p><div className="db-color-row">{COLORS.map(color => <button key={color} className={`db-color-swatch ${color === draft.color ? "db-selected" : ""}`} style={{backgroundColor:color}} title={color} type="button" onClick={() => setDraft(v => ({...v,color}))}>{color === draft.color && <Check size={16}/>}</button>)}<input aria-label="Custom subject color" title="Custom color" type="color" value={draft.color} onChange={e => setDraft(v => ({...v,color:e.target.value}))}/></div></div>
    {error && <p className="db-error" role="alert">{error}</p>}<div className="db-dialog-actions"><button className="db-btn db-btn-outline" type="button" onClick={close}>Cancel</button><button className="db-btn db-btn-primary" disabled={busy}>{busy ? "Saving..." : "Save subject"}</button></div>
  </form></div></div>;
}

function PreferencesPanel({ mode, setMode, theme, setTheme, customColor, setCustomColor, dailyTarget, setDailyTarget }: {
  mode: Mode; setMode: (v: Mode) => void; theme: string; setTheme: (v: string) => void; customColor: string; setCustomColor: (v: string) => void; dailyTarget: number; setDailyTarget: (v: number) => void;
}) {
  return <section className="db-panel db-v55-settings-card"><div className="db-v55-settings-heading"><div><span className="db-overline">APPEARANCE & PREFERENCES</span><h2 id="db-theme-title"><Palette size={21}/> Make it yours</h2><p>Adjust the look of your YOLO workspace. Changes save automatically in this browser.</p></div></div><div className="db-form">
    <div><p className="db-field-label">Appearance</p><div className="db-segment db-wide-segment"><button type="button" aria-pressed={mode === "light"} className={mode === "light" ? "active" : ""} onClick={() => setMode("light")}><Sun size={16}/> Light mode</button><button type="button" aria-pressed={mode === "dark"} className={mode === "dark" ? "active" : ""} onClick={() => setMode("dark")}><Moon size={16}/> Dark mode</button></div></div>
    <div><p className="db-field-label">Color palette</p><div className="db-palette-grid">{THEMES.map(choice => <button key={choice.id} type="button" onClick={() => setTheme(choice.id)} aria-pressed={theme === choice.id} className={`db-palette-choice ${theme === choice.id ? "active" : ""}`}><span className="db-palette-duo"><i style={{backgroundColor:choice.accent}}/><i style={{backgroundColor:choice.companion}}/></span><span>{choice.name}</span>{theme===choice.id && <Check size={14}/>}</button>)}</div></div>
    <div className="db-custom-color"><label htmlFor="db-custom">Your own shade</label><input id="db-custom" type="color" value={customColor} onChange={e => { setCustomColor(e.target.value); setTheme("custom"); }}/><button type="button" className={theme === "custom" ? "db-small-active" : ""} onClick={() => setTheme("custom")}>Use custom shade</button></div>
    <div><label className="db-field-label" htmlFor="db-goal">Daily completion goal</label><div className="db-goal-field"><input id="db-goal" className="db-input" type="number" min={1} max={30} value={dailyTarget} onChange={e => setDailyTarget(Math.min(30,Math.max(1,Number(e.target.value)||1)))}/><p className="db-help">Count tasks marked Done today. Stored in this browser.</p></div></div>
  </div></section>;
}

export default function DayBloomApp({ user }: { user: { name: string; username: string } }) {
  const [view, setView] = useState<View>("dashboard");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [subjectDraft, setSubjectDraft] = useState<SubjectDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dragId, setDragId] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [anchor, setAnchor] = useState("2026-10-17");
  const [period, setPeriod] = useState<Period>("month");
  const [selectedDay, setSelectedDay] = useState("2026-10-17");
  const [journalDate, setJournalDate] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("light");
  const [theme, setTheme] = useState("pinkblue");
  const [customColor, setCustomColor] = useState("#d57cac");
  const [dailyTarget, setDailyTarget] = useState(3);
  const [readySettings, setReadySettings] = useState(false);
  const [recurrenceRefreshKey, setRecurrenceRefreshKey] = useState(0);
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidgetSetting[]>(() => DEFAULT_DASHBOARD_WIDGETS.map(w => ({ ...w })));
  const [showDashboardCustomize, setShowDashboardCustomize] = useState(false);

  useEffect(() => {
    const date = new Date(); setNow(date); setAnchor(iso(date)); setSelectedDay(iso(date));
    const ticker = window.setInterval(() => setNow(new Date()), 60_000);
    const storageKey = `daybloom:${user.username}:preferences`;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.mode === "dark" || saved.mode === "light") setMode(saved.mode);
        if (typeof saved.theme === "string" && [...THEMES.map(t => t.id), "custom"].includes(saved.theme)) setTheme(saved.theme);
        if (typeof saved.customColor === "string" && /^#[0-9a-f]{6}$/i.test(saved.customColor)) setCustomColor(saved.customColor);
        if (Number.isInteger(saved.dailyTarget) && saved.dailyTarget >= 1 && saved.dailyTarget <= 30) setDailyTarget(saved.dailyTarget);
      }
    } catch { /* ignore corrupted local preference */ }
    try {
      const layout = window.localStorage.getItem(`yolo:${user.username}:dashboard-widgets`);
      setDashboardWidgets(normalizeDashboardWidgets(layout ? JSON.parse(layout) : null));
    } catch {
      setDashboardWidgets(normalizeDashboardWidgets(null));
    }
    setReadySettings(true);
    const controller = new AbortController();
    async function load() {
      try {
        // Recurrence sync creates the next 60 days of distinct task occurrences.
        // If V5 SQL is missing, still load the existing V4 tasks and subjects.
        await api("/api/recurrences/sync", { method: "POST", signal: controller.signal }).catch(error => {
          if (!controller.signal.aborted) console.warn("Recurring sync unavailable:", error);
        });
        const [s, t] = await Promise.all([
          api<{ subjects: Subject[] }>("/api/subjects", { signal: controller.signal }),
          api<{ tasks: Task[] }>("/api/tasks", { signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) { setSubjects(s.subjects); setTasks(t.tasks); }
      } catch (err) { if (!controller.signal.aborted) setNotice(err instanceof Error ? err.message : "Unable to load workspace."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => { window.clearInterval(ticker); controller.abort(); };
  }, [user.username]);
  useEffect(() => {
    if (!readySettings) return;
    try { window.localStorage.setItem(`daybloom:${user.username}:preferences`, JSON.stringify({mode, theme, customColor, dailyTarget})); }
    catch { /* browser storage optional */ }
  }, [user.username, readySettings, mode, theme, customColor, dailyTarget]);
  useEffect(() => {
    if (!readySettings) return;
    try { window.localStorage.setItem(`yolo:${user.username}:dashboard-widgets`, JSON.stringify(dashboardWidgets)); }
    catch { /* Browser storage may be unavailable. The layout still works until refresh. */ }
  }, [user.username, readySettings, dashboardWidgets]);

  const palette = THEMES.find(item => item.id === theme);
  const cssVars = { "--db-accent": palette?.accent ?? customColor, "--db-second": palette?.companion ?? customColor } as CSSProperties;
  const today = now ? iso(now) : "";
  const greeting = now ? (now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening") : "Welcome back";
  const greetingMessage = !now ? "Here's your plan for today." : now.getHours() < 12 ? "Here's your plan for this morning." : now.getHours() < 17 ? "Here's your plan for this afternoon." : "Here's your plan for tonight.";
  const subjectMap = useMemo(() => new Map(subjects.map(s => [s.id, s])), [subjects]);
  const counts = { all: tasks.length, active: tasks.filter(t=>t.status!=="done").length, todo: tasks.filter(t=>t.status==="todo").length, in_progress: tasks.filter(t=>t.status==="in_progress").length, done: tasks.filter(t=>t.status==="done").length };
  const completedToday = tasks.filter(t => t.completed_at && now && new Date(t.completed_at).toDateString() === now.toDateString() && t.status === "done").length;
  const todayProgress = Math.min(100, Math.round(completedToday / dailyTarget * 100));
  const doneAll = counts.all ? Math.round(counts.done / counts.all * 100) : 0;
  const upcoming = sorted(tasks.filter(t => t.schedule_type === "deadline" && t.due_date && t.due_date >= today && t.status !== "done")).slice(0,4);
  const overdueTasks = sorted(tasks.filter(t => t.schedule_type === "deadline" && t.due_date && t.due_date < today && t.status !== "done"));
  const focus = [...tasks.filter(t => t.status !== "done")].sort((a,b) => taskRank(a.priority)-taskRank(b.priority) || (a.due_date??"9999").localeCompare(b.due_date??"9999")).slice(0,4);
  const filtered = sorted(tasks.filter(t => t.status !== "done" && (t.title.toLowerCase().includes(search.toLowerCase()) || t.notes.toLowerCase().includes(search.toLowerCase())) && (!filterSubject || t.subject_id === filterSubject) && (!filterStatus || t.status === filterStatus)));
  const byDate = useMemo(() => {
    const map=new Map<string,Task[]>();
    tasks.forEach(t=>{
      if(!t.due_date||t.schedule_type==="none")return;
      const add=(date:string)=>map.set(date,[...(map.get(date)??[]),t]);
      add(t.due_date);
      if(t.schedule_type==="duration"&&t.end_date&&t.end_date>t.due_date){
        const current=fromISO(t.due_date);
        for(let n=1;n<=3;n++){const date=iso(addDays(current,n));if(date>t.end_date)break;add(date);}
      }
    });return map;
  },[tasks]);
  const anchorDate = fromISO(anchor);
  const startWeek = addDays(anchorDate, -anchorDate.getDay());
  const monthFirst = new Date(anchorDate.getFullYear(),anchorDate.getMonth(),1);
  const monthStart = addDays(monthFirst, -monthFirst.getDay());
  const gridDates = period === "month" ? Array.from({length:42},(_,i) => addDays(monthStart,i)) : period === "week" ? Array.from({length:7},(_,i) => addDays(startWeek,i)) : [anchorDate];
  const periodLabel = period === "month" ? monthFirst.toLocaleDateString("en-US", {month:"long",year:"numeric"}) : period === "week" ? `${humanDate(iso(startWeek))} – ${humanDate(iso(addDays(startWeek,6)))}` : fullDate(anchorDate);
  const selectedTasks = sorted(byDate.get(selectedDay) ?? []);
  const detailTask = tasks.find(task => task.id === detailTaskId);

  // All dashboard widgets draw from the same current task/subject state.
  // Reordering them changes only presentation; it never modifies Supabase records.
  const dashboardWidgetsContent: Record<DashboardWidgetId, ReactNode> = {
    hero: <section className="db-hero">
      <div className="db-hero-left">
        <span className="db-hero-eyebrow"><Sparkles size={15}/> YOUR DAY, YOUR PACE</span>
        <h2>{greetingMessage}</h2><p>Pick your next step and make today count.</p>
        <div className="db-hero-actions">
          <button onClick={() => newTask()}><Plus size={16}/> Add task</button>
          <button onClick={() => setView("tasks")}>View my tasks <ArrowUpRight size={16}/></button>
        </div>
      </div>
      <div className="db-hero-progress">
        <p><Target size={17}/> Daily goal</p>
        <div className="db-progress-big"><strong>{completedToday}</strong><span>/ {dailyTarget} completed today</span></div>
        <div className="db-bar db-bar-hero"><span style={{width:`${todayProgress}%`}}/></div>
        <div className="db-between"><small>{todayProgress}% of daily goal</small><button onClick={() => setView("settings")}><Settings2 size={15}/> Set goal</button></div>
      </div>
    </section>,
    stats: <section className="db-stats" aria-label="Task statistics">{[
      {label:"Remaining tasks",value:counts.active,icon:ClipboardList},
      {label:"To do",value:counts.todo,icon:ListTodo},
      {label:"In progress",value:counts.in_progress,icon:Clock3},
      {label:"Completed",value:counts.done,icon:CheckCircle2},
    ].map(stat => {
      const Icon = stat.icon;
      return <div className="db-panel db-stat" key={stat.label}><div><span>{stat.label}</span><Icon size={21}/></div><strong>{stat.value}</strong></div>;
    })}</section>,
    classes: <TodayClassesWidget subjects={subjects} weekday={now?.getDay() ?? null} currentMinute={now ? now.getHours() * 60 + now.getMinutes() : null} openSchedule={() => setView("classes")}/> ,
    spotify: <SpotifyPlaylistWidget username={user.username}/>,
    pomodoro: <PomodoroQuickControls openFull={() => setView("pomodoro")}/>,
    focus: <section className="db-panel db-section">
      <div className="db-section-heading"><div><span className="db-overline">YOUR NEXT STEPS</span><h2>Focus list</h2><p>High-priority unfinished tasks first</p></div><Target size={20}/></div>
      {focus.length ? <div className="db-list">{focus.map(task => <button key={task.id} className="db-focus-row" onClick={() => openTask(task)}>
        <Circle size={18}/><div><strong>{task.title}</strong><small>{subjectMap.get(task.subject_id ?? "")?.code || "Personal"} · {humanDate(task.due_date)}</small></div><PriorityChip priority={task.priority}/>
      </button>)}</div> : <p className="db-empty">Nothing on your list yet. Add a task to start.</p>}
      <button className="db-text-link" onClick={() => setView("tasks")}>View all tasks <ArrowRight size={14}/></button>
    </section>,
    progress: <section className="db-panel db-section">
      <div className="db-section-heading"><div><span className="db-overline">KEEP MOVING</span><h2>Today's progress</h2><p>Tasks completed on your device's current day</p></div><CheckCircle2 size={20}/></div>
      <p className="db-progress-label">{completedToday} / {dailyTarget} daily goal</p>
      <div className="db-bar"><span style={{width:`${todayProgress}%`}}/></div>
      <p className="db-progress-note">{todayProgress >= 100 ? "Daily goal reached — nice work!" : "Mark tasks as Done to grow your progress."}</p>
      <div className="db-mini-metrics"><div><span>Overall completion</span><strong>{doneAll}%</strong></div><div><span>Overdue tasks</span><strong>{overdueTasks.length}</strong></div></div>
    </section>,
    deadlines: <section className="db-panel db-section">
      <div className="db-section-heading"><div><span className="db-overline">COMING UP</span><h2>Upcoming deadlines</h2><p>Automatically synced with your calendar</p></div><button className="db-text-link" onClick={() => setView("calendar")}>Open calendar <ArrowRight size={15}/></button></div>
      <div className="db-deadline-grid">{upcoming.length ? upcoming.map(task => <button key={task.id} onClick={() => openTask(task)} className="db-deadline-card">
        <div><CalendarDays size={18}/><span>{humanDate(task.due_date)}</span></div><strong>{task.title}</strong><SubjectChip subject={subjectMap.get(task.subject_id ?? "")}/>
      </button>) : <p className="db-empty">No upcoming deadlines. You're all caught up!</p>}</div>
    </section>,
    board: <section className="db-panel db-section">
      <div className="db-section-heading"><div><span className="db-overline">WORKFLOW</span><h2>Active task board</h2><p>To Do → In Progress · Done tasks move to Completed</p></div><button className="db-text-link" onClick={() => setView("board")}>Full board <ArrowRight size={15}/></button></div>
      <div className="db-kanban db-v51-active-board">{ACTIVE_STATUS.map(status => <div className="db-board-column" key={status.id}>
        <div className="db-between"><h3>{status.title}</h3><span>{counts[status.id]}</span></div>
        {sorted(tasks.filter(task => task.status === status.id)).slice(0,2).map(task => <TaskTile key={task.id} task={task} subject={subjectMap.get(task.subject_id ?? "")} edit={() => openTask(task)}/>)}
        {counts[status.id] === 0 && <p className="db-empty">No tasks yet</p>}
      </div>)}</div>
    </section>,
    overdue: overdueTasks.length > 0 ? <section className="db-panel db-section">
      <div className="db-section-heading"><div><span className="db-overline">NEEDS A NEW DATE</span><h2>Reschedule unfinished tasks</h2><p>Move an overdue deadline without changing its status.</p></div><CalendarClock size={19}/></div>
      <div className="db-overdue-list">{overdueTasks.slice(0,5).map(task => <div className="db-overdue-row" key={task.id}>
        <div><strong>{task.title}</strong><small>Was due {humanDate(task.due_date)}</small></div>
        <div><button disabled={!!updatingId} onClick={() => void patchTask(task,{due_date:today})}>Today</button><button disabled={!!updatingId} onClick={() => void patchTask(task,{due_date:iso(addDays(new Date(),1))})}>Tomorrow</button><button onClick={() => editTask(task)}>Choose date</button></div>
      </div>)}</div>
    </section> : null,
  };

  function newTask(date: string | null = null) { setDetailTaskId(null); setModalError(""); setTaskDraft(blankTask(date)); }
  function openTask(t: Task) { setModalError(""); setDetailTaskId(t.id); }
  function editTask(t: Task) { setDetailTaskId(null); setModalError(""); setTaskDraft({id:t.id,title:t.title,notes:t.notes,links:t.links ?? [],priority:t.priority,status:t.status,subject_id:t.subject_id,due_date:t.due_date,due_time:t.due_time?.slice(0,5)??null,schedule_type:t.schedule_type??"deadline",end_date:t.end_date??null,end_time:t.end_time?.slice(0,5)??null}); }
  function newSubject() { setModalError(""); setSubjectDraft({name:"",code:"",color:COLORS[0]}); }
  async function saveSubject(d: SubjectDraft) {
    if (busy) return; setBusy(true); setModalError("");
    try { const r = await api<{subject:Subject}>(d.id ? `/api/subjects/${d.id}` : "/api/subjects",jsonOptions(d.id?"PATCH":"POST",{name:d.name,code:d.code,color:d.color}));
      setSubjects(old => d.id ? old.map(s=>s.id===r.subject.id?r.subject:s):[...old,r.subject]); setSubjectDraft(null);
    } catch (e) { setModalError(e instanceof Error?e.message:"Cannot save subject."); } finally { setBusy(false); }
  }
  async function deleteSubject(s:Subject) {
    if (!window.confirm(`Delete ${s.name}? Its tasks will remain unassigned, but any class schedule meetings for this subject will also be removed.`)) return;
    try { await api(`/api/subjects/${s.id}`,{method:"DELETE"}); setSubjects(old=>old.filter(v=>v.id!==s.id)); setTasks(old=>old.map(t=>t.subject_id===s.id?{...t,subject_id:null}:t)); }
    catch(e) { setNotice(e instanceof Error?e.message:"Cannot delete subject."); }
  }
  async function saveTask(d:TaskDraft) {
    if (busy) return; setBusy(true); setModalError("");
    try {
      if (!d.id && d.frequency && d.frequency !== "none") {
        if (!d.due_date) throw new Error("Choose a first due date for this repeating task.");
        const r = await api<{tasks:Task[]}>("/api/recurrences",jsonOptions("POST",d));
        setTasks(old => [...r.tasks, ...old]);
        setRecurrenceRefreshKey(n=>n+1);
        setNotice(`Repeating task added. ${r.tasks.length} upcoming occurrences are ready.`);
      } else {
        const r = await api<{task:Task}>(d.id ? `/api/tasks/${d.id}` : "/api/tasks",jsonOptions(d.id?"PATCH":"POST",d));
        setTasks(old => d.id ? old.map(t=>t.id===r.task.id?r.task:t):[r.task,...old]);
      }
      setTaskDraft(null);
    } catch(e) { setModalError(e instanceof Error?e.message:"Cannot save task."); } finally { setBusy(false); }
  }
  async function patchTask(t:Task, patch:Partial<TaskDraft>) {
    if (updatingId) return;
    setUpdatingId(t.id);
    try { const r = await api<{task:Task}>(`/api/tasks/${t.id}`, jsonOptions("PATCH",patch)); setTasks(old => old.map(item=>item.id===t.id?r.task:item)); }
    catch(e) { setNotice(e instanceof Error?e.message:"Cannot update task."); } finally { setUpdatingId(""); }
  }
  async function deleteTask(t:Task) {
    if (!window.confirm(`Delete “${t.title}” permanently?`)) return;
    try { await api(`/api/tasks/${t.id}`,{method:"DELETE"}); setTasks(old=>old.filter(item=>item.id!==t.id)); setDetailTaskId(current=>current===t.id?null:current); }
    catch(e) { setNotice(e instanceof Error?e.message:"Cannot delete task."); }
  }
  async function logout() {
    if (loggingOut) return; setLoggingOut(true);
    try { await api("/api/auth/logout",{method:"POST"}); window.location.replace("/login"); }
    catch(e) { setNotice(e instanceof Error?e.message:"Unable to log out."); setLoggingOut(false); }
  }
  function moveCalendar(direction:number) {
    const d = period === "month" ? new Date(anchorDate.getFullYear(),anchorDate.getMonth()+direction, Math.min(anchorDate.getDate(),28)) : addDays(anchorDate, direction*(period === "week" ? 7 : 1));
    setAnchor(iso(d)); setSelectedDay(iso(d));
  }
  const views: {id:View;name:string;icon:typeof LayoutDashboard}[] = [
    {id:"dashboard",name:"Dashboard",icon:LayoutDashboard}, {id:"tasks",name:"My Tasks",icon:ListTodo}, {id:"completed",name:"Completed",icon:CheckCircle2}, {id:"calendar",name:"Calendar",icon:CalendarDays}, {id:"board",name:"Task Board",icon:Columns3},
    {id:"classes",name:"Class Schedule",icon:CalendarRange}, {id:"pomodoro",name:"Pomodoro",icon:Timer}, {id:"journal",name:"Daily Journal",icon:BookHeart},
  ];
  const menuTitle:Record<View,string> = {
    dashboard:`${greeting}, ${user.name}!`, tasks:"Your tasks", completed:"Completed tasks", calendar:"Your calendar", board:"Your task board",
    classes:"Your class schedule", pomodoro:"Focus time", journal:"Your daily journal", settings:"Settings", roadmap:"What’s next?",
  };
  const subtitles:Record<View,string> = {
    dashboard:greetingMessage, tasks:"Your unfinished tasks, all in one place.", completed:"Finished and archived here. Restore a task whenever you need it.",
    calendar:"Every task and its due date, all in sync.", board:"Focus on what remains. Completed tasks move to your archive.",
    classes:"Classes live here, separate from your task calendar.",
    pomodoro:"Find your rhythm with a little focus and a real break.",
    journal:"Write your day down, just for you.", settings:"Your theme, goals, account recovery and backups in one place.", roadmap:"A sneak peek at the future of YOLO.",
  };

  return <div className="daybloom-v3" data-mode={mode} style={cssVars}>
    <div className="db-shell">
      <aside className="db-sidebar"><div className="db-logo"><span><Flower2 size={24}/></span><div><strong>YOLO</strong><small>Your personal planner</small></div></div>
        <p className="db-nav-title">WORKSPACE</p><nav className="db-nav">{views.map(v=>{const I=v.icon;return <button key={v.id} type="button" className={view === v.id ? "active" : ""} onClick={() => setView(v.id)}><I size={18}/>{v.name}</button>;})}</nav>
        <div className="db-subject-heading"><span>MY SUBJECTS</span><button onClick={newSubject} title="Add subject" aria-label="Add subject"><Plus size={17}/></button></div>
        <div className="db-subject-list">{!loading && !subjects.length && <p className="db-help">No subjects yet</p>}{subjects.map(s => <div key={s.id} className="db-subject"><i style={{backgroundColor:s.color}}/><button onClick={() => {setFilterSubject(s.id);setView("tasks");}} title={s.name}><strong>{s.name}</strong><small>{s.code}</small></button><button title={`Edit ${s.name}`} aria-label={`Edit ${s.name}`} onClick={()=>{setModalError("");setSubjectDraft({id:s.id,name:s.name,code:s.code??"",color:s.color});}}><Pencil size={14}/></button><button title={`Delete ${s.name}`} aria-label={`Delete ${s.name}`} onClick={()=>void deleteSubject(s)}><Trash2 size={14}/></button></div>)}</div>
        <button className="db-add-subject" type="button" onClick={newSubject}><Plus size={16}/> Add subject</button>
        <div className="db-sidebar-bottom"><button type="button" className={`db-v55-sidebar-settings yolo62-sidebar-roadmap ${view === "roadmap" ? "active" : ""}`} onClick={() => setView("roadmap")}><Rocket size={18}/> What's Next?</button><button type="button" className={`db-v55-sidebar-settings ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}><Settings2 size={18}/> Settings</button><div className="db-reminder"><Heart size={17}/><strong>A little reminder</strong><p>Progress is still progress, even in small steps.</p></div><button className="db-sidebar-logout" onClick={()=>void logout()} disabled={loggingOut}><LogOut size={17}/>{loggingOut?"Logging out...":"Log out"}</button></div>
      </aside>
      <main className="db-main"><header className="db-header"><div className="db-header-copy"><p><Sparkles size={15}/> YOUR PERSONAL WORKSPACE</p><h1>{menuTitle[view]}</h1><span>{subtitles[view]}</span></div><div className="db-header-actions"><GlobalSearch onSelect={result=>{if(result.type==="task"){const t=tasks.find(t=>t.id===result.id);if(t)openTask(t);else setView("tasks");}else if(result.type==="subject"){setFilterSubject(result.id);setView("tasks");}else if(result.type==="class"){setView("classes");}else if(result.type==="journal"){setJournalDate(result.date);setView("journal");}}}/><ReminderCenter tasks={tasks} subjects={subjects} username={user.username} goToTasks={()=>setView("tasks")}/><button className="db-btn db-btn-primary" onClick={()=>newTask()}><Plus size={17}/> New task</button><div className="db-profile"><UserRound size={19}/><div><strong>{user.name}</strong><small>@{user.username}</small></div></div></div></header>
        <div className="db-mobile-nav">{views.map(v=><button key={v.id} className={view===v.id?"active":""} onClick={()=>setView(v.id)}>{v.name}</button>)}<button onClick={newSubject}>+ Subject</button><button className={view==="roadmap"?"active":""} onClick={()=>setView("roadmap")}>What's Next?</button><button onClick={()=>setView("settings")}>Settings</button><button onClick={()=>void logout()}>Logout</button></div>
        {notice && <div className="db-error db-global-error" role="alert">{notice}<button aria-label="Dismiss" onClick={()=>setNotice("")}><X size={15}/></button></div>}
        {loading && <div className="db-panel db-loading"><LoaderCircle size={19} className="animate-spin"/> Loading your workspace...</div>}

        {!loading && view === "dashboard" && <div className="db-dashboard db-v52-dashboard-page">
          <div className="db-v52-dashboard-toolbar">
            <div><span className="db-overline">YOUR WORKSPACE</span><p>Organized around what matters to you.</p></div>
            <button type="button" className="db-btn db-btn-outline db-v52-customize-button" onClick={() => setShowDashboardCustomize(true)}><Settings2 size={17}/> Customize dashboard</button>
          </div>
          {dashboardWidgets.every(item => !item.visible) ?
            <section className="db-panel db-v52-all-hidden"><h2>Your dashboard is clear.</h2><p>All widgets are hidden. Choose what you want to show.</p><button type="button" className="db-btn db-btn-primary" onClick={() => setShowDashboardCustomize(true)}>Choose widgets</button></section>
          : <div className="db-v52-dashboard-grid">
            {dashboardWidgets.filter(item => item.visible).map(item => {
              const element = dashboardWidgetsContent[item.id];
              if (element === null) return null;
              return <div key={item.id} className={`db-v52-widget ${item.id === "focus" || item.id === "progress" || item.id === "spotify" || item.id === "pomodoro" ? "db-v52-half" : "db-v52-wide"}`}>{element}</div>;
            })}
          </div>}
        </div>}

        {!loading && view === "roadmap" && <RoadmapPanel/>}
        {!loading && view === "settings" && <div className="db-v55-settings-page">
          <PreferencesPanel mode={mode} setMode={setMode} theme={theme} setTheme={setTheme} customColor={customColor} setCustomColor={setCustomColor} dailyTarget={dailyTarget} setDailyTarget={setDailyTarget}/>
          <AccountTools embedded/>
        </div>}
        {!loading && view === "tasks" && <section className="db-panel db-tasks-panel"><div className="db-filter-bar"><div className="db-search"><Search size={17}/><input aria-label="Search tasks" placeholder="Search tasks and notes..." value={search} onChange={e=>setSearch(e.target.value)}/></div><select className="db-input" aria-label="Filter by subject" value={filterSubject} onChange={e=>setFilterSubject(e.target.value)}><option value="">All subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select className="db-input" aria-label="Filter by status" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="">All active statuses</option>{ACTIVE_STATUS.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></div><div className="db-list-heading"><h2>Active tasks</h2><span>{filtered.length} remaining</span></div>{filtered.length?filtered.map(t=><div key={t.id} className="db-task-row"><button aria-label={`Open ${t.title}`} onClick={()=>openTask(t)}>{t.status==="done"?<CheckCircle2 size={20}/>:<Circle size={20}/>}</button><button className="db-task-row-main" onClick={()=>openTask(t)}><strong className={t.status==="done"?"db-strike":""}>{t.title}</strong><small><SubjectChip subject={subjectMap.get(t.subject_id??"")}/> · {humanDate(t.due_date)}</small></button><PriorityChip priority={t.priority}/><select aria-label={`Change status for ${t.title}`} value={t.status} disabled={!!updatingId} onChange={e=>void patchTask(t,{status:e.target.value as Status})}>{STATUS.map(s=><option value={s.id} key={s.id}>{s.title}</option>)}</select><button title="Edit task" onClick={()=>editTask(t)}><Pencil size={17}/></button><button title="Delete task" onClick={()=>void deleteTask(t)}><Trash2 size={17}/></button></div>):<p className="db-empty db-empty-large">No tasks match your filters.</p>}</section>}

        {!loading && view === "tasks" && <RecurringRulesPanel refreshKey={recurrenceRefreshKey}/>}
        {!loading && view === "classes" && <ClassSchedulePanel subjects={subjects}/>}
        {!loading && view === "journal" && <JournalPanel key={journalDate ?? "recent"} username={user.username} initialDate={journalDate}/>}
        <div hidden={loading || view !== "pomodoro"}>{!loading && <PomodoroPanel username={user.username} tasks={tasks}/>}</div>
        {!loading && view === "board" && <section className="db-v51-board-layout">
          <div className="db-v51-board-top"><div><h2>Active workflow</h2><p>Only unfinished tasks stay on this board.</p></div><button className="db-btn db-btn-outline" onClick={()=>setView("completed")}><CheckCircle2 size={16}/> Completed ({counts.done})</button></div>
          <div className="db-kanban db-board-page db-v51-active-board">{ACTIVE_STATUS.map(s=>{const items=sorted(tasks.filter(t=>t.status===s.id));return <div className="db-board-column" key={s.id} onDragOver={e=>e.preventDefault()} onDrop={(e:DragEvent<HTMLDivElement>)=>{e.preventDefault();const id=e.dataTransfer.getData("text/plain")||dragId;const t=tasks.find(t=>t.id===id);setDragId("");if(t)void patchTask(t,{status:s.id});}}><div className="db-between"><h3>{s.title}</h3><span>{items.length}</span></div><p className="db-help">Drag cards here to update status.</p>{items.map(t=><div className="db-v51-task-wrapper" key={t.id}><TaskTile task={t} subject={subjectMap.get(t.subject_id??"")} edit={()=>openTask(t)} dragStart={setDragId}/><button type="button" className="db-v51-markdone" disabled={!!updatingId} onClick={()=>void patchTask(t,{status:"done"})}><CheckCircle2 size={15}/> Mark Done</button></div>)}{items.length===0&&<p className="db-empty">Drop an unfinished task here</p>}</div>;})}</div>
          <div className="db-v51-completion-drop" onDragOver={e=>e.preventDefault()} onDrop={(e:DragEvent<HTMLDivElement>)=>{e.preventDefault();const id=e.dataTransfer.getData("text/plain")||dragId;const t=tasks.find(t=>t.id===id);setDragId("");if(t&&t.status!=="done")void patchTask(t,{status:"done"});}}><CheckCircle2 size={21}/><div><strong>Done with a task?</strong><p>Drag it here or click Mark Done. It disappears from the active board but remains in Completed.</p></div><button className="db-text-link" type="button" onClick={()=>setView("completed")}>View completed <ArrowRight size={15}/></button></div>
        </section>}

        {!loading && view === "completed" && <section className="db-panel db-tasks-panel db-v51-completed-page"><div className="db-list-heading"><h2>Completed tasks</h2><span>{counts.done} completed</span></div><p className="db-help">Your finished tasks are stored here, not deleted. You can reopen or restore any of them.</p>{sorted(tasks.filter(t=>t.status==="done")).map(t=><div key={t.id} className="db-task-row"><CheckCircle2 size={19} className="db-v51-complete-icon"/><button className="db-task-row-main" onClick={()=>openTask(t)}><strong>{t.title}</strong><small><SubjectChip subject={subjectMap.get(t.subject_id??"")}/> · {humanDate(t.due_date)}</small></button><button className="db-v51-restore" disabled={!!updatingId} onClick={()=>void patchTask(t,{status:"todo"})}>Restore to To Do</button><button title="Edit task" aria-label={`Edit ${t.title}`} onClick={()=>editTask(t)}><Pencil size={17}/></button><button title="Delete task" aria-label={`Delete ${t.title}`} onClick={()=>void deleteTask(t)}><Trash2 size={17}/></button></div>)}{counts.done===0&&<p className="db-empty db-empty-large">Nothing completed yet. Finished tasks will appear here automatically.</p>}</section>}

        {!loading && view === "calendar" && <div className="db-calendar-layout"><section className="db-panel db-calendar-main"><div className="db-calendar-toolbar"><div><span className="db-overline">YOUR SCHEDULE</span><h2>{periodLabel}</h2></div><div className="db-calendar-controls"><div className="db-segment">{(["day","week","month"] as Period[]).map(p=><button key={p} onClick={()=>setPeriod(p)} className={period===p?"active":""}>{p[0].toUpperCase()+p.slice(1)}</button>)}</div><button aria-label="Previous period" className="db-icon-button" onClick={()=>moveCalendar(-1)}><ChevronLeft size={18}/></button><button className="db-btn db-btn-outline" onClick={()=>{const d=iso(new Date());setAnchor(d);setSelectedDay(d);}}>Today</button><button aria-label="Next period" className="db-icon-button" onClick={()=>moveCalendar(1)}><ChevronRight size={18}/></button></div></div>
          {period==="month" && <div className="db-calendar-scroll"><div className="db-calendar-grid"><div className="db-weekdays">{DAYS.map(day=><div key={day}>{day}</div>)}</div><div className="db-calendar-cells">{gridDates.map(d=>{const key=iso(d);const events=byDate.get(key)??[];return <div key={key} role="button" tabIndex={0} aria-label={`Select ${humanDate(key)}`} className={`db-calendar-cell ${d.getMonth()!==anchorDate.getMonth()?"db-other-month":""} ${selectedDay===key?"db-selected-day":""}`} onClick={()=>setSelectedDay(key)} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==="Enter"||e.key===" ")){e.preventDefault();setSelectedDay(key);}}}><span className={today===key?"db-today-number":""}>{d.getDate()}</span><div>{events.slice(0,3).map(t=><button type="button" key={t.id} title={`${t.title} · ${taskDateLabel(t)}`} className={`db-v55-calendar-task ${t.status==="done"?"db-strike":""}`} style={{borderLeftColor:subjectMap.get(t.subject_id??"")?.color??"#a2a6b7"}} onClick={e=>{e.stopPropagation();setSelectedDay(key);openTask(t);}}>{t.schedule_type==="duration"?"◷ ":""}{t.title}</button>)}{events.length>3&&<small>+{events.length-3} more</small>}</div></div>;})}</div></div></div>}
          {period!=="month"&&<TimedCalendar dates={period==="week"?gridDates.map(iso):[anchor]} tasks={tasks} subjects={subjects} selectedDay={period==="day"?anchor:selectedDay} onDaySelect={date=>{setSelectedDay(date);if(period==="day")setAnchor(date);}} onEdit={t=>{const full=tasks.find(item=>item.id===t.id);if(full)openTask(full);}} onNew={date=>newTask(date)}/>}
          </section><aside className="db-panel db-calendar-aside"><span className="db-overline">SELECTED DAY</span><h2>{humanDate(period==="day"?anchor:selectedDay)}</h2><p className="db-help">{(period==="day"?(byDate.get(anchor)??[]):selectedTasks).length} tasks scheduled</p><button className="db-btn db-btn-primary" onClick={()=>newTask(period==="day"?anchor:selectedDay)}><Plus size={16}/> Add task</button><div className="db-aside-tasks">{(period==="day"?sorted(byDate.get(anchor)??[]):selectedTasks).map(t=><TaskTile key={t.id} task={t} subject={subjectMap.get(t.subject_id??"")} edit={()=>openTask(t)}/>)}{(period==="day"?byDate.get(anchor)??[]:selectedTasks).length===0&&<p className="db-empty">Nothing scheduled here yet.</p>}</div></aside></div>}
        <footer className="db-footer">YOLO · Tasks and calendar share one database · Local development edition</footer>
      </main>
    </div>
    {!loading && view !== "dashboard" && view !== "pomodoro" && <PomodoroQuickControls floating openFull={() => setView("pomodoro")}/>}
    {showDashboardCustomize && <DashboardCustomizeModal widgets={dashboardWidgets} setWidgets={setDashboardWidgets} onClose={() => setShowDashboardCustomize(false)}/>}
    {subjectDraft && <SubjectModal initial={subjectDraft} busy={busy} error={modalError} save={saveSubject} close={()=>setSubjectDraft(null)}/>}
    {detailTask && !taskDraft && <TaskDetailsModal task={detailTask} subject={subjectMap.get(detailTask.subject_id ?? "")} close={() => setDetailTaskId(null)} edit={() => editTask(detailTask)} removeTask={() => void deleteTask(detailTask)} />}
    {taskDraft && <TaskModal initial={taskDraft} subjects={subjects} busy={busy} error={modalError} save={saveTask} close={()=>setTaskDraft(null)}/>}
  </div>;
}
