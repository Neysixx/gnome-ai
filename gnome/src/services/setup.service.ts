import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { DockerService } from './docker.service.js';
import { FileService } from './file.service.js';
import { GithubService } from './github.service.js';

export type SetupStatus = 'idle' | 'checking' | 'downloading' | 'starting' | 'ready' | 'error';

export interface SetupResult {
  success: boolean;
  status: SetupStatus;
  message?: string;
}

export class SetupService {
  private static _instance: SetupService;
  private readonly _fileService: FileService;
  private readonly _githubService: GithubService;
  private readonly _dockerService: DockerService;

  private _status: SetupStatus = 'idle';

  private constructor() {
    this._fileService = FileService.getInstance();
    this._githubService = GithubService.getInstance();
    this._dockerService = DockerService.getInstance();
  }

  public static getInstance(): SetupService {
    if (!SetupService._instance) {
      SetupService._instance = new SetupService();
    }
    return SetupService._instance;
  }

  public get status(): SetupStatus {
    return this._status;
  }

  public get isReady(): boolean {
    return this._status === 'ready';
  }

  public async initialize(onStatusChange?: (status: SetupStatus) => void): Promise<SetupResult> {
    const updateStatus = (status: SetupStatus) => {
      this._status = status;
      onStatusChange?.(status);
    };

    try {
      // Step 1: Check Docker installation
      updateStatus('checking');
      if (!this._dockerService.isInstalled()) {
        Main.notify('AI Assistant', 'Docker not installed. Please install Docker to continue.');
        updateStatus('error');
        return { success: false, status: 'error', message: 'Docker not installed' };
      }

      // Step 2: Always ensure app directory exists
      this._fileService.ensureAppDirExists();

      // Step 3: Always ensure configuration files exist
      updateStatus('downloading');
      const configDownloaded = await this._downloadConfigFiles();
      if (!configDownloaded) {
        updateStatus('error');
        return { success: false, status: 'error', message: 'Failed to download config files' };
      }

      // Step 4: Always ensure docker-compose.yml exists
      const composeDownloaded = await this._githubService.downloadToAppDir(
        'docker-compose.yml',
        true,
      );
      if (!composeDownloaded) {
        Main.notify('AI Assistant', 'Failed to download docker-compose.yml');
        updateStatus('error');
        return {
          success: false,
          status: 'error',
          message: 'Failed to download docker-compose.yml',
        };
      }

      // Step 5: Check if services are already running
      if (this._dockerService.areServicesRunning()) {
        console.log('[AI] Services already running');
        updateStatus('ready');
        return { success: true, status: 'ready' };
      }

      // Step 6: Start containers
      updateStatus('starting');
      Main.notify('AI Assistant', 'Starting services...');
      const started = await this._dockerService.startContainers();

      if (started) {
        updateStatus('ready');
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
          Main.notify('AI Assistant', 'Ready to work! 🚀');
          return GLib.SOURCE_REMOVE;
        });
        return { success: true, status: 'ready' };
      }

      updateStatus('error');
      return { success: false, status: 'error', message: 'Failed to start containers' };
    } catch (e) {
      console.error(`[AI] Setup failed: ${e}`);
      updateStatus('error');
      return { success: false, status: 'error', message: String(e) };
    }
  }

  private async _downloadConfigFiles(): Promise<boolean> {
    const defaultConfigPath = this._fileService.buildPath('config.default.json');
    const configPath = this._fileService.buildPath('config.json');

    // Download config.default.json
    const defaultDownloaded = await this._githubService.downloadToAppDir('config.default.json');
    if (!defaultDownloaded) {
      console.error('[AI] Failed to download config.default.json');
      return false;
    }

    // Create config.json from config.default.json if it doesn't exist
    if (!this._fileService.isRegularFile(configPath)) {
      console.log('[AI] Creating config.json from config.default.json...');
      const copied = this._fileService.copyFile(defaultConfigPath, configPath);
      if (!copied) {
        console.error('[AI] Failed to copy config file');
        return false;
      }
    }

    console.log('[AI] Configuration files are ready');
    return true;
  }

  public shutdown(): void {
    this._dockerService.stopContainers();
    this._status = 'idle';
  }
}
