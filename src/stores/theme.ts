import { create } from "zustand";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem("omnix-theme") as Theme) || "system",
  setTheme: (theme) => {
    localStorage.setItem("omnix-theme", theme);
    set({ theme });
    applyTheme(theme);
  },
}));

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "system") {
    const sys = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(sys ? "dark" : "light");
  } else {
    root.classList.add(theme);
  }
}

// Initialize on load
applyTheme(useThemeStore.getState().theme);
