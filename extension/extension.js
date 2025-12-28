import GObject from 'gi://GObject';
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

// Import system graphics libraries (GTK and WebKit)
import Gtk from 'gi://Gtk?version=4.0';
import WebKit from 'gi://WebKit?version=6.0'; // Or 5.0/4.1 depending on your distro

const URL = 'http://localhost:9999';

// Definition of the button in the panel
const AgentIndicator = GObject.registerClass(
    class AgentIndicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, 'My Agent');

            // The icon (here a system robot/head icon)
            const icon = new St.Icon({
                icon_name: 'user-available-symbolic',
                style_class: 'system-status-icon',
            });
            this.add_child(icon);

            this._window = null;
        }

        // What happens when clicked
        vfunc_event(event) {
            if (this._window) {
                this._window.close();
                this._window = null;
            } else {
                this._createWindow();
            }
            return super.vfunc_event(event);
        }

        _createWindow() {
            // 1. Window creation
            this._window = new Gtk.Window({
                title: 'My Agent',
                default_width: 450,
                default_height: 650,
                resizable: false,
                decorated: false, // Remove title bar to make it look like a "Widget"
            });

            // 2. Browser creation (WebView)
            const webView = new WebKit.WebView();
            webView.load_uri(URL);

            // 3. Add browser to the window
            this._window.set_child(webView);

            // 4. Positioning (Optional: center or follow mouse)
            // For simplicity here, we let the window manager decide
            // or we can force centering:
            // this._window.set_position(Gtk.WindowPosition.CENTER); 

            // Handle proper closing
            this._window.connect('close-request', () => {
                this._window = null;
            });

            this._window.present();
        }
    });

export default class AgentExtension extends Extension {
    enable() {
        this._indicator = new AgentIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            if (this._indicator._window) {
                this._indicator._window.close();
            }
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}