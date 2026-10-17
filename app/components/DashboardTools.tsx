"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowRight, ArrowUp, CalendarRange, Check, Clock3,
  Eye, EyeOff, GripVertical, RotateCcw, X,
} from "lucide-react";

export type DashboardWidgetId =
  | "hero"
  | "stats"
  | "classes"
  | "spotify"
  | "pomodoro"
  | "focus"
  | "progress"
  | "deadlines"
  | "board"
  | "overdue";

export type DashboardWidgetSetting = {
  id: DashboardWidgetId;
  visible: boolean;
};

const WIDGET_LABELS: Record<DashboardWidgetId, { title: string; hint: string }> = {
  hero: { title: "Welcome & daily goal", hint: "Greeting and quick task shortcuts" },
  stats: { title: "Task overview", hint: "Remaining, To Do, In Progress, Completed" },
  classes: { title: "Today's classes", hint: "Today's timetable and rooms, using subject colors" },
  spotify: { title: "Spotify playlists", hint: "Saved playlists and a persistent floating vinyl player" },
  pomodoro: { title: "Mini Pomodoro", hint: "Quick controls connected to your main focus timer" },
  focus: { title: "Focus list", hint: "Your highest-priority unfinished tasks" },
  progress: { title: "Today's progress", hint: "Daily completion progress and percentages" },
  deadlines: { title: "Upcoming deadlines", hint: "Unfinished tasks with approaching due dates" },
  board: { title: "Active task board", hint: "To Do and In Progress preview" },
  overdue: { title: "Reschedule overdue tasks", hint: "Appears when an unfinished task is overdue" },
};

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetSetting[] = [
  { id: "hero", visible: true },
  { id: "stats", visible: true },
  { id: "classes", visible: true },
  { id: "spotify", visible: true },
  { id: "pomodoro", visible: true },
  { id: "focus", visible: true },
  { id: "progress", visible: true },
  { id: "deadlines", visible: true },
  { id: "board", visible: true },
  { id: "overdue", visible: true },
];

// Merge saved user settings with the known widget IDs. Avoid dropping a widget
// after future upgrades, and reject unexpected or malformed localStorage data.
export function normalizeDashboardWidgets(value: unknown): DashboardWidgetSetting[] {
  if (!Array.isArray(value)) return DEFAULT_DASHBOARD_WIDGETS.map(x => ({ ...x }));
  const known = new Set<DashboardWidgetId>(DEFAULT_DASHBOARD_WIDGETS.map(x => x.id));
  const seen = new Set<DashboardWidgetId>();
  const result: DashboardWidgetSetting[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const id: unknown = (item as { id?: unknown }).id;
    if (typeof id !== "string" || !known.has(id as DashboardWidgetId) || seen.has(id as DashboardWidgetId)) continue;
    seen.add(id as DashboardWidgetId);
    result.push({ id: id as DashboardWidgetId, visible: (item as { visible?: unknown }).visible !== false });
  }
  for (const defaultWidget of DEFAULT_DASHBOARD_WIDGETS) {
    if (seen.has(defaultWidget.id)) continue;
    // Place new music/focus widgets together when migrating older saved layouts.
    if (defaultWidget.id === "spotify") {
      const classesIndex = result.findIndex(item => item.id === "classes");
      result.splice(classesIndex >= 0 ? classesIndex + 1 : result.length, 0, { ...defaultWidget });
    } else if (defaultWidget.id === "pomodoro") {
      const spotifyIndex = result.findIndex(item => item.id === "spotify");
      result.splice(spotifyIndex >= 0 ? spotifyIndex + 1 : result.length, 0, { ...defaultWidget });
    } else {
      result.push({ ...defaultWidget });
    }
  }
  return result;
}

export function DashboardCustomizeModal({
  widgets,
  setWidgets,
  onClose,
}: {
  widgets: DashboardWidgetSetting[];
  setWidgets: (next: DashboardWidgetSetting[]) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= widgets.length) return;
    const next = widgets.map(widget => ({ ...widget }));
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setWidgets(next);
  }

  function toggle(id: DashboardWidgetId) {
    setWidgets(widgets.map(item => item.id === id ? { ...item, visible: !item.visible } : item));
  }

  return <div className="db-overlay" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
    <div className="db-dialog db-v52-customizer" role="dialog" aria-modal="true" aria-labelledby="yolo-layout-title">
      <div className="db-dialog-head">
        <div><h2 id="yolo-layout-title">Customize dashboard</h2><p>Choose which widgets appear and their display order.</p></div>
        <button type="button" onClick={onClose} aria-label="Close dashboard customization"><X size={21}/></button>
      </div>
      <div className="db-v52-layout-list">
        {widgets.map((widget, index) => <div className="db-v52-layout-row" key={widget.id}>
          <GripVertical size={17} aria-hidden="true" className="db-v52-grip"/>
          <div className="db-v52-layout-name">
            <strong>{WIDGET_LABELS[widget.id].title}</strong>
            <small>{WIDGET_LABELS[widget.id].hint}</small>
          </div>
          <button type="button" className={`db-v52-visibility ${widget.visible ? "active" : ""}`} onClick={() => toggle(widget.id)}
            aria-label={`${widget.visible ? "Hide" : "Show"} ${WIDGET_LABELS[widget.id].title}`} aria-pressed={widget.visible} title={widget.visible ? "Hide widget" : "Show widget"}>
            {widget.visible ? <Eye size={17}/> : <EyeOff size={17}/>}<span>{widget.visible ? "Shown" : "Hidden"}</span>
          </button>
          <div className="db-v52-move-actions">
            <button type="button" onClick={() => move(index,-1)} disabled={index === 0} title="Move widget up" aria-label={`Move ${WIDGET_LABELS[widget.id].title} up`}><ArrowUp size={16}/></button>
            <button type="button" onClick={() => move(index,1)} disabled={index === widgets.length - 1} title="Move widget down" aria-label={`Move ${WIDGET_LABELS[widget.id].title} down`}><ArrowDown size={16}/></button>
          </div>
        </div>)}
      </div>
      <div className="db-v52-layout-footer">
        <button type="button" className="db-btn db-btn-outline" onClick={() => setWidgets(DEFAULT_DASHBOARD_WIDGETS.map(x => ({ ...x })))}><RotateCcw size={16}/> Reset layout</button>
        <button type="button" className="db-btn db-btn-primary" onClick={onClose}><Check size={16}/> Done</button>
      </div>
      <p className="db-help db-v52-layout-help">Only your dashboard layout changes. Your tasks, class schedule, and other data stay intact. Layout is saved in this browser for this YOLO account.</p>
    </div>
  </div>;
}

type Meeting = {
  id: string;
  subject_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string;
};
type Subject = { id: string; name: string; code: string | null; color: string };

function minutes(value: string) {
  const [hours, mins] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + mins;
}
function formatTime(value: string) {
  const [hours, mins] = value.slice(0, 5).split(":").map(Number);
  return `${hours % 12 || 12}:${String(mins).padStart(2,"0")} ${hours >= 12 ? "PM" : "AM"}`;
}

export function TodayClassesWidget({
  subjects,
  weekday,
  currentMinute,
  openSchedule,
}: {
  subjects: Subject[];
  weekday: number | null;
  currentMinute: number | null;
  openSchedule: () => void;
}) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/class-meetings", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Unable to load today's classes.");
        if (!Array.isArray(result.meetings)) throw new Error("Unexpected class schedule response.");
        if (!controller.signal.aborted) setMeetings(result.meetings);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load classes.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  const subjectMap = useMemo(() => new Map(subjects.map(s => [s.id,s])), [subjects]);
  const todaysMeetings = useMemo(() => meetings.filter(m => m.weekday === weekday)
    .sort((a,b) => minutes(a.start_time) - minutes(b.start_time)), [meetings,weekday]);
  const nextClass = todaysMeetings.find(m => currentMinute === null || minutes(m.end_time) > currentMinute);
  const nextClassSubject = nextClass ? subjectMap.get(nextClass.subject_id) : undefined;

  return <section className="db-panel db-section db-v52-today-classes">
    <div className="db-section-heading">
      <div><span className="db-overline">YOUR CLASS TIMETABLE</span><h2>Today&apos;s classes</h2><p>Same subject colors, separate from your task calendar</p></div>
      <CalendarRange size={21}/>
    </div>
    {loading ? <p className="db-v52-classes-message" role="status"><Clock3 size={17}/> Loading classes…</p> :
      error ? <div className="db-v52-classes-message"><p role="alert">{error}</p><button type="button" className="db-text-link" onClick={() => setAttempt(n => n + 1)}>Try again <ArrowRight size={14}/></button></div> :
      weekday === null ? <p className="db-v52-classes-message">Loading today&apos;s date…</p> :
      todaysMeetings.length === 0 ? <div className="db-v52-classes-message"><p>No classes scheduled today.</p><span>Your timetable is still available in Class Schedule.</span></div> :
      <>
        {nextClass && <div className="db-v52-next-class" style={{ borderLeftColor: nextClassSubject?.color ?? "var(--db-second)" }}>
          <span>{currentMinute !== null && minutes(nextClass.start_time) <= currentMinute ? "HAPPENING NOW" : "UP NEXT"}</span>
          <strong>{nextClassSubject?.name ?? "Class"}</strong>
          <small>{formatTime(nextClass.start_time)} – {formatTime(nextClass.end_time)}{nextClass.room ? ` · ${nextClass.room}` : ""}</small>
        </div>}
        <div className="db-v52-class-list">
          {todaysMeetings.map(meeting => {
            const subject = subjectMap.get(meeting.subject_id);
            const ended = currentMinute !== null && minutes(meeting.end_time) <= currentMinute;
            const ongoing = currentMinute !== null && minutes(meeting.start_time) <= currentMinute && minutes(meeting.end_time) > currentMinute;
            return <div key={meeting.id} className={`db-v52-class-row ${ended ? "db-v52-class-ended" : ""}`}>
              <span className="db-v52-class-color" style={{backgroundColor:subject?.color??"var(--db-second)"}}/>
              <div className="db-v52-class-info">
                <strong>{subject?.name ?? "Unassigned class"}</strong>
                <small>{subject?.code || "No code"}{meeting.room ? ` · ${meeting.room}` : ""}</small>
              </div>
              <div className="db-v52-class-time"><strong>{formatTime(meeting.start_time)}</strong><small>to {formatTime(meeting.end_time)}</small>{ongoing && <span className="db-v52-class-live">Now</span>}</div>
            </div>;
          })}
        </div>
      </>}
    <button type="button" className="db-text-link db-v52-class-link" onClick={openSchedule}>Open Class Schedule <ArrowRight size={15}/></button>
  </section>;
}
