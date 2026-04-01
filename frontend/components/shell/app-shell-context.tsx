"use client";

import * as React from "react";

import type {
  AddTaskOptions,
  ProjectItem,
  TaskHistoryItem,
} from "@/features/projects";
import type { SettingsTabId } from "@/features/settings";

export type ProjectRepoDefaultsInput = {
  repo_url?: string | null;
  git_branch?: string | null;
  git_token_env_key?: string | null;
};

export type ProjectCreateInput = {
  name: string;
  description?: string | null;
  default_model?: string | null;
  mount_enabled?: boolean;
  mount_name?: string | null;
  mount_path?: string | null;
  mount_access_mode?: "ro" | "rw" | null;
} & ProjectRepoDefaultsInput;

export type ProjectUpdatesInput = {
  name?: string;
  description?: string | null;
  default_model?: string | null;
  mount_enabled?: boolean;
  mount_name?: string | null;
  mount_path?: string | null;
  mount_access_mode?: "ro" | "rw" | null;
} & ProjectRepoDefaultsInput;

export interface AppShellContextValue {
  lng: string;
  openSettings: (tab?: SettingsTabId) => void;

  projects: ProjectItem[];
  addProject: (input: ProjectCreateInput) => Promise<ProjectItem | null>;
  updateProject: (
    projectId: string,
    updates: ProjectUpdatesInput,
  ) => Promise<ProjectItem | null>;
  deleteProject: (projectId: string) => Promise<void>;

  taskHistory: TaskHistoryItem[];
  pinnedTaskIds: string[];
  addTask: (title: string, options?: AddTaskOptions) => TaskHistoryItem;
  removeTask: (taskId: string) => Promise<void>;
  moveTask: (taskId: string, projectId: string | null) => Promise<void>;
  toggleTaskPin: (taskId: string) => void;
  refreshTasks: () => Promise<void>;
}

const AppShellContext = React.createContext<AppShellContextValue | null>(null);

export function AppShellProvider({
  value,
  children,
}: {
  value: AppShellContextValue;
  children: React.ReactNode;
}) {
  return (
    <AppShellContext.Provider value={value}>
      {children}
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  const context = React.useContext(AppShellContext);
  if (!context) {
    throw new Error("useAppShell must be used within AppShellProvider");
  }
  return context;
}
