"use client";

import { useMemo, useState } from "react";
import { Popover } from "radix-ui";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { searchRepositories } from "@inkspect/core/lib/repository-search";
import styles from "./chat-repository-picker.module.css";

type Props = { repositories: {id:number;fullName:string}[]; value:string; disabled?:boolean; onChange:(value:string)=>void };
export function ChatRepositoryPicker({repositories,value,disabled,onChange}:Props) {
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState("");
  const showAll=!query.trim() || "all repositories".includes(query.trim().toLowerCase());
  const {matches,total}=useMemo(()=>searchRepositories(repositories,query),[repositories,query]);
  const name=value==="all" ? "All repositories" : repositories.find(repo=>String(repo.id)===value)?.fullName ?? "Choose a repository";
  const choose=(next:string)=>{onChange(next);setOpen(false);setQuery("");};
  return <Popover.Root open={open && !disabled} onOpenChange={next=>{setOpen(next);setQuery("");}}>
    <Popover.Trigger asChild><button type="button" className={styles.trigger} disabled={disabled} aria-label={`Repositories to ask about: ${name}`} aria-expanded={open && !disabled} title={name}><span>{name}</span><ChevronsUpDown size={14} aria-hidden="true" /></button></Popover.Trigger>
    <Popover.Portal><Popover.Content className={styles.popover} sideOffset={8} align="start" collisionPadding={12} aria-label="Choose repositories" onEscapeKeyDown={event=>event.stopPropagation()}>
      <Command label="Repositories" shouldFilter={false} loop>
        <div className={styles.search}><Search size={15} aria-hidden="true" /><Command.Input className={styles.input} value={query} onValueChange={setQuery} placeholder="Search owner or repository…" aria-label="Search repositories" /></div>
        <Command.List className={styles.list}>
          {showAll && <Command.Item value="all" className={styles.item} onSelect={()=>choose("all")}><span>All repositories</span>{value==="all" && <Check size={15} aria-label="Selected" />}</Command.Item>}
          {matches.map(repo=><Command.Item key={repo.id} value={String(repo.id)} className={styles.item} onSelect={()=>choose(String(repo.id))}><span title={repo.fullName}>{repo.fullName}</span>{value===String(repo.id) && <Check size={15} aria-label="Selected" />}</Command.Item>)}
          {!total && !showAll && <p className={styles.empty} role="status">No repositories found.</p>}
        </Command.List>
      </Command>
      <p className={styles.footer} role="status">{total > matches.length ? `Showing ${matches.length} of ${total.toLocaleString()} repositories. Type to narrow the list.` : `${total.toLocaleString()} ${total===1 ? "repository" : "repositories"}`}</p>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
