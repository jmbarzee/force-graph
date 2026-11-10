.PHONY: help check typecheck typecheck-example test build release

## help — print the targets
help:
	@sed -n 's/^## //p' Makefile

## check — everything CI runs
check: typecheck typecheck-example test build

## typecheck — the library's types
typecheck:
	npm run typecheck

## typecheck-example — the course catalog against the public entry
typecheck-example:
	npx tsc --noEmit -p examples/course-catalog/tsconfig.json

## test — the unit tests
test:
	npm test

## build — the library artifact in dist-lib/
build:
	npm run build:lib

TYPE ?= minor

## release — tag origin/main as the next vX.Y.Z and push it (TYPE=patch|minor, or VERSION=X.Y.Z)
release:
	@git fetch -q --tags origin main
	@test -z "$$(git status --porcelain)" || { echo "release: the tree is dirty"; exit 1; }
	@test "$$(git rev-parse HEAD)" = "$$(git rev-parse origin/main)" || { echo "release: HEAD is not origin/main"; exit 1; }
	@last=$$(git tag -l 'v*.*.*' --sort=-v:refname | head -1); \
	v=$${VERSION:-$$(echo "$${last:-v0.0.1}" | awk -F. -v t=$(TYPE) '{ sub("v", "", $$1) } t == "patch" { print $$1 "." $$2 "." $$3 + 1 } t == "minor" { print $$1 "." $$2 + 1 ".0" }')}; \
	echo "$$v" | grep -Eqx '[0-9]+\.[0-9]+\.[0-9]+' || { echo "release: no version from TYPE=$(TYPE) VERSION=$(VERSION)"; exit 1; }; \
	! git ls-remote --exit-code --tags origin "refs/tags/v$$v" >/dev/null || { echo "release: v$$v is already on origin"; exit 1; }; \
	git tag "v$$v" && git push origin "v$$v"
