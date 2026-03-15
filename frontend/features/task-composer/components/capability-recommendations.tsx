"use client";

import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CapabilitySourceAvatar } from "@/features/capabilities/components/capability-source-avatar";
import type { CapabilityRecommendation } from "@/features/task-composer/types/capability-recommendation";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface CapabilityRecommendationsProps {
  recommendations: CapabilityRecommendation[];
  trackedItems: CapabilityRecommendation[];
  isLoading: boolean;
  showEmptyState: boolean;
  isEnabled: (item: CapabilityRecommendation) => boolean;
  onToggle: (item: CapabilityRecommendation, enabled: boolean) => void;
}

function getCapabilityTypeLabel(
  item: CapabilityRecommendation,
  t: (key: string) => string,
) {
  return item.type === "mcp"
    ? t("hero.capabilityRecommendations.mcpLabel")
    : t("hero.capabilityRecommendations.skillLabel");
}

interface RecommendationCardProps {
  item: CapabilityRecommendation;
  enabled: boolean;
  onToggle: (item: CapabilityRecommendation, enabled: boolean) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function RecommendationCard({
  item,
  enabled,
  onToggle,
  t,
}: RecommendationCardProps) {
  return (
    <div
      className={cn(
        "group flex min-h-[56px] items-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 transition-colors hover:border-border/70 hover:bg-card",
      )}
    >
      <CapabilitySourceAvatar
        name={item.name}
        status={enabled ? "active" : "inactive"}
        className="size-8"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="truncate text-sm font-medium text-foreground">
            {item.name}
          </span>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {getCapabilityTypeLabel(item, t)}
          </Badge>
          {item.default_enabled ? (
            <Badge variant="secondary" className="text-[10px] uppercase">
              {t("hero.capabilityRecommendations.enabledByDefault")}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
          {item.description ||
            t("hero.capabilityRecommendations.noDescription")}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => onToggle(item, checked)}
          aria-label={`${item.name} ${enabled ? t("common.enabled") : t("common.disabled")}`}
          title={enabled ? t("common.enabled") : t("common.disabled")}
        />
      </div>
    </div>
  );
}

export function CapabilityRecommendations({
  recommendations,
  trackedItems,
  isLoading,
  showEmptyState,
  isEnabled,
  onToggle,
}: CapabilityRecommendationsProps) {
  const { t } = useT("translation");
  const itemsToRender: CapabilityRecommendation[] = [];
  const seenKeys = new Set<string>();

  for (const item of recommendations) {
    const key = `${item.type}:${item.id}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    itemsToRender.push(item);
  }

  for (const item of trackedItems) {
    const key = `${item.type}:${item.id}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    itemsToRender.push(item);
  }

  if (!isLoading && itemsToRender.length === 0 && !showEmptyState) {
    return null;
  }

  return (
    <div className="border-t border-border/60 px-4 py-2.5">
      <div className="space-y-2.5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3.5" />
              <span>{t("hero.capabilityRecommendations.title")}</span>
            </div>
            {isLoading ? (
              <span className="text-xs text-muted-foreground">
                {t("hero.capabilityRecommendations.loading")}
              </span>
            ) : null}
          </div>

          {itemsToRender.length > 0 ? (
            <div className="space-y-2">
              {itemsToRender.map((item) => (
                <RecommendationCard
                  key={`${item.type}:${item.id}`}
                  item={item}
                  enabled={isEnabled(item)}
                  onToggle={onToggle}
                  t={t}
                />
              ))}
            </div>
          ) : showEmptyState && !isLoading ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
              {t("hero.capabilityRecommendations.empty")}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
