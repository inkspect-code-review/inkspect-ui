"use client";

import { useDashboardEdition } from "./dashboard-edition";
import Link from "next/link";
import { Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { productFetch } from "@inkspect/core/lib/api-client";
import { useNotifications } from "./notification-toast";
import shared from "./dashboard.module.css";
import styles from "./byok-settings.module.css";
import settingsStyles from "./settings.module.css";

type Settings = { review_provider: "managed"|"byok"; plan: string; eligible: boolean; can_manage: boolean; encryption_ready: boolean;
  providers: {id:string;name:string}[]; models: {provider:string;id:string;name:string}[];
  connection: {provider:string;model:string;key_suffix:string;updated_at:string} | null };

type ProviderMode = Settings["review_provider"];
type ProviderOption = { mode: ProviderMode; label: string; available: boolean };

export function ReviewProviderSelector({ current, options, disabled, connectionLabel, onChange }: {
  current: ProviderMode;
  options: ProviderOption[];
  disabled: boolean;
  connectionLabel?: string;
  onChange: (mode: ProviderMode) => void;
}) {
  return <>
    <div className={styles.activeProvider}>
      <span>Active provider</span>
      <strong>{options.find(option => option.mode === current)?.label}</strong>
      {current === "byok" && connectionLabel && <span>{connectionLabel}</span>}
    </div>
    <div className={styles.actions} role="group" aria-label="Organization review provider">
      {options.map(option => {
        const active = current === option.mode;
        const unavailable = disabled || !option.available || active;
        return <button key={option.mode} type="button" className={`${shared.secondaryButton} ${styles.providerOption}`} disabled={unavailable} aria-pressed={active} data-active={active}
          onClick={() => { if (!unavailable) onChange(option.mode); }}>
          {option.label}{active && <span className={styles.activeBadge}><Check size={13} aria-hidden="true" />Active</span>}
        </button>;
      })}
    </div>
  </>;
}

export function ByokSettings({organizationId}:{organizationId:string}) {
  const { provider: providerPresentation } = useDashboardEdition();
  const { notify, clearToast } = useNotifications();
  const [settings,setSettings]=useState<Settings|null>(null),[provider,setProvider]=useState("openai"),[model,setModel]=useState(""),[apiKey,setApiKey]=useState("");
  const [busy,setBusy]=useState(false),[loadError,setLoadError]=useState("");
  const pending=useRef(false);
  const endpoint=`/api/byok?${new URLSearchParams({organizationId})}`;
  const load=useCallback(async (signal?:AbortSignal)=>{
    const response=await productFetch(endpoint,{cache:"no-store",signal});
    const value=await response.json();
    if (!response.ok) throw new Error(value.error || "Could not load provider settings.");
    if(signal?.aborted)return;
    const next=value as Settings;
    setSettings(next);setLoadError("");
    setProvider(next.connection?.provider || "openai");
    setModel(next.connection?.model || next.models.find(item=>item.provider==="openai")?.id || "");
  },[endpoint]);
  useEffect(()=>{
    const controller=new AbortController();
    void Promise.resolve().then(()=>load(controller.signal)).catch(()=>{if(!controller.signal.aborted){setLoadError("Could not load provider settings. Try again.");notify("error","Could not load provider settings. Try again.");}});
    return ()=>controller.abort();
  },[load,notify]);
  async function save(event:FormEvent) {
    event.preventDefault();
    if(pending.current)return;
    pending.current=true;setBusy(true);clearToast();
    const body=JSON.stringify({provider,model,api_key:apiKey});
    setApiKey("");
    try {
      const response=await productFetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body});
      const value=await response.json();if(!response.ok)throw new Error(value.error || "Could not save provider settings.");
      await load();notify("success","Provider saved. New reviews will use this connection.");
    }catch(error){notify("error",error instanceof Error?error.message:"Could not save provider settings.");}
    finally{pending.current=false;setBusy(false);}
  }
  async function chooseMode(mode:ProviderMode) {
    if(pending.current || !settings?.can_manage || settings.review_provider===mode
      || (mode==="managed" ? !providerPresentation.managedAvailable : !settings.eligible || !settings.connection))return;
    pending.current=true;setBusy(true);clearToast();
    try{const response=await productFetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"provider",mode})});const value=await response.json();if(!response.ok)throw new Error(value.error || "Could not update the review provider.");await load();notify("success","Review provider updated for new reviews.");}catch(error){notify("error",error instanceof Error?error.message:"Could not update the review provider.");}finally{pending.current=false;setBusy(false);}
  }
  async function remove() {
    if(pending.current)return;
    pending.current=true;setBusy(true);clearToast();setApiKey("");
    try{
      const response=await productFetch(endpoint,{method:"DELETE"});
      const value=await response.json();if(!response.ok)throw new Error(value.error || "Could not remove provider key.");
      await load();notify("success","Provider key removed. Add a key before starting another BYOK review.");
    }catch(error){notify("error",error instanceof Error?error.message:"Could not remove provider key.");}
    finally{pending.current=false;setBusy(false);}
  }
  const header=<header className={settingsStyles.sectionHeader}><div><h2 id="byok-heading">Review provider</h2><p>Choose the provider and model for your workspace’s reviews.</p></div></header>;
  // This section has its own tab, so keep the heading visible while it loads or if loading fails.
  if(!settings)return <section className={settingsStyles.section} aria-labelledby="byok-heading" aria-busy={!loadError}>{header}
    {loadError?<button type="button" className={shared.secondaryButton} onClick={()=>{clearToast();void load().catch(()=>notify("error","Could not load provider settings. Try again."));}}>Retry loading provider settings</button>:<p className={settingsStyles.hint}>Loading provider settings…</p>}
  </section>;
  const editable=settings.eligible && settings.can_manage && settings.encryption_ready && !busy;
  const connection=settings.connection;
  const connectionLabel=connection ? `${settings.providers.find(item=>item.id===connection.provider)?.name || connection.provider} · ${settings.models.find(item=>item.provider===connection.provider && item.id===connection.model)?.name || connection.model}` : undefined;
  return <section className={settingsStyles.section} aria-labelledby="byok-heading">
    {header}
    <div className={styles.body}>
      <ReviewProviderSelector current={settings.review_provider} disabled={busy || !settings.can_manage}
        options={[
          {mode:"managed",label:providerPresentation.managedLabel,available:providerPresentation.managedAvailable},
          {mode:"byok",label:providerPresentation.byokLabel,available:settings.eligible && !!settings.connection},
        ]}
        connectionLabel={connectionLabel}
        onChange={mode=>void chooseMode(mode)} />
      <p className={styles.description}>{providerPresentation.description}</p>
      {settings.connection && <p className={styles.connection}>Saved key ending in <strong>{settings.connection.key_suffix}</strong>. Access is checked when a review starts.</p>}
      {!settings.eligible && <p className={styles.message}>{providerPresentation.unavailable} {providerPresentation.action && <Link href={providerPresentation.action.href}>{providerPresentation.action.label}</Link>}</p>}
      {!settings.can_manage && <p className={styles.message}>Ask a workspace owner or admin to update this connection.</p>}
      {settings.eligible && !settings.encryption_ready && <p className={styles.message} role="status">Secure key storage is not available yet. Contact support.</p>}
      <form onSubmit={save} aria-busy={busy}>
        <div className={styles.fields}>
          <label htmlFor="byok-provider">Provider<select id="byok-provider" value={provider} disabled={!editable} onChange={event=>{const next=event.target.value;setProvider(next);setModel(settings.models.find(item=>item.provider===next)?.id || "");setApiKey("");}}>{settings.providers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label htmlFor="byok-model">Model<select id="byok-model" value={model} disabled={!editable} onChange={event=>setModel(event.target.value)}>{settings.models.filter(item=>item.provider===provider).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </div>
        {settings.can_manage && <label className={styles.key} htmlFor="byok-api-key">API key<input id="byok-api-key" name="byok-api-key" type="password" autoComplete="new-password" spellCheck={false} autoCapitalize="none" value={apiKey} disabled={!editable} minLength={16} maxLength={4096} required placeholder={settings.connection?"Enter a key to update this connection":"Enter your provider API key"} aria-describedby="byok-key-help" onChange={event=>setApiKey(event.target.value)}/><span id="byok-key-help">Stored encrypted and never displayed again. Re-enter your key when changing the provider or model.</span></label>}
        {settings.can_manage && <div className={styles.actions}><button className={shared.primaryButton} type="submit" disabled={!editable || !model || apiKey.length<16}>{busy?"Please wait…":"Save provider"}</button>{settings.connection && <button className={shared.secondaryButton} type="button" disabled={busy} onClick={()=>void remove()}>Remove key</button>}</div>}
      </form>
    </div>
  </section>;
}
