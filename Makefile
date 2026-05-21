.PHONY: dev build clean web-dev icons release help examples-json docs-serve

help:
	@echo "CALLSTACK - API Testing Tool"
	@echo ""
	@echo "Available targets:"
	@echo "  dev            Run Tauri dev mode (Vite HMR + Rust backend)"
	@echo "  build          Build distributable app (.app / .dmg / .msi)"
	@echo "  web-dev        Run Vite dev server only (no Rust backend)"
	@echo "  examples-json  Regenerate docs/assets/data/scriptExamples.json from web/src/data/scriptExamples.ts"
	@echo "  docs-serve     Serve docs/ locally on http://localhost:8000"
	@echo "  clean          Remove build artifacts"
	@echo "  icons          Regenerate app icons"
	@echo "  release        Set release version (prompts for version number)"
	@echo "  help           Show this help"

release:
	@node scripts/set-release-version.js

dev:
	cd src-tauri && cargo tauri dev

build:
	npm --prefix web run build
	cd src-tauri && cargo tauri build

web-dev:
	cd web && npm run dev

examples-json:
	node scripts/build-examples-json.mjs

docs-serve:
	@echo "Serving docs/ at http://localhost:8000 — Ctrl+C to stop"
	@cd docs && python3 -m http.server 8000

clean:
	rm -rf web/dist src-tauri/target

icons:
	python3 generate-icons.py

