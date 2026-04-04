import test from "node:test";
import assert from "node:assert/strict";

import type { Preset } from "../../capabilities/presets/lib/preset-types.ts";
import {
  filterProjectPresets,
  getProjectPresetCardState,
} from "./project-preset-selection.ts";

function createPreset(overrides: Partial<Preset>): Preset {
  return {
    preset_id: 1,
    user_id: "user-1",
    name: "Code review",
    description: "Review backend services",
    visual_key: "preset-visual-01",
    visual_url: "https://example.com/preset.svg",
    visual_version: "abc123",
    visual_name: "Preset Visual 01",
    prompt_template: "",
    skill_ids: [],
    mcp_server_ids: [],
    plugin_ids: [],
    subagent_configs: [],
    browser_enabled: false,
    memory_enabled: false,
    created_at: "2026-04-02T00:00:00Z",
    updated_at: "2026-04-02T00:00:00Z",
    ...overrides,
  };
}

test("filterProjectPresets matches both name and description", () => {
  const presets = [
    createPreset({ preset_id: 1, name: "Code review" }),
    createPreset({
      preset_id: 2,
      name: "Planner",
      description: "Write implementation plans",
    }),
  ];

  assert.deepEqual(
    filterProjectPresets(presets, "plan").map((preset) => preset.preset_id),
    [2],
  );
  assert.deepEqual(
    filterProjectPresets(presets, "review").map((preset) => preset.preset_id),
    [1],
  );
});

test("getProjectPresetCardState highlights selected presets without color metadata", () => {
  const preset = createPreset({ preset_id: 3 });

  assert.deepEqual(getProjectPresetCardState(preset, 3), {
    selected: true,
  });
});

test("getProjectPresetCardState leaves unselected presets neutral", () => {
  const preset = createPreset({ preset_id: 4 });

  assert.deepEqual(getProjectPresetCardState(preset, 2), {
    selected: false,
  });
});
