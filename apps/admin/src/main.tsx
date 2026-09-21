import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import { AdminDataProvider } from "./context/AdminDataContext";
import "./styles/design-tokens.css";
import "./styles/global.css";

const rootElement = document.getElementById("root");
const routerBasename =
  import.meta.env.BASE_URL === "/"
    ? undefined
    : import.meta.env.BASE_URL.replace(/\/$/, "");
const routerProps = routerBasename ? { basename: routerBasename } : {};

if (!rootElement) {
  throw new Error("未找到应用挂载节点 #root");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter {...routerProps}>
      <AdminDataProvider>
        <App />
      </AdminDataProvider>
    </BrowserRouter>
  </StrictMode>,
);
