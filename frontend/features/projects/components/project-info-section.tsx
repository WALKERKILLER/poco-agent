"use client";

import * as React from "react";

import { ProjectFilesDialog } from "@/features/projects/components/project-files-dialog";
import { ProjectInfoHeader } from "@/features/projects/components/project-info-header";
import { ProjectQuickActions } from "@/features/projects/components/project-quick-actions";
import { ProjectStats } from "@/features/projects/components/project-stats";
import type { ProjectItem } from "@/features/projects/types";

interface ProjectInfoSectionProps {
  project: ProjectItem;
  sessionCount: number;
  presetCount: number;
  onUpdateProject: (updates: Partial<ProjectItem>) => Promise<void>;
  onOpenSettings: () => void;
}

export function ProjectInfoSection({
  project,
  sessionCount,
  presetCount,
  onUpdateProject,
  onOpenSettings,
}: ProjectInfoSectionProps) {
  const [renameSignal, setRenameSignal] = React.useState(0);
  const [isFilesDialogOpen, setIsFilesDialogOpen] = React.useState(false);

  return (
    <>
      <div className="grid gap-4">
        <ProjectInfoHeader
          project={project}
          onUpdate={onUpdateProject}
          renameSignal={renameSignal}
        />
        <ProjectStats
          sessionCount={sessionCount}
          presetCount={presetCount}
          updatedAt={project.updatedAt}
        />
        <ProjectQuickActions
          onOpenSettings={onOpenSettings}
          onRequestRename={() => setRenameSignal((value) => value + 1)}
          onOpenFiles={() => setIsFilesDialogOpen(true)}
        />
      </div>

      <ProjectFilesDialog
        open={isFilesDialogOpen}
        onOpenChange={setIsFilesDialogOpen}
        projectId={project.id}
        projectName={project.name}
      />
    </>
  );
}
