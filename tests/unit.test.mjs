import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function appContext() {
  const noop = () => {};
  const node = () => ({
    classList: { add: noop, remove: noop, toggle: noop },
    addEventListener: noop,
    querySelectorAll: () => [],
    setAttribute: noop,
    append: noop,
    appendChild: noop,
    style: {},
  });
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    Uint16Array,
    document: {
      querySelector: node,
      querySelectorAll: () => [],
      createElement: node,
    },
  });
  vm.runInContext(fs.readFileSync("app-1.js", "utf8"), context, { filename: "app-1.js" });
  return context;
}

function run(ctx, expression) {
  return vm.runInContext(expression, ctx);
}

test("ordinary 5-7-5 regression", () => {
  const c = appContext();
  const counts = run(c, `parseText("Maybe it will rain\\nSpiders crawling on my skin\\nCoffee tastes like dirt.").stanzas[0].lines.map(lineStats).map(x=>x.syllables)`);
  assert.deepEqual([...counts], [5, 7, 5]);
});

test("Autumn Referendum remains 5-7-5", () => {
  const c = appContext();
  const counts = run(c, `parseText("Each leaf casts its vote.\\nThe Autumn Referendum\\nThe republic stands.").stanzas[0].lines.map(lineStats).map(x=>x.syllables)`);
  assert.deepEqual([...counts], [5, 7, 5]);
});

test("Jabberwocky opening survives nonce words", () => {
  const c = appContext();
  const counts = run(c, `parseText("'Twas brillig, and the slithy toves\\nDid gyre and gimble in the wabe:\\nAll mimsy were the borogoves,\\nAnd the mome raths outgrabe.").stanzas[0].lines.map(lineStats).map(x=>x.syllables)`);
  assert.deepEqual([...counts], [8, 8, 8, 6]);
});

test("Jabberwocky nonce words split plausibly and consistently", () => {
  const c = appContext();
  const expected = { brillig: 2, slithy: 2, toves: 1, gyre: 1, gimble: 2, borogoves: 3, mimsy: 2, frumious: 3, manxome: 2, uffish: 2, tulgey: 2, frabjous: 2, chortled: 2, galumphing: 3 };
  for (const [word, count] of Object.entries(expected)) {
    assert.equal(run(c, `syllabify(${JSON.stringify(word)}).length`), count, word);
    assert.equal(run(c, `syllabify(${JSON.stringify(word)}).join("").toLowerCase()`), word, word + " round-trip");
  }
});

test("parser preserves stanza and line structure", () => {
  const c = appContext();
  const shape = run(c, `(()=>{let d=parseText("one\\ntwo\\n\\nthree");return [d.stanzas.length,d.stanzas[0].lines.length,d.stanzas[1].lines.length]})()`);
  assert.deepEqual([...shape], [2, 2, 1]);
});

test("reconcile preserves annotations after deleting an earlier word", () => {
  const c = appContext();
  const result = run(c, `(()=>{doc=parseText("red blue green");let s=allSyllables();s[2].sy.stress="strong";s[2].sy.boundary="foot";doc=reconcile("red green");let n=allSyllables(doc);return [n[1].sy.text,n[1].sy.stress,n[1].sy.boundary]})()`);
  assert.deepEqual([...result], ["green", "strong", "foot"]);
});

test("reconcile preserves annotations after inserting a word", () => {
  const c = appContext();
  const result = run(c, `(()=>{doc=parseText("red blue");let s=allSyllables();s[1].sy.stress="medium";doc=reconcile("red bright blue");let n=allSyllables(doc);return [n.at(-1).sy.text,n.at(-1).sy.stress]})()`);
  assert.deepEqual([...result], ["blue", "medium"]);
});
