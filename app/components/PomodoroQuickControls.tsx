"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, BarChart3, Clock3, FlagTriangleRight, Pause, Play, RotateCcw, Timer, Trophy } from "lucide-react";

type FocusSession = { id: string; focus_minutes: number; completed_at: string };

type TimerStatus = {
  phase: "focus" | "break"; remaining: number; running: boolean;
  hydrated: boolean; focusMin: number; breakMin: number;
  engaged: boolean; lapFinished: boolean;
};
const DEFAULT: TimerStatus = {
  phase: "focus", remaining: 1500, running: false, hydrated: false,
  focusMin: 25, breakMin: 5, engaged: false, lapFinished: false,
};

function RaceCar({ racing }: { racing: boolean }) {
  return <svg width="76" height="36" viewBox="0 0 116 54" fill="none" role="img" aria-label="Single-seater racing car illustration" className={racing ? "yolo58-car-running" : ""}>
    <rect x="10" y="4" width="18" height="15" rx="4" fill="#242a3b"/>
    <rect x="10" y="35" width="18" height="15" rx="4" fill="#242a3b"/>
    <rect x="77" y="4" width="18" height="15" rx="4" fill="#242a3b"/>
    <rect x="77" y="35" width="18" height="15" rx="4" fill="#242a3b"/>
    <path d="M4 9L13 9L22 14H74L99 22L108 27L99 32L74 40H22L13 45H4V9Z" fill="#db83b5" stroke="#97598d" strokeWidth="2" />
    <path d="M37 18H70L89 27L70 36H37L29 27L37 18Z" fill="#ffe4f3" opacity=".88" />
    <ellipse cx="51" cy="27" rx="17" ry="10" fill="#27344e" />
    <path d="M55 18L68 23V31L55 36Z" fill="#91b9ee" />
    <path d="M17 7V47" stroke="#ffe4f3" strokeWidth="5" strokeLinecap="round" />
    <path d="M99 18V36" stroke="#2a3048" strokeWidth="5" strokeLinecap="round" />
    <circle cx="47" cy="27" r="4" fill="#f2a3cc" />
  </svg>;
}

export default function PomodoroQuickControls({ floating = false, openFull }: { floating?: boolean; openFull: () => void }) {
  const [status, setStatus] = useState<TimerStatus>(DEFAULT);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [statsLoading, setStatsLoading] = useState(!floating);
  const [statsError, setStatsError] = useState(false);
  useEffect(() => {
    const receive = (event: Event) => {
      const data = (event as CustomEvent<TimerStatus>).detail;
      if (data && typeof data.remaining === "number") setStatus(data);
    };
    window.addEventListener("yolo57:pomodoro:status", receive);
    window.dispatchEvent(new Event("yolo57:pomodoro:request"));
    return () => window.removeEventListener("yolo57:pomodoro:status", receive);
  }, []);

  // Dashboard-only insights use the same persisted focus records as the
  // Pomodoro tab. They never create another timer or write to the database.
  useEffect(() => {
    if (floating) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/focus-sessions", {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not load focus history.");
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("sessions" in data)) {
          throw new Error("Unexpected focus history response.");
        }
        const raw = (data as { sessions?: unknown }).sessions;
        const clean: FocusSession[] = Array.isArray(raw) ? raw.filter((entry): entry is FocusSession =>
          entry !== null && typeof entry === "object" &&
          typeof entry.id === "string" &&
          typeof entry.focus_minutes === "number" &&
          Number.isFinite(entry.focus_minutes) &&
          typeof entry.completed_at === "string"
        ) : [];
        if (!controller.signal.aborted) { setSessions(clean); setStatsError(false); }
      } catch {
        if (!controller.signal.aborted) setStatsError(true);
      } finally {
        if (!controller.signal.aborted) setStatsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [floating, status.lapFinished]);

  // A paused session stays on-screen so users can resume. Reset/finish closes it.
  if (floating && (!status.hydrated || !status.engaged)) return null;

  const command = (name: "toggle" | "reset") => window.dispatchEvent(new CustomEvent("yolo57:pomodoro:command", { detail: name }));
  const minutes = String(Math.floor(status.remaining / 60)).padStart(2, "0");
  const seconds = String(status.remaining % 60).padStart(2, "0");
  const totalSeconds = status.phase === "focus" ? status.focusMin * 60 : status.breakMin * 60;
  const progress = status.lapFinished ? 100 : Math.max(0, Math.min(100, (1 - status.remaining / Math.max(1, totalSeconds)) * 100));
  const raceLabel = status.lapFinished ? "Finish line crossed!" : status.phase === "break" ? "Pit stop · recharge" : status.running ? "Racing toward your goal" : status.engaged ? "Race paused" : "Ready on the starting grid";

  const today = new Date();
  const todayKey = today.toDateString();
  const todaySessions = sessions.filter(session => new Date(session.completed_at).toDateString() === todayKey);
  const todayMinutes = todaySessions.reduce((sum, session) => sum + session.focus_minutes, 0);
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - i));
    const minutes = sessions.filter(session => new Date(session.completed_at).toDateString() === day.toDateString())
      .reduce((sum, session) => sum + session.focus_minutes, 0);
    return { label: day.toLocaleDateString("en-US", { weekday: "short" }), minutes };
  });
  const weekMinutes = week.reduce((sum, day) => sum + day.minutes, 0);
  const peak = Math.max(1, ...week.map(day => day.minutes));

  return <section className={floating ? "yolo57-mini-pomodoro yolo57-mini-floating yolo58-race-floating" : "db-panel yolo57-mini-pomodoro yolo57-mini-dashboard yolo58-race-dashboard"} aria-label="Pomodoro race timer">
    <div className="yolo57-timer-copy"><div><Timer size={19}/><strong>{status.phase === "focus" ? "Focus Grand Prix" : "Pit Stop Break"}</strong></div><span>{status.focusMin}/{status.breakMin} preset</span></div>
    {!floating && <p className="yolo58-race-subtitle">Your very own focus race. Finish the lap by finishing your session.</p>}
    <div className="yolo57-timer-row"><div className="yolo58-timer-display"><strong className="yolo57-timer-time" aria-label={`${minutes} minutes and ${seconds} seconds remaining`}>{minutes}:{seconds}</strong><span className="yolo58-race-label" aria-live="polite">{raceLabel}</span></div><div className="yolo57-mini-actions">
      <button type="button" onClick={() => command("toggle")} disabled={!status.hydrated} aria-label={status.running ? "Pause focus timer" : "Start or resume focus timer"} title={status.running ? "Pause timer" : "Start timer"}>{status.running ? <Pause size={18}/> : <Play size={18}/>}</button>
      <button type="button" onClick={() => command("reset")} disabled={!status.hydrated} aria-label="Reset timer" title="Reset timer"><RotateCcw size={17}/></button>
      <button type="button" onClick={openFull} title="Open full Pomodoro" aria-label="Open Pomodoro tab"><ArrowUpRight size={18}/></button>
    </div></div>
    <div className="yolo58-race-track" role="progressbar" aria-label="Pomodoro lap progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
      <div className="yolo58-track-lines"/>
      <span className="yolo58-race-start">START</span>
      <div className="yolo58-car-path"><div className={`yolo58-car ${status.running ? "is-racing" : ""}`} style={{ left: `${progress}%` }}><RaceCar racing={status.running}/></div></div>
      <div className="yolo58-finish"><FlagTriangleRight size={17}/><span>FINISH</span></div>
    </div>
    <div className="yolo58-progress-copy"><span>{Math.round(progress)}% complete</span><span>{status.phase === "focus" ? "Focus lap" : "Break lap"}</span></div>
    {!floating && <div className="yolo59-pit-wall" aria-label="Focus session insights">
      <div className="yolo59-insights-heading">
        <span><BarChart3 size={17}/> PIT WALL · YOUR FOCUS STATS</span>
        <button type="button" onClick={openFull}>Full Pomodoro <ArrowUpRight size={14}/></button>
      </div>
      {statsLoading ? <p className="yolo59-stats-feedback" role="status">Loading your study history…</p>
      : statsError ? <p className="yolo59-stats-feedback" role="status">Focus history is unavailable. Your timer still works.</p>
      : <>
        <div className="yolo59-stats-grid">
          <div className="yolo59-stat"><Clock3 size={17}/><strong>{todayMinutes}<small> min</small></strong><span>Focused today</span></div>
          <div className="yolo59-stat"><Trophy size={17}/><strong>{todaySessions.length}</strong><span>Laps finished today</span></div>
          <div className="yolo59-stat"><BarChart3 size={17}/><strong>{weekMinutes}<small> min</small></strong><span>Last 7 days</span></div>
        </div>
        <div className="yolo59-chart-head"><strong>Study time · last 7 days</strong><span>{weekMinutes ? `${weekMinutes} minutes` : "Your first lap starts here"}</span></div>
        <div className="yolo59-week-chart" role="img" aria-label={`Last 7 days of completed Pomodoro focus: ${week.map(day => `${day.label} ${day.minutes} minutes`).join(", ")}`}>
          {week.map((day, i) => <div className="yolo59-chart-col" key={i}>
            <div className="yolo59-chart-bar-slot"><span style={{height: `${day.minutes === 0 ? 3 : Math.max(7, day.minutes / peak * 100)}%`}}/></div>
            <small>{day.label}</small>
          </div>)}
        </div>
      </>}
      <p className="yolo59-chart-note">Complete a focus session to add a lap to your history. Skipped sessions don't count.</p>
    </div>}
    {!status.hydrated && <span className="yolo57-timer-loading">Connecting to focus timer…</span>}
  </section>;
}
