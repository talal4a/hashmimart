import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

// Signals to CSS that JS is alive: scroll reveals and entrances only run
// behind this flag, so content stays visible if a script fails or is slow.
document.documentElement.classList.add("js");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
