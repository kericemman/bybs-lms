import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { initializePwa, PwaStatus } from "@bybs/shared";
import App from "./App.jsx";
import "./styles/index.css";

initializePwa();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <PwaStatus />
    </BrowserRouter>
  </React.StrictMode>
);
