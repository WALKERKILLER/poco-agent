"use client";

import * as React from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }

  return (
    Boolean(target.closest("[contenteditable='true']")) ||
    Boolean(target.closest("[role='textbox']"))
  );
}

/**
 * Hook for registering Shift+Cmd+O (Mac) / Shift+Ctrl+O (Windows) to create a new task.
 */
export function useNewTaskShortcut(onNewTask: () => void) {
  const isMac = React.useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (typeof e.key !== "string" || isEditableTarget(e.target)) {
        return;
      }

      const key = e.key.toLowerCase();
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (e.shiftKey && modifier && key === "o") {
        e.preventDefault();
        e.stopPropagation();
        onNewTask();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isMac, onNewTask]);
}
