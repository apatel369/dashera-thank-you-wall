import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildIgnitions,
  buildFinale,
  SHOW_MS,
  FINALE_START_MS,
} from "../src/lib/fireworks-schedule.ts";
import {
  crackerForId,
  CRACKER_TYPES,
} from "../src/lib/crackers.ts";

test("crackerForId always returns a valid type and is stable", () => {
  for (let id = 1; id <= 50; id++) {
    const type1 = crackerForId(id);
    const type2 = crackerForId(id);
    assert.equal(type1, type2, `Stable for id ${id}`);
    assert.ok(CRACKER_TYPES.includes(type1), `Valid type for id ${id}`);
  }
});

test("buildIgnitions is deterministic for the same seed and differs for different seeds", () => {
  const items = [
    { slot: 0, type: "anar" },
    { slot: 1, type: "chakri" },
    { slot: 2, type: "rocket" },
    { slot: 3, type: "phuljhari" },
    { slot: 4, type: "bomb" },
  ];

  const ignitions1 = buildIgnitions(12345, items);
  const ignitions2 = buildIgnitions(12345, items);
  const ignitions3 = buildIgnitions(99999, items);

  assert.deepEqual(ignitions1, ignitions2);
  assert.notDeepEqual(ignitions1, ignitions3);
});

test("every ignition has 0 <= igniteAt < endAt <= SHOW_MS - 500", () => {
  const items = [];
  for (let i = 0; i < 40; i++) {
    items.push({ slot: i, type: CRACKER_TYPES[i % CRACKER_TYPES.length] });
  }

  const ignitions = buildIgnitions(42, items);
  assert.equal(ignitions.length, items.length);

  for (const ig of ignitions) {
    assert.ok(ig.igniteAt >= 0, `igniteAt >= 0 for slot ${ig.slot}`);
    assert.ok(ig.igniteAt < ig.endAt, `igniteAt < endAt for slot ${ig.slot}`);
    assert.ok(ig.endAt <= SHOW_MS - 500, `endAt <= SHOW_MS - 500 for slot ${ig.slot} (was ${ig.endAt})`);
  }
});

test("each type respects its window", () => {
  const items = [
    { slot: 0, type: "phuljhari" },
    { slot: 1, type: "chakri" },
    { slot: 2, type: "anar" },
    { slot: 3, type: "rocket" },
    { slot: 4, type: "bomb" },
  ];

  const ignitions = buildIgnitions(777, items);
  for (const ig of ignitions) {
    switch (ig.type) {
      case "phuljhari":
        assert.ok(ig.igniteAt >= 0 && ig.igniteAt <= 3500);
        break;
      case "chakri":
        assert.ok(ig.igniteAt >= 2000 && ig.igniteAt <= 8500);
        break;
      case "anar":
        assert.ok(ig.igniteAt >= 4500 && ig.igniteAt <= 12500);
        break;
      case "rocket":
        assert.ok(ig.igniteAt >= 7500 && ig.igniteAt <= 15000);
        break;
      case "bomb":
        assert.ok(ig.igniteAt >= 10500 && ig.igniteAt <= 16500);
        break;
    }
  }
});

test("peak starts per second <= 8 for a test input of 60 items (12 of each type)", () => {
  const items = [];
  for (let i = 0; i < 60; i++) {
    items.push({ slot: i, type: CRACKER_TYPES[i % 5] });
  }

  const ignitions = buildIgnitions(8888, items);
  assert.equal(ignitions.length, 60);

  // Check 1-second sliding window
  for (let t = 0; t <= SHOW_MS; t += 200) {
    const inWindow = ignitions.filter(ig => ig.igniteAt >= t && ig.igniteAt < t + 1000).length;
    assert.ok(
      inWindow <= 8,
      `Peak starts in 1s window starting at ${t}ms was ${inWindow} (must be <= 8)`
    );
  }
});

test("buildFinale returns events within bounds and sorted by at", () => {
  const width = 1920;
  const height = 1080;
  const finale = buildFinale(42, width, height);

  assert.ok(finale.length >= 35 && finale.length <= 45);

  for (let i = 0; i < finale.length; i++) {
    const ev = finale[i];
    assert.ok(ev.at >= FINALE_START_MS - 50, `at >= FINALE_START_MS (${ev.at})`);
    assert.ok(ev.at <= SHOW_MS - 200, `at <= SHOW_MS - 200 (${ev.at})`);
    assert.ok(ev.x >= 0.08 * width && ev.x <= 0.92 * width, `x in bounds (${ev.x})`);
    assert.ok(ev.y >= 0.12 * height && ev.y <= 0.50 * height, `y in bounds (${ev.y})`);
    if (i > 0) {
      assert.ok(ev.at >= finale[i - 1].at, "Sorted by at");
    }
  }
});
