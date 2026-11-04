"use client";

import { useDashboardEdition } from "./dashboard-edition";
import { DashboardIcon } from "./dashboard-icon";
import Link from "next/link";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "./ui/sidebar";

export function NavUser({ user, busy, onSignOut, onNavigate }: {
  user: { name: string; email: string };
  busy: boolean;
  onSignOut: () => void;
  onNavigate: () => void;
}) {
  const edition = useDashboardEdition();
  const { isMobile, open } = useSidebar();
  const compact = !isMobile && !open;
  return <SidebarMenu><SidebarMenuItem>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className={compact ? "mx-auto justify-center group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-1!" : "h-12 w-full gap-3 px-2"} aria-label={`Account menu: ${user.name || user.email}`}>
          <Avatar className="size-8 shrink-0 rounded-full"><AvatarFallback className="rounded-full text-xs">{(user.name || user.email).slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
          {!compact && <><span className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-semibold">{user.name || "Your account"}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{user.email}</span></span><ChevronsUpDown className="size-3.5! text-muted-foreground" /></>}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 rounded-lg" side={isMobile ? "top" : "right"} align="end" sideOffset={12}>
        <DropdownMenuLabel><span className="block truncate">{user.name || "Your account"}</span><span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span></DropdownMenuLabel>
        <DropdownMenuSeparator />
        {edition.accountSections.map(id => {
          const item = edition.sections.find(section => section.id === id);
          return item ? <DropdownMenuItem key={id} asChild><Link href={`/dashboard?view=${id}`} onClick={onNavigate}><DashboardIcon name={id} />{item.name}</Link></DropdownMenuItem> : null;
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={busy} onSelect={onSignOut}><LogOut />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </SidebarMenuItem></SidebarMenu>;
}
