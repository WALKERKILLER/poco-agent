"use client";

import { ExternalLink, Github, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import type { SkillsMpSkillItem } from "@/features/capabilities/skills/types";
import { useT } from "@/lib/i18n/client";

interface SkillMarketplacePreviewDrawerProps {
  item: SkillsMpSkillItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (item: SkillsMpSkillItem) => void;
  isDownloading?: boolean;
}

function formatUpdatedAt(value: string | null, locale: string): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

function getGithubRepoLabel(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return url;
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length >= 2) {
      return `${segments[0]}/${segments[1].replace(/\.git$/, "")}`;
    }
    return url;
  } catch {
    return url;
  }
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;

  return (
    <div className="grid grid-cols-[5rem_1fr] gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground break-all">{value}</span>
    </div>
  );
}

export function SkillMarketplacePreviewDrawer({
  item,
  open,
  onOpenChange,
  onDownload,
  isDownloading = false,
}: SkillMarketplacePreviewDrawerProps) {
  const { t, i18n } = useT("translation");

  if (!item) return null;

  const updatedAt = formatUpdatedAt(item.updated_at, i18n.language);
  const repoLabel = getGithubRepoLabel(item.github_url);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="right-0 h-full w-full max-w-xl border-l bg-background">
        <DrawerHeader className="gap-3 border-b border-border/60 px-6 py-5 text-left">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-primary/20 bg-primary/5 text-primary"
                >
                  <Sparkles className="size-3.5" />
                  {t("library.skillsImport.marketplace.previewBadge")}
                </Badge>
                {item.author ? (
                  <span className="text-sm text-muted-foreground">
                    {t("library.skillsImport.marketplace.byAuthor", {
                      author: item.author,
                    })}
                  </span>
                ) : null}
              </div>
              <DrawerTitle className="text-xl font-semibold tracking-tight">
                {item.name}
              </DrawerTitle>
              <DrawerDescription className="max-w-lg text-sm leading-6 text-muted-foreground">
                {item.description ||
                  t("library.skillsImport.marketplace.noDescription")}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t("library.skillsImport.marketplace.stars")}
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {item.stars.toLocaleString()}
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t("library.skillsImport.marketplace.forks")}
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {item.forks.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/60 bg-background px-4 py-4">
            <DetailRow
              label={t("library.skillsImport.marketplace.repo")}
              value={repoLabel}
            />
            <DetailRow
              label={t("library.skillsImport.marketplace.branch")}
              value={item.branch}
            />
            <DetailRow
              label={t("library.skillsImport.marketplace.path")}
              value={item.relative_skill_path}
            />
            <DetailRow
              label={t("library.skillsImport.marketplace.updatedAt")}
              value={updatedAt}
            />
          </div>

          {item.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="rounded-full px-3 py-1 text-xs"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-t border-border/60 px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {item.github_url ? (
              <Button variant="outline" asChild>
                <a href={item.github_url} target="_blank" rel="noreferrer">
                  <Github className="size-4" />
                  {t("library.skillsImport.marketplace.openGithub")}
                </a>
              </Button>
            ) : null}
            <Button
              variant="outline"
              asChild
              className="border-border/70 bg-background"
            >
              <a href={item.skillsmp_url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                {t("library.skillsImport.marketplace.jump")}
              </a>
            </Button>
            <Button
              onClick={() => onDownload(item)}
              disabled={isDownloading}
              className="shadow-sm"
            >
              {isDownloading
                ? t("library.skillsImport.marketplace.downloading")
                : t("library.skillsImport.marketplace.download")}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
