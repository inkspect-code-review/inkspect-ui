"use client";

import Image from "next/image";
import { useState } from "react";
import { workspaceLogoSource } from "@inkspect/core/lib/workspace-logo";
import type { DashboardOrganization } from "@inkspect/core/lib/dashboard";
import styles from "./workspace-logo.module.css";

export function WorkspaceAvatar({ organization, className }: { organization: Pick<DashboardOrganization, "id" | "name" | "logo"> | null; className?: string }) {
  const source = organization ? workspaceLogoSource(organization.id, organization.logo) : null;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <span className={`${styles.avatar} ${className ?? ""}`} aria-hidden="true">
    {source && failedSource !== source ? <Image src={source} alt="" width={72} height={72} unoptimized onError={() => setFailedSource(source)} /> : organization?.name.slice(0, 1).toUpperCase() || "I"}
  </span>;
}
