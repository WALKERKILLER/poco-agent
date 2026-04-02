import test from "node:test";
import assert from "node:assert/strict";

import { getLocalMountPickerGuidance } from "./local-mount-picker-guidance.ts";

test("getLocalMountPickerGuidance shows manual fallback and search limitation without native picker", () => {
  const guidance = getLocalMountPickerGuidance(false);

  assert.deepEqual(guidance, [
    "filesystem.picker.notSupported",
    "filesystem.picker.searchLimitation",
  ]);
});

test("getLocalMountPickerGuidance only shows search limitation when native picker is available", () => {
  const guidance = getLocalMountPickerGuidance(true);

  assert.deepEqual(guidance, ["filesystem.picker.searchLimitation"]);
});
