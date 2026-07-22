import assert from "node:assert/strict";
import test from "node:test";
import { inspectUpload } from "../../src/lib/services/media";

test("upload inspection derives PNG MIME and dimensions from bytes", () => {
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png, 0);
  png.writeUInt32BE(1200, 16);
  png.writeUInt32BE(800, 20);
  assert.deepEqual(inspectUpload(png), {
    mimeType: "image/png",
    extension: "png",
    width: 1200,
    height: 800,
  });
});

test("SVG and renamed script content are rejected", () => {
  assert.throws(() =>
    inspectUpload(Buffer.from("<svg onload=alert(1)></svg>")),
  );
  assert.throws(() =>
    inspectUpload(Buffer.from("console.log('not an image')")),
  );
});
