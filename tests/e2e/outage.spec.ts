import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { requireTestDatabaseUrl } from "../helpers/test-database";

test("database outage never offers invented availability or a usable checkout (#166)", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const database = new URL(requireTestDatabaseUrl());
  database.pathname = "/navi_missing_outage_test";
  let output = "";
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      "./tests/helpers/local-network.ts",
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      "3132",
      "-H",
      "127.0.0.1",
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: database.toString(),
        TEST_DATABASE_URL: database.toString(),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout?.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    output += String(chunk);
  });
  try {
    await expect
      .poll(
        async () => {
          if (child.exitCode !== null)
            throw new Error(`Outage fixture exited: ${output}`);
          try {
            return (
              await fetch("http://localhost:3132/login", {
                signal: AbortSignal.timeout(1000),
              })
            ).ok;
          } catch {
            return false;
          }
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    const response = await page.request.get(
      "http://localhost:3132/api/availability/day?date=" +
        new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    );
    expect(response.status()).toBe(503);
    await page.goto("http://localhost:3132/rezervace");
    await expect(page.getByRole("button", { name: /Vybrat$/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Pokračovat/ })).toHaveCount(0);
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    const starts = new Date(Date.now() + 86400000 * 7).toISOString();
    const detailsUrl = `http://localhost:3132/rezervace/udaje?start=${encodeURIComponent(starts)}`;
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") writes.push(request.url());
    });
    await page.goto(detailsUrl);
    await expect(
      page.getByRole("heading", { name: "Stránku se nepodařilo načíst" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Zkontrolovat rezervace v účtu" }),
    ).toHaveAttribute("href", "/account");
    await page.getByRole("button", { name: "Obnovit stránku" }).click();
    await expect(
      page.getByRole("heading", { name: "Stránku se nepodařilo načíst" }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("start")).toBe(starts);
    expect(writes).toEqual([]);
  } finally {
    if (child.exitCode === null) {
      const stopped = new Promise<void>((resolve) =>
        child.once("exit", () => resolve()),
      );
      child.kill("SIGTERM");
      await stopped;
    }
  }
});
