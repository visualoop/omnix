import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/print.css";
import { bootstrapTheme } from "./stores/theme";

// Apply persisted theme choice to <html data-theme=…> BEFORE React mounts so
// there's no flash of the default theme.
bootstrapTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
