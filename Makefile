.PHONY: install update delete delete-all start stop logs restart-gnome

# UUID of the extension (must match metadata.json)
UUID = gnome-ai-assistant@neysixx
# Shared data directory used by the extension
SHARED_DIR = $(HOME)/.local/share/ai-assistant

# Build and install the GNOME extension (Docker is started by the extension on first launch)
install:
	cd ./gnome && bun run build:install

# Remove docker-compose.yml to force extension to fetch latest version on next launch
update:
	rm -f $(SHARED_DIR)/docker-compose.yml
	@echo "docker-compose.yml removed. The extension will fetch the latest version on next launch."

# Uninstall extension and stop Docker containers
delete:
	-gnome-extensions uninstall $(UUID)
	-docker compose -f $(SHARED_DIR)/docker-compose.yml down

# Uninstall extension and remove all config from shared directory
delete-all:
	-gnome-extensions uninstall $(UUID)
	-docker compose -f $(SHARED_DIR)/docker-compose.yml down
	rm -rf $(SHARED_DIR)
	@echo "Extension uninstalled and all config removed from $(SHARED_DIR)"

# Start Docker containers
start:
	@echo "Starting services..."
	docker compose up -d
	@echo "The app is running on http://localhost:9999"

# Stop Docker containers
stop:
	docker compose down

# Restart GNOME Shell (only works under X11)
restart-gnome:
	busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'global.reexec_self()'

# View Docker logs
logs:
	docker compose logs -f