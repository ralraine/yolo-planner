"use client";
import { useEffect, useMemo, useState } from "react";
import { Archive, Bell, Check, Download, KeyRound, LoaderCircle, Search, ShieldCheck, X } from "lucide-react";

type SearchResult={type:"task"|"subject"|"class"|"journal";id:string;title:string;detail:string;date?:string};
type SearchType=SearchResult["type"];
export function GlobalSearch({onSelect}:{onSelect:(result:SearchResult)=>void}){
  const [open,setOpen]=useState(false),[q,setQ]=useState(""),[results,setResults]=useState<SearchResult[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState("");
  useEffect(()=>{const listener=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setOpen(v=>!v);}if(e.key==="Escape")setOpen(false);};document.addEventListener("keydown",listener);return()=>document.removeEventListener("keydown",listener);},[]);
  useEffect(()=>{if(!open)return;const controller=new AbortController();if(q.trim().length<2){setResults([]);setLoading(false);return()=>controller.abort();}
    const t=window.setTimeout(async()=>{setLoading(true);setError("");try{const r=await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`,{signal:controller.signal,cache:"no-store"});const data=await r.json();if(!r.ok)throw new Error(data.error||"Search failed");setResults(data.results??[]);}catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:"Search failed");}finally{if(!controller.signal.aborted)setLoading(false);}},260);
    return()=>{window.clearTimeout(t);controller.abort();};},[open,q]);
  const kind:Record<SearchType,string>={task:"Task",subject:"Subject",class:"Class",journal:"Journal"};
  return <><button className="db-icon-button" title="Search everything (Ctrl+K)" aria-label="Search everything" onClick={()=>setOpen(true)}><Search size={20}/></button>
  {open&&<div className="db-overlay db53-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}><section className="db53-dialog" role="dialog" aria-modal="true" aria-label="Global search"><div className="db53-search-head"><Search size={20}/><input autoFocus aria-label="Search tasks, classes, subjects and journal" placeholder="Search everything..." value={q} onChange={e=>setQ(e.target.value)}/><button aria-label="Close search" onClick={()=>setOpen(false)}><X size={19}/></button></div>
    <div className="db53-search-list" aria-live="polite">{loading?<p>Searching...</p>:error?<p role="alert">{error}</p>:q.trim().length<2?<p>Type at least 2 characters. Press Ctrl + K to open this anytime.</p>:results.length===0?<p>No matching records in the latest indexed items.</p>:results.map(r=><button key={r.type+r.id} type="button" onClick={()=>{onSelect(r);setOpen(false);setQ("");}}><span className="db53-type">{kind[r.type]}</span><span className="db53-result-text"><strong>{r.title}</strong><small>{r.detail}</small></span></button>)}
    </div><footer className="db53-modal-foot">Searches up to 500 recent records per category in your account.</footer></section></div>}</>;
}

type AlertTask={id:string;title:string;due_date:string|null;due_time:string|null;status:string;schedule_type?:"deadline"|"duration"|"none"};
type Meeting={id:string;subject_id:string;weekday:number;start_time:string;room:string};
type Subject={id:string;name:string};
function formatDay(d:Date){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
export function ReminderCenter({tasks,subjects,goToTasks,username}:{tasks:AlertTask[];subjects:Subject[];goToTasks:()=>void;username:string}){
  const [open,setOpen]=useState(false),[meetings,setMeetings]=useState<Meeting[]>([]),[notifications,setNotifications]=useState(false),[notice,setNotice]=useState("");
  const [now,setNow]=useState<number|null>(null);
  useEffect(()=>{setNow(Date.now());const id=window.setInterval(()=>setNow(Date.now()),30000);return()=>window.clearInterval(id);},[]);
  useEffect(()=>{let active=true;fetch("/api/class-meetings",{cache:"no-store"}).then(r=>r.json()).then(d=>{if(active)setMeetings(d.meetings??[]);}).catch(()=>{});return()=>{active=false;};},[]);
  useEffect(()=>{try{setNotifications(localStorage.getItem(`yolo:${username}:notifications`)==="yes");}catch{}},[username]);
  const info=useMemo(()=>{
    if(now===null)return {overdue:[] as AlertTask[],due:[] as AlertTask[],soon:[] as Meeting[],all:0};
    const date=new Date(now),today=formatDay(date),tomorrow=formatDay(new Date(date.getFullYear(),date.getMonth(),date.getDate()+1));
    const overdue=tasks.filter(t=>t.status!=="done"&&(!t.schedule_type||t.schedule_type==="deadline")&&t.due_date&&t.due_date<today);
    const due=tasks.filter(t=>t.status!=="done"&&(t.due_date===today||t.due_date===tomorrow));
    const minute=date.getHours()*60+date.getMinutes();
    const soon=meetings.filter(m=>m.weekday===date.getDay()&&((Number(m.start_time.slice(0,2))*60+Number(m.start_time.slice(3,5)))-minute)>=0&&((Number(m.start_time.slice(0,2))*60+Number(m.start_time.slice(3,5)))-minute)<=30);
    return {overdue,due,soon,all:overdue.length+due.length+soon.length};
  },[now,tasks,meetings]);
  useEffect(()=>{if(!notifications||typeof Notification==="undefined"||Notification.permission!=="granted")return;
    if(now===null)return;
    const d=new Date(now),today=formatDay(d);
    const imminents=tasks.filter(t=>t.status!=="done"&&(!t.schedule_type||t.schedule_type==="deadline")&&t.due_date===today&&t.due_time).filter(t=>{
      const time=Number(t.due_time!.slice(0,2))*60+Number(t.due_time!.slice(3,5));const diff=time-d.getHours()*60-d.getMinutes();return diff>=0&&diff<=30;});
    const combined=[...imminents.map(t=>({key:`task:${t.id}:${today}`,title:"Task deadline approaching",body:t.title})),...info.soon.map(m=>({key:`class:${m.id}:${today}`,title:"Class starts soon",body:subjects.find(s=>s.id===m.subject_id)?.name||"Upcoming class"}))];
    for(const n of combined){const key=`yolo:${username}:alerted:${n.key}`;try{if(localStorage.getItem(key))continue;localStorage.setItem(key,"1");new Notification(n.title,{body:n.body});}catch{}}
  },[now,notifications,info.soon,tasks,subjects,username]);
  async function enable(){if(typeof Notification==="undefined"){setNotice("This browser does not support notifications.");return;}const p=await Notification.requestPermission();setNotifications(p==="granted");try{localStorage.setItem(`yolo:${username}:notifications`,p==="granted"?"yes":"no");}catch{}setNotice(p==="granted"?"Notifications are enabled while YOLO is open.":"Notifications were not enabled.");}
  function disable(){setNotifications(false);try{localStorage.setItem(`yolo:${username}:notifications`,"no");}catch{}setNotice("Browser alerts turned off for YOLO.");}
  return <div className="db53-relative"><button className="db-icon-button" aria-label="Reminders" title="Reminders" onClick={()=>setOpen(v=>!v)}><Bell size={20}/>{info.all>0&&<span className="db53-bell-count">{Math.min(info.all,99)}</span>}</button>
  {open&&<div className="db53-popover"><div className="db53-pop-title"><strong>Reminders</strong><button aria-label="Close reminders" onClick={()=>setOpen(false)}><X size={16}/></button></div>
  <div className="db53-alert-list"><h4>Overdue ({info.overdue.length})</h4>{info.overdue.map(t=><button key={t.id} onClick={()=>{goToTasks();setOpen(false);}}>{t.title} · {t.due_date}</button>)}<h4>Due today / tomorrow ({info.due.length})</h4>{info.due.map(t=><button key={t.id} onClick={()=>{goToTasks();setOpen(false);}}>{t.title} · {t.due_date}</button>)}<h4>Classes starting within 30 min ({info.soon.length})</h4>{info.soon.map(m=><p key={m.id}>{subjects.find(s=>s.id===m.subject_id)?.name??"Class"} · {m.start_time.slice(0,5)} · {m.room||"Room TBD"}</p>)}{!info.all&&<p>Nothing urgent right now.</p>}</div>
  <div className="db53-alert-controls"><button onClick={()=>void (notifications?disable():enable())}>{notifications?"Turn browser alerts off":"Enable browser alerts"}</button><small>{notice||"Alerts work only while YOLO is open. Permissions required."}</small></div></div>}</div>;
}

export function AccountTools({ embedded = false }: { embedded?: boolean }){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[code,setCode]=useState(""),[error,setError]=useState("");
  async function createCode(){
    if(!window.confirm("Generate a new recovery code? This replaces any previous code. Save the new code offline."))return;
    setBusy(true);setError("");setCode("");
    try{const r=await fetch("/api/account/recovery-code",{method:"POST"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Failed to create code.");setCode(d.code);}
    catch(e){setError(e instanceof Error?e.message:"Could not generate code.");}finally{setBusy(false);}
  }
  async function exportData(){
    setBusy(true);setError("");
    try{const r=await fetch("/api/account/export",{cache:"no-store"});if(!r.ok){const d=await r.json();throw new Error(d.error||"Backup failed");}const b=await r.blob();const url=URL.createObjectURL(b);const a=document.createElement("a");a.href=url;a.download=`YOLO-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
    catch(e){setError(e instanceof Error?e.message:"Backup failed");}finally{setBusy(false);}
  }
  const content = <>
    <div className="db53-tool"><h3><Archive size={18}/> Export account data</h3><p>Download tasks, subjects, schedules, journal, and focus history as JSON. Attachment metadata is included, but file contents are not. There is no import/restore feature yet.</p><button type="button" className="db-btn db-btn-primary" disabled={busy} onClick={()=>void exportData()}><Download size={16}/> Export JSON backup</button></div>
    <div className="db53-tool"><h3><KeyRound size={18}/> Emergency recovery code</h3><p>Generate a one-time code for PIN recovery. Save it offline. Every new code replaces your previous code—never share it with anyone.</p><button type="button" className="db-btn db-btn-outline" disabled={busy} onClick={()=>void createCode()}>{busy?<LoaderCircle size={15} className="animate-spin"/>:<KeyRound size={15}/>} Generate recovery code</button>{code&&<div className="db53-code"><strong>Save this once:</strong><code>{code}</code><button type="button" onClick={()=>void navigator.clipboard?.writeText(code)}>Copy recovery code</button></div>}</div>
    {error&&<p role="alert" className="db-error">{error}</p>}
    <p className="db-help">Security note: PIN-only authentication is for local development. Do not deploy YOLO publicly without stronger authentication and protections.</p>
  </>;
  if (embedded) return <section className="db-panel db-v55-settings-card"><div className="db-v55-settings-heading"><div><span className="db-overline">ACCOUNT & DATA</span><h2><ShieldCheck size={21}/> Account safety & backup</h2><p>Recovery options and your account export, all in one place.</p></div></div>{content}</section>;
  return <><button type="button" className="db-icon-button" aria-label="Account backup and recovery" title="Account backup and recovery" onClick={()=>setOpen(true)}><ShieldCheck size={20}/></button>
    {open&&<div className="db-overlay db53-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}><section className="db53-dialog" role="dialog" aria-modal="true" aria-label="Account safety"><div className="db53-modal-title"><div><h2>Account safety & backup</h2></div><button aria-label="Close" onClick={()=>{setOpen(false);setCode("");}}><X size={20}/></button></div>{content}</section></div>}
  </>;
}
