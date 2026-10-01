import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { initializePwa, PwaStatus } from "@bybs/shared";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import "./styles/index.css";

initializePwa();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <PwaStatus />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
