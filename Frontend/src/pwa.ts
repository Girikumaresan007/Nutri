/**
 * NutriTrack AI — PWA Service Worker Registration & Installation Helper
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isStandaloneMedia || isIosStandalone;
}

export function subscribeInstallPrompt(callback: (canInstall: boolean) => void): () => void {
  installListeners.add(callback);
  // If already running as an installed standalone PWA, never offer installation
  if (isPwaStandalone()) {
    callback(false);
  } else {
    callback(deferredPrompt !== null);
  }
  return () => {
    installListeners.delete(callback);
  };
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt || isPwaStandalone()) {
    return 'unavailable';
  }
  try {
    const promptEvent = deferredPrompt;
    // Consume prompt immediately so it cannot be invoked concurrently or repeatedly
    deferredPrompt = null;
    installListeners.forEach((listener) => listener(false));

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    return outcome;
  } catch (err) {
    console.warn('[NutriTrack PWA] Install prompt error:', err);
    return 'unavailable';
  }
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // In development mode (e.g. localhost / Vite dev), unregister existing service workers
  // to prevent stale caches from poisoning module scripts and Hot Module Replacement (HMR).
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) {
            console.log('[NutriTrack PWA] Cleaned up dev service worker registration:', registration.scope);
          }
        });
      }
    });
    return;
  }

  // If already running in standalone PWA mode, suppress install prompts
  if (!isPwaStandalone()) {
    // Capture the browser installation prompt event cleanly
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      installListeners.forEach((listener) => listener(true));
      console.log('[NutriTrack PWA] App install prompt captured and available.');
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      installListeners.forEach((listener) => listener(false));
      console.log('[NutriTrack PWA] NutriTrack was successfully installed on the device.');
    });
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[NutriTrack PWA] ServiceWorker registered with scope:', registration.scope);

        // Periodically check for application updates (hourly)
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);

        // Check for updates when user returns to the tab/app
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });
      })
      .catch((error) => {
        console.warn('[NutriTrack PWA] ServiceWorker registration failed:', error);
      });
  });
}
