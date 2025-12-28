#!/bin/bash

# Configuration
EXTENSION_UUID="gnome-ai-assistant@neysixx" # MUST match the UUID in metadata.json
EXTENSION_SRC="$(pwd)/extension"
GNOME_EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

echo "🚀 Starting installation of the Agent..."

# 1. Installation de l'extension GNOME (Lien symbolique)
if [ -d "$GNOME_EXT_DIR" ]; then
    echo "⚠️  A version of the extension already exists. Deleting the link..."
    rm -rf "$GNOME_EXT_DIR"
fi

echo "🔗 Creating the symbolic link for the extension..."
ln -s "$EXTENSION_SRC" "$GNOME_EXT_DIR"

# 2. Build des conteneurs Docker (App + Ollama)
echo "🐳 Building the Docker environment..."
docker compose build

echo "✅ Installation completed!"
echo "------------------------------------------------"
echo "👉 CRITICAL STEP: You need to restart GNOME Shell."
echo "   - Under X11 : Press Alt+F2, type 'r', then Enter."
echo "   - Under Wayland : Log out and log back in."
echo "------------------------------------------------"
echo "Once restarted, enable the extension with :"
echo "gnome-extensions enable $EXTENSION_UUID"