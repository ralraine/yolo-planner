"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AtSign, ArrowRight, CheckCircle2, Flower2, LockKeyhole, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";

type Mode = "login" | "signup";

function PinBoxes({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#51536a]">
        <LockKeyhole size={16} className="text-[#c983ac]" /> {label}
      </label>
      <div className="relative">
        <div aria-hidden="true" className="flex justify-center gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 transition-colors ${focused && i === Math.min(value.length, 3) ? "border-[#da86b7] bg-pink-50" : i < value.length ? "border-[#e2b1cb] bg-[#fdf2f8]" : "border-[#e8e9f2] bg-[#fafaff]"}`}>
              <span className="text-xl text-[#c983ac]">{i < value.length ? "●" : ""}</span>
            </div>
          ))}
        </div>
        <input id={id} type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} required
          aria-label={label} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="absolute inset-0 h-full w-full cursor-text opacity-0" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);
  const signup = mode === "signup";

  function changeMode(next: Mode) {
    setMode(next); setPin(""); setConfirmPin(""); setName(""); setFeedback(""); setError(false);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setFeedback(""); setError(false);
    if (signup && (name.trim().length < 2 || name.trim().length > 60)) { setFeedback("Name must contain 2–60 characters."); setError(true); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { setFeedback("Username must contain 3–20 letters, numbers or underscores."); setError(true); return; }
    if (!/^\d{4}$/.test(pin)) { setFeedback("Enter four digits for your PIN."); setError(true); return; }
    if (signup && confirmPin !== pin) { setFeedback("Passcodes don't match."); setError(true); return; }
    setBusy(true);
    try {
      const response = await fetch(signup ? "/api/auth/register" : "/api/auth/login", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signup ? { name: name.trim(), username, pin, confirmPin } : { username, pin }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      setPin(""); setConfirmPin("");
      if (signup) {
        setMode("login");
        setFeedback("Account created! Sign in using your username and PIN.");
      } else {
        window.location.replace("/");
      }
    } catch (err) {
      setError(true); setFeedback(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fdf1f8] via-[#faf9ff] to-[#eaf3ff] px-5 py-12">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white shadow-sm"><Flower2 className="text-[#d981b0]" size={33} strokeWidth={1.7} /></div>
          <h1 className="text-3xl font-bold tracking-tight"><span className="text-[#d981b0]">YOLO</span></h1>
          <p className="mt-2 text-sm text-[#9195a7]">Your space to plan, focus, and grow.</p>
        </div>
        <div className="rounded-[28px] border border-[#f1eaf3] bg-white p-7 shadow-xl shadow-pink-100/40 sm:p-9">
          <h2 className="text-2xl font-bold">{signup ? "Create your account" : "Welcome back"}</h2>
          <p className="mt-2 text-sm text-[#9598ab]">{signup ? "Create your personal planning space." : "Sign in to your YOLO workspace."}</p>
          <form className="mt-8 space-y-6" onSubmit={submit}>
            {signup && <div><label htmlFor="displayName" className="mb-2 block text-sm font-semibold text-[#51536a]">Your Name</label>
              <div className="flex items-center gap-3 rounded-xl border border-[#e8e9f1] px-4 focus-within:border-[#d981b0]"><UserRound size={18} className="text-[#a2a6b5]" /><input id="displayName" autoComplete="name" required minLength={2} maxLength={60} placeholder="What should we call you?" value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent py-3.5 text-sm outline-none" /></div>
            </div>}
            <div><label htmlFor="username" className="mb-2 block text-sm font-semibold text-[#51536a]">Username</label>
              <div className="flex items-center gap-3 rounded-xl border border-[#e8e9f1] px-4 focus-within:border-[#d981b0]"><AtSign size={18} className="text-[#a2a6b5]" /><input id="username" autoComplete="username" required minLength={3} maxLength={20} placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0,20))} className="w-full bg-transparent py-3.5 text-sm outline-none" /></div>
            </div>
            <PinBoxes id="pin" label="4-Digit Passcode" value={pin} onChange={setPin} />
            {signup && <div className="space-y-3"><PinBoxes id="confirmPin" label="Confirm Passcode" value={confirmPin} onChange={setConfirmPin} />
              {confirmPin.length === 4 && <p className={`flex items-center justify-center gap-1.5 text-xs ${pin === confirmPin ? "text-emerald-600" : "text-rose-600"}`}><CheckCircle2 size={14} />{pin === confirmPin ? "Passcodes match" : "Passcodes do not match"}</p>}</div>}
            {feedback && <p role={error ? "alert" : "status"} className={`rounded-xl p-3 text-center text-sm ${error ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-700"}`}>{feedback}</p>}
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d981b0] py-4 font-semibold text-white transition hover:bg-[#c871a3] disabled:opacity-50">
              {busy ? <><LoaderCircle size={18} className="animate-spin" /> Please wait...</> : <>{signup ? "Create Account" : "Sign In"} <ArrowRight size={18} /></>}
            </button>
          </form>
          {!signup && <div className="mt-3 text-center"><Link href="/recover" className="text-sm font-semibold text-[#c878a7] hover:underline">Forgot your PIN? Use a recovery code</Link></div>}
          <div className="mt-7 border-t border-gray-100 pt-6 text-center"><p className="text-sm text-[#9699aa]">{signup ? "Already have an account?" : "New to YOLO?"}</p><button type="button" disabled={busy} onClick={() => changeMode(signup ? "login" : "signup")} className="mt-2 text-sm font-semibold text-[#d17cad] hover:underline">{signup ? "Sign In" : "Create an account"}</button></div>
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-[#9496a6]"><ShieldCheck size={15} /> Local development version · Not ready for public deployment</p>
      </div>
    </main>
  );
}
