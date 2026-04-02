"use client";

import { AlertCircle, FolderPlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/client";
import { getLocalMountPickerGuidance } from "@/features/task-composer/lib/local-mount-picker-guidance";
import type { LocalMountDraftRow } from "@/features/task-composer";

interface LocalMountEditorProps {
  rows: LocalMountDraftRow[];
  nativePickerSupported: boolean;
  onAddRow: () => void;
  onRemoveRow: (clientId: string) => void;
  onRowChange: (
    clientId: string,
    field: keyof LocalMountDraftRow,
    nextValue: string,
  ) => void;
  idPrefix?: string;
  description?: string;
}

export function LocalMountEditor({
  rows,
  nativePickerSupported,
  onAddRow,
  onRemoveRow,
  onRowChange,
  idPrefix = "local-mount",
  description,
}: LocalMountEditorProps) {
  const { t } = useT("translation");
  const pickerGuidance = getLocalMountPickerGuidance(nativePickerSupported);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">
            {t("filesystem.mounts.title")}
          </div>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={onAddRow}
        >
          <FolderPlus className="size-4" />
          {t("filesystem.actions.addMount")}
        </Button>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4 text-sm text-amber-950 dark:text-amber-100">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1.5">
            {pickerGuidance.map((guidanceKey) => (
              <p key={guidanceKey}>{t(guidanceKey)}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.client_id}
            className="rounded-2xl border border-border/60 bg-card p-4"
          >
            <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.7fr)_180px_44px]">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor={`${idPrefix}-name-${row.client_id}`}
                >
                  {t("filesystem.fields.name")}
                </label>
                <Input
                  id={`${idPrefix}-name-${row.client_id}`}
                  value={row.name}
                  onChange={(event) =>
                    onRowChange(row.client_id, "name", event.target.value)
                  }
                  placeholder={t("filesystem.placeholders.name")}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor={`${idPrefix}-path-${row.client_id}`}
                >
                  {t("filesystem.fields.path")}
                </label>
                <Input
                  id={`${idPrefix}-path-${row.client_id}`}
                  value={row.host_path}
                  onChange={(event) =>
                    onRowChange(row.client_id, "host_path", event.target.value)
                  }
                  placeholder={t("filesystem.placeholders.path")}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor={`${idPrefix}-access-${row.client_id}`}
                >
                  {t("filesystem.fields.access")}
                </label>
                <Select
                  value={row.access_mode}
                  onValueChange={(nextValue) =>
                    onRowChange(row.client_id, "access_mode", nextValue)
                  }
                >
                  <SelectTrigger id={`${idPrefix}-access-${row.client_id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ro">
                      {t("filesystem.accessModes.ro")}
                    </SelectItem>
                    <SelectItem value="rw">
                      {t("filesystem.accessModes.rw")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div
                  className="invisible text-sm font-medium"
                  aria-hidden="true"
                >
                  {t("filesystem.fields.access")}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onRemoveRow(row.client_id)}
                    aria-label={t("filesystem.actions.removeMount")}
                    title={t("filesystem.actions.removeMount")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
