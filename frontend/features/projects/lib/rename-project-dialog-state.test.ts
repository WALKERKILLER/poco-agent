import test from "node:test";
import assert from "node:assert/strict";

import { createRenameProjectDialogState } from "./rename-project-dialog-state.ts";

test("createRenameProjectDialogState derives dialog state from raw project values", () => {
  const state = createRenameProjectDialogState({
    projectName: "Docs",
    projectDescription: "Project docs",
    projectDefaultModel: "  claude-sonnet-4-20250514  ",
    projectLocalMounts: [
      {
        id: "notes",
        name: "Notes",
        host_path: "/tmp/notes",
        access_mode: "rw",
      },
    ],
  });

  assert.equal(state.name, "Docs");
  assert.equal(state.description, "Project docs");
  assert.deepEqual(state.modelSelection, {
    modelId: "claude-sonnet-4-20250514",
    providerId: null,
  });
  assert.equal(state.filesystemMode, "local_mount");
  assert.equal(state.mountRows.length, 1);
  assert.equal(state.mountRows[0]?.host_path, "/tmp/notes");
});
