import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }));
  return nested.flat();
}

test("JavaScript files parse without syntax errors", async () => {
  const files = await walk(path.join(projectRoot, "js"));
  const jsFiles = files.filter((file) => file.endsWith(".js"));
  assert.ok(jsFiles.length > 0, "expected to find JavaScript files");

  for (const file of jsFiles) {
    try {
      execFileSync(process.execPath, ["--check", "--input-type=commonjs"], {
        input: await readFile(file, "utf8"),
      });
    } catch (error) {
      throw new Error(`Syntax error in ${path.relative(projectRoot, file)}:\n${error.stderr?.toString() || error.message}`);
    }
  }
});

test("HTML pages reference existing local assets", async () => {
  const htmlFiles = [
    path.join(projectRoot, "index.html"),
    ...(await walk(path.join(projectRoot, "html"))).filter((file) => file.endsWith(".html")),
  ];
  const missing = [];

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, "utf8");
    const refs = html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi);

    for (const [, reference] of refs) {
      if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(reference)) continue;
      const localPath = reference.split(/[?#]/, 1)[0];
      const target = localPath.startsWith("/")
        ? path.join(projectRoot, localPath.slice(1))
        : path.resolve(path.dirname(htmlFile), localPath);
      try {
        await stat(target);
      } catch {
        missing.push(`${path.relative(projectRoot, htmlFile)} -> ${reference}`);
      }
    }
  }

  assert.deepEqual(missing, [], `missing local assets:\n${missing.join("\n")}`);
});
