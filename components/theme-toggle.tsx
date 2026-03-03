"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

const THEME_LABELS: Record<string, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon-sm" className="opacity-0">
        <Sun className="w-4 h-4" />
      </Button>
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const nextTheme =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={cycleTheme}
          />
        }
      >
        {theme === "dark" ? (
          <Moon className="w-4 h-4" />
        ) : theme === "light" ? (
          <Sun className="w-4 h-4" />
        ) : (
          <Monitor className="w-4 h-4" />
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {THEME_LABELS[theme || "system"]} — click for {THEME_LABELS[nextTheme]}
      </TooltipContent>
    </Tooltip>
  );
}
