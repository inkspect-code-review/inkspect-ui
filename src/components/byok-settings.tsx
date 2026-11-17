"use client";

import { useDashboardEdition } from "./dashboard-edition";
import Link from "next/link";
import { Check, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { productFetch } from "@inkspect/core/lib/api-client";
import { SearchableSelect } from "./ui/searchable-select";
import { ConfirmationDialog } from "./confirmation-dialog";
import { useNotifications } from "./notification-toast";
import shared from "./dashboard.module.css";
import styles from "./byok-settings.module.css";
import settingsStyles from "./settings.module.css";

type Settings = { review_provider: "managed"|"byok"; plan: string; eligible: boolean; can_manage: boolean; encryption_ready: boolean;
  providers: {id:string;name:string}[]; models: {provider:string;id:string;name:string}[];
  connection: {provider:string;model:string;key_suffix:string;updated_at:string} | null };

type ProviderMode = Settings["review_provider"];
type ProviderOption = { mode: ProviderMode; label: string; available: boolean; description?: string };

export function ReviewProviderSelector({ current, selected = current, options, disabled, connectionLabel, onChange }: {
  current: ProviderMode;
  selected?: ProviderMode;
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
    <div className={styles.providerOptions} role="group" aria-label="Organization review provider">
      {options.map(option => {
        const active = current === option.mode;
        const chosen = selected === option.mode;
        const unavailable = disabled || !option.available || chosen;
        const Icon = option.mode === "managed" ? Sparkles : KeyRound;
        return <button key={option.mode} type="button" className={styles.providerOption} disabled={unavailable} aria-pressed={chosen} data-selected={chosen}
          onClick={() => { if (!unavailable) onChange(option.mode); }}>
          <Icon size={19} aria-hidden="true" /><span className={styles.optionContent}><span className={styles.optionTitle}>{option.label}{active && <span className={styles.activeBadge}><Check size={13} aria-hidden="true" />Active</span>}</span>{option.description && <span className={styles.optionDescription}>{option.description}</span>}</span><span className={styles.selectionMark} aria-hidden="true">{chosen && <Check size={12} />}</span>
        </button>;
      })}
    </div>
  </>;
}

export function ByokSettings({organizationId}:{organizationId:string}) {
  return <ProviderSettings key={organizationId} organizationId={organizationId} />;
}

function ProviderSettings({organizationId}:{organizationId:string}) {
  const { provider: providerPresentation } = useDashboardEdition();
  const { notify, clearToast } = useNotifications();
  const [settings,setSettings]=useState<Settings|null>(null),[provider,setProvider]=useState("openai"),[model,setModel]=useState(""),[apiKey,setApiKey]=useState("");
  const [busy,setBusy]=useState(false),[loadError,setLoadError]=useState("");
  const [selected, setSelected] = useState<ProviderMode>("managed");
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const pending=useRef(false);
  const endpoint=`/api/byok?${new URLSearchParams({organizationId})}`;
  const load=useCallback(async (signal?:AbortSignal)=>{
    const response=await productFetch(endpoint,{cache:"no-store",signal});
    const value=await response.json();
    if (!response.ok) throw new Error(value.error || "Could not load provider settings.");
    if(signal?.aborted)return;
    const next=value as Settings;
    setSettings(next);setLoadError("");setSelected(next.review_provider);setEditing(false);
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
    if(pending.current || !settings?.can_manage || !settings.eligible || !settings.encryption_ready || !settings.models.some(item=>item.provider===provider && item.id===model) || apiKey.length<16)return;
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
    if(pending.current || !settings?.can_manage)return;
    pending.current=true;setBusy(true);clearToast();setApiKey("");
    try{
      const response=await productFetch(endpoint,{method:"DELETE"});
      const value=await response.json();if(!response.ok)throw new Error(value.error || "Could not remove provider key.");
      await load();setConfirmRemove(false);notify("success","Provider key removed. Add a key before starting another BYOK review.");
    }catch(error){notify("error",error instanceof Error?error.message:"Could not remove provider key.");}
    finally{pending.current=false;setBusy(false);}
  }
  const header=<header className={settingsStyles.sectionHeader}><div><h2 id="byok-heading">Review provider</h2><p>Choose the provider and model for your workspace’s reviews.</p></div></header>;
  // This section has its own tab, so keep the heading visible while it loads or if loading fails.
  if(!settings)return <section className={`${settingsStyles.section} ${styles.section}`} aria-labelledby="byok-heading" aria-busy={!loadError}>{header}
    {loadError?<button type="button" className={shared.secondaryButton} onClick={()=>{clearToast();void load().catch(()=>notify("error","Could not load provider settings. Try again."));}}>Retry loading provider settings</button>:<p className={settingsStyles.hint}>Loading provider settings…</p>}
  </section>;
  const editable=settings.eligible && settings.can_manage && settings.encryption_ready && !busy;
  const connection=settings.connection;
  const connectionLabel=connection ? `${settings.providers.find(item=>item.id===connection.provider)?.name || connection.provider} · ${settings.models.find(item=>item.provider===connection.provider && item.id===connection.model)?.name || connection.model}` : undefined;
  const providerModels = settings.models.filter(item => item.provider === provider);
  const showEditor = !connection || editing;
  const resetEditor = () => {
    setProvider(connection?.provider || settings.providers[0]?.id || "openai");
    setModel(connection?.model || settings.models.find(item => item.provider === settings.providers[0]?.id)?.id || "");
    setApiKey("");setEditing(false);
  };
  return <section className={`${settingsStyles.section} ${styles.section}`} aria-labelledby="byok-heading" aria-busy={busy}>
    {header}
    <div className={styles.body}>
      <ReviewProviderSelector current={settings.review_provider} selected={selected} disabled={busy || !settings.can_manage}
        options={[
          {mode:"managed",label:providerPresentation.managedLabel,available:providerPresentation.managedAvailable,description:"Ready to use. No provider API key needed."},
          {mode:"byok",label:providerPresentation.byokLabel,available:true,description:"Choose a model and connect your own API key."},
        ]}
        connectionLabel={connectionLabel}
        onChange={mode=>{setSelected(mode);resetEditor();}} />
      {!settings.can_manage && <p className={styles.message}>Ask a workspace owner or admin to update this connection.</p>}
      <div className={styles.configuration}>
      {selected === "managed" ? <>
        <div className={styles.detailHeading}><Sparkles size={18} aria-hidden="true" /><div><h3>{providerPresentation.managedLabel}</h3><p>Provider setup and model selection are handled for you.</p></div></div>
        {settings.review_provider === "managed" ? <p className={styles.status}><Check size={15} aria-hidden="true" />New reviews use {providerPresentation.managedLabel}.</p> : <div className={styles.footer}><p>Applies to new reviews. Your saved API key is kept.</p><button type="button" className={shared.primaryButton} disabled={busy || !settings.can_manage || !providerPresentation.managedAvailable} onClick={()=>void chooseMode("managed")}>Use {providerPresentation.managedLabel}</button></div>}
      </> : <>
        <div className={styles.detailHeading}><KeyRound size={18} aria-hidden="true" /><div><h3>Your provider connection</h3><p>{providerPresentation.description}</p></div></div>
        {!settings.eligible && <p className={styles.message}>{providerPresentation.unavailable} {providerPresentation.action && <Link href={providerPresentation.action.href}>{providerPresentation.action.label}</Link>}</p>}
        {settings.eligible && !settings.encryption_ready && <p className={styles.message} role="status">Secure key storage is not available yet. Contact support.</p>}
        {connection && <div className={styles.connection}>
          <ShieldCheck size={18} aria-hidden="true" /><div><strong>{connectionLabel}</strong><span>Saved key ending in {connection.key_suffix}. Access is checked when a review starts.</span></div>
          {settings.can_manage && !editing && <button type="button" className={shared.secondaryButton} disabled={!editable} onClick={()=>setEditing(true)}>Edit connection</button>}
        </div>}
        {showEditor && <form onSubmit={save} aria-busy={busy}>
          <div className={styles.fields}>
            <div className={styles.field}><label htmlFor="byok-provider">Provider</label><SearchableSelect id="byok-provider" label="Provider" value={provider} disabled={!editable} className={styles.selectTrigger}
              options={settings.providers.map(item=>({value:item.id,label:item.name}))} placeholder="Choose a provider" searchPlaceholder="Search providers…" emptyMessage="No matching providers."
              onValueChange={next=>{setProvider(next);setModel(settings.models.find(item=>item.provider===next)?.id || "");setApiKey("");}} /></div>
            <div className={styles.field}><div className={styles.fieldLabel}><label htmlFor="byok-model">Model</label><span>{providerModels.length} models</span></div><SearchableSelect key={provider} id="byok-model" label="Model" value={model} disabled={!editable || !providerModels.length} className={styles.selectTrigger}
              options={providerModels.map(item=>({value:item.id,label:item.name}))} placeholder="Choose a model" searchPlaceholder="Search model names or IDs…" emptyMessage="No matching models. Try another name or model ID."
              onValueChange={setModel} />
              <span className={styles.modelId} title={model}>{model || "No review models available for this provider."}</span></div>
          </div>
          {settings.can_manage && <div className={`${styles.field} ${styles.key}`}><label htmlFor="byok-api-key">{connection ? "API key to save changes" : "API key"}</label><input id="byok-api-key" name="byok-api-key" type="password" autoComplete="new-password" spellCheck={false} autoCapitalize="none" value={apiKey} disabled={!editable} minLength={16} maxLength={4096} required placeholder="Paste your provider API key" aria-describedby="byok-key-help" onChange={event=>setApiKey(event.target.value)}/><p id="byok-key-help" className={styles.keyHelp}><ShieldCheck size={14} aria-hidden="true" /><span>Stored encrypted and never displayed again.{connection && " Re-enter your key to change the provider or model."}</span></p></div>}
          {settings.can_manage && <div className={styles.footer}><p>Saving enables this connection for new reviews.</p><div className={styles.actions}>{connection && <button className={shared.secondaryButton} type="button" disabled={busy} onClick={resetEditor}>Cancel</button>}<button className={shared.primaryButton} type="submit" disabled={!editable || !model || apiKey.length<16}>{busy?"Saving…":connection?"Save and use connection":"Connect and use provider"}</button></div></div>}
        </form>}
        {connection && !editing && settings.can_manage && <div className={styles.footer}>
          <ConfirmationDialog open={confirmRemove} onOpenChange={setConfirmRemove} title="Remove provider key?" description={settings.review_provider === "byok" ? "New BYOK reviews will be blocked until you add a key or switch providers. This removes the saved key for everyone in this workspace." : "This removes the saved key for everyone in this workspace. Your active review provider stays the same."} confirmLabel="Remove key" busy={busy} onConfirm={()=>void remove()} trigger={<button type="button" className={`${shared.secondaryButton} ${styles.removeButton}`} disabled={busy}>Remove key</button>} />
          {settings.review_provider === "byok" ? <p className={styles.status}><Check size={15} aria-hidden="true" />Used for new reviews</p> : <button type="button" className={shared.primaryButton} disabled={busy || !settings.eligible} onClick={()=>void chooseMode("byok")}>Use saved connection</button>}
        </div>}
      </>}
      </div>
    </div>
  </section>;
}
