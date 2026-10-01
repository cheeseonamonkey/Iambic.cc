import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("static entrypoint references files that exist", () => {
  const html = fs.readFileSync("index.html", "utf8");
  for (const file of ["style.css", "app-1.js", "app-2.js", "app-3.js"]) {
    assert.ok(html.includes(file), "index.html should reference " + file);
    assert.ok(fs.existsSync(file), file + " should exist");
  }
});

test("poem library has valid required fields and unique title/author pairs", () => {
  const poems = JSON.parse(fs.readFileSync("poems.json", "utf8"));
  assert.ok(Array.isArray(poems) && poems.length > 0);
  const seen = new Set();
  for (const [i, p] of poems.entries()) {
    for (const key of ["title", "author", "text", "license"])
      assert.equal(typeof p[key] === "string" && p[key].trim().length > 0, true, `poem ${i}: ${key}`);
    const id = p.author.trim() + "\\0" + p.title.trim();
    assert.equal(seen.has(id), false, "duplicate poem: " + p.author + " / " + p.title);
    seen.add(id);
  }
});

test("custom-domain deployment files agree", () => {
  assert.equal(fs.readFileSync("CNAME", "utf8").trim(), "iambic.cc");
  assert.ok(fs.existsSync(".nojekyll"));
});
