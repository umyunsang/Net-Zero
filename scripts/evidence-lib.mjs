export function assertSourceStable(before, after) {
  if (before !== after) throw new Error("Source changed during verification");
}

export function assertFresh(timestampMs, startedAtMs, label) {
  if (!Number.isFinite(timestampMs) || timestampMs < startedAtMs) {
    throw new Error(`${label} is stale for this verification run`);
  }
}

export function assertSourceBound(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} is bound to a different source hash`);
}

export function isSourceFile(path) {
  return path === ".env.example"
    || /(?:^|\/)Dockerfile$/.test(path)
    || /\.(?:ts|tsx|js|mjs|json|sql|md|yaml|yml|css|html|jpg|svg)$/.test(path);
}

export function isIgnoredSourceDirectory(name) {
  return name.startsWith(".") || ["node_modules", "dist", "test-results"].includes(name);
}
