import React from "react";
import ReactDOM from "react-dom/client";
import { WebCompanionApp } from "@/pages/WebCompanionApp";
import { registerWebServiceWorker } from "@/web/runtime";
import { bootstrapTheme } from "@/stores/theme";
import "@/index.css";

bootstrapTheme();
registerWebServiceWorker();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <WebCompanionApp />
  </React.StrictMode>,
);
