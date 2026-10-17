"use client";
import { useEffect, useRef, useState } from "react";
import { Clock3, Pause, Play, RotateCcw, SkipForward, Timer, CheckCircle2 } from "lucide-react";
type Task={id:string;title:string;status:string};
type Session={id:string;focus_minutes:number;completed_at:string;task_id:string|null};
type Phase="focus"|"break";
const PRESETS=[{label:"25 / 5",focus:25,break:5},{label:"50 / 10",focus:50,break:10},{label:"90 / 15",focus:90,break:15}];
export default function PomodoroPanel({tasks,username}:{tasks:Task[];username:string}){
  const [focusMin,setFocusMin]=useState(25),[breakMin,setBreakMin]=useState(5);
  const [phase,setPhase]=useState<Phase>("focus");
  const [remaining,setRemaining]=useState(25*60);
  const [target,setTarget]=useState<number|null>(null);
  const [taskId,setTaskId]=useState("");
  const [sessions,setSessions]=useState<Session[]>([]);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const processing=useRef(false);
  const sessionKey=useRef("");
  const [hydrated,setHydrated]=useState(false);
  const [engaged,setEngaged]=useState(false);
  const [lapFinished,setLapFinished]=useState(false);
  useEffect(()=>{
    const storageKey=`yolo:${username}:pomodoro-v53`;
    try {
      const raw=localStorage.getItem(storageKey);
      if(raw){
        const v=JSON.parse(raw);
        const f=Number(v.focusMin),b=Number(v.breakMin),r=Number(v.remaining);
        if(Number.isInteger(f)&&f>=1&&f<=240)setFocusMin(f);
        if(Number.isInteger(b)&&b>=1&&b<=60)setBreakMin(b);
        if(v.phase==="focus"||v.phase==="break")setPhase(v.phase);
        if(Number.isFinite(r)&&r>=0&&r<=240*60)setRemaining(r);
        if(typeof v.target==="number"&&Number.isFinite(v.target)&&v.target>Date.now()-86400000&&v.target<Date.now()+86400000)setTarget(v.target);
        if(typeof v.taskId==="string")setTaskId(v.taskId);
        if(typeof v.engaged==="boolean")setEngaged(v.engaged);
        else if(typeof v.target==="number"&&v.target>Date.now())setEngaged(true);
        if(typeof v.lapFinished==="boolean")setLapFinished(v.lapFinished);
        if(typeof v.sessionKey==="string"&&/^[0-9a-f-]{36}$/i.test(v.sessionKey))sessionKey.current=v.sessionKey;
      }
    }catch{}
    if(!sessionKey.current)sessionKey.current=crypto.randomUUID();
    setHydrated(true);
  },[username]);
  useEffect(()=>{
    if(!hydrated)return;
    try {localStorage.setItem(`yolo:${username}:pomodoro-v53`,JSON.stringify({focusMin,breakMin,phase,remaining,target,taskId,engaged,lapFinished,sessionKey:sessionKey.current}));}catch{}
  },[username,hydrated,focusMin,breakMin,phase,remaining,target,taskId,engaged,lapFinished]);
  useEffect(()=>{let live=true;
    fetch("/api/focus-sessions",{cache:"no-store"}).then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error??"Could not load sessions.");return x;})
      .then(x=>{if(live)setSessions(x.sessions??[]);}).catch(e=>{if(live)setError(e instanceof Error?e.message:"Could not load sessions.");});
    return()=>{live=false;};
  },[username]);
  useEffect(()=>{
    if(!hydrated||target===null)return;
    const tick=()=>{
      const secs=Math.max(0,Math.ceil((target-Date.now())/1000));setRemaining(secs);
      if(secs>0||processing.current)return;
      processing.current=true;setTarget(null);
      if(phase==="focus"){
        setNotice("Finish line crossed! Focus complete — take your pit stop break.");
        setLapFinished(true);
        setEngaged(false);
        const completedKey = sessionKey.current;
        sessionKey.current = crypto.randomUUID();
        fetch("/api/focus-sessions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({focus_minutes:focusMin,task_id:taskId||null,session_key:completedKey})})
          .then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error??"Session was not saved.");setSessions(old=>[x.session,...old]);})
          .catch(e=>setError(e instanceof Error?e.message:"Focus session not saved."))
          .finally(()=>{processing.current=false;});
        setPhase("break");setRemaining(breakMin*60);
      }else{
        setNotice("Pit stop complete! Ready for your next race?");
        setEngaged(false);
        setPhase("focus");setRemaining(focusMin*60);processing.current=false;
      }
    };
    tick();const interval=window.setInterval(tick,500);
    return()=>window.clearInterval(interval);
  },[target,phase,focusMin,breakMin,taskId,hydrated]);
  const running=target!==null;
  function pause(){if(target!==null){setRemaining(Math.max(0,Math.ceil((target-Date.now())/1000)));setTarget(null);}}
  function resume(){setNotice("");setError("");if(!sessionKey.current)sessionKey.current=crypto.randomUUID();if(!processing.current&&remaining>0){setLapFinished(false);setEngaged(true);setTarget(Date.now()+remaining*1000);}}
  function reset(){setEngaged(false);setLapFinished(false);sessionKey.current=crypto.randomUUID();setTarget(null);setRemaining((phase==="focus"?focusMin:breakMin)*60);setNotice("");}
  function selectPreset(focus:number,br:number){setEngaged(false);setLapFinished(false);setTarget(null);setFocusMin(focus);setBreakMin(br);setPhase("focus");setRemaining(focus*60);setNotice("");}
  function updateMinutes(kind:Phase,value:number){setEngaged(false);setLapFinished(false);const v=Math.min(kind==="focus"?240:60,Math.max(1,value||1));setTarget(null);if(kind==="focus"){setFocusMin(v);if(phase==="focus")setRemaining(v*60);}else{setBreakMin(v);if(phase==="break")setRemaining(v*60);}}
  function skip(){setEngaged(false);setLapFinished(false);sessionKey.current=crypto.randomUUID();setTarget(null);const next=phase==="focus"?"break":"focus";setPhase(next);setRemaining((next==="focus"?focusMin:breakMin)*60);setNotice(phase==="focus"?"Focus skipped — not counted as completed.":"Break skipped.");}
  const minutes=Math.floor(remaining/60),seconds=remaining%60;
  const today=new Date().toDateString();
  const todaySessions=sessions.filter(s=>new Date(s.completed_at).toDateString()===today);
  const focusToday=todaySessions.reduce((n,s)=>n+s.focus_minutes,0);
  const totalMinutes=sessions.reduce((n,s)=>n+s.focus_minutes,0);
  const week=Array.from({length:7},(_,i)=>{
    const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(6-i));
    return {label:d.toLocaleDateString("en-US",{weekday:"short"}),mins:sessions.filter(x=>new Date(x.completed_at).toDateString()===d.toDateString()).reduce((a,x)=>a+x.focus_minutes,0)};
  });
  const weekMax=Math.max(30,...week.map(d=>d.mins));
  const weekTotal=week.reduce((a,d)=>a+d.mins,0);
  // V5.7: Broadcast the actual Pomodoro state to mini controls. This is NOT
  // a separate timer; only this component owns the countdown and saves sessions.
  useEffect(() => {
    if (!hydrated) return;
    const detail = { phase, remaining, running, hydrated, focusMin, breakMin, engaged, lapFinished };
    window.dispatchEvent(new CustomEvent("yolo57:pomodoro:status", { detail }));
    const request = () => window.dispatchEvent(new CustomEvent("yolo57:pomodoro:status", { detail }));
    const command = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === "toggle") { if (running) pause(); else resume(); }
      else if (action === "reset") reset();
    };
    window.addEventListener("yolo57:pomodoro:request", request);
    window.addEventListener("yolo57:pomodoro:command", command);
    return () => {
      window.removeEventListener("yolo57:pomodoro:request", request);
      window.removeEventListener("yolo57:pomodoro:command", command);
    };
  }, [phase, remaining, running, hydrated, focusMin, breakMin, engaged, lapFinished]);
  return <section className="db-v5-section">
    <div className="db-v5-heading"><div><span className="db-overline">TIME TO FOCUS</span><h2>Pomodoro</h2><p>Stay focused, take breaks, and celebrate the sessions you finish.</p></div><Timer size={25}/></div>
    <div className="db-v5-focus-layout">
      <div className="db-panel db-v5-timer-card">
        <div className="db-v5-presets">{PRESETS.map(p=><button key={p.label} type="button" className={focusMin===p.focus&&breakMin===p.break?"active":""} onClick={()=>selectPreset(p.focus,p.break)}>{p.label}</button>)}</div>
        <div className="db-v5-timer-disc"><span>{phase==="focus"?"FOCUS TIME":"BREAK TIME"}</span><strong aria-live="off">{String(minutes).padStart(2,"0")}:{String(seconds).padStart(2,"0")}</strong><small>{running?"Timer running":"Ready when you are"}</small></div>
        <div className="db-v5-timer-actions"><button className="db-btn db-btn-primary" onClick={running?pause:resume}>{running?<><Pause size={17}/> Pause</>:<><Play size={17}/> Start / Resume</>}</button><button className="db-btn db-btn-outline" onClick={reset}><RotateCcw size={16}/> Reset</button><button className="db-btn db-btn-outline" onClick={skip}><SkipForward size={16}/> Skip phase</button></div>
        {notice&&<p role="status" className="db-v5-message">{notice}</p>}{error&&<p role="alert" className="db-error">{error}</p>}
      </div>
      <div className="db-v5-side-stack">
        <div className="db-panel db-v5-smallpanel"><h3>Custom durations</h3><p className="db-help">Changing durations resets the current timer.</p>
          <div className="db-grid-two"><label><span className="db-field-label">Focus (minutes)</span><input type="number" className="db-input" min={1} max={240} value={focusMin} onChange={e=>updateMinutes("focus",Number(e.target.value))}/></label><label><span className="db-field-label">Break (minutes)</span><input type="number" className="db-input" min={1} max={60} value={breakMin} onChange={e=>updateMinutes("break",Number(e.target.value))}/></label></div>
          <label><span className="db-field-label">Focus on a task (optional)</span><select className="db-input" value={taskId} onChange={e=>setTaskId(e.target.value)}><option value="">General focus session</option>{tasks.filter(t=>t.status!=="done").map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
        </div>
        <div className="db-panel db-v5-smallpanel"><h3><Clock3 size={17}/> Focus statistics</h3><div className="db-v5-stats"><div><strong>{focusToday}</strong><span>Minutes today</span></div><div><strong>{todaySessions.length}</strong><span>Sessions today</span></div><div><strong>{totalMinutes}</strong><span>Minutes in recent history</span></div></div><p className="db-help"><CheckCircle2 size={15}/> Focus is recorded only when a timer finishes, not when skipped.</p></div>
      </div>
    </div>
    <section className="db-panel db-v5-smallpanel db53-history"><h3>Study time · Last 7 days</h3><p className="db-help">{weekTotal} total focused minutes. Sessions appear after a focus timer finishes.</p>
      <div className="db53-week-chart" role="img" aria-label={`Weekly focus: ${week.map(d=>d.label+" "+d.mins+" minutes").join(", ")}`}>
      {week.map((d,i)=><div key={i}><strong>{d.mins||""}</strong><span style={{height:`${Math.max(4,d.mins/weekMax*100)}%`}}/><small>{d.label}</small></div>)}</div>
      <h3>Recent sessions</h3>{sessions.slice(0,8).length ? <div className="db53-session-list">{sessions.slice(0,8).map(s=><div key={s.id}><span>{new Date(s.completed_at).toLocaleString()}</span><strong>{s.focus_minutes} min</strong></div>)}</div>:<p className="db-help">No completed focus sessions yet.</p>}
    </section>
  </section>;
}
