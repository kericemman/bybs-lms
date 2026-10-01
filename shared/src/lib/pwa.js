const DEFAULT_STATE = Object.freeze({
  canInstall: false,
  isInstalled: false,
  isInstalling: false,
  isOnline: true,
  isUpdating: false,
  updateReady: false
});

let state = DEFAULT_STATE;
let deferredInstallPrompt = null;
let waitingWorker = null;
let initialized = false;
let reloadAfterUpdate = false;
const listeners = new Set();

function publish(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function isStandalone() {
  if (typeof window === "undefined") return false;

  return window.matchMedia?.("(display-mode: standalone)")?.matches
    || window.navigator.standalone === true;
}

function exposeWaitingWorker(worker) {
  waitingWorker = worker;
  publish({ updateReady: Boolean(worker), isUpdating: false });
}

function watchRegistration(registration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    exposeWaitingWorker(registration.waiting);
  }

  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
        exposeWaitingWorker(installingWorker);
      }
    });
  });
}

export function getPwaSnapshot() {
  return state;
}

export function subscribeToPwa(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initializePwa({ registerServiceWorker = Boolean(import.meta.env?.PROD) } = {}) {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  publish({
    isInstalled: isStandalone(),
    isOnline: navigator.onLine
  });

  window.addEventListener("online", () => publish({ isOnline: true }));
  window.addEventListener("offline", () => publish({ isOnline: false }));
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    publish({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    publish({ canInstall: false, isInstalled: true, isInstalling: false });
  });

  if (!registerServiceWorker || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadAfterUpdate) return;
    reloadAfterUpdate = false;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .then((registration) => {
        watchRegistration(registration);
        return registration.update();
      })
      .catch((error) => {
        console.error("BYBS service worker registration failed", error);
      });
  }, { once: true });
}

export async function promptPwaInstall() {
  if (!deferredInstallPrompt) return { outcome: "unavailable" };

  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  publish({ canInstall: false, isInstalling: true });

  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    publish({ isInstalling: false });
    return choice;
  } catch (error) {
    publish({ isInstalling: false });
    console.error("BYBS app installation prompt failed", error);
    return { outcome: "error" };
  }
}

export function applyPwaUpdate() {
  if (!waitingWorker) return false;

  reloadAfterUpdate = true;
  publish({ isUpdating: true });
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
  return true;
}
