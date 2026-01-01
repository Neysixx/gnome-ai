.PHONY: install start stop logs

# UUID of the extension (must match metadata.json)
UUID = gnome-ai-assistant@neysixx

install:
	docker compose up --build -d &&	cd ./gnome && bun run build:install

start:
	@echo "Starting services..."
	docker compose up -d
	@echo "The app is running on http://localhost:9999"

stop:
	docker compose down

restart-gnome:
	# Only works under X11
	busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'global.reexec_self()'

logs:
	docker compose logs -f