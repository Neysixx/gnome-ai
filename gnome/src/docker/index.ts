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
    const [ok, stdout] = GLib.spawn_command_line_sync('docker ps --filter name=ai-assistant --format "{{.Names}} {{.Status}}"');
    if (!ok) {
      console.log('[AI] Docker ps command failed');
      return false;
    }

    const decoder = new TextDecoder('utf-8');
    const output = decoder.decode(stdout as AllowSharedBufferSource);

    // Check for the main app container and verify it's running (not just created/exited)
    const hasApp = output.includes('ai-assistant') && output.includes('Up');

    if (hasApp) {
      console.log('[AI] Main container is running:', output);
    } else {
      console.log('[AI] Main container not found or not running. Output:', output);
    }

    return hasApp;
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
    console.log('[AI] Starting Docker containers (this may take a while if images need to be downloaded)...');
    Main.notify('AI Assistant', 'Starting services...');

    const launcher = new Gio.SubprocessLauncher({
      flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    });

    // Use --pull always to ensure images are downloaded before starting
    // Note: --wait is not used as it requires healthchecks on all services
    const proc = launcher.spawnv(['docker', 'compose', '-f', composePath, 'up', '-d', '--pull', 'always']);

    proc.wait_check_async(null, (_proc, res) => {
      try {
        _proc?.wait_check_finish(res);
        console.log('[AI] Docker compose command completed, verifying containers are running...');

        // Double-check that containers are actually running
        // Wait for containers to actually start (poll every 2 seconds, max 60 seconds)
        let attempts = 0;
        const maxAttempts = 30;

        const checkContainers = () => {
          attempts++;
          console.log(`[AI] Checking containers status (attempt ${attempts}/${maxAttempts})...`);

          if (areServicesRunning()) {
            console.log('[AI] Docker containers started successfully and are running');
            Main.notify('AI Assistant', 'Services started successfully');
            callback?.(true);
            return;
          }

          if (attempts >= maxAttempts) {
            console.error('[AI] Containers did not start within timeout');
            Main.notify('AI Assistant', 'Services are taking longer than expected. Please check Docker logs.');
            callback?.(false);
            return;
          }

          // Check again in 2 seconds
          GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            checkContainers();
            return GLib.SOURCE_REMOVE;
          });
        };

        // Start checking immediately
        checkContainers();
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
export async function downloadDockerCompose(
  extensionPath: string,
  callback?: (success: boolean) => void,
): Promise<void> {
  const appDir = getAppDir();
  const destPath = GLib.build_filenamev([appDir, 'docker-compose.yml']);

  if (GLib.file_test(destPath, GLib.FileTest.EXISTS)) {
    console.log('[AI] docker-compose.yml already exists');
    callback?.(true);
    return;
  }

  try {
    // Download directly from GitHub raw URL (main branch)
    const downloadUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/docker-compose.yml`;
    console.log(`[AI] Downloading docker-compose.yml from ${downloadUrl}`);

    const downloadFile = Gio.File.new_for_uri(downloadUrl);
    const destFile = Gio.File.new_for_path(destPath);

    downloadFile.read_async(0, null, (sourceFile, readRes) => {
      try {
        if (!sourceFile) {
          console.error('[AI] Source file is null');
          Main.notify('AI Assistant', 'Failed to download configuration');
          callback?.(false);
          return;
        }

        const inputStream = sourceFile.read_finish(readRes);
        if (!inputStream) {
          console.error('[AI] Input stream is null');
          Main.notify('AI Assistant', 'Failed to download configuration');
          callback?.(false);
          return;
        }

        const outputStream = destFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
        if (!outputStream) {
          console.error('[AI] Output stream is null');
          Main.notify('AI Assistant', 'Failed to download configuration');
          callback?.(false);
          return;
        }

        // Copy the stream
        outputStream.splice_async(
          inputStream,
          Gio.OutputStreamSpliceFlags.CLOSE_SOURCE | Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
          0,
          null,
          (stream, spliceRes) => {
            try {
              if (!stream) {
                console.error('[AI] Stream is null');
                Main.notify('AI Assistant', 'Download failed');
                callback?.(false);
                return;
              }

              stream.splice_finish(spliceRes);
              console.log(`[AI] Downloaded docker-compose.yml to ${destPath}`);

              Main.notify('AI Assistant', 'Configuration downloaded');
              callback?.(true);
            } catch (e: unknown) {
              const error = e as { message?: string };
              console.error(`[AI] Download failed: ${error.message}`);
              Main.notify('AI Assistant', 'Download failed');
              callback?.(false);
            }
          },
        );
      } catch (e: unknown) {
        const error = e as { message?: string };
        console.error(`[AI] Failed to read download URL: ${error.message}`);
        Main.notify('AI Assistant', 'Failed to download configuration');
        callback?.(false);
      }
    });
  } catch (e: unknown) {
    const error = e as { message?: string };
    console.error(`[AI] Failed to initiate download: ${error.message}`);
    Main.notify('AI Assistant', 'Failed to initiate download');
    callback?.(false);
  }
}
