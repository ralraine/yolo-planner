"use client";

import { useEffect, useMemo, useRef } from "react";
import { Flag, Clock3 } from "lucide-react";

type TimedTask = {
  id: string; title: string; status: string; subject_id: string | null;
  due_date: string | null; due_time: string | null;
  schedule_type: "deadline" | "duration" | "none";
  end_date: string | null; end_time: string | null;
};
type TimedSubject = { id: string; name: string; code: string | null; color: string };
const HOUR_HEIGHT = 66;
const TOTAL_HEIGHT = 24 * HOUR_HEIGHT;
// Keep late-night deadlines readable instead of clipping them to the last minute.
const MIN_DEADLINE_HEIGHT = 52;
const BOTTOM_GAP = 6;
const WEEKDAYS = ["Suckday", "Moanday", "Tongueday", "Wetday", "Thirstday", "Freakday", "Sexday"];
const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (d: string) => {const [y,m,day]=d.split("-").map(Number);return new Date(y,m-1,day);};
const minutes = (value: string) => Number(value.slice(0, 2))*60 + Number(value.slice(3, 5));
function clockLabel(hour: number) { return `${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`; }
function timeLabel(v: string) {const m=minutes(v);return `${Math.floor(m/60)%12||12}:${pad(m%60)} ${m<720?"AM":"PM"}`;}
function segmentsOnDay(day: string, tasks: TimedTask[]) {
  const pieces: { task: TimedTask; start: number; end: number; continued: boolean }[] = [];
  for (const task of tasks) {
    if (task.schedule_type === "duration" && task.due_date && task.due_time && task.end_date && task.end_time) {
      if (day < task.due_date || day > task.end_date) continue;
      const start = day === task.due_date ? minutes(task.due_time) : 0;
      const end = day === task.end_date ? minutes(task.end_time) : 1440;
      if (end > start) pieces.push({task, start, end, continued: day !== task.due_date});
    } else if (task.schedule_type === "deadline" && task.due_date === day && task.due_time) {
      const start = minutes(task.due_time);
      pieces.push({task, start, end: Math.min(1440, start+30), continued:false});
    }
  }
  return pieces.sort((a,b)=>a.start-b.start || b.end-a.end);
}

export default function TimedCalendar({dates,tasks,subjects,selectedDay,onDaySelect,onEdit,onNew}:{
  dates:string[];tasks:TimedTask[];subjects:TimedSubject[];selectedDay:string;
  onDaySelect:(date:string)=>void;onEdit:(task:TimedTask)=>void;onNew:(date:string)=>void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const subjectMap = useMemo(()=>new Map(subjects.map(s=>[s.id,s])),[subjects]);
  const dateKey = dates.join("|");
  useEffect(()=>{
    // The full midnight-to-midnight grid exists; initially scroll near the daytime hours.
    if (viewport.current) viewport.current.scrollTop = HOUR_HEIGHT * 7;
  },[dateKey]);
  const wide = dates.length === 7;
  return <div className="db54-shell">
    <div className="db54-caption"><Clock3 size={16}/> 12:00 AM → 12:00 AM next day · Scroll to see all 24 hours <span>Deadlines = flag · Duration = colored block</span></div>
    <div className="db54-viewport" ref={viewport}>
      <div className={`db54-inner ${wide ? "db54-week" : "db54-one-day"}`}>
        <div className="db54-head">
          <span className="db54-corner">TIME</span>
          {dates.map(date=>{
            const d=fromISO(date);
            return <button type="button" key={date} onClick={()=>onDaySelect(date)} className={`db54-head-day ${selectedDay===date?"is-selected":""}`}>
              <strong>{WEEKDAYS[d.getDay()]}</strong><span>{d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
            </button>;
          })}
        </div>
        <div className="db54-allday">
          <span className="db54-allday-label">NO TIME</span>
          {dates.map(date=><div key={date} className="db54-allday-cell">
            {tasks.filter(t=>t.schedule_type==="deadline"&&t.due_date===date&&!t.due_time).map(t=>
              <button type="button" key={t.id} className="db54-allday-pill" title={`Deadline · ${t.title}`} onClick={()=>onEdit(t)} style={{borderLeftColor:subjectMap.get(t.subject_id??"")?.color??"var(--db-accent)"}}><Flag size={12}/>{t.title}</button>
            )}
          </div>)}
        </div>
        <div className="db54-body">
          <div className="db54-times" style={{height:TOTAL_HEIGHT}}>
            {Array.from({length:25},(_,h)=><span key={h} className="db54-hour-label" style={{top:Math.min(h*HOUR_HEIGHT,TOTAL_HEIGHT-18)}}>{clockLabel(h%24)}{h===24?" +1":""}</span>)}
          </div>
          <div className="db54-day-columns">
            {dates.map(date=>{
              const entries=segmentsOnDay(date,tasks);
              return <div key={date} className={`db54-column ${selectedDay===date?"db54-column-selected":""}`} style={{height:TOTAL_HEIGHT}}>
                {Array.from({length:24},(_,h)=><button type="button" key={h} className="db54-hour-slot" style={{top:h*HOUR_HEIGHT,height:HOUR_HEIGHT}} title={`Add task on ${date} at ${clockLabel(h)}`} onClick={()=>{onDaySelect(date);onNew(date);}}/>)}
                {entries.map(({task,start,end,continued})=>{
                  const subject=subjectMap.get(task.subject_id??"");
                  const duration=task.schedule_type==="duration";
                  const exactTop = start / 60 * HOUR_HEIGHT;
                  // Deadlines are points in time, not duration blocks. Reserve enough
                  // room for their title and due-time label even at 11:59 PM.
                  const naturalHeight = (end - start) / 60 * HOUR_HEIGHT;
                  const eventHeight = duration
                    ? Math.min(Math.max(22, naturalHeight), TOTAL_HEIGHT - exactTop)
                    : MIN_DEADLINE_HEIGHT;
                  const visualTop = duration
                    ? exactTop
                    : Math.min(exactTop, TOTAL_HEIGHT - MIN_DEADLINE_HEIGHT - BOTTOM_GAP);
                  const color=subject?.color??"#9ab6e0";
                  return <button type="button" key={`${task.id}:${date}`} onClick={()=>onEdit(task)} title={`${task.title} · ${duration?"Duration":"Deadline"} · ${timeLabel(task.due_time??"00:00")}`} className={`db54-time-event ${duration?"db54-event-duration":"db54-event-deadline"} ${task.status==="done"?"db54-done":""}`}
                    style={{top:visualTop,height:eventHeight,borderLeftColor:color,backgroundColor:duration?`${color}35`:undefined}}>
                    <span className="db54-event-title">{duration?<Clock3 size={13}/>:<Flag size={13}/>}<strong>{task.title}</strong></span>
                    <span className="db54-event-info">{duration?(continued?"Continued · ":"")+timeLabel(task.due_time??"00:00")+(dayLabel(task,date)):`Due ${timeLabel(task.due_time??"00:00")}`}</span>
                    {duration&&eventHeight>65&&subject&&<span className="db54-event-info">{subject.code||subject.name}</span>}
                  </button>;
                })}
              </div>;
            })}
          </div>
        </div>
      </div>
    </div>
  </div>;
}
function dayLabel(t:TimedTask, day:string) {
  if (!t.end_time) return "";
  return ` – ${t.end_date===day?timeLabel(t.end_time):"12:00 AM (+1)"}`;
}
