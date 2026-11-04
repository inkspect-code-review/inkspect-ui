"use client";
import { useRouter } from "next/navigation";
import { useEffect,useState, type ReactNode } from "react";
import { productFetch } from "@inkspect/core/lib/api-client";
import { authClient } from "@inkspect/core/lib/auth-client";
export type InvitationDetails = { name: string; tier?: string; email: string; status: string; expires_at: string };
export function InvitationAccept({id, description = invitation => `You have been invited to join this workspace as ${invitation.email}.`}:{id:string; description?: (invitation: InvitationDetails) => ReactNode}) {
  const router=useRouter();
  const [invitation,setInvitation]=useState<InvitationDetails|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const endpoint=`/api/invitation?id=${id}`;
  useEffect(()=>{const controller=new AbortController();void productFetch(endpoint,{signal:controller.signal}).then(async response=>{const value=await response.json();if(!response.ok)throw new Error(value.error);if(!controller.signal.aborted)setInvitation(value);}).catch(error=>{if(!controller.signal.aborted)setError(error.message);});return()=>controller.abort();},[endpoint]);
  async function accept(){
    if(busy)return;setBusy(true);setError("");
    try{const response=await productFetch(endpoint,{method:"POST"});const value=await response.json();if(!response.ok)throw new Error(value.error);const result=await authClient.organization.setActive({organizationId:value.organizationId});if(result.error)throw new Error(result.error.message||"Joined the team. Open the dashboard to choose your workspace.");router.push('/dashboard?view=members');router.refresh();}catch(error){setError((error as Error).message);setBusy(false);}
  }
  const expired=invitation&&invitation.status!=="accepted"&&new Date(invitation.expires_at)<=new Date();
  return <div className="login-content"><h1>{invitation?`Join ${invitation.name}`:"Your team invitation"}</h1>{error&&<p className="form-error" role="alert">{error}</p>}{invitation&&<><p className="intro-copy">{description(invitation)}</p>{expired||!["pending","accepted"].includes(invitation.status)?<p>This invitation is no longer available. Ask the workspace owner for a new link.</p>:<button className="button primary" disabled={busy} onClick={()=>void accept()}>{busy?"Joining…":invitation.status==="accepted"?"Open workspace":"Accept invitation"}</button>}</>}</div>;
}
