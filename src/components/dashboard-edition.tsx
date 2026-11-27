"use client";
import { createContext, useContext, type ComponentType, type ReactNode } from "react";
import type { DashboardSection } from "@inkspect/core/lib/dashboard";
import { selfHostedDashboardEdition } from "@inkspect/core/lib/dashboard-edition";

const EditionContext = createContext(selfHostedDashboardEdition);
export const DashboardEditionProvider = EditionContext.Provider;
export function useDashboardEdition() { return useContext(EditionContext); }

const WidgetsContext = createContext<{
  repositoryBadge?: (id: number) => ReactNode;
  additionalCompleted?: { count: number; detail: (workspaceCount:number) => string };
  historySupplement?: (repositoryId:number) => ReactNode;
  confirmReview?: (repositoryId:number) => { label:string; workspace:string } | undefined;
  sidebarFooter?: ReactNode;
  overviewCard?: ReactNode;
  afterReviewActivity?: ReactNode;
  ReviewRepositoryAction?: ComponentType<{ repositoryId: number; repositoryName: string }>;
  wideOverviewCard?: boolean;
  ReviewUsage?: ComponentType<{ organizationId: string; jobId: string }>;
  ReviewAllowance?: ComponentType<{ organizationId: string }>;
  PublicRepositoryNotice?: ComponentType<{ repositoryId: string }>;
  navigationIcons?: Partial<Record<DashboardSection, ReactNode>>;
}>({});
export const DashboardWidgetsProvider = WidgetsContext.Provider;
export function useDashboardWidgets() { return useContext(WidgetsContext); }
