import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installE2eHook } from "./game/e2e";
import "./styles.css";

if (new URLSearchParams(location.search).get("e2e") === "1") installE2eHook();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
