"use client";

import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { FilesystemMode } from "@/features/chat/types/api/session";

interface LocalFilesystemModeSelectorProps {
  mode: FilesystemMode;
  onModeChange: (mode: FilesystemMode) => void;
  localModeLocked?: boolean;
}

export function LocalFilesystemModeSelector({
  mode,
  onModeChange,
  localModeLocked = false,
}: LocalFilesystemModeSelectorProps) {
  const { t } = useT("translation");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        className={cn(
          "rounded-2xl border p-4 text-left transition-colors",
          mode === "sandbox"
            ? "border-primary bg-primary/5"
            : "border-border/60 bg-card hover:border-border",
        )}
        onClick={() => onModeChange("sandbox")}
      >
        <div className="text-sm font-medium text-foreground">
          {t("filesystem.mode.sandboxTitle")}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {t("filesystem.mode.sandboxDescription")}
        </div>
      </button>
      <button
        type="button"
        disabled={localModeLocked}
        className={cn(
          "rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          mode === "local_mount"
            ? "border-primary bg-primary/5"
            : "border-border/60 bg-card hover:border-border",
        )}
        onClick={() => onModeChange("local_mount")}
      >
        <div className="text-sm font-medium text-foreground">
          {t("filesystem.mode.localMountTitle")}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {t("filesystem.mode.localMountDescription")}
        </div>
      </button>
    </div>
  );
}
