import { registerSW } from "virtual:pwa-register";

const SERVICE_WORKER_STATUSES = {
  CHECKING: "CHECKING",
  ACTIVE: "ACTIVE",
  INSTALLING: "INSTALLING",
  WAITING: "WAITING",
  NOT_REGISTERED: "NOT_REGISTERED",
  REGISTRATION_FAILED: "REGISTRATION_FAILED",
  UNSUPPORTED: "UNSUPPORTED",
};

const serviceWorkerListeners = new Set();
let serviceWorkerStatusSnapshot = {
  status: SERVICE_WORKER_STATUSES.CHECKING,
  checkedAt: "",
};

const getIsoNow = () => new Date().toISOString();

const emitServiceWorkerStatus = (status) => {
  serviceWorkerStatusSnapshot = {
    status,
    checkedAt: getIsoNow(),
  };

  serviceWorkerListeners.forEach((listener) => {
    try {
      listener(serviceWorkerStatusSnapshot);
    } catch (_error) {
      // Listener errors must not block status updates.
    }
  });
};

const getRegistrationStatus = (registration) => {
  if (!registration) {
    return SERVICE_WORKER_STATUSES.NOT_REGISTERED;
  }

  if (registration.installing) {
    return SERVICE_WORKER_STATUSES.INSTALLING;
  }

  if (registration.waiting) {
    return SERVICE_WORKER_STATUSES.WAITING;
  }

  if (registration.active || navigator.serviceWorker?.controller) {
    return SERVICE_WORKER_STATUSES.ACTIVE;
  }

  return SERVICE_WORKER_STATUSES.NOT_REGISTERED;
};

const watchServiceWorkerRegistration = (registration) => {
  if (!registration) {
    emitServiceWorkerStatus(SERVICE_WORKER_STATUSES.NOT_REGISTERED);
    return;
  }

  const applyRegistrationStatus = () => {
    emitServiceWorkerStatus(getRegistrationStatus(registration));
  };

  applyRegistrationStatus();
  registration.addEventListener("updatefound", applyRegistrationStatus);
  registration.installing?.addEventListener("statechange", applyRegistrationStatus);
  registration.waiting?.addEventListener("statechange", applyRegistrationStatus);
  registration.active?.addEventListener("statechange", applyRegistrationStatus);
  navigator.serviceWorker?.addEventListener("controllerchange", applyRegistrationStatus);
};

export const getDistyncServiceWorkerStatusSnapshot = () =>
  serviceWorkerStatusSnapshot;

export const subscribeToDistyncServiceWorkerStatus = (listener) => {
  serviceWorkerListeners.add(listener);
  return () => serviceWorkerListeners.delete(listener);
};

export const refreshDistyncServiceWorkerStatus = async () => {
  if (typeof window === "undefined") {
    return serviceWorkerStatusSnapshot;
  }

  if (!("serviceWorker" in navigator)) {
    emitServiceWorkerStatus(SERVICE_WORKER_STATUSES.UNSUPPORTED);
    return serviceWorkerStatusSnapshot;
  }

  emitServiceWorkerStatus(SERVICE_WORKER_STATUSES.CHECKING);

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    watchServiceWorkerRegistration(registration);
  } catch (_error) {
    emitServiceWorkerStatus(SERVICE_WORKER_STATUSES.REGISTRATION_FAILED);
  }

  return serviceWorkerStatusSnapshot;
};

export const registerDistyncServiceWorker = () => {
  if (typeof window === "undefined") {
    return;
  }

  if (!("serviceWorker" in navigator)) {
    emitServiceWorkerStatus(SERVICE_WORKER_STATUSES.UNSUPPORTED);
    return;
  }

  registerSW({
    immediate: true,
    onRegistered(registration) {
      watchServiceWorkerRegistration(registration);
      console.info("DISTYNC service worker registered.");
    },
    onRegisterError(error) {
      emitServiceWorkerStatus(SERVICE_WORKER_STATUSES.REGISTRATION_FAILED);
      console.error("DISTYNC service worker registration failed:", error);
    },
  });
};
