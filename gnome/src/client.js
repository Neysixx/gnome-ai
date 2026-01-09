#!/usr/bin/env gjs -m

import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import WebKit from 'gi://WebKit?version=6.0';

// Debug visible in journalctl
print('[AI CLIENT] Starting client script...');

const APP_URL = 'http://localhost:9999';
const APP_ID = 'com.neysixx.gnome_ai_assistant.client';

// Let Gtk.Application handle the init
const app = new Gtk.Application({
  application_id: APP_ID,
  flags: 0, // Gio.ApplicationFlags.FLAGS_NONE
});

app.connect('activate', () => {
  print('[AI CLIENT] Application activated');

  const window = new Gtk.ApplicationWindow({
    application: app,
    title: 'AI Assistant',
    default_width: 500,
    default_height: 800,
  });

  try {
    // Setup persistent session (1 session / boot -> stored in /tmp)
    const baseDir = GLib.build_filenamev([GLib.get_tmp_dir(), 'gnome-ai-session']);
    const dataDir = GLib.build_filenamev([baseDir, 'data']);
    const cacheDir = GLib.build_filenamev([baseDir, 'cache']);
    const cookieFile = GLib.build_filenamev([baseDir, 'cookies.sqlite']);

    // Ensure directories exist
    GLib.mkdir_with_parents(dataDir, 0o755);
    GLib.mkdir_with_parents(cacheDir, 0o755);

    print(`[AI CLIENT] Session path: ${baseDir}`);

    const networkSession = new WebKit.NetworkSession({
      data_directory: dataDir,
      cache_directory: cacheDir,
    });

    // Enable persistent cookies
    const cookieManager = networkSession.get_cookie_manager();
    cookieManager.set_persistent_storage(cookieFile, WebKit.CookiePersistentStorage.SQLITE);

    const webView = new WebKit.WebView({
      network_session: networkSession,
    });

    // Enable microphone access for speech recognition
    const settings = webView.get_settings();
    settings.set_enable_media_stream(true);
    settings.set_enable_mediasource(true);

    // Handle permission requests
    webView.connect('permission-request', (webView, request) => {
      print(`[AI CLIENT] Permission request: ${request.constructor.$gtype.name}`);

      // Auto-allow microphone/camera permissions
      if (request instanceof WebKit.UserMediaPermissionRequest) {
        print('[AI CLIENT] Allowing user media (microphone/camera)');
        request.allow();
        return true;
      }

      // Deny other permission types by default
      return false;
    });

    webView.load_uri(APP_URL);
    window.set_child(webView);
  } catch (e) {
    print(`[AI CLIENT] WebKit error: ${e.message}`);
    // Fallback to non-persistent if something fails
    try {
      const webView = new WebKit.WebView();

      // Enable microphone access for fallback too
      const settings = webView.get_settings();
      settings.set_enable_media_stream(true);
      settings.set_enable_mediasource(true);

      // Handle permission requests
      webView.connect('permission-request', (webView, request) => {
        if (request instanceof WebKit.UserMediaPermissionRequest) {
          print('[AI CLIENT FALLBACK] Allowing user media');
          request.allow();
          return true;
        }
        return false;
      });

      webView.load_uri(APP_URL);
      window.set_child(webView);
    } catch (e2) {
      print(`[AI CLIENT] Fatal WebKit error: ${e2.message}`);
    }
  }

  window.present();
});

// Global error capture to understand why it crashes
try {
  app.run([imports.system.programInvocationName].concat(ARGV));
} catch (e) {
  print(`[AI CLIENT CRASH]: ${e.message}`);
  print(e.stack);
}
