import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("calendar loading states mirror their final interfaces", async () => {
  const [publicLoader, calendarSkeleton, adminLoader] = await Promise.all([
    readFile("src/app/rezervace/loading.tsx", "utf8"),
    readFile("src/components/site/loading-skeletons.tsx", "utf8"),
    readFile("src/app/admin/calendar/loading.tsx", "utf8"),
  ]);

  assert.match(publicLoader, /CalendarSkeleton/);
  assert.match(publicLoader, /aria-busy="true"/);
  assert.doesNotMatch(publicLoader, /id="main-content"/);
  assert.match(calendarSkeleton, /grid-cols-7/);
  assert.match(calendarSkeleton, /length: 42/);
  assert.match(adminLoader, /repeat\(7,minmax/);
});

test("skeleton motion is restrained and removable", async () => {
  const [skeleton, styles] = await Promise.all([
    readFile("src/components/ui/skeleton.tsx", "utf8"),
    readFile("src/app/globals.css", "utf8"),
  ]);

  assert.match(skeleton, /skeleton-pulse_2\.2s/);
  assert.match(skeleton, /motion-reduce:animate-none/);
  assert.match(styles, /@keyframes skeleton-pulse/);
  assert.match(styles, /opacity: 0\.72/);
});
