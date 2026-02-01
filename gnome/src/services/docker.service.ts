import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { FileService } from './file.service.js';

export class DockerService {
  private static _instance: DockerService;
  private readonly _fileService: FileService;
  private readonly _containerName = 'ai-assistant';

  private constructor() {
    this._fileService = FileService.getInstance();
  }

  public static getInstance(): DockerService {
    if (!DockerService._instance) {
      DockerService._instance = new DockerService();
    }
    return DockerService._instance;
  }

  public isInstalled(): boolean {
    try {
      const [ok] = GLib.spawn_command_line_sync('docker --version');
      return ok;
    } catch (e) {
      console.error(`[AI] Docker check failed: ${e}`);
      return false;
    }
  }

  public areServicesRunning(): boolean {
    try {
      const [ok, stdout] = GLib.spawn_command_line_sync(
        `docker ps --filter name=${this._containerName} --format "{{.Names}} {{.Status}}"`,
      );

      if (!ok) {
        console.log('[AI] Docker ps command failed');
        return false;
      }

      const decoder = new TextDecoder('utf-8');
      const output = decoder.decode(stdout as AllowSharedBufferSource);
      const isRunning = output.includes(this._containerName) && output.includes('Up');

      if (isRunning) {
        console.log('[AI] Main container is running:', output.trim());
      } else {
        console.log('[AI] Main container not found or not running');
      }

      return isRunning;
    } catch (e) {
      console.error(`[AI] Services check failed: ${e}`);
      return false;
    }
  }

  public async startContainers(): Promise<boolean> {
    const composePath = this._fileService.buildPath('docker-compose.yml');
    const envPath = this._fileService.buildPath('.env');
    const appDir = this._fileService.appDir;

    if (!this._fileService.fileExists(composePath)) {
      console.error(`[AI] docker-compose.yml not found at ${composePath}`);
      Main.notify('AI Assistant', 'Configuration missing');
      return false;
    }

    return new Promise((resolve) => {
      try {
        console.log('[AI] Starting Docker containers...');
        Main.notify('AI Assistant', 'Starting services...');

        const launcher = new Gio.SubprocessLauncher({
          flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
        });
        launcher.set_cwd(appDir);

        if (!this._fileService.fileExists(envPath)) {
          console.warn('[AI] .env file not found. API keys may not be set.');
        }

        const proc = launcher.spawnv([
          'docker',
          'compose',
          '-f',
          composePath,
          'up',
          '-d',
          '--pull',
          'always',
        ]);

        proc.communicate_utf8_async(null, null, (proc, res) => {
          try {
            const [ok, stdout, stderr] = proc?.communicate_utf8_finish(res) || [false, '', ''];

            if (!proc?.get_successful()) {
              console.error(`[AI] Docker compose failed: ${stderr}`);
              // Try to maintain a user-friendly message but include key details if valid
              const errorMsg = stderr ? stderr.trim().split('\n').pop() : 'Unknown error';
              Main.notify('AI Assistant', `Error starting: ${errorMsg}`);
              resolve(false);
              return;
            }

            console.log('[AI] Docker compose command completed, verifying...');
            this._waitForContainers(resolve);
          } catch (e) {
            console.error(`[AI] Failed to communicate with docker process: ${e}`);
            Main.notify('AI Assistant', 'Error communicating with Docker');
            resolve(false);
          }
        });
      } catch (e) {
        console.error(`[AI] Failed to spawn docker compose: ${e}`);
        Main.notify('AI Assistant', `Error: ${e}`);
        resolve(false);
      }
    });
  }

  private _waitForContainers(
    resolve: (success: boolean) => void,
    attempt = 1,
    maxAttempts = 30,
  ): void {
    console.log(`[AI] Checking containers status (${attempt}/${maxAttempts})...`);

    if (this.areServicesRunning()) {
      console.log('[AI] Docker containers started successfully');
      Main.notify('AI Assistant', 'Services started successfully');
      resolve(true);
      return;
    }

    if (attempt >= maxAttempts) {
      console.error('[AI] Containers did not start within timeout');
      Main.notify('AI Assistant', 'Services are taking longer than expected.');
      resolve(false);
      return;
    }

    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
      this._waitForContainers(resolve, attempt + 1, maxAttempts);
      return GLib.SOURCE_REMOVE;
    });
  }

  public stopContainers(): void {
    const composePath = this._fileService.buildPath('docker-compose.yml');
    const appDir = this._fileService.appDir;

    try {
      GLib.spawn_command_line_async(`docker compose -f ${composePath} down`);
      console.log('[AI] Stopping Docker containers');
    } catch (e) {
      console.error(`[AI] Failed to stop containers: ${e}`);
    }
  }

  public async restartContainers(): Promise<boolean> {
    const composePath = this._fileService.buildPath('docker-compose.yml');
    const appDir = this._fileService.appDir;

    if (!this._fileService.fileExists(composePath)) {
      console.error(`[AI] docker-compose.yml not found at ${composePath}`);
      return false;
    }

    return new Promise((resolve) => {
      try {
        console.log('[AI] Restarting Docker containers...');
        Main.notify('AI Assistant', 'Restarting services...');

        const launcher = new Gio.SubprocessLauncher({
          flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
        });
        launcher.set_cwd(appDir);

        const proc = launcher.spawnv(['docker', 'compose', '-f', composePath, 'restart']);

        proc.wait_check_async(null, (_proc, res) => {
          try {
            _proc?.wait_check_finish(res);
            console.log('[AI] Docker containers restarted successfully');
            Main.notify('AI Assistant', 'Services restarted with new settings');
            resolve(true);
          } catch (e) {
            console.error(`[AI] Failed to restart containers: ${e}`);
            Main.notify('AI Assistant', 'Error restarting services');
            resolve(false);
          }
        });
      } catch (e) {
        console.error(`[AI] Failed to restart containers: ${e}`);
        resolve(false);
      }
    });
  }
}
