import type { Preset } from "../../capabilities/presets/lib/preset-types.ts";

export interface ProjectPresetCardState {
  selected: boolean;
}

export function filterProjectPresets(
  presets: Preset[],
  query: string,
): Preset[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return presets;
  }

  return presets.filter((preset) => {
    return (
      preset.name.toLowerCase().includes(normalizedQuery) ||
      (preset.description ?? "").toLowerCase().includes(normalizedQuery)
    );
  });
}

export function getProjectPresetCardState(
  preset: Preset,
  activeDefaultPresetId: number | null,
): ProjectPresetCardState {
  return {
    selected: activeDefaultPresetId === preset.preset_id,
  };
}
