import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { FileService } from './services/file.service.js';

export default class AiAssistantPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window: Adw.PreferencesWindow): void {
    const fileService = FileService.getInstance();
    const appDir = fileService.appDir;
    const envPath = GLib.build_filenamev([appDir, '.env']);

    window.set_default_size(600, 500);

    // API Keys page
    const apiKeysPage = new Adw.PreferencesPage({
      title: 'API Keys',
      icon_name: 'dialog-password-symbolic',
    });

    const apiKeysGroup = new Adw.PreferencesGroup({
      title: 'Required API Keys',
      description: 'Enter your API keys to use the AI Assistant',
    });

    // Read existing .env file
    let openrouterKey = '';
    let composioKey = '';

    if (GLib.file_test(envPath, GLib.FileTest.EXISTS)) {
      try {
        const [, contents] = Gio.File.new_for_path(envPath).load_contents(null);
        const decoder = new TextDecoder('utf-8');
        const content = decoder.decode(contents as Uint8Array);

        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('OPENROUTER_API_KEY=')) {
            openrouterKey = trimmed
              .substring('OPENROUTER_API_KEY='.length)
              .replace(/^["']|["']$/g, '');
          } else if (trimmed.startsWith('COMPOSIO_API_KEY=')) {
            composioKey = trimmed.substring('COMPOSIO_API_KEY='.length).replace(/^["']|["']$/g, '');
          }
        }
      } catch (e) {
        console.error(`[AI] Failed to read .env file: ${e}`);
      }
    }

    // OpenRouter API Key
    const openrouterRow = new Adw.PasswordEntryRow({
      title: 'OpenRouter API Key',
      text: openrouterKey,
    });

    // Composio API Key
    const composioRow = new Adw.PasswordEntryRow({
      title: 'Composio API Key',
      text: composioKey,
    });

    apiKeysGroup.add(openrouterRow);
    apiKeysGroup.add(composioRow);
    apiKeysPage.add(apiKeysGroup);

    // Save button
    const saveGroup = new Adw.PreferencesGroup();
    const saveButton = new Gtk.Button({
      label: 'Save',
      css_classes: ['suggested-action'],
    });

    saveButton.connect('clicked', () => {
      const newOpenrouterKey = openrouterRow.get_text().trim();
      const newComposioKey = composioRow.get_text().trim();

      // Validate that at least OpenRouter key is provided
      if (!newOpenrouterKey) {
        const dialog = new Adw.AlertDialog({
          heading: 'OpenRouter API Key Required',
          body: 'Please enter your OpenRouter API key to use the AI Assistant.',
        });
        dialog.add_response('ok', 'OK');
        dialog.present(window);
        return;
      }

      // Write .env file
      try {
        const envContent = `OPENROUTER_API_KEY=${newOpenrouterKey}\nCOMPOSIO_API_KEY=${newComposioKey}\n`;
        const encoder = new TextEncoder();
        const contents = encoder.encode(envContent);

        const file = Gio.File.new_for_path(envPath);
        file.replace_contents(contents, null, false, Gio.FileCreateFlags.NONE, null);

        const successDialog = new Adw.AlertDialog({
          heading: 'Settings Saved',
          body: 'Your API keys have been saved. Please restart the Docker containers for changes to take effect.',
        });
        successDialog.add_response('ok', 'OK');
        successDialog.present(window);

        console.log('[AI] API keys saved to .env file');
      } catch (e) {
        console.error(`[AI] Failed to save .env file: ${e}`);
        const errorDialog = new Adw.AlertDialog({
          heading: 'Error Saving Settings',
          body: `Failed to save settings: ${e}`,
        });
        errorDialog.add_response('ok', 'OK');
        errorDialog.present(window);
      }
    });

    const saveRow = new Adw.ActionRow();
    saveRow.add_suffix(saveButton);
    saveRow.set_activatable_widget(saveButton);
    saveGroup.add(saveRow);
    apiKeysPage.add(saveGroup);

    window.add(apiKeysPage);
  }
}
