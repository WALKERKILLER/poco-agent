"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { CapabilityDialogContent } from "@/features/capabilities/components/capability-dialog-content";
import { presetsService } from "@/features/capabilities/presets/api/presets-api";
import { PRESET_ICON_MAP } from "@/features/capabilities/presets/lib/preset-visuals";
import type { Preset } from "@/features/capabilities/presets/lib/preset-types";
import { useT } from "@/lib/i18n/client";

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  projectDefaultPresetId: number | null;
  onProjectDefaultPresetChange: (presetId: number | null) => Promise<void>;
}

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  projectDefaultPresetId,
  onProjectDefaultPresetChange,
}: ProjectSettingsDialogProps) {
  const { t } = useT("translation");
  const [allPresets, setAllPresets] = React.useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>("none");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const presets = await presetsService.listPresets({ revalidate: 0 });
      setAllPresets(presets);
    } catch (error) {
      console.error(
        `[ProjectSettingsDialog] Failed to fetch presets for project ${projectId}`,
        error,
      );
      toast.error(t("project.settingsPanel.presets.toasts.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [projectId, t]);

  React.useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  React.useEffect(() => {
    if (!open) return;
    setSelectedPresetId(
      projectDefaultPresetId ? String(projectDefaultPresetId) : "none",
    );
  }, [open, projectDefaultPresetId]);

  const currentDefaultPreset = React.useMemo(
    () =>
      allPresets.find((preset) => preset.preset_id === projectDefaultPresetId) ?? null,
    [allPresets, projectDefaultPresetId],
  );

  const handleSave = React.useCallback(async () => {
    const nextPresetId =
      selectedPresetId === "none" ? null : Number(selectedPresetId);
    setIsSaving(true);
    try {
      await onProjectDefaultPresetChange(nextPresetId);
      toast.success(t("project.settingsPanel.presets.toasts.defaultUpdated"));
    } catch (error) {
      console.error(
        `[ProjectSettingsDialog] Failed to update default preset for project ${projectId}`,
        error,
      );
      toast.error(t("project.settingsPanel.presets.toasts.defaultFailed"));
    } finally {
      setIsSaving(false);
    }
  }, [
    onProjectDefaultPresetChange,
    projectId,
    selectedPresetId,
    t,
  ]);

  const iconName =
    currentDefaultPreset?.icon && currentDefaultPreset.icon in PRESET_ICON_MAP
      ? currentDefaultPreset.icon
      : "default";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CapabilityDialogContent
        title={t("project.settingsPanel.dialogTitle", { name: projectName })}
        description={t("project.settingsPanel.dialogDescription")}
        maxWidth="48rem"
        maxHeight="80dvh"
        desktopMaxHeight="86dvh"
        footer={
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.close")}
            </Button>
            <Button onClick={() => void handleSave()} disabled={isLoading || isSaving}>
              {isSaving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        }
      >
        <div className="space-y-5">
          <section className="space-y-3 rounded-2xl border border-border/60 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">
                {t("project.settingsPanel.presets.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("project.settingsPanel.presets.description")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t("project.settingsPanel.presets.addLabel")}</Label>
              <Select
                value={selectedPresetId}
                onValueChange={setSelectedPresetId}
                disabled={isLoading || allPresets.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t("project.settingsPanel.presets.addPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t("project.settingsPanel.presets.addPlaceholder")}
                  </SelectItem>
                  {allPresets.map((preset) => (
                    <SelectItem
                      key={preset.preset_id}
                      value={String(preset.preset_id)}
                    >
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-3">
            {isLoading ? (
              <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-border/60 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("project.settingsPanel.presets.loading")}
              </div>
            ) : currentDefaultPreset ? (
              <div className="rounded-2xl border border-border/60 bg-card p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40"
                    style={{
                      color: currentDefaultPreset.color || "var(--primary)",
                    }}
                  >
                    {React.createElement(PRESET_ICON_MAP[iconName], {
                      className: "size-4",
                    })}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {currentDefaultPreset.name}
                      </p>
                      <Badge variant="secondary">
                        {t("project.settingsPanel.presets.default")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {currentDefaultPreset.description?.trim() ||
                        t("project.settingsPanel.presets.emptyDescription")}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                    <Sparkles className="size-3" />
                    {t("project.settingsPanel.presets.stats.skills", {
                      count: currentDefaultPreset.skill_ids.length,
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                    {t("project.settingsPanel.presets.stats.mcp", {
                      count: currentDefaultPreset.mcp_server_ids.length,
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                    {t("project.settingsPanel.presets.stats.plugins", {
                      count: currentDefaultPreset.plugin_ids.length,
                    })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
                {t("project.settingsPanel.presets.empty")}
              </div>
            )}
          </section>
        </div>
      </CapabilityDialogContent>
    </Dialog>
  );
}
