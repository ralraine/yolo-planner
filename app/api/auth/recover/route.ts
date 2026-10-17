import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { hashPin } from "@/lib/auth/pin";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail } from "@/lib/api-helpers";

export async function POST(req:NextRequest){
  const guard=devOnly()||rejectWrongOrigin(req)||jsonRequired(req);if(guard)return guard;
  const body=await parseJsonObject(req);if(!body)return fail("Invalid request body.");
  const username=typeof body.username==="string"?body.username.trim().toLowerCase():"";
  const code=typeof body.code==="string"?body.code.trim().toUpperCase():"";
  const pin=typeof body.pin==="string"?body.pin:"";
  const confirm=typeof body.confirmPin==="string"?body.confirmPin:"";
  if(!/^[a-z0-9_]{3,20}$/.test(username)||!/^[0-9A-F]{40}$/.test(code)||!/^[0-9]{4}$/.test(pin)||pin!==confirm) return fail("Invalid recovery details.");
  try{
    const pepper=process.env.DAYBLOOM_PIN_PEPPER;if(!pepper||pepper.length<32)return fail("Server secret missing.",500);
    const db=createAdminClient();
    const {data:account,error:aError}=await db.from("accounts").select("id").eq("username",username).maybeSingle();if(aError)throw aError;
    if(!account)return fail("Invalid recovery details.",401);
    const {data:cred,error:cError}=await db.from("pin_credentials").select("recovery_hash").eq("user_id",account.id).maybeSingle();if(cError)throw cError;
    const expected=createHash("sha256").update(`${pepper}:recovery:${code}`).digest();
    const stored=cred?.recovery_hash;
    if(!stored||!/^[a-f0-9]{64}$/.test(stored)||!timingSafeEqual(Buffer.from(stored,"hex"),expected))return fail("Invalid recovery details.",401);
    const newHash=await hashPin(pin);
    const {data:updated,error:uError}=await db.from("pin_credentials")
      .update({pin_hash:newHash,recovery_hash:null,failed_attempts:0,locked_until:null})
      .eq("user_id",account.id).eq("recovery_hash",stored).select("user_id").maybeSingle();
    if(uError)throw uError;if(!updated)return fail("Recovery code already used.",409);
    const {error:sError}=await db.from("sessions").delete().eq("user_id",account.id);if(sError)throw sError;
    return NextResponse.json({success:true,message:"PIN reset. Sign in again. Recovery code is now invalid."},{headers:{"Cache-Control":"no-store"}});
  }catch(err){console.error("PIN recovery",err);return fail("Unable to recover account.",500);}
}
