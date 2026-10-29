import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";

// Mount the actual component with an in-memory SDK replacement. This needs no
// API key, product test endpoint, database records or requests to Google.
let bundle: string;
test.beforeAll(async () => {
  const result = await build({
    absWorkingDir: process.cwd(),
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      contents: `
        import React from "react";
        import {createRoot} from "react-dom/client";
        import {LocationMap} from "./src/components/site/location-map";
        const root = createRoot(document.getElementById("root"));
        window.unmountMap = () => root.unmount();
        root.render(<div style={{position:"relative",width:600,height:400}}>
          <LocationMap address="Synthetic local map" apiKey="local-map-key" mapId="local-map-id"
            position={{lat:49.75,lng:13.37}} fallbackEmbedUrl="about:blank" />
        </div>);
      `,
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    external: ["@sentry/nextjs"],
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.NEXT_PUBLIC_SENTRY_DSN": '""',
    },
    plugins: [
      {
        name: "local-maps-sdk",
        setup(builder) {
          builder.onResolve({ filter: /^@googlemaps\/js-api-loader$/ }, () => ({
            path: "maps",
            namespace: "local-maps",
          }));
          builder.onLoad({ filter: /.*/, namespace: "local-maps" }, () => ({
            loader: "js",
            contents: `
        const state = window.mapProof = {maps:0, detached:0, removed:0, unbound:0, cleared:0, listenerRemoved:0};
        window.google = {maps:{event:{clearInstanceListeners(){state.cleared++;}}}};
        export function setOptions(options){state.loaderOptions=options;}
        class FakeMap {
          constructor(container,options){state.maps++;state.options=options;container.append(document.createElement("div"));}
          addListener(name,callback){state.ready=callback;return {remove(){state.listenerRemoved++;}};}
          unbindAll(){state.unbound++;}
        }
        class FakeMarker {
          constructor(options){this.map=options.map;this.node=document.createElement("span");}
          set map(value){this.currentMap=value;if(value===null)state.detached++;}
          get map(){return this.currentMap;}
          append(node){this.node.append(node);}
          remove(){state.removed++;if(state.failCleanup)throw new Error("Synthetic marker cleanup failure");this.node.remove();}
        }
        export async function importLibrary(name){
          if(window.failMapImport) throw new Error("Synthetic SDK outage");
          return name==="maps" ? {Map:FakeMap,RenderingType:{RASTER:"RASTER"}} : {AdvancedMarkerElement:FakeMarker};
        }
      `,
          }));
        },
      },
    ],
  });
  bundle = result.outputFiles[0]!.text;
});

async function mount(page: Page, failImport = false) {
  // All attempted network access is refused, including accidental SDK calls.
  await page.route("**/*", (route) => route.abort());
  await page.setContent(
    '<style>.hidden{display:none}.absolute{position:absolute;inset:0}iframe{width:600px;height:400px}</style><div id="root"></div>',
  );
  await page.evaluate((fail) => {
    (window as unknown as { failMapImport: boolean }).failMapImport = fail;
  }, failImport);
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId("location-map")).toBeVisible();
}

type MapWindow = Window & {
  mapProof: {
    maps: number;
    detached: number;
    removed: number;
    unbound: number;
    cleared: number;
    listenerRemoved: number;
    failCleanup?: boolean;
    options: { renderingType: string };
    ready: () => void;
  };
  unmountMap: () => void;
};

test("enhanced location map uses raster and keeps the iframe until tiles are ready", async ({
  page,
}) => {
  await mount(page);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as MapWindow).mapProof.maps),
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () => (window as unknown as MapWindow).mapProof.options.renderingType,
    ),
  ).toBe("RASTER");
  await page.evaluate(() => (window as unknown as MapWindow).mapProof.ready());
  await expect(page.getByTestId("location-map")).toBeHidden();
  await page.evaluate(() => (window as unknown as MapWindow).unmountMap());
  expect(
    await page.evaluate(() => {
      const s = (window as unknown as MapWindow).mapProof;
      return [s.detached, s.removed, s.unbound, s.cleared, s.listenerRemoved];
    }),
  ).toEqual([1, 1, 1, 1, 1]);
});

test("a confirmed Maps runtime failure restores the iframe and immediately disposes the failed renderer", async ({
  page,
}) => {
  await mount(page);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as MapWindow).mapProof.maps),
    )
    .toBe(1);
  await page.evaluate(() => (window as unknown as MapWindow).mapProof.ready());
  await expect(page.getByTestId("location-map")).toBeHidden();
  const consumed = await page.evaluate(() => {
    const error = new Error("~#!#~0~#!#~Script error.~#!#~");
    error.stack =
      "at app:///maps-api-v3/api/js/66/11a/intl/cs_ALL/webgl.js:148:79";
    const event = new ErrorEvent("error", { error, cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(consumed).toBe(true);
  await expect(page.getByTestId("location-map")).toBeVisible();
  await expect(page.getByTestId("location-map-canvas")).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const s = (window as unknown as MapWindow).mapProof;
      return [s.detached, s.removed, s.unbound, s.cleared, s.listenerRemoved];
    }),
  ).toEqual([1, 1, 1, 1, 1]);
  // A late Google callback cannot cover the fallback or dispose twice.
  await page.evaluate(() => (window as unknown as MapWindow).mapProof.ready());
  await expect(page.getByTestId("location-map")).toBeVisible();
  await page.evaluate(() => (window as unknown as MapWindow).unmountMap());
  expect(
    await page.evaluate(
      () => (window as unknown as MapWindow).mapProof.unbound,
    ),
  ).toBe(1);
});

test("failed SDK imports keep a usable iframe and unrelated errors remain observable", async ({
  page,
}) => {
  await mount(page, true);
  await expect(page.getByTestId("location-map-canvas")).toHaveCount(0);
  const consumed = await page.evaluate(() => {
    const error = new TypeError("Application failure");
    error.stack = "at app:///_next/static/chunks/application.js:1:10";
    const event = new ErrorEvent("error", { error, cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(consumed).toBe(false);
  await expect(page.getByTestId("location-map")).toBeVisible();
});

test("one provider cleanup failure cannot interrupt the fallback or other cleanup", async ({
  page,
}) => {
  await mount(page);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as MapWindow).mapProof.maps),
    )
    .toBe(1);
  await page.evaluate(() => {
    (window as unknown as MapWindow).mapProof.failCleanup = true;
    window.gm_authFailure?.();
  });
  await expect(page.getByTestId("location-map")).toBeVisible();
  await expect(page.getByTestId("location-map-canvas")).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const s = (window as unknown as MapWindow).mapProof;
      return [s.detached, s.removed, s.unbound, s.cleared, s.listenerRemoved];
    }),
  ).toEqual([1, 1, 1, 1, 1]);
  await page.evaluate(() => (window as unknown as MapWindow).unmountMap());
});
