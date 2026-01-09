// docker.ts

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { APP_NAME, COMPOSE_URL } from '../constants.js';

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
    const output = decoder.decode(stdout as Uint8Array);

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

  try {
    const launcher = new Gio.SubprocessLauncher({
      flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    });

    const proc = launcher.spawnv(['docker', 'compose', '-f', composePath, 'up', '-d']);

    proc.wait_check_async(null, (_proc, res) => {
      try {
        _proc?.wait_check_finish(res);
        console.log('[AI] Docker containers started successfully');
        Main.notify('AI Assistant', 'Started Docker containers');
        callback?.(true);
      } catch (e: any) {
        console.error(`[AI] Failed to start containers: ${e.message}`);
        Main.notify('AI Assistant', 'Failed to start containers');
        callback?.(false);
      }
    });
  } catch (e: any) {
    console.error(`[AI] Failed to spawn docker compose: ${e.message}`);
    Main.notify('AI Assistant', `Erreur: ${e.message}`);
    callback?.(false);
  }
}

export function stopDockerContainers(): void {
  const appDir = getAppDir();
  const composePath = GLib.build_filenamev([appDir, 'docker-compose.yml']);

  try {
    GLib.spawn_command_line_async(`docker compose -f ${composePath} down`);
    console.log('[AI] Stopped Docker containers');
  } catch (e: any) {
    console.error(`[AI] Failed to stop containers: ${e.message}`);
  }
}

export function downloadDockerCompose(callback?: (success: boolean) => void): void {
  const appDir = getAppDir();
  const destPath = GLib.build_filenamev([appDir, 'docker-compose.yml']);

  // Vérifier si le fichier existe déjà
  if (GLib.file_test(destPath, GLib.FileTest.EXISTS)) {
    console.log('[AI] docker-compose.yml already exists');
    callback?.(true);
    return;
  }

  const sourceFile = Gio.File.new_for_uri(COMPOSE_URL);
  const destFile = Gio.File.new_for_path(destPath);

  sourceFile.copy_async(
    destFile,
    Gio.FileCopyFlags.OVERWRITE,
    GLib.PRIORITY_DEFAULT,
    null,
    null,
    (source, result) => {
      try {
        source?.copy_finish(result);
        console.log(`[AI] Downloaded docker-compose.yml to ${destPath}`);
        Main.notify('AI Assistant', 'Downloaded docker-compose.yml');
        callback?.(true);
      } catch (e: any) {
        console.error(`[AI] Download failed: ${e.message}`);
        Main.notify('AI Assistant', 'Failed to download docker-compose.yml');
        callback?.(false);
      }
    },
  );
}
