#!/usr/bin/env gjs -m

import Gtk from 'gi://Gtk?version=4.0';
import WebKit from 'gi://WebKit?version=6.0';

// Debug visible dans journalctl
print('[AI CLIENT] Démarrage du script client...');

const APP_URL = 'http://localhost:9999';
const APP_ID = 'com.neysixx.gnome_ai_assistant.client';

// On laisse Gtk.Application gérer l'init
const app = new Gtk.Application({
    application_id: APP_ID,
    flags: 0 // Gio.ApplicationFlags.FLAGS_NONE
});

app.connect('activate', () => {
    print('[AI CLIENT] Application activated');
    
    const window = new Gtk.ApplicationWindow({
        application: app,
        title: 'GNOME AI Assistant',
        default_width: 800,
        default_height: 600,
    });

    try {
        const webView = new WebKit.WebView();
        webView.load_uri(APP_URL);
        window.set_child(webView);
    } catch (e) {
        print(`[AI CLIENT] Erreur WebKit: ${e.message}`);
    }

    window.present();
});

// Capture globale des erreurs pour comprendre pourquoi ça plante
try {
    app.run([imports.system.programInvocationName].concat(ARGV));
} catch (e) {
    print(`[AI CLIENT CRASH] : ${e.message}`);
    print(e.stack);
}