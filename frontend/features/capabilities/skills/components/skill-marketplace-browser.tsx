"use client";

import * as React from "react";
import {
  ArrowUpRight,
  Download,
  Search,
  Sparkles,
  Star,
  GitFork,
} from "lucide-react";

import { HeaderSearchInput } from "@/components/shared/header-search-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StaggeredList } from "@/components/ui/staggered-entrance";
import type {
  SkillsMpRecommendationSection,
  SkillsMpSkillItem,
} from "@/features/capabilities/skills/types";
import { useT } from "@/lib/i18n/client";

interface SkillMarketplaceBrowserProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  isLoading: boolean;
  errorMessage: string | null;
  sections: SkillsMpRecommendationSection[];
  items: SkillsMpSkillItem[];
  hasActiveSearch: boolean;
  onPreview: (item: SkillsMpSkillItem) => void;
  onDownload: (item: SkillsMpSkillItem) => void;
  downloadingExternalId?: string | null;
}

function getInitials(value: string | null): string {
  const text = (value || "").trim();
  if (!text) return "?";
  return Array.from(text).slice(0, 2).join("").toUpperCase();
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

function getRepoLabel(url: string | null): string | null {
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

function SkillMarketplaceCard({
  item,
  onPreview,
  onDownload,
  downloadingExternalId,
}: {
  item: SkillsMpSkillItem;
  onPreview: (item: SkillsMpSkillItem) => void;
  onDownload: (item: SkillsMpSkillItem) => void;
  downloadingExternalId?: string | null;
}) {
  const { t, i18n } = useT("translation");
  const updatedAt = formatUpdatedAt(item.updated_at, i18n.language);
  const repoLabel = getRepoLabel(item.github_url);
  const isDownloading = downloadingExternalId === item.external_id;

  return (
    <article className="group overflow-hidden rounded-[1.35rem] border border-border/60 bg-gradient-to-b from-background via-background to-muted/20 shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-[var(--shadow-md)]">
      <div className="space-y-4 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-full border-primary/20 bg-primary/5 text-primary"
              >
                <Sparkles className="size-3.5" />
                SkillsMP
              </Badge>
              {updatedAt ? (
                <span className="text-xs text-muted-foreground">{updatedAt}</span>
              ) : null}
            </div>
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
              {item.name}
            </h3>
          </div>

          <Avatar className="size-10 border border-border/60 bg-muted/30">
            <AvatarImage src={item.author_avatar_url || undefined} alt={item.author || item.name} />
            <AvatarFallback className="text-xs font-semibold text-muted-foreground">
              {getInitials(item.author || item.name)}
            </AvatarFallback>
          </Avatar>
        </div>

        <p className="line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-muted-foreground">
          {item.description || t("library.skillsImport.marketplace.noDescription")}
        </p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {item.author ? (
            <span>{t("library.skillsImport.marketplace.byAuthor", { author: item.author })}</span>
          ) : null}
          {repoLabel ? (
            <Badge
              variant="secondary"
              className="max-w-full truncate rounded-full px-2.5 py-1 font-normal"
            >
              {repoLabel}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Star className="size-3.5" />
            {item.stars.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <GitFork className="size-3.5" />
            {item.forks.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-border/60 bg-muted/10">
        <Button
          variant="ghost"
          className="h-11 rounded-none"
          onClick={() => onPreview(item)}
        >
          {t("library.skillsImport.marketplace.preview")}
        </Button>
        <Button
          variant="ghost"
          className="h-11 rounded-none border-x border-border/60"
          onClick={() => onDownload(item)}
          disabled={isDownloading}
        >
          <Download className="size-4" />
          {isDownloading
            ? t("library.skillsImport.marketplace.downloading")
            : t("library.skillsImport.marketplace.download")}
        </Button>
        <Button variant="ghost" className="h-11 rounded-none" asChild>
          <a href={item.skillsmp_url} target="_blank" rel="noreferrer">
            <ArrowUpRight className="size-4" />
            {t("library.skillsImport.marketplace.jump")}
          </a>
        </Button>
      </div>
    </article>
  );
}

export function SkillMarketplaceBrowser({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onReset,
  isLoading,
  errorMessage,
  sections,
  items,
  hasActiveSearch,
  onPreview,
  onDownload,
  downloadingExternalId,
}: SkillMarketplaceBrowserProps) {
  const { t } = useT("translation");

  const showEmptyState = !isLoading && !errorMessage && items.length === 0;

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-[1.5rem] border border-border/60 bg-gradient-to-br from-muted/30 via-background to-background px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <HeaderSearchInput
            value={searchQuery}
            onChange={onSearchQueryChange}
            placeholder={t("library.skillsImport.placeholders.marketplaceSearch")}
            className="w-full md:w-full"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSearch();
              }
            }}
          />
          <div className="flex items-center gap-2">
            <Button onClick={onSearch} disabled={isLoading} className="shrink-0">
              <Search className="size-4" />
              {t("library.skillsImport.marketplace.search")}
            </Button>
            {hasActiveSearch ? (
              <Button variant="outline" onClick={onReset} disabled={isLoading}>
                {t("library.skillsImport.marketplace.reset")}
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {t("library.skillsImport.hints.marketplace")}
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-64 animate-pulse rounded-[1.35rem] border border-border/60 bg-muted/20"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && hasActiveSearch ? (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {t("library.skillsImport.marketplace.searchResults", {
              count: items.length,
            })}
          </div>
          {showEmptyState ? (
            <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-muted/10 px-5 py-10 text-center text-sm text-muted-foreground">
              {t("library.skillsImport.marketplace.emptySearch")}
            </div>
          ) : (
            <StaggeredList
              items={items}
              show
              className="grid gap-3 sm:grid-cols-2 sm:space-y-0"
              itemClassName="h-full"
              keyExtractor={(item) => item.external_id}
              renderItem={(item) => (
                <SkillMarketplaceCard
                  item={item}
                  onPreview={onPreview}
                  onDownload={onDownload}
                  downloadingExternalId={downloadingExternalId}
                />
              )}
            />
          )}
        </div>
      ) : null}

      {!isLoading && !hasActiveSearch ? (
        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.key} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold tracking-tight">
                    {section.title ||
                      t(`library.skillsImport.marketplace.sections.${section.key}`)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("library.skillsImport.marketplace.recommendationHint")}
                  </p>
                </div>
              </div>
              {section.items.length === 0 ? (
                <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-muted/10 px-5 py-10 text-center text-sm text-muted-foreground">
                  {t("library.skillsImport.marketplace.emptyRecommendations")}
                </div>
              ) : (
                <StaggeredList
                  items={section.items}
                  show
                  className="grid gap-3 sm:grid-cols-2 sm:space-y-0"
                  itemClassName="h-full"
                  keyExtractor={(item) => `${section.key}-${item.external_id}`}
                  renderItem={(item) => (
                    <SkillMarketplaceCard
                      item={item}
                      onPreview={onPreview}
                      onDownload={onDownload}
                      downloadingExternalId={downloadingExternalId}
                    />
                  )}
                />
              )}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
