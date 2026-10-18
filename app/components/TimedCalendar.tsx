"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { Flag, Clock3 } from "lucide-react";

type TimedTask = {
  id: string; title: string; status: string; subject_id: string | null;
  due_date: string | null; due_time: string | null;
  schedule_type: "deadline" | "duration" | "none";
  end_date: string | null; end_time: string | null;
};
type TimedSubject = { id: string; name: string; code: string | null; color: string };
type CalendarSegment = {task: TimedTask; start: number; end: number; continued: boolean; lane: number; laneCount: number};

const HOUR_HEIGHT = 66;
const TOTAL_HEIGHT = 24 * HOUR_HEIGHT;
const WEEKDAYS = ["Suckday", "Moanday", "Tongueday", "Wetday", "Thirstday", "Freakday", "Sexday"];
const pad = (n: number) => String(n).padStart(2, "0");
const fromISO = (d: string) => {const [y,m,day] = d.split("-").map(Number);return new Date(y,m-1,day);};
const minutes = (value: string) => Number(value.slice(0,2)) * 60 + Number(value.slice(3,5));
function clockLabel(hour: number) { return `${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`; }
function timeLabel(value: string) {const m=minutes(value);return `${Math.floor(m/60)%12||12}:${pad(m%60)} ${m<720?"AM":"PM"}`;}

function subjectStyle(subject?: TimedSubject): CSSProperties {
  const color = subject?.color;
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return {};
  const rgb = [1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
  const lin=rgb.map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  const luminance=lin[0]*0.2126+lin[1]*0.7152+lin[2]*0.0722;
  const ink=(luminance+0.05)/0.07>=1.05/(luminance+0.05)?"#1e283f":"#ffffff";
  return {backgroundColor:color,color:ink,borderLeftColor:color};
}

/** Create daily slices for timed events, including overnight/multi-day tasks. */
function segmentsOnDay(day: string, tasks: TimedTask[]): CalendarSegment[] {
  const entries: CalendarSegment[] = [];
  for (const task of tasks) {
    if (task.schedule_type === "duration" && task.due_date && task.due_time && task.end_date && task.end_time) {
      if (day < task.due_date || day > task.end_date) continue;
      const start = day === task.due_date ? minutes(task.due_time) : 0;
      const end = day === task.end_date ? minutes(task.end_time) : 1440;
      if (Number.isFinite(start) && Number.isFinite(end) && end > start)
        entries.push({task,start,end,continued:day!==task.due_date,lane:0,laneCount:1});
    } else if (task.schedule_type === "deadline" && task.due_date === day && task.due_time) {
      const start = minutes(task.due_time);
      if (Number.isFinite(start) && start < 1440)
        entries.push({task,start,end:Math.min(1440,start+30),continued:false,lane:0,laneCount:1});
    }
  }
  entries.sort((a,b)=>a.start-b.start||b.end-a.end);

  // Position overlapping entries in adjacent lanes instead of stacking on top.
  let group: CalendarSegment[] = [];
  let groupEnd = -1;
  const finishGroup = () => {
    if (!group.length) return;
    const laneEnds: number[]=[];
    for (const entry of group) {
      let lane=laneEnds.findIndex(end=>end<=entry.start);
      if (lane<0) {lane=laneEnds.length;laneEnds.push(entry.end);}
      else laneEnds[lane]=entry.end;
      entry.lane=lane;
    }
    for (const entry of group) entry.laneCount=laneEnds.length;
    group=[];
  };
  for (const entry of entries) {
    if (group.length && entry.start>=groupEnd) finishGroup();
    group.push(entry);
    groupEnd=Math.max(groupEnd,entry.end);
  }
  finishGroup();
  return entries;
}

function displayedRange(segment:CalendarSegment, date:string) {
  if (segment.task.schedule_type === "deadline") return `Due ${timeLabel(segment.task.due_time??"00:00")}`;
  const start=segment.continued?"12:00 AM":timeLabel(segment.task.due_time??"00:00");
  const end=segment.task.end_date===date?timeLabel(segment.task.end_time??"00:00"):"12:00 AM +1";
  return `${start} – ${end}`;
}

export default function TimedCalendar({dates,tasks,subjects,selectedDay,onDaySelect,onEdit,onNew}: {
  dates:string[];tasks:TimedTask[];subjects:TimedSubject[];selectedDay:string;
  onDaySelect:(date:string)=>void;onEdit:(task:TimedTask)=>void;onNew:(date:string)=>void;
}) {
  const viewport=useRef<HTMLDivElement>(null);
  const subjectMap=useMemo(()=>new Map(subjects.map(s=>[s.id,s])),[subjects]);
  const dateKey=dates.join("|");
  const entriesByDay=useMemo(()=>new Map(dates.map(date=>[date,segmentsOnDay(date,tasks)])),[dateKey,dates,tasks]);
  useEffect(()=>{
    // Keep all 24 hours accessible while opening near morning on a new day/week.
    if (viewport.current) viewport.current.scrollTop=HOUR_HEIGHT*7;
  },[dateKey]);
  const wide=dates.length===7;
  return <div className="db54-shell db-v66-calendar-shell">
    <div className="db54-caption"><Clock3 size={16}/> Weekly planner · Scroll for all 24 hours <span>Color = subject · Flag = due date · Block = scheduled task</span></div>
    <div className="db54-viewport" ref={viewport}>
      <div className={`db54-inner ${wide?"db54-week":"db54-one-day"}`}>
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
              <button type="button" key={t.id} className={`db54-allday-pill db-v66-all-day-event ${t.status==="done"?"db-v66-calendar-done":""}`}
                title={`Deadline · ${t.title}`} aria-label={`Open deadline: ${t.title}`} onClick={()=>onEdit(t)} style={subjectStyle(subjectMap.get(t.subject_id??""))}>
                <Flag size={12}/><span>{t.title}</span>
              </button>
            )}
          </div>)}
        </div>
        <div className="db54-body">
          <div className="db54-times" style={{height:TOTAL_HEIGHT}}>
            {Array.from({length:25},(_,h)=><span key={h} className="db54-hour-label" style={{top:Math.min(h*HOUR_HEIGHT,TOTAL_HEIGHT-18)}}>{clockLabel(h%24)}{h===24?" +1":""}</span>)}
          </div>
          <div className="db54-day-columns">
            {dates.map(date=>{
              const entries=entriesByDay.get(date)??[];
              return <div key={date} className={`db54-column ${selectedDay===date?"db54-column-selected":""}`} style={{height:TOTAL_HEIGHT}}>
                {Array.from({length:24},(_,h)=><button type="button" key={h} className="db54-hour-slot" style={{top:h*HOUR_HEIGHT,height:HOUR_HEIGHT}}
                  title={`Add task on ${date} at ${clockLabel(h)}`} aria-label={`Add task for ${date} at ${clockLabel(h)}`} onClick={()=>{onDaySelect(date);onNew(date);}}/>)}
                {entries.map(segment=>{
                  const {task,start,end,continued,lane,laneCount}=segment;
                  const subject=subjectMap.get(task.subject_id??"");
                  const duration=task.schedule_type==="duration";
                  const minHeight=duration?23:28;
                  const top=Math.min(start/60*HOUR_HEIGHT,TOTAL_HEIGHT-minHeight);
                  const height=Math.min(Math.max(minHeight,(end-start)/60*HOUR_HEIGHT),TOTAL_HEIGHT-top);
                  const width=100/laneCount;
                  const laneStyle={...subjectStyle(subject),top,height,left:`calc(${lane*width}% + 3px)`,width:`calc(${width}% - 6px)`};
                  return <button type="button" key={`${task.id}:${date}`} onClick={()=>onEdit(task)}
                    aria-label={`Open ${duration?"scheduled task":"deadline"}: ${task.title}, ${displayedRange(segment,date)}`}
                    title={`${task.title} · ${displayedRange(segment,date)}${subject?` · ${subject.name}`:""}`}
                    className={`db54-time-event db-v66-calendar-event ${duration?"db54-event-duration":"db54-event-deadline"} ${task.status==="done"?"db54-done db-v66-calendar-done":""}`}
                    style={laneStyle}>
                    <span className="db54-event-title">{duration?<Clock3 size={13}/>:<Flag size={13}/>}<strong>{task.title}</strong></span>
                    {height>=42&&<span className="db54-event-info">{continued?"Continued · ":""}{displayedRange(segment,date)}</span>}
                    {duration&&height>74&&subject&&<span className="db54-event-info">{subject.code||subject.name}</span>}
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
