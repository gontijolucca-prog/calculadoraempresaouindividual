/**
 * Version Checker: Polls for app updates and notifies user
 *
 * Strategy:
 * - Fetches /version.json every 30s + on focus
 * - Only reloads if no unsaved edits detected
 * - Shows non-blocking toast with manual reload option
 * - No reload loops (version.json is immutable, index.html is revalidated)
 */

export interface VersionCheckConfig {
  pollIntervalMs?: number; // default 30000
  onUpdateAvailable?: () => void;
  onReloadNeeded?: () => void;
  checkUnsavedEdits?: () => boolean; // returns true if unsaved work exists
}

let lastVersion: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let updateAvailableCallback: (() => void) | null = null;
let reloadNeededCallback: (() => void) | null = null;
let checkUnsavedEditsFn: (() => boolean) | null = null;

export function initVersionChecker(config: VersionCheckConfig = {}) {
  const {
    pollIntervalMs = 30000,
    onUpdateAvailable,
    onReloadNeeded,
    checkUnsavedEdits,
  } = config;

  updateAvailableCallback = onUpdateAvailable || null;
  reloadNeededCallback = onReloadNeeded || null;
  checkUnsavedEditsFn = checkUnsavedEdits || null;

  // Initial version fetch
  fetchAndCheckVersion();

  // Poll on interval
  pollTimer = setInterval(() => {
    fetchAndCheckVersion();
  }, pollIntervalMs);

  // Also check when user returns to tab (focus event)
  window.addEventListener('focus', () => {
    fetchAndCheckVersion();
  });

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
  });
}

async function fetchAndCheckVersion() {
  try {
    // Append cache-bust query to force fresh fetch from CF
    const response = await fetch('/version.json?t=' + Date.now(), {
      cache: 'no-cache',
    });

    if (!response.ok) {
      console.warn('[Version Checker] Failed to fetch version:', response.status);
      return;
    }

    const data = (await response.json()) as { buildId: string; timestamp: number };
    const currentVersion = data.buildId;

    if (lastVersion === null) {
      // First check — just record it
      lastVersion = currentVersion;
      return;
    }

    if (currentVersion !== lastVersion) {
      console.log(
        '[Version Checker] Update detected:',
        lastVersion,
        '→',
        currentVersion,
      );

      // Call callback to show toast
      updateAvailableCallback?.();

      // Check if we can reload safely
      if (!checkUnsavedEditsFn || !checkUnsavedEditsFn()) {
        // No unsaved edits — safe to reload automatically after brief delay
        // (gives user time to see the toast)
        setTimeout(() => {
          console.log('[Version Checker] Reloading to new version...');
          reloadNeededCallback?.();
          // Hard reload: bypasses cache, fetches fresh index.html + all assets
          window.location.replace(window.location.href);
        }, 2000);
      } else {
        console.log(
          '[Version Checker] Unsaved edits detected — showing manual reload option',
        );
        // User will see toast with manual "Reload now" button
      }

      lastVersion = currentVersion;
    }
  } catch (error) {
    console.error('[Version Checker] Error checking version:', error);
  }
}

export function stopVersionChecker() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function manualReload() {
  console.log('[Version Checker] Manual reload triggered');
  window.location.replace(window.location.href);
}
