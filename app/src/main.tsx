import "./styles/index.css";
import "./theme/brand.css";
import "./app.css";
import "./tekjobs.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// Tells a `tekjobs serve` server the app is still open; it closes itself a couple of minutes after the last beat.
const beat = () => { fetch("/api/ping", { cache: "no-store" }).catch(() => {}); };
beat();
setInterval(beat, 20_000);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
