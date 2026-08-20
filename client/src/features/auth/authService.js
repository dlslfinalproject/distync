const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const GOOGLE_SCRIPT_SOURCE = "https://accounts.google.com/gsi/client";
let googleScriptPromise;
let initializedGoogleClientId = null;
let currentCredentialHandler = null;

const handleJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || fallbackMessage);
  }

  return payload;
};

export const loadGoogleIdentityScript = () => {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      `script[src="${GOOGLE_SCRIPT_SOURCE}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google));
      existingScript.addEventListener("error", () => {
        reject(new Error("Failed to load Google Sign-In"));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SOURCE;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

export const renderGoogleSignInButton = async ({
  element,
  clientId,
  onCredential,
}) => {
  if (!element) {
    return;
  }

  if (!clientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID is missing");
  }

  await loadGoogleIdentityScript();

  if (!window.google?.accounts?.id) {
    throw new Error("Google Identity Services is unavailable");
  }

  currentCredentialHandler = onCredential;

  if (initializedGoogleClientId !== clientId) {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (
          response?.credential &&
          typeof currentCredentialHandler === "function"
        ) {
          currentCredentialHandler(response.credential);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    initializedGoogleClientId = clientId;
  }

  element.innerHTML = "";
  const buttonWidth = Math.floor(element.getBoundingClientRect().width || 360);

  window.google.accounts.id.renderButton(element, {
    theme: "outline",
    size: "large",
    shape: "rectangular",
    text: "signin_with",
    width: Math.min(360, Math.max(200, buttonWidth)),
    logo_alignment: "center",
  });
};

export const authenticateWithGoogleIdToken = async (idToken) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id_token: idToken,
    }),
  });

  return handleJsonResponse(response, "Google sign-in failed");
};

export const authenticateWithDevelopmentRole = async (role) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/development`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role,
    }),
  });

  return handleJsonResponse(response, "Development sign-in failed");
};

export const clearGooglePromptState = () => {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }
};
