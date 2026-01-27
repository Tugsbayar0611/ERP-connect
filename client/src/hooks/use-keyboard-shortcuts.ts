import { useEffect, useCallback } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
  enabled?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
      const target = event.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || 
                      target.tagName === "TEXTAREA" || 
                      target.isContentEditable ||
                      (target.closest('[role="textbox"]') !== null);
      
      if (isInput && event.key !== "Escape") {
        return;
      }

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        if (!keyMatch) continue;

        // Check Ctrl/Cmd modifier (supports both Ctrl and Cmd)
        const needsCtrlModifier = shortcut.ctrlKey === true || shortcut.metaKey === true;
        const hasCtrlModifier = event.ctrlKey || event.metaKey;
        if (needsCtrlModifier && !hasCtrlModifier) continue;
        if (!needsCtrlModifier && hasCtrlModifier && shortcut.key !== "Escape") continue;

        // Check other modifiers
        const shiftMatch = shortcut.shiftKey === undefined ? true : event.shiftKey === shortcut.shiftKey;
        const altMatch = shortcut.altKey === undefined ? true : event.altKey === shortcut.altKey;

        if (shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
