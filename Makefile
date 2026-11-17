.PHONY: help check typecheck typecheck-example test build docs react-types readme release

## help — print the targets
help:
	@sed -n 's/^## //p' Makefile

## check — everything CI runs
check: typecheck typecheck-example test build docs react-types readme

## typecheck — the library's types
typecheck:
	npm run typecheck

## typecheck-example — the examples against the public entry
typecheck-example:
	npx tsc --noEmit -p examples/course-catalog/tsconfig.json
	npx tsc --noEmit -p examples/many-axes/tsconfig.json

## test — the unit tests
test:
	npm test

## build — the library artifact in dist-lib/
build:
	npm run build:lib

## docs — every declaration the build ships carries a doc comment
docs: build
	node verify/dts-docs.mjs

## react-types — a host compiles against the shipped declarations under React 18's types and React 19's
react-types: build
	npx tsc --noEmit -p verify/react-types/tsconfig.18.json
	npx tsc --noEmit -p verify/react-types/tsconfig.19.json

## readme — the README names nothing src/ exports that the entry does not
readme:
	node verify/readme-names.mjs

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
