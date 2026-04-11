.PHONY: dev build clean web-dev icons help

help:
	@echo "CALLSTACK - API Testing Tool"
	@echo ""
	@echo "Available targets:"
	@echo "  dev         Run Tauri dev mode (Vite HMR + Rust backend)"
	@echo "  build       Build distributable app (.app / .dmg / .msi)"
	@echo "  web-dev     Run Vite dev server only (no Rust backend)"
	@echo "  clean       Remove build artifacts"
	@echo "  icons       Regenerate app icons"
	@echo "  help        Show this help"

dev:
	cd src-tauri && cargo tauri dev

build:
	cd src-tauri && cargo tauri build

web-dev:
	cd web && npm run dev

clean:
	rm -rf web/dist src-tauri/target

icons:
	python3 generate-icons.py
