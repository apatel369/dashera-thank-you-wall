import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceWall, FILL_INTERVAL_MS, latestScrollNotes } from "../src/lib/wall-flow.ts";

// Integration tests must never switch the live projector or pause real guests.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const store = await import("../api/_store.ts");

const sample = {
  message: "Let go of anger", colorStyle: "golden", texture: "plain",
  fontColor: "warm", symbol: "none",
};

test("input validation", () => {
  assert.equal(store.parseInput({ message: "   " }), null);
  assert.equal(store.parseInput({ ...sample, message: "x".repeat(121) }), null);
  assert.equal(store.parseInput(sample)?.message, sample.message);
});

test("the stationary wall fills, replaces one random slot, and stays put when idle", () => {
  assert.equal(FILL_INTERVAL_MS, 2000);
  let slots = [null, null, null];
  let queue = [1, 2, 3, 4];
  for (const expected of [1, 2, 3]) {
    const step = advanceWall(slots, queue, () => 0);
    slots = step.slots;
    queue = step.queue;
    assert.equal(slots.filter(Boolean).length, expected);
  }
  assert.deepEqual(slots, [1, 2, 3]);
  const replaced = advanceWall(slots, queue, () => 0.5);
  assert.deepEqual(replaced.slots, [1, 4, 3]);
  assert.deepEqual(replaced.queue, []);
  assert.equal(advanceWall(replaced.slots, [], () => 0).changed, false);
  assert.deepEqual(latestScrollNotes(Array.from({ length: 105 }, (_, index) => index)),
    Array.from({ length: 100 }, (_, index) => index + 5));
});

test("test mode seeds, switches display modes, pauses guests, and restores real notes", {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const original = await store.getState();
  assert.equal(original.testMode, false, "test database must start outside test mode");
  const realNotes = await store.getSubmissions(original.session);
  let demoSession = "";
  try {
    const testState = await store.startTest();
    demoSession = testState.session;
    assert.equal(testState.mode, "wall");
    assert.equal(testState.testMode, true);
    assert.match(demoSession, /^demo-[a-f0-9]{16}$/);
    assert.deepEqual(await store.startTest(), testState, "a repeat click cannot seed more notes");

    const notes = await store.getSubmissions(demoSession);
    assert.equal(notes.length, 100);
    assert.equal(new Set(notes.map(note => note.id)).size, 100);
    assert.ok(notes.every(note => /^Demo \d{3} · /.test(note.message)));
    assert.equal(new Set(notes.map(note => note.colorStyle)).size, 4);
    await assert.rejects(store.addSubmission(store.parseInput(sample), original.session), /paused/);
    await assert.rejects(store.setMode("qr"), /End test mode/);
    const scrolled = await store.setMode("scroll");
    assert.equal(scrolled.mode, "scroll");
    assert.equal(scrolled.testMode, true);
    assert.equal(scrolled.session, demoSession);
    const burned = await store.setMode("burn");
    assert.equal(burned.mode, "burn");
    assert.equal(burned.testMode, true);
    assert.equal(burned.session, demoSession);
    assert.equal((await store.setMode("wall")).mode, "wall");
    const cursor = { createdAt: notes[11].createdAt, id: notes[11].id };
    assert.deepEqual(await store.getSubmissionsAfter(demoSession, cursor), notes.slice(12));
    await assert.rejects(store.endTest("demo-stale"), /test session changed/i);
    await store.endTest(demoSession);

    assert.deepEqual(await store.getState(), original);
    assert.deepEqual(await store.getSubmissions(original.session), realNotes);
    assert.deepEqual(await store.getSubmissions(demoSession), []);
    assert.deepEqual(await store.getApprovalBatches(demoSession), []);
    assert.deepEqual(await store.endTest(demoSession), original, "repeat end is harmless");
  } finally {
    const state = await store.getState();
    if (state.testMode && state.session === demoSession) await store.endTest(demoSession);
  }
});
