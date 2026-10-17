import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, fail } from "@/lib/api-helpers";
export async function GET(req:NextRequest){
  const guard=devOnly();if(guard)return guard;
  try{
    const user=await getCurrentUser();if(!user)return fail("Please sign in.",401);
    const q=(req.nextUrl.searchParams.get("q")??"").trim().toLowerCase().slice(0,100);
    const {data,error}=await createAdminClient().from("journal_entries").select("entry_date,title,mood,content")
      .eq("user_id",user.id).order("entry_date",{ascending:false}).limit(365);
    if(error)throw error;
    const rows=(data??[]).filter((x:{entry_date:string;title:string;mood:string;content:string})=>!q||[x.entry_date,x.title,x.mood,x.content].some((v:string)=>(v??"").toLowerCase().includes(q))).slice(0,30).map(x=>({date:x.entry_date,title:x.title,mood:x.mood,preview:(x.content??"").slice(0,95)}));
    return NextResponse.json({entries:rows,limited:true});
  }catch(err){console.error("Journal history",err);return fail("Unable to load journal history.",500);}
}
