"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BookHeart, ChevronLeft, ChevronRight, Save, Smile } from "lucide-react";
type Mood="great"|"good"|"neutral"|"low"|"rough";
type Entry={entry_date:string;title:string;content:string;mood:Mood;updated_at:string};
const MOODS:[Mood,string][]=[["great","Great"],["good","Good"],["neutral","Okay"],["low","Low"],["rough","Rough"]];
const pad=(n:number)=>String(n).padStart(2,"0");
const formatDate=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromDate=(text:string)=>{const [y,m,d]=text.split("-").map(Number);return new Date(y,m-1,d);};
const shift=(s:string,delta:number)=>{const d=fromDate(s);d.setDate(d.getDate()+delta);return formatDate(d);};
async function getEntry(date:string){const res=await fetch(`/api/journal?date=${encodeURIComponent(date)}`,{cache:"no-store"});const body=await res.json();if(!res.ok)throw new Error(body.error??"Unable to load journal.");return body.entry as Entry|null;}
async function putEntry(date:string,title:string,content:string,mood:Mood){const res=await fetch("/api/journal",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({date,title,content,mood})});const body=await res.json();if(!res.ok)throw new Error(body.error??"Unable to save journal.");return body.entry as Entry;}
export default function JournalPanel({username,initialDate}:{username:string;initialDate?:string}){
  const [date,setDate]=useState(()=>initialDate||formatDate(new Date()));
  const [historyQuery,setHistoryQuery]=useState("");
  const [history,setHistory]=useState<{date:string;title:string;mood:string;preview:string}[]>([]);
  const [historyError,setHistoryError]=useState("");
  const [title,setTitle]=useState(""),[content,setContent]=useState(""),[mood,setMood]=useState<Mood>("neutral");
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const [status,setStatus]=useState(""),[error,setError]=useState("");
  const [changed,setChanged]=useState(0);
  const lastRevision=useRef(0);
  const loadedDate=useRef("");
  useEffect(()=>{let live=true;setLoading(true);setError("");loadedDate.current="";
    getEntry(date).then(e=>{if(!live)return;setTitle(e?.title??"");setContent(e?.content??"");setMood(e?.mood??"neutral");setStatus(e?"Loaded saved entry":"New entry");loadedDate.current=date;setChanged(0);lastRevision.current=0;})
      .catch(e=>{if(live)setError(e instanceof Error?e.message:"Unable to load journal.");})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[date,username]);
  useEffect(()=>{const ctrl=new AbortController();const t=window.setTimeout(()=>{
    fetch(`/api/journal/history?q=${encodeURIComponent(historyQuery)}`,{cache:"no-store",signal:ctrl.signal})
      .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||"History unavailable");setHistory(data.entries??[]);setHistoryError("");})
      .catch(e=>{if(!ctrl.signal.aborted)setHistoryError(e instanceof Error?e.message:"History unavailable");});
  },230);return()=>{window.clearTimeout(t);ctrl.abort();};},[historyQuery,date,status]);
  // Debounced autosave, plus explicit save button. Leaving the date first saves any pending edits.
  useEffect(()=>{if(loading||!changed||loadedDate.current!==date)return;
    const revision=changed;
    const timer=window.setTimeout(()=>{
      setSaving(true);putEntry(date,title,content,mood).then(e=>{if(revision>=lastRevision.current){lastRevision.current=revision;setStatus("Saved automatically");}})
        .catch(e=>setError(e instanceof Error?e.message:"Autosave failed."))
        .finally(()=>setSaving(false));
    },1100);
    return()=>window.clearTimeout(timer);
  },[date,title,content,mood,changed,loading]);
  const edit=()=>{setChanged(n=>n+1);setStatus("Unsaved edits");setError("");};
  async function save(e?:FormEvent){e?.preventDefault();if(loading)return;
    setSaving(true);setError("");try{await putEntry(date,title,content,mood);lastRevision.current=changed;setStatus("Saved");}
    catch(e){setError(e instanceof Error?e.message:"Could not save journal.");}
    finally{setSaving(false);}
  }
  async function changeDate(next:string){if(!next||next===date)return;
    if(changed>lastRevision.current){setSaving(true);try{await putEntry(date,title,content,mood);}catch(e){setError("Save failed. Try again before changing days.");setSaving(false);return;}setSaving(false);}
    setDate(next);
  }
  return <section className="db-v5-section">
    <div className="db-v5-heading"><div><span className="db-overline">YOUR PRIVATE SPACE</span><h2>Daily Journal</h2><p>Reflect on your day. Separate from task notes and calendar events.</p></div><BookHeart size={25}/></div>
    <div className="db-panel db-v5-journal">
      <div className="db-v5-journal-nav"><button type="button" className="db-icon-button" aria-label="Previous day" onClick={()=>void changeDate(shift(date,-1))}><ChevronLeft size={18}/></button><input type="date" className="db-input" aria-label="Journal date" value={date} onChange={e=>void changeDate(e.target.value)}/><button type="button" className="db-btn db-btn-outline" onClick={()=>void changeDate(formatDate(new Date()))}>Today</button><button type="button" className="db-icon-button" aria-label="Next day" onClick={()=>void changeDate(shift(date,1))}><ChevronRight size={18}/></button></div>
      {loading?<p className="db-v5-message">Loading your journal…</p>:<form onSubmit={e=>void save(e)} className="db-form">
        <label><span className="db-field-label">Entry title</span><input className="db-input db-v5-title-input" maxLength={150} placeholder="A little about today…" value={title} onChange={e=>{setTitle(e.target.value);edit();}}/></label>
        <fieldset className="db-v5-moods"><legend className="db-field-label"><Smile size={15}/> How was your day?</legend><div>{MOODS.map(([value,label])=><button key={value} type="button" className={mood===value?"active":""} aria-pressed={mood===value} onClick={()=>{setMood(value);edit();}}>{label}</button>)}</div></fieldset>
        <label><span className="db-field-label">Your thoughts</span><textarea className="db-input db-v5-journal-text" maxLength={20000} value={content} onChange={e=>{setContent(e.target.value);edit();}} placeholder="Write about your day, ideas, wins, feelings, or anything on your mind…"/></label>
        {error&&<p role="alert" className="db-error">{error}</p>}
        <div className="db-v5-savebar"><small aria-live="polite">{saving?"Saving…":status}</small><button className="db-btn db-btn-primary" disabled={saving}><Save size={16}/> Save entry</button></div>
      </form>}
    </div>
    <section className="db-panel db-v5-smallpanel db53-history"><h3>Previous journal entries</h3><label className="db-field-label" htmlFor="db53-journal-search">Find a past entry</label><input id="db53-journal-search" className="db-input" value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)} placeholder="Search date, title, mood or writing..."/>
    {historyError&&<p role="alert" className="db-error">{historyError}</p>}
    <div className="db53-journal-history">{history.map(h=><button type="button" key={h.date} onClick={()=>void changeDate(h.date)}><span><strong>{h.title||"Untitled entry"}</strong><small>{h.date} · {h.mood}</small></span><small>{h.preview||"No text"}</small></button>)}{history.length===0&&<p className="db-help">No entries found.</p>}</div></section>
    <p className="db-help db-v5-under">Entries are stored in your private YOLO account. Autosave occurs after a short pause while typing.</p>
  </section>;
}
