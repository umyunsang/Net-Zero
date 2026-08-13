import assert from "node:assert/strict";
import { test } from "node:test";

import { assertFresh, assertSourceBound, assertSourceStable, isIgnoredSourceDirectory, isSourceFile } from "./evidence-lib.mjs";

test("rejects stale raw verification output", () => {
  assert.throws(() => assertFresh(999, 1_000, "Vitest"), /stale/);
  assert.doesNotThrow(() => assertFresh(1_000, 1_000, "Vitest"));
});

test("rejects changed or mismatched source bindings", () => {
  assert.throws(() => assertSourceStable("sha256:before", "sha256:after"), /changed/);
  assert.throws(() => assertSourceBound("sha256:old", "sha256:new", "artifact"), /different/);
  assert.doesNotThrow(() => {
    assertSourceStable("sha256:same", "sha256:same");
    assertSourceBound("sha256:same", "sha256:same", "artifact");
  });
});

test("includes runtime styles, pages, environment contracts, and binary fixtures", () => {
  for (const path of [".env.example", "tsconfig.base.json", "pnpm-workspace.yaml", "apps/web/index.html", "apps/web/public/icon.svg", "apps/web/src/styles.css", "apps/web/src/synthetic-fixture.jpg"]) {
    assert.equal(isSourceFile(path), true, path);
  }
  assert.equal(isSourceFile("apps/web/tsconfig.app.tsbuildinfo"), false);
  for (const name of ["node_modules", "dist", "test-results", ".cache"]) {
    assert.equal(isIgnoredSourceDirectory(name), true, name);
  }
});
