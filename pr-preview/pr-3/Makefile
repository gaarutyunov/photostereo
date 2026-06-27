# Stereoscope — local dev helpers.
# The site is fully static (HTML + ES modules), but it must be served over HTTP
# (ES module imports and fonts won't load from file://). Default port: 8000.

PORT ?= 8000

.PHONY: serve
serve: ## Serve the site locally at http://localhost:$(PORT)
	@echo "Serving stereoscope at http://localhost:$(PORT) (Ctrl-C to stop)"
	@python3 -m http.server $(PORT)

.PHONY: open
open: ## Open the served site in the default browser
	@open "http://localhost:$(PORT)"

.PHONY: help
help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'
