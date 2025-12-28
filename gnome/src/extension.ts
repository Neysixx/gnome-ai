import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const Indicator = GObject.registerClass(
    class Indicator extends St.Bin {
        private _proc: Gio.Subprocess | null = null;
        private _extensionPath: string = '';

        _init() {
            super._init({
                style_class: 'panel-button',
                reactive: true,
                can_focus: true,
                track_hover: true,
            });
        }

        setExtensionPath(extensionPath: string) {
            if (!extensionPath) {
                console.error('[AI ERROR] Extension path is required');
                throw new Error('Extension path is required');
            }

            this._extensionPath = extensionPath;
            console.log(`[AI] Indicator path set to: ${this._extensionPath}`);

            const icon = new St.Icon({
                icon_name: 'user-available-symbolic',
                style_class: 'system-status-icon',
            });

            this.set_child(icon);

            // Handle click events
            this.connect('button-press-event', (_actor: any, event: any) => {
                this._toggleClient();
                return Clutter.EVENT_STOP;
            });
        }
        _toggleClient() {
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

                // The magic variable for the Sandbox
                env = GLib.environ_setenv(env, 'WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS', '1', true);

                // Make sure the client knows which screen to display on
                const display = GLib.getenv('DISPLAY') || ':0';
                env = GLib.environ_setenv(env, 'DISPLAY', display, true);

                const wayland = GLib.getenv('WAYLAND_DISPLAY');
                if (wayland) {
                    env = GLib.environ_setenv(env, 'WAYLAND_DISPLAY', wayland, true);
                }

                const launcher = new Gio.SubprocessLauncher({
                    flags: Gio.SubprocessFlags.STDERR_PIPE | Gio.SubprocessFlags.STDOUT_PIPE
                });
                launcher.set_environ(env);

                console.log(`[AI] Launching via /usr/bin/gjs : ${clientPath}`);

                // Using absolute path for gjs
                const proc = launcher.spawnv(['/usr/bin/gjs', '-m', clientPath]);
                this._proc = proc;

                // Read standard output (console.log from client)
                const stdoutPipe = proc.get_stdout_pipe();
                if (stdoutPipe) {
                    const stdoutStream = new Gio.DataInputStream({ base_stream: stdoutPipe });
                    this._readStream(stdoutStream, '[CLIENT LOG]');
                }

                // Read errors
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
                    } catch (e: any) {
                        if (e.code !== Gio.IOErrorEnum.CANCELLED) {
                            console.log(`[AI] Process finished (Code: ${e.code}, Message: ${e.message}).`);
                        }
                    }
                    this._proc = null;
                });

            } catch (e: any) {
                console.error(`[AI] Launch failed: ${e.message}`);
                console.error(`[AI ERROR] Stack trace: ${e.stack}`);
                this._proc = null;
            }
        }

        // Small utility function to read streams without blocking
        _readStream(stream: Gio.DataInputStream, prefix: string) {
            stream.read_line_async(0, null, (obj, res) => {
                try {
                    const [line] = obj?.read_line_finish_utf8(res) || [null];
                    if (line !== null) {
                        console.log(`${prefix} ${line}`);
                        // Continue reading the next line
                        this._readStream(stream, prefix);
                    }
                } catch (e: any) {
                    // End of stream or error
                    console.log(`${prefix} Stream error or end: ${e.message || 'unknown'}`);
                }
            });
        }

        _launchClient(clientPath: string) {
            try {
                // Launch the client script as a subprocess
                const launcher = new Gio.SubprocessLauncher({
                    flags: Gio.SubprocessFlags.NONE
                });

                console.log(`[AI Assistant] Launching client: gjs -m ${clientPath}`);
                const proc = launcher.spawnv(['gjs', '-m', clientPath]);
                this._proc = proc;

                // Watch for process exit - use arrow function to capture 'this'
                proc.wait_check_async(null, (_proc, res) => {
                    try {
                        if (_proc) {
                            _proc.wait_check_finish(res);
                        }
                    } catch (e: any) {
                        // Process ended (maybe closed by user or crashed)
                        if (e.code !== Gio.IOErrorEnum.CANCELLED) {
                            console.log(`[AI Assistant] Client process exited (Code: ${e.code})`);
                        }
                    }

                    // Clear the process reference
                    // @ts-ignore - TypeScript can't track that _proc is set in the closure
                    this._proc = null;
                });
            } catch (error: any) {
                console.error(`[AI Assistant] Failed to launch client: ${error.message}`);
                console.error(`[AI Assistant] Path attempted: ${clientPath}`);
                console.error(`[AI ERROR] Stack trace: ${error.stack}`);
                this._proc = null;
            }
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
    }


);

export default class AiAssistant extends Extension {
    private _indicator: InstanceType<typeof Indicator> | null = null;

    enable() {
        // @ts-ignore - GObject.registerClass creates a constructor that may not match TypeScript types
        this._indicator = new Indicator();
        // Définir le path après l'instanciation
        this._indicator.setExtensionPath(this.path);
        // Add directly to the right side of the panel
        // @ts-ignore - _rightBox is a private property but it's the standard way to add custom widgets
        Main.panel._rightBox.add_child(this._indicator);
    }

    disable() {
        if (this._indicator) {
            // Remove from panel before destroying
            // @ts-ignore - _rightBox is a private property
            Main.panel._rightBox.remove_child(this._indicator);
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
