"use client";
import { createContext, useContext, type ComponentType } from "react";
import { selfHostedDashboardEdition } from "@inkspect/core/lib/dashboard-edition";

const EditionContext = createContext(selfHostedDashboardEdition);
export const DashboardEditionProvider = EditionContext.Provider;
export function useDashboardEdition() { return useContext(EditionContext); }

const WidgetsContext = createContext<{
  ReviewAllowance?: ComponentType<{ organizationId: string }>;
  PublicRepositoryNotice?: ComponentType<{ repositoryId: string }>;
}>({});
export const DashboardWidgetsProvider = WidgetsContext.Provider;
export function useDashboardWidgets() { return useContext(WidgetsContext); }
