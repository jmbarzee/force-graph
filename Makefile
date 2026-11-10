.PHONY: help check typecheck typecheck-example test build

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
