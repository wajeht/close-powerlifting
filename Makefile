DC := docker compose -f docker-compose.dev.yml
EXEC := $(DC) exec close-powerlifting

.PHONY: help up up-d down restart log shell test test-watch test-coverage \
	lint format typecheck check snapshot snapshot-build snapshot-commit \
	push clean

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
	@echo "Snapshot:"
	@echo "  snapshot         Rebuild + commit the OPL snapshot"
	@echo "  snapshot-build   Rebuild the JSON snapshot from the OPL CSV"
	@echo "  snapshot-commit  Stage + commit the snapshot files (requires git-lfs)"
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

snapshot: snapshot-build snapshot-commit

snapshot-build:
	@npx tsx scripts/build-snapshot.ts

snapshot-commit:
	@command -v git-lfs >/dev/null 2>&1 || { \
		echo ""; \
		echo "git-lfs is not installed."; \
		echo "  brew install git-lfs"; \
		echo "  git lfs install"; \
		echo ""; \
		exit 1; \
	}
	@if git diff --quiet HEAD -- src/data/snapshot/ 2>/dev/null && \
	   [ -z "$$(git ls-files --others --exclude-standard src/data/snapshot/)" ]; then \
		echo "No snapshot changes to commit."; \
		exit 0; \
	fi
	@BUILT=$$(node -e "console.log(JSON.parse(require('fs').readFileSync('src/data/snapshot/meta.json','utf8')).builtAt)"); \
	git add src/data/snapshot/ && \
	git commit -m "chore(data): refresh OPL snapshot ($$BUILT)"

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
