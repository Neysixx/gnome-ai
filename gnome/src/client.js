#!/usr/bin/env gjs -m

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import WebKit from 'gi://WebKit?version=6.0';

import { APP_URL, APP_HOST, APP_ID } from './constants.js';

// Debug visible in journalctl
print('[AI CLIENT] Starting client script...');

/**
 * Setup a WebView with common settings and handlers
 * @param {WebKit.WebView} webView
 * @param {string} logPrefix
 */
function setupWebView(webView, logPrefix = '[AI CLIENT]') {
  // Enable microphone access for speech recognition
  const settings = webView.get_settings();
  settings.set_enable_media_stream(true);
  settings.set_enable_mediasource(true);

  // Handle permission requests
  webView.connect('permission-request', (_webView, request) => {
    print(`${logPrefix} Permission request: ${request.constructor.$gtype.name}`);

    if (request instanceof WebKit.UserMediaPermissionRequest) {
      print(`${logPrefix} Allowing user media (microphone/camera)`);
      request.allow();
      return true;
    }

    return false;
  });

  // Handle navigation - open external links in default browser (only for user-initiated clicks)
  webView.connect('decide-policy', (_webView, decision, decisionType) => {
    if (decisionType === WebKit.PolicyDecisionType.NAVIGATION_ACTION) {
      const navAction = decision.get_navigation_action();
      const navType = navAction.get_navigation_type();

      // Only intercept user-initiated link clicks, not programmatic navigation
      if (navType === WebKit.NavigationType.LINK_CLICKED) {
        const request = navAction.get_request();
        const uri = request.get_uri();

        if (uri) {
          try {
            const gUri = GLib.Uri.parse(uri, GLib.UriFlags.NONE);
            const host = gUri.get_host();
            const port = gUri.get_port();
            const fullHost = port > 0 ? `${host}:${port}` : host;

            // External link: open in default browser
            if (fullHost !== APP_HOST) {
              print(`${logPrefix} Opening external link in browser: ${uri}`);
              Gio.AppInfo.launch_default_for_uri(uri, null);
              decision.ignore();
              return true;
            }
          } catch (e) {
            print(`${logPrefix} URI parse error: ${e.message}`);
          }
        }
      }
    }
    decision.use();
    return true;
  });

  webView.load_uri(APP_URL);
}

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

    setupWebView(webView, '[AI CLIENT]');
    window.set_child(webView);
  } catch (e) {
    print(`[AI CLIENT] WebKit error: ${e.message}`);
    // Fallback to non-persistent if something fails
    try {
      const webView = new WebKit.WebView();
      setupWebView(webView, '[AI CLIENT FALLBACK]');
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
