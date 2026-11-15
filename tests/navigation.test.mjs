import test from "node:test";
import assert from "node:assert/strict";
import "../app.js";

const nav = globalThis.__TERRA_ANALOG_NAV__;

test("deck has exactly 6 slides", () => {
  assert.equal(nav.TOTAL_SLIDES, 6);
});

test("clampSlideIndex bounds values cleanly", () => {
  assert.equal(nav.clampSlideIndex(-1), 0);
  assert.equal(nav.clampSlideIndex(0), 0);
  assert.equal(nav.clampSlideIndex(3), 3);
  assert.equal(nav.clampSlideIndex(9), 5);
});

test("formatSlideCounter formats 1 / 6 style strings", () => {
  assert.equal(nav.formatSlideCounter(0), "1 / 6");
  assert.equal(nav.formatSlideCounter(2), "3 / 6");
  assert.equal(nav.formatSlideCounter(5), "6 / 6");
});

test("keyboard navigation maps arrows, page keys, and spacebar", () => {
  assert.equal(nav.getSlideDirectionForKey("ArrowRight", false), 1);
  assert.equal(nav.getSlideDirectionForKey("ArrowDown", false), 1);
  assert.equal(nav.getSlideDirectionForKey("PageDown", false), 1);
  assert.equal(nav.getSlideDirectionForKey("ArrowLeft", false), -1);
  assert.equal(nav.getSlideDirectionForKey("ArrowUp", false), -1);
  assert.equal(nav.getSlideDirectionForKey("PageUp", false), -1);
  assert.equal(nav.getSlideDirectionForKey(" ", false), 1);
  assert.equal(nav.getSlideDirectionForKey(" ", true), 0);
});

test("swipe navigation enforces 50px threshold and rejects vertical scroll", () => {
  assert.equal(nav.getSlideDirectionForSwipe(-55, 10), 1);
  assert.equal(nav.getSlideDirectionForSwipe(55, 5), -1);
  assert.equal(nav.getSlideDirectionForSwipe(-49, 0), 0);
  assert.equal(nav.getSlideDirectionForSwipe(-60, 75), 0);
});

test("wheel navigation respects internal vertical scroll boundaries", () => {
  assert.equal(nav.getSlideDirectionForWheel(0, 25, 0, 700, 700), 1);
  assert.equal(nav.getSlideDirectionForWheel(0, -25, 0, 700, 700), -1);
  assert.equal(nav.getSlideDirectionForWheel(0, 25, 40, 900, 700), 0);
  assert.equal(nav.getSlideDirectionForWheel(0, 25, 200, 900, 700), 1);
  assert.equal(nav.getSlideDirectionForWheel(0, -25, 40, 900, 700), 0);
  assert.equal(nav.getSlideDirectionForWheel(0, -25, 0, 900, 700), -1);
});

test("filterEnabledSources excludes disabled data sources", () => {
  const result = nav.filterEnabledSources([
    { name: "A", enabled: true },
    { name: "B", enabled: false },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "A");
});
