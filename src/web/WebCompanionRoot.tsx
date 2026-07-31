import { useEffect } from "react";
import { WebCompanionApp } from "@/pages/WebCompanionApp";
import { registerWebServiceWorker } from "@/web/runtime";

export function WebCompanionRoot() {
  useEffect(() => {
    registerWebServiceWorker();
  }, []);

  return <WebCompanionApp />;
}
