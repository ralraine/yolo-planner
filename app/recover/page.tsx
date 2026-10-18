"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Flower2 } from "lucide-react";
export default function RecoverPage(){
  const [username,setUsername]=useState(""),[code,setCode]=useState(""),[pin,setPin]=useState(""),[confirmPin,setConfirmPin]=useState("");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setError(false);setMessage("");if(pin!==confirmPin){setError(true);setMessage("Passcodes do not match.");return;}setBusy(true);try{
    const r=await fetch("/api/auth/recover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,code,pin,confirmPin})});
    const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to recover account");setMessage("PIN updated. Your old sessions were revoked. Return to Sign In.");setCode("");setPin("");setConfirmPin("");
  }catch(err){setError(true);setMessage(err instanceof Error?err.message:"Unable to recover account");}finally{setBusy(false);}}
  return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fdf1f8] via-[#faf9ff] to-[#eaf3ff] px-5 py-12"><section className="w-full max-w-[440px] rounded-3xl bg-white p-8 shadow-lg"><div className="mb-4 flex items-center gap-2 text-[#d981b0]"><Flower2 size={28}/><strong className="text-2xl">YOLO</strong></div><h1 className="text-2xl font-bold text-[#34364d]">Recover your account</h1><p className="mt-2 text-sm text-gray-500">Use the emergency recovery code you generated while signed in. Each code works once.</p>
  <form onSubmit={submit} className="mt-6 space-y-4 text-[#34364d]"><label className="block text-sm font-medium">Username<input className="mt-2 w-full rounded-xl border p-3" autoComplete="username" required minLength={3} maxLength={20} value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))}/></label>
  <label className="block text-sm font-medium">Emergency recovery code<input className="mt-2 w-full rounded-xl border p-3 font-mono tracking-wide" required minLength={40} maxLength={40} value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9a-f]/gi,"").toUpperCase().slice(0,40))} placeholder="40-character recovery code"/></label>
  <label className="block text-sm font-medium">New 4-digit PIN<input className="mt-2 w-full rounded-xl border p-3 tracking-widest" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4}" maxLength={4} required value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,4))}/></label>
  <label className="block text-sm font-medium">Confirm new PIN<input className="mt-2 w-full rounded-xl border p-3 tracking-widest" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4}" maxLength={4} required value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\D/g,"").slice(0,4))}/></label>
  {message&&<p role={error?"alert":"status"} className={`rounded-xl p-3 text-sm ${error?"bg-red-50 text-red-700":"bg-green-50 text-green-700"}`}>{message}</p>}
  <button disabled={busy} className="w-full rounded-xl bg-[#d981b0] p-3 font-semibold text-white disabled:opacity-50">{busy?"Please wait...":"Reset PIN"}</button></form><Link href="/login" className="mt-5 flex items-center gap-2 text-sm text-[#c878a7]"><ArrowLeft size={15}/> Back to Sign In</Link><p className="mt-4 text-xs text-gray-400">Save the one-time recovery code in a private place. No email is required.</p></section></main>;
}
