// docker/index.ts
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { APP_NAME, GITHUB_REPO } from '../constants.js';

export function getAppDir(): string {
  return GLib.build_filenamev([GLib.get_user_data_dir(), APP_NAME]);
}

export function isDockerInstalled(): boolean {
  try {
    const [ok] = GLib.spawn_command_line_sync('docker --version');
    return ok;
  } catch (e) {
    console.error(`[AI] Docker check failed: ${e}`);
    return false;
  }
}

export function areServicesRunning(): boolean {
  try {
    const [ok, stdout] = GLib.spawn_command_line_sync(`docker ps --filter name=${APP_NAME}`);
    if (!ok) return false;

    const decoder = new TextDecoder('utf-8');
    const output = decoder.decode(stdout as AllowSharedBufferSource);

    return output.includes(`${APP_NAME}-nextjs`) && output.includes(`${APP_NAME}-stt`);
  } catch (e) {
    console.error(`[AI] Services check failed: ${e}`);
    return false;
  }
}

export function ensureAppDirExists(): void {
  const appDir = getAppDir();
  if (!GLib.file_test(appDir, GLib.FileTest.EXISTS)) {
    GLib.mkdir_with_parents(appDir, 0o755);
    console.log(`[AI] Created app directory: ${appDir}`);
  }
}

export function startDockerContainers(callback?: (success: boolean) => void): void {
  const appDir = getAppDir();
  const composePath = GLib.build_filenamev([appDir, 'docker-compose.yml']);

  if (!GLib.file_test(composePath, GLib.FileTest.EXISTS)) {
    console.error(`[AI] docker-compose.yml not found at ${composePath}`);
    Main.notify('AI Assistant', 'Configuration missing');
    callback?.(false);
    return;
  }

  try {
    const launcher = new Gio.SubprocessLauncher({
      flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    });

    const proc = launcher.spawnv(['docker', 'compose', '-f', composePath, 'up', '-d']);

    proc.wait_check_async(null, (_proc, res) => {
      try {
        _proc?.wait_check_finish(res);
        console.log('[AI] Docker containers started successfully');
        Main.notify('AI Assistant', 'Services started successfully');
        callback?.(true);
      } catch (e: unknown) {
        const error = e as { message?: string };
        console.error(`[AI] Failed to start containers: ${error.message}`);
        Main.notify('AI Assistant', 'Error starting services');
        callback?.(false);
      }
    });
  } catch (e: unknown) {
    const error = e as { message?: string };
    console.error(`[AI] Failed to spawn docker compose: ${error.message}`);
    Main.notify('AI Assistant', `Error: ${error.message}`);
    callback?.(false);
  }
}

export function stopDockerContainers(): void {
  const appDir = getAppDir();
  const composePath = GLib.build_filenamev([appDir, 'docker-compose.yml']);

  try {
    GLib.spawn_command_line_async(`docker compose -f ${composePath} down`);
    console.log('[AI] Stopping Docker containers');
  } catch (e: unknown) {
    const error = e as { message?: string };
    console.error(`[AI] Failed to stop containers: ${error.message}`);
  }
}

export async function downloadDockerCompose(callback?: (success: boolean) => void): Promise<void> {
  const appDir = getAppDir();
  const destPath = GLib.build_filenamev([appDir, 'docker-compose.yml']);

  if (GLib.file_test(destPath, GLib.FileTest.EXISTS)) {
    console.log('[AI] docker-compose.yml already exists');
    callback?.(true);
    return;
  }

  try {
    // First, get the latest release tag from the GitHub API
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    const data = await response.json();
    if (!data.assets || data.assets.length === 0) {
      console.error('[AI] Failed to get assets');
      callback?.(false);
      return;
    }
    const asset = data.assets.find(
      (asset: { name: string }) => asset.name === 'docker-compose.yml',
    );
    if (!asset) {
      console.error('[AI] Failed to find docker-compose.yml asset');
      callback?.(false);
      return;
    }
    console.log(`[AI] Found docker-compose.yml asset: ${asset.name}`);

    const launcher = new Gio.SubprocessLauncher({
      flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    });

    console.log(`[AI] Downloading docker-compose.yml from ${asset.browser_download_url}`);
    const proc = launcher.spawnv(['curl', '-fsSL', '-o', destPath, asset.browser_download_url]);

    proc.wait_check_async(null, (_proc, result) => {
      try {
        _proc?.wait_check_finish(result);
        console.log(`[AI] Downloaded docker-compose.yml to ${destPath}`);
        Main.notify('AI Assistant', 'Configuration downloaded');
        callback?.(true);
      } catch (e: unknown) {
        const error = e as { message?: string };
        console.error(`[AI] Download failed: ${error.message}`);
        Main.notify('AI Assistant', 'Download failed');
        callback?.(false);
      }
    });
  } catch (e: unknown) {
    const error = e as { message?: string };
    console.error(`[AI] Failed to initiate download: ${error.message}`);
    callback?.(false);
  }
}
