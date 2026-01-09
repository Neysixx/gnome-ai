import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Docker from './docker/index.js';

export const Indicator = GObject.registerClass(
  class Indicator extends St.Bin {
    private _proc: Gio.Subprocess | null = null;
    private _extensionPath = '';
    private _servicesReady = false;

    _init() {
      super._init({
        style_class: 'panel-button',
        reactive: true,
        can_focus: true,
        track_hover: true,
      });
    }

    async setExtensionPath(extensionPath: string) {
      if (!extensionPath) {
        console.error('[AI ERROR] Extension path is required');
        throw new Error('Extension path is required');
      }

      this._extensionPath = extensionPath;
      console.log(`[AI] Indicator path set to: ${this._extensionPath}`);

      const icon = new St.Icon({
        icon_name: 'user-busy-symbolic',
        style_class: 'system-status-icon',
      });

      this.set_child(icon);

      this.connect('button-press-event', (_actor: unknown, _event: Clutter.Event) => {
        this._toggleClient();
        return Clutter.EVENT_STOP;
      });

      await this._initializeServices();
    }

    async _initializeServices() {
      console.log('[AI] Initializing services...');

      if (!Docker.isDockerInstalled()) {
        Main.notify('AI Assistant', 'Docker not installed. Please install Docker to continue.');
        this._updateIcon(false);
        return;
      }

      if (Docker.areServicesRunning()) {
        console.log('[AI] Services already running');
        this._servicesReady = true;
        this._updateIcon(true);
        return;
      }

      Docker.ensureAppDirExists();

      Main.notify('AI Assistant', 'Configuring services...');

      await Docker.downloadDockerCompose(this._extensionPath, async (downloadSuccess) => {
        if (downloadSuccess) {
          Docker.startDockerContainers(async (startSuccess) => {
            this._servicesReady = startSuccess;
            this._updateIcon(startSuccess);

            if (startSuccess) {
              GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
                Main.notify('AI Assistant', 'Ready to work! 🚀');
                return GLib.SOURCE_REMOVE;
              });
            }
          });
        } else {
          this._updateIcon(false);
        }
      });
    }

    _updateIcon(ready: boolean) {
      const icon = this.get_child() as St.Icon;
      if (icon) {
        icon.icon_name = ready ? 'user-available-symbolic' : 'user-busy-symbolic';
      }
    }

    _toggleClient() {
      if (!this._servicesReady) {
        Main.notify('AI Assistant', 'Services are starting, please wait...');
        return;
      }

      if (this._proc) {
        this._closeClient();
      } else {
        this._spawnClient();
      }
    }

    _spawnClient() {
      if (!this._extensionPath) {
        console.error('[AI ERROR] Extension path is not set. Cannot spawn client.');
        return;
      }
      const clientPath = GLib.build_filenamev([this._extensionPath, 'client.js']);

      const file = Gio.File.new_for_path(clientPath);
      const fileExists = file.query_exists(null);

      if (!fileExists) {
        console.error(`[AI ERROR] Client file not found at: ${clientPath}`);
        return;
      }

      try {
        let env = GLib.get_environ();

        env = GLib.environ_setenv(env, 'WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS', '1', true);

        const display = GLib.getenv('DISPLAY') || ':0';
        env = GLib.environ_setenv(env, 'DISPLAY', display, true);

        const wayland = GLib.getenv('WAYLAND_DISPLAY');
        if (wayland) {
          env = GLib.environ_setenv(env, 'WAYLAND_DISPLAY', wayland, true);
        }

        const launcher = new Gio.SubprocessLauncher({
          flags: Gio.SubprocessFlags.STDERR_PIPE | Gio.SubprocessFlags.STDOUT_PIPE,
        });
        launcher.set_environ(env);

        console.log(`[AI] Launching client: ${clientPath}`);

        const proc = launcher.spawnv(['/usr/bin/gjs', '-m', clientPath]);
        this._proc = proc;

        const stdoutPipe = proc.get_stdout_pipe();
        if (stdoutPipe) {
          const stdoutStream = new Gio.DataInputStream({ base_stream: stdoutPipe });
          this._readStream(stdoutStream, '[CLIENT LOG]');
        }

        const stderrPipe = proc.get_stderr_pipe();
        if (stderrPipe) {
          const stderrStream = new Gio.DataInputStream({ base_stream: stderrPipe });
          this._readStream(stderrStream, '[CLIENT ERROR]');
        }

        proc.wait_check_async(null, (_proc, res) => {
          try {
            if (_proc) {
              _proc.wait_check_finish(res);
            }
          } catch (e: unknown) {
            const error = e as { code?: number; message?: string };
            if (error.code !== Gio.IOErrorEnum.CANCELLED) {
              console.log(`[AI] Client exited (Code: ${error.code}, Message: ${error.message}).`);
            }
          }
          this._proc = null;
        });
      } catch (e: unknown) {
        const error = e as { message?: string; stack?: string };
        console.error(`[AI] Launch failed: ${error.message || 'unknown error'}`);
        console.error(`[AI ERROR] Stack trace: ${error.stack || 'no stack trace'}`);
        this._proc = null;
      }
    }

    _readStream(stream: Gio.DataInputStream, prefix: string) {
      stream.read_line_async(0, null, (obj, res) => {
        try {
          const [line] = obj?.read_line_finish_utf8(res) || [null];
          if (line !== null) {
            console.log(`${prefix} ${line}`);
            this._readStream(stream, prefix);
          }
        } catch (e: unknown) {
          const error = e as { message?: string };
          console.log(`${prefix} Stream ended: ${error.message || 'unknown'}`);
        }
      });
    }

    _closeClient() {
      if (this._proc) {
        this._proc.force_exit();
        this._proc = null;
      }
    }

    destroy() {
      this._closeClient();
      super.destroy();
    }
  },
);

export default class AiAssistant extends Extension {
  private _indicator: InstanceType<typeof Indicator> | null = null;

  async enable() {
    // @ts-ignore
    this._indicator = new Indicator();
    await this._indicator.setExtensionPath(this.path);
    // @ts-ignore
    Main.panel._rightBox.insert_child_at_index(this._indicator, 0);
  }

  async disable() {
    if (this._indicator) {
      // @ts-ignore
      Main.panel._rightBox.remove_child(this._indicator);
      this._indicator.destroy();
      this._indicator = null;
    }

    Docker.stopDockerContainers();
  }
}
