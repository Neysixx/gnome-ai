# GNOME AI Assistant

A modern AI assistant integration for GNOME Desktop, combining a native GNOME Shell extension with a Next.js web application for seamless AI interactions directly from your desktop.

## 🎯 Overview

This project consists of two main components:

1. **GNOME Shell Extension** - A native extension that adds an AI assistant icon to your GNOME top panel
2. **Next.js Web App** - A modern chat interface powered by AI models via OpenRouter, with voice input support

When you click the panel icon, a WebKit-based window opens displaying the chat interface, allowing you to interact with various AI models without leaving your desktop environment.

## ✨ Features

- 🖥️ **Native GNOME Integration** - System tray icon for quick access
- 💬 **AI Chat Interface** - Clean, responsive chat UI with markdown support
- 🎙️ **Voice Input** - Speech-to-text using browser Speech Recognition API + Kaldi FR speech server
- 🛠️ **AI Tools** - Integration with Composio for extended AI capabilities
- 🌐 **Multiple LLM Support** - Access various AI models through OpenRouter
- 🎨 **Dark/Light Theme** - Automatic theme switching
- 💾 **Persistent Sessions** - Chat history saved in localStorage + WebKit session persistence
- ⚙️ **Configurable** - Customize model, language, and system prompts via JSON config

## 🏗️ Architecture

### Monorepo Structure

```
gnome-ai/
├── gnome/              # GNOME Shell Extension
│   ├── src/
│   │   ├── extension.ts    # Main extension code (panel button)
│   │   ├── client.js       # GTK4 + WebKit window
│   │   └── stylesheet.css
│   └── metadata.json       # Extension metadata
│
├── app/                # Next.js Application
│   ├── src/
│   │   ├── app/           # Next.js App Router
│   │   │   ├── api/       # API routes (chat, config)
│   │   │   └── page.tsx   # Main chat interface
│   │   ├── components/    # React components
│   │   ├── services/      # LLM service integration
│   │   ├── hooks/         # Custom React hooks (voice input)
│   │   └── lib/           # Utilities
│   └── Dockerfile
│
├── config.schema.json  # Configuration schema
├── config.default.json # Default configuration
├── config.json         # User configuration (override)
└── docker-compose.yml  # Container orchestration
```

### How It Works

1. **Extension Launch**: The GNOME extension adds a button to the top panel
2. **Window Spawn**: Clicking the button spawns a GJS subprocess that creates a GTK4 window with WebKit2
3. **Web App**: The WebKit view loads `http://localhost:9999` (Next.js app running in Docker)
4. **AI Interaction**: User messages are sent to `/api/chat` which streams responses from OpenRouter
5. **Voice Input**: Optional speech recognition connects to the Kaldi speech server (port 2700)

## 📋 Prerequisites

- **GNOME Shell 46 or 47**
- **Docker & Docker Compose**
- **Bun** (for development)
- **GJS** (GNOME JavaScript - usually pre-installed)
- **WebKit2GTK-6.0** (for the client window)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd gnome-ai
```

### 2. Configure Environment

Create a `.env` file at the root:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
OPENROUTER_API_KEY=your_openrouter_key
COMPOSIO_API_KEY=your_composio_key
```

### 3. Customize Configuration (Optional)

Edit `config.json` to customize the AI behavior:

```json
{
  "llm": {
    "model": "xiaomi/mimo-v2-flash:free",
    "language": "auto",
    "preprompt": "You are a helpful assistant."
  }
}
```

**Available languages**: `auto`, `en`, `fr`

### 4. Install Everything

```bash
make install
```

This will:
- Build and start the Docker containers (Next.js app + speech server)
- Build and install the GNOME extension

### 5. Enable the Extension

Restart GNOME Shell:
- **X11**: Press `Alt+F2`, type `r`, press Enter
- **Wayland**: Log out and log back in

Or use the command:

```bash
make restart-gnome  # Only works on X11
```

Then enable the extension:

```bash
gnome-extensions enable gnome-ai-assistant@neysixx
```

## 🎮 Usage

1. **Click** the AI assistant icon in your top panel (user icon)
2. **Type** your message or **click the microphone** for voice input
3. **Press Send** or hit `Ctrl+Enter` to submit
4. **View** AI responses with markdown formatting and tool usage
5. **Configure** settings via the gear icon (model selection, language, prompts)

### Keyboard Shortcuts

- `Ctrl + Enter` - Send message
- `Escape` - Close window (click icon again)

### Voice Input

The speech recognition feature requires:
- Browser support for Web Speech API OR
- Kaldi speech server running (included in docker-compose)

French language model is used by default via the Kaldi container.

## 🛠️ Development

### Start Development Servers

```bash
# Start Docker services
make start

# In separate terminals:
bun run dev:app     # Next.js dev server with HMR
bun run dev:gnome   # Build extension with live reload
```

### Build for Production

```bash
# Build Next.js app
bun run build

# Build extension
cd gnome && bun run build
```

### Linting & Formatting

```bash
bun run lint        # Check all workspaces
bun run lint:fix    # Auto-fix issues
bun run format      # Format code with Biome
```

### Docker Management

```bash
make start    # Start containers
make stop     # Stop containers
make logs     # View logs
```

## 🔧 Configuration

### LLM Configuration

Edit `config.json`:

```json
{
  "llm": {
    "model": "xiaomi/mimo-v2-flash:free",
    "language": "auto",
    "preprompt": "Custom system instructions here"
  }
}
```

The config is validated against `config.schema.json` and can be updated at runtime.

### Available Models

The app uses OpenRouter, so you can use any model available there:
- `xiaomi/mimo-v2-flash:free` (default, free)
- `anthropic/claude-3.5-sonnet`
- `openai/gpt-4-turbo`
- `google/gemini-pro`
- And many more...

### Extension Configuration

Edit `gnome/metadata.json` to change:
- Extension name and description
- Supported GNOME Shell versions
- Extension UUID

## 🐛 Troubleshooting

### Extension not appearing

```bash
# Check extension status
gnome-extensions info gnome-ai-assistant@neysixx

# View logs
journalctl -f -o cat /usr/bin/gnome-shell

# Reinstall
cd gnome && bun run build:install
```

### WebKit window not opening

Check that WebKit2GTK-6.0 is installed:

```bash
# Fedora/RHEL
sudo dnf install webkit2gtk4.1

# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-0
```

### API errors

```bash
# Check Docker containers
docker compose ps

# View app logs
make logs

# Verify environment variables
docker compose exec app env | grep API_KEY
```

### Speech recognition not working

The Kaldi speech server runs on port 2700. Check if it's running:

```bash
curl http://localhost:2700
docker compose logs speech-server
```

## 📦 Tech Stack

### GNOME Extension
- **TypeScript** - Type-safe extension code
- **GJS** - GNOME JavaScript bindings
- **GTK4** - Native UI toolkit
- **WebKit2GTK** - Web rendering engine
- **esbuild** - Fast bundling

### Next.js App
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **AI SDK** - Vercel AI SDK for streaming
- **OpenRouter** - LLM API gateway
- **Composio** - AI tool integration
- **Bun** - Fast JavaScript runtime

### Infrastructure
- **Docker** - Containerization
- **Kaldi** - Speech recognition server
- **Biome** - Fast linting and formatting

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `bun run check` to ensure code quality
5. Submit a pull request

## 📝 License

[Add your license here]

## 🙏 Acknowledgments

- OpenRouter for LLM API access
- Vercel AI SDK for streaming support
- GNOME developers for the extension API
- Kaldi project for speech recognition

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review GNOME Shell extensions documentation

---

**Note**: This extension is in active development. Some features may be unstable or incomplete.
