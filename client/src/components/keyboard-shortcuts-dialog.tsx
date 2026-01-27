import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: Array<{
    keys: string[];
    description: string;
    category?: string;
  }>;
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  shortcuts,
}: KeyboardShortcutsDialogProps) {
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || "Ерөнхий";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);

  const formatKey = (key: string) => {
    const keyMap: Record<string, string> = {
      ctrl: "Ctrl",
      cmd: "⌘",
      meta: "⌘",
      shift: "Shift",
      alt: "Alt",
      escape: "Esc",
      enter: "Enter",
      "/": "/",
      k: "K",
      n: "N",
    };

    return keyMap[key.toLowerCase()] || key.toUpperCase();
  };

  const formatKeys = (keys: string[]) => {
    return keys.map(formatKey).join(" + ");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Гарны товчлуур</DialogTitle>
          <DialogDescription>
            Системийн бүх гарны товчлууруудын жагсаалт
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {Object.entries(groupedShortcuts).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                {category}
              </h3>
              <div className="space-y-2">
                {items.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span className="text-sm text-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, keyIndex) => {
                        const keys = key.split("+").map((k) => k.trim());
                        return (
                          <Badge
                            key={keyIndex}
                            variant="outline"
                            className="font-mono text-xs px-2 py-1"
                          >
                            {formatKeys(keys)}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
