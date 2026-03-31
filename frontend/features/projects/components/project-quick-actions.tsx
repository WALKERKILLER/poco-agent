"use client";

import * as React from "react";
import { Files, PenSquare, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

interface ProjectQuickActionsProps {
  onOpenSettings: () => void;
  onRequestRename: () => void;
  onOpenFiles: () => void;
}

interface ActionItem {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}

export function ProjectQuickActions({
  onOpenSettings,
  onRequestRename,
  onOpenFiles,
}: ProjectQuickActionsProps) {
  const { t } = useT("translation");

  const actions: ActionItem[] = [
    {
      key: "presets",
      title: t("project.detail.quickActions.presets.title"),
      description: t("project.detail.quickActions.presets.description"),
      icon: Sparkles,
      onClick: onOpenSettings,
    },
    {
      key: "rename",
      title: t("project.detail.quickActions.rename.title"),
      description: t("project.detail.quickActions.rename.description"),
      icon: PenSquare,
      onClick: onRequestRename,
    },
    {
      key: "files",
      title: t("project.detail.quickActions.files.title"),
      description: t("project.detail.quickActions.files.description"),
      icon: Files,
      onClick: onOpenFiles,
    },
  ];

  return (
    <section className="rounded-3xl border border-border/60 bg-background px-5 py-5 shadow-sm sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {t("project.detail.quickActions.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("project.detail.quickActions.subtitle")}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.key}
              variant="outline"
              className="h-auto items-start justify-start rounded-2xl border-border/60 px-4 py-4 text-left"
              onClick={action.onClick}
            >
              <div className="flex w-full items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    <span className="font-medium text-foreground">
                      {action.title}
                    </span>
                  </div>
                  <p className="whitespace-normal text-sm text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
