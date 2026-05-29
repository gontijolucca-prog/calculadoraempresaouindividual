/**
 * Vite Plugin: Emit version.json with build ID and timestamp
 *
 * This plugin:
 * - Creates /version.json in the output directory
 * - Uses commit hash (or timestamp) as buildId
 * - Called after each build, so buildId changes on every deploy
 * - Client polls this file to detect updates
 *
 * version.json is immutable (hashed by Vite if you rebuild),
 * but the client cache-busts it with ?t=Date.now() to force fetch
 */

import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import type {Plugin} from 'vite';

function getBuildId(): string {
  try {
    // Try to use git commit hash (most reliable)
    const hash = execSync('git rev-parse --short HEAD', {encoding: 'utf-8'}).trim();
    if (hash) return hash;
  } catch {
    // Fall back to timestamp if git fails
  }

  return Math.floor(Date.now() / 1000).toString();
}

export function vitePluginVersion(): Plugin {
  return {
    name: 'vite-plugin-version',
    apply: 'build', // only run during build
    enforce: 'post', // run after other plugins

    writeBundle() {
      const buildId = getBuildId();
      const timestamp = Date.now();

      const versionData = {
        buildId,
        timestamp,
      };

      // Write to dist/version.json
      const distDir = path.resolve(process.cwd(), 'dist');
      const versionPath = path.join(distDir, 'version.json');

      fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2));
      console.log(`[vite-plugin-version] Emitted version.json: buildId=${buildId}`);
    },
  };
}
