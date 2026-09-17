import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("self-navigating calendars carry no segment loading boundary", async () => {
  // Under a `loading.tsx` boundary the React build bundled with Next 15.5 can
  // park a same-page search-param navigation (see the note in each page), so
  // both calendars hold the current view instead of swapping in a skeleton.
  await Promise.all(
    [
      "src/app/rezervace/loading.tsx",
      "src/app/account/rezervace/[id]/zmenit/loading.tsx",
    ].map((path) => assert.rejects(readFile(path, "utf8"), { code: "ENOENT" })),
  );
  const [bookingPage, reschedulePage, skeletons] = await Promise.all([
    readFile("src/app/rezervace/page.tsx", "utf8"),
    readFile("src/app/account/rezervace/[id]/zmenit/page.tsx", "utf8"),
    readFile("src/components/site/loading-skeletons.tsx", "utf8"),
  ]);
  assert.match(bookingPage, /Deliberately no `loading\.tsx`/);
  assert.match(reschedulePage, /Deliberately no `loading\.tsx`/);
  assert.doesNotMatch(skeletons, /CalendarSkeleton/);
});

test("remaining loading states mirror their final interfaces", async () => {
  const [detailsLoader, doneLoader, adminLoader] = await Promise.all([
    readFile("src/app/rezervace/udaje/loading.tsx", "utf8"),
    readFile("src/app/rezervace/hotovo/loading.tsx", "utf8"),
    readFile("src/app/admin/calendar/loading.tsx", "utf8"),
  ]);

  for (const loader of [detailsLoader, doneLoader]) {
    assert.match(loader, /aria-busy="true"/);
    assert.doesNotMatch(loader, /id="main-content"/);
  }
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

test("unknown routes never invent a generic page skeleton", async () => {
  await Promise.all(
    ["src/app/loading.tsx", "src/app/admin/loading.tsx"].map((path) =>
      assert.rejects(readFile(path, "utf8"), { code: "ENOENT" }),
    ),
  );

  const loginForm = await readFile("src/app/login/login-form.tsx", "utf8");

  assert.match(loginForm, /Přihlašuji…/);
  assert.match(loginForm, /formState\.isSubmitting \|\| isNavigating/);
});
