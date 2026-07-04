import { test } from "node:test";
import assert from "node:assert/strict";
import { adjudicate, failureSignature, reconcileUnits, selectWinner, levelsOf, sortByPath, slug, buildTricolor } from "../scripts/adjudicate.mjs";

test("adjudicate: passes only when every probe matches", () => {
  const probes = [{ cmd: "a", expect_exit: 0 }, { cmd: "b", expect_exit: 3 }];
  assert.equal(adjudicate(probes, [{ cmd: "a", exit: 0 }, { cmd: "b", exit: 3 }]).pass, true);
  assert.equal(adjudicate(probes, [{ cmd: "a", exit: 0 }, { cmd: "b", exit: 0 }]).pass, false);
});

test("adjudicate: missing exit code is a failure, never a pass", () => {
  const v = adjudicate([{ cmd: "a", expect_exit: 0 }], []);
  assert.equal(v.pass, false);
  assert.equal(v.failures[0].exit, null);
});

test("adjudicate: empty probe list is NOT a pass (no evidence, no green)", () => {
  assert.equal(adjudicate([], []).pass, false);
});

test("adjudicate: duplicate exit reports use the first occurrence (deterministic)", () => {
  const v = adjudicate([{ cmd: "a", expect_exit: 0 }], [{ cmd: "a", exit: 0 }, { cmd: "a", exit: 1 }]);
  assert.equal(v.pass, true);
});

test("failureSignature: order-independent and stable", () => {
  const s1 = failureSignature([{ cmd: "b", exit: 1 }, { cmd: "a", exit: 2 }]);
  const s2 = failureSignature([{ cmd: "a", exit: 2 }, { cmd: "b", exit: 1 }]);
  assert.equal(s1, s2);
  assert.notEqual(s1, failureSignature([{ cmd: "a", exit: 3 }]));
});

test("reconcileUnits: consensus needs >=2 enumerators; singletons are disputed", () => {
  const { units, disputed } = reconcileUnits([
    { units: [{ path: "a" }, { path: "b" }] },
    { units: [{ path: "a" }] },
    { units: [{ path: "a" }, { path: "c" }] }
  ]);
  assert.deepEqual(units.map(u => u.path), ["a"]);
  assert.deepEqual(disputed.map(u => u.path).sort(), ["b", "c"]);
});

test("reconcileUnits: duplicate paths within one enumerator count once", () => {
  const { units } = reconcileUnits([
    { units: [{ path: "a" }, { path: "a" }] },
    { units: [] }
  ]);
  assert.equal(units.length, 0); // one enumerator listing it twice is still one vote
});

test("selectWinner: only PASS entries qualify; fewer confirmed findings wins", () => {
  const w = selectWinner([
    { status: "STUCK", confirmed_findings: 0, build: { branch: "x" } },
    { status: "PASS", confirmed_findings: 2, rounds: 0, build: { branch: "b" } },
    { status: "PASS", confirmed_findings: 1, rounds: 5, build: { branch: "a" } }
  ]);
  assert.equal(w.build.branch, "a");
});

test("selectWinner: total order — branch name breaks exact ties deterministically", () => {
  const entries = [
    { status: "PASS", confirmed_findings: 0, rounds: 1, build: { branch: "zeta" } },
    { status: "PASS", confirmed_findings: 0, rounds: 1, build: { branch: "alpha" } }
  ];
  assert.equal(selectWinner(entries).build.branch, "alpha");
  assert.equal(selectWinner(entries.reverse()).build.branch, "alpha");
});

test("selectWinner: all-red tournament returns null, never a loser", () => {
  assert.equal(selectWinner([{ status: "STUCK" }, { status: "FLAKY-ORACLE" }]), null);
});

test("levelsOf: strictly ascending levels, deterministic group order within a level", () => {
  const levels = levelsOf([
    { id: "b", level: 1 }, { id: "a", level: 0 }, { id: "c", level: 1 }, { id: "a2", level: 0 }
  ]);
  assert.deepEqual(levels.map(l => l.map(g => g.id)), [["a", "a2"], ["b", "c"]]);
});

test("sortByPath and slug are deterministic", () => {
  assert.deepEqual(sortByPath([{ path: "b" }, { path: "a" }]).map(u => u.path), ["a", "b"]);
  assert.equal(slug("src/foo bar/baz.ts"), "src_foo_bar_baz.ts");
});

test("buildTricolor: failures never fold into verified; grey counted in total", () => {
  const r = buildTricolor(
    [
      { meta: { path: "a" }, verdict: { pass: true, results: [], failures: [] } },
      { meta: { path: "b" }, verdict: { pass: false, results: [], failures: [{ cmd: "x" }] } },
      { meta: { path: "c" }, status: "STUCK" }
    ],
    [{ path: "a" }, { path: "b" }, { path: "c" }, { path: "d", grey: true }],
    { crosscutting: [] }
  );
  assert.equal(r.coverage.verified, 1);
  assert.equal(r.coverage.quarantined, 2);
  assert.equal(r.coverage.grey, 1);
  assert.equal(r.coverage.total, 4);
});
