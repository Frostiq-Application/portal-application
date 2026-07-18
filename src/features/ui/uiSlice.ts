import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

const THEME_KEY = "frostique-portal-theme";

type Theme = "light" | "dark";

interface UiState {
  theme: Theme;
}

function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark") return t;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

const uiSlice = createSlice({
  name: "ui",
  initialState: { theme: loadTheme() } as UiState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
      try {
        localStorage.setItem(THEME_KEY, action.payload);
      } catch {
        /* ignore */
      }
    },
    toggleTheme(state) {
      state.theme = state.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, state.theme);
      } catch {
        /* ignore */
      }
    },
  },
});

export const { setTheme, toggleTheme } = uiSlice.actions;
export default uiSlice.reducer;
