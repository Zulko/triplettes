/** Cross-browser helpers for installing Triplettes as an app. */

let deferredPrompt = null;
const promptListeners = new Set();
let captureInitialized = false;

function notifyPromptListeners() {
  const available = deferredPrompt !== null;
  promptListeners.forEach((listener) => listener(available));
}

/** Call once at startup so a Chromium install prompt is not missed. */
export function initPwaInstallCapture() {
  if (typeof window === 'undefined' || captureInitialized) return;
  captureInitialized = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notifyPromptListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyPromptListeners();
  });
}

export function subscribeInstallPrompt(listener) {
  promptListeners.add(listener);
  listener(deferredPrompt !== null);
  return () => {
    promptListeners.delete(listener);
  };
}

export function hasNativeInstallPrompt() {
  return deferredPrompt !== null;
}

export function isRunningAsInstalledApp() {
  if (typeof window === 'undefined') return false;
  const displayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const displayFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const displayMinimal = window.matchMedia('(display-mode: minimal-ui)').matches;
  const iosStandalone = window.navigator.standalone === true;
  const androidApp = document.referrer.startsWith('android-app://');
  return displayStandalone || displayFullscreen || displayMinimal || iosStandalone || androidApp;
}

export function detectInstallPlatform() {
  if (typeof navigator === 'undefined') return 'other';

  const ua = navigator.userAgent;
  const platform = navigator.platform ?? '';
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;

  // iPadOS 13+ reports as MacIntel with touch points.
  const isIPad = /iPad/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const isIPhone = /iPhone|iPod/.test(ua);
  const isAppleMobile = isIPhone || isIPad;
  const isAndroid = /Android/i.test(ua);
  const isSafari =
    /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|EdgiOS|FxiOS|OPiOS|Android/i.test(ua);
  const isFirefox = /Firefox|FxiOS/i.test(ua);
  const isMacDesktop = !isIPad && (/Mac/i.test(platform) || /Macintosh/i.test(ua));

  if (isIPad) return 'ipados';
  if (isIPhone || isAppleMobile) return 'ios';
  if (isMacDesktop && isSafari) return 'macos-safari';
  if (isSafari) return 'safari';
  if (isFirefox && !isAndroid) return 'firefox';
  if (/Chrome|Chromium|Edg|OPR|SamsungBrowser|Android/i.test(ua) || isAndroid) return 'chromium';
  return 'other';
}

/** Trigger the native install prompt when available. Returns true if prompted. */
export async function promptNativeInstall() {
  if (!deferredPrompt) return false;
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notifyPromptListeners();
  await promptEvent.prompt();
  try {
    await promptEvent.userChoice;
  } catch {
    // Some browsers reject after dismiss; ignore.
  }
  return true;
}
