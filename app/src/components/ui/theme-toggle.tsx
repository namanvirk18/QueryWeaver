import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Theme = "light" | "dark";

const ThemeToggle = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Get theme from localStorage or default to dark
    const savedTheme = localStorage.getItem("theme") as Theme;
    return savedTheme || "dark";
  });

  useEffect(() => {
    // Apply theme to document
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  const getIcon = () => {
    return theme === "light" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />;
  };

  const getTooltipText = () => {
    return theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode";
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={0}>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            aria-label="Toggle theme"
          >
            {getIcon()}
            <span className="sr-only">{getTooltipText()}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{getTooltipText()}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ThemeToggle;
