"use client";
import { useEffect, useState } from "react";
import { Repeat2, StopCircle } from "lucide-react";

type Rule={id:string;title:string;frequency:"daily"|"weekly"|"monthly";weekdays:number[];start_date:string;end_date:string|null;active:boolean};
const DAYS=["Su","Mo","Tu","We","Th","Fr","Sa"];
export default function RecurringRulesPanel({refreshKey=0}:{refreshKey?:number}){
  const [rules,setRules]=useState<Rule[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{let live=true;setLoading(true);
    fetch("/api/recurrences",{cache:"no-store"}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error??"Cannot load recurring tasks.");return data;})
      .then(data=>{if(live)setRules(data.rules??[]);}).catch(e=>{if(live)setError(e instanceof Error?e.message:"Unable to load.");})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[refreshKey]);
  async function stop(rule:Rule){
    if(!window.confirm(`Stop future repetition for “${rule.title}”? Already-created task occurrences will remain.`))return;
    setError("");try{const resp=await fetch(`/api/recurrences/${rule.id}`,{method:"DELETE"});const body=await resp.json();if(!resp.ok)throw new Error(body.error||"Cannot stop recurrence.");setRules(old=>old.map(r=>r.id===rule.id?{...r,active:false}:r));}
    catch(e){setError(e instanceof Error?e.message:"Cannot stop recurrence.");}
  }
  const active=rules.filter(r=>r.active);
  return <section className="db-panel db-v5-rules">
    <div className="db-v5-subheading"><div><span className="db-overline">REPEATING ROUTINES</span><h2><Repeat2 size={18}/> Recurring tasks</h2><p>Set “Repeat” when creating a new task. Each date is a separate task you can complete.</p></div></div>
    {error&&<p className="db-error" role="alert">{error}</p>}
    {loading?<p className="db-help">Loading repeating routines…</p>:active.length?active.map(rule=><div className="db-v5-rule-row" key={rule.id}><div><strong>{rule.title}</strong><small>{rule.frequency==="weekly"?`Weekly · ${rule.weekdays.map(d=>DAYS[d]).join(", ")}`:rule.frequency==="monthly"?"Monthly":"Daily"} · starts {rule.start_date}{rule.end_date?` · until ${rule.end_date}`:""}</small></div><button title="Stop repeating" onClick={()=>void stop(rule)}><StopCircle size={16}/> Stop</button></div>):<p className="db-help">No active repeating tasks yet. Create a task and choose Daily, Weekly, or Monthly.</p>}
  </section>;
}
