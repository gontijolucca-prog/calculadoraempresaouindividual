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
let pendingReload = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let updateAvailableCallback: (() => void) | null = null;
let reloadNeededCallback: (() => void) | null = null;
let checkUnsavedEditsFn: (() => boolean) | null = null;
let focusHandler: (() => void) | null = null;
let visHandler: (() => void) | null = null;
let unloadHandler: (() => void) | null = null;

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

  // Also check when user returns to the tab. `focus` não dispara sempre (trocar
  // de separador, voltar de outra app no telemóvel), por isso ouvimos também
  // `visibilitychange` — garante que ninguém fica preso numa versão antiga só
  // porque o evento de foco não chegou a disparar.
  focusHandler = () => fetchAndCheckVersion();
  visHandler = () => {
    if (document.visibilityState === 'visible') { fetchAndCheckVersion(); return; }
    // Separador escondido com versão nova e sem edições por guardar: recarrega
    // já, para quando a pessoa voltar estar na versão certa sem pedir nada.
    if (pendingReload && (!checkUnsavedEditsFn || !checkUnsavedEditsFn())) {
      pendingReload = false;
      window.location.replace(window.location.href);
    }
  };
  unloadHandler = () => { if (pollTimer) clearInterval(pollTimer); };
  const onlineHandler = () => fetchAndCheckVersion();
  window.addEventListener('online', onlineHandler);
  window.addEventListener('pageshow', () => fetchAndCheckVersion());
  window.addEventListener('focus', focusHandler);
  document.addEventListener('visibilitychange', visHandler);
  window.addEventListener('beforeunload', unloadHandler);
}

async function fetchAndCheckVersion() {
  // Em dev não existe /version.json (o Vite devolve o index.html) — skip.
  if (import.meta.env.DEV) return;
  try {
    // Append cache-bust query to force fresh fetch from CF
    const response = await fetch('/version.json?t=' + Date.now(), {
      cache: 'no-cache',
    });

    if (!response.ok) {
      return;
    }

    // Pode vir HTML (proxy/CDN a devolver 200 com fallback) — nunca deixar rebentar o parse.
    let data: { buildId?: string; timestamp?: number };
    try { data = (await response.json()) as typeof data; } catch { return; }
    if (!data.buildId) return;
    const currentVersion = data.buildId;

    if (lastVersion === null) {
      // First check — just record it
      lastVersion = currentVersion;
      return;
    }

    if (currentVersion !== lastVersion) {
      pendingReload = true;
      if (import.meta.env.DEV) console.log(
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
        // (gives user time to see the toast + flush audit queue)
        setTimeout(async () => {
          if (import.meta.env.DEV) console.log('[Version Checker] Reloading to new version...');
          reloadNeededCallback?.();
          try { window.dispatchEvent(new CustomEvent('estudo360:flush-audit')); } catch {}
          // Dá 900ms para o flush da queue de audit ir para Firestore antes do reload
          await new Promise(r => setTimeout(r, 900));
          // Hard reload: bypasses cache, fetches fresh index.html + all assets
          window.location.replace(window.location.href);
        }, 2000);
      } else {
        if (import.meta.env.DEV) console.log(
          '[Version Checker] Unsaved edits detected — showing manual reload option',
        );
        // User will see toast with manual "Reload now" button
      }

      lastVersion = currentVersion;
    }
  } catch (error) {
    if (import.meta.env.DEV) console.error('[Version Checker] Error checking version:', error);
  }
}

export function stopVersionChecker() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (focusHandler) { window.removeEventListener('focus', focusHandler); focusHandler = null; }
  if (visHandler) { document.removeEventListener('visibilitychange', visHandler); visHandler = null; }
  if (unloadHandler) { window.removeEventListener('beforeunload', unloadHandler); unloadHandler = null; }
}

export function manualReload() {
  if (import.meta.env.DEV) console.log('[Version Checker] Manual reload triggered');
  window.location.replace(window.location.href);
}
