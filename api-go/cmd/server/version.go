package main

// These variables are set at build time via ldflags (see Makefile).
//
//	make build VERSION=v1.2.3 GIT_COMMIT=abc1234 BUILD_TIME=2026-06-17T00:00:00Z
//
// During development (go run) they keep their default "dev" / "unknown" values.
var (
	version   = "dev"
	gitCommit = "unknown"
	buildTime = "unknown"
)
