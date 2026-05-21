import { registerSW } from "virtual:pwa-register";

export const registerDistyncServiceWorker = () => {
  if (typeof window === "undefined") {
    return;
  }

  registerSW({
    immediate: true,
    onRegistered() {
      console.info("DISTYNC service worker registered.");
    },
    onRegisterError(error) {
      console.error("DISTYNC service worker registration failed:", error);
    },
  });
};
