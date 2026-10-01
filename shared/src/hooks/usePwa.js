import { useSyncExternalStore } from "react";
import {
  applyPwaUpdate,
  getPwaSnapshot,
  promptPwaInstall,
  subscribeToPwa
} from "../lib/pwa.js";

export function usePwa() {
  const snapshot = useSyncExternalStore(subscribeToPwa, getPwaSnapshot, getPwaSnapshot);

  return {
    ...snapshot,
    applyUpdate: applyPwaUpdate,
    install: promptPwaInstall
  };
}
