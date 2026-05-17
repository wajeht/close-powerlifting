DC := docker compose -f docker-compose.dev.yml
EXEC := $(DC) exec close-powerlifting

.PHONY: help up up-d down restart log shell test test-watch test-coverage \
	lint format typecheck check snapshot-build snapshot-download \
	snapshot-publish push clean

REPO ?= wajeht/close-powerlifting
SNAPSHOT_TAG ?= snapshot-latest
SNAPSHOT_BASE := https://github.com/$(REPO)/releases/download/$(SNAPSHOT_TAG)

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Development:"
	@echo "  up               Start dev server"
	@echo "  up-d             Start dev server in background"
	@echo "  down             Stop dev server"
	@echo "  restart          Restart dev server"
	@echo "  log              Follow container logs"
	@echo "  shell            Open shell in container"
	@echo ""
	@echo "Testing:"
	@echo "  test             Run all tests"
	@echo "  test-watch       Run tests in watch mode"
	@echo "  test-coverage    Run tests with coverage"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint             Run linter"
	@echo "  format           Format code"
	@echo "  typecheck        Run TypeScript type checking"
	@echo "  check            Run lint + format + typecheck"
	@echo ""
	@echo "Snapshot (data lives in the snapshot-latest GitHub Release, not git):"
	@echo "  snapshot-download  Fetch the latest snapshot assets from the release"
	@echo "  snapshot-build     Rebuild the JSON snapshot locally from OPL's CSV"
	@echo "  snapshot-publish   Build + upload as snapshot-latest release assets (gh CLI)"
	@echo ""
	@echo "Deployment:"
	@echo "  push             Test + lint + format + commit + push"
	@echo "  clean            Remove all containers and volumes"

# === Development ===

up:
	@$(DC) up

up-d:
	@$(DC) up -d

down:
	@$(DC) down

restart:
	@$(DC) restart close-powerlifting

log:
	@$(DC) logs -f

shell:
	@$(EXEC) sh

# === Testing ===

test:
	@$(EXEC) npm run test

test-watch:
	@$(EXEC) npm run test -- --watch

test-coverage:
	@$(EXEC) npm run test:coverage

# === Code Quality ===

lint:
	@$(EXEC) npm run lint

format:
	@$(EXEC) npm run format

typecheck:
	@$(EXEC) npx tsc --noEmit

check:
	@$(MAKE) lint
	@$(MAKE) format
	@$(MAKE) typecheck

# === Snapshot ===

snapshot-build:
	@npx tsx scripts/build-snapshot.ts

snapshot-download:
	@mkdir -p src/data/snapshot
	@echo "Downloading snapshot from $(SNAPSHOT_BASE)..."
	@curl -fsSL --retry 3 -o src/data/snapshot/lifters.json  "$(SNAPSHOT_BASE)/lifters.json"
	@curl -fsSL --retry 3 -o src/data/snapshot/meets.json    "$(SNAPSHOT_BASE)/meets.json"
	@curl -fsSL --retry 3 -o src/data/snapshot/entries.json  "$(SNAPSHOT_BASE)/entries.json"
	@curl -fsSL --retry 3 -o src/data/snapshot/meta.json     "$(SNAPSHOT_BASE)/meta.json"
	@ls -lh src/data/snapshot/

snapshot-publish:
	@command -v gh >/dev/null 2>&1 || { \
		echo ""; \
		echo "gh CLI is not installed."; \
		echo "  brew install gh"; \
		echo "  gh auth login"; \
		echo ""; \
		exit 1; \
	}
	@$(MAKE) snapshot-build
	@BUILT=$$(node -e "console.log(JSON.parse(require('fs').readFileSync('src/data/snapshot/meta.json','utf8')).builtAt)"); \
	echo "Publishing snapshot-latest release..."; \
	gh release delete $(SNAPSHOT_TAG) --yes --cleanup-tag 2>/dev/null || true; \
	gh release create $(SNAPSHOT_TAG) \
		--title "OPL snapshot ($$BUILT)" \
		--notes "Manual publish via Makefile. See meta.json for counts." \
		src/data/snapshot/lifters.json \
		src/data/snapshot/meets.json \
		src/data/snapshot/entries.json \
		src/data/snapshot/meta.json

# === Deployment ===

push:
	@$(MAKE) test
	@$(MAKE) lint
	@$(MAKE) format
	@git add -A
	@curl -s http://commit.jaw.dev/ | sh -s -- --no-verify
	@git push --no-verify

clean:
	@$(DC) down --rmi all --volumes --remove-orphans
	@docker system prune -a -f
	@docker volume prune -f
	@docker network prune -f
