import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, rejectWrongOrigin, fail, uuidOk } from "@/lib/api-helpers";
type Ctx = {params:Promise<{id:string}>};
export async function DELETE(request:NextRequest,{params}:Ctx) {
  const guard = devOnly() || rejectWrongOrigin(request); if (guard) return guard;
  const {id}=await params; if (!uuidOk(id)) return fail("Invalid repeat rule.");
  try {
    const user=await getCurrentUser(); if(!user) return fail("Please sign in.",401);
    const {data,error}=await createAdminClient().from("task_recurrences")
      .update({active:false}).eq("user_id",user.id).eq("id",id).eq("active",true).select("id").maybeSingle();
    if(error) throw error; if(!data) return fail("Repeat rule not found.",404);
    return NextResponse.json({success:true});
  } catch(error) {console.error("STOP recurrence",error);return fail("Unable to stop repeating task.",500);}
}
