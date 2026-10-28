import assert from "node:assert/strict";
import test from "node:test";
import type { ErrorEvent } from "@sentry/nextjs";
import {
  isGoogleMapsModuleError,
  isInjectedFacebookError,
  isInjectedBrowserError,
  isTransportError,
  markMapErrorRecovered,
  wasMapErrorRecovered,
} from "../../src/lib/helpers/browser-errors";

const ua = "Mozilla/5.0 [FBAN/FBIOS;FBAV/559.0.0]";
function bridge(file = "app:///"): ErrorEvent {
  return {
    type: undefined,
    exception: {
      values: [
        {
          type: "TypeError",
          value:
            "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
          stacktrace: {
            frames: [{ filename: file, function: "T", in_app: true }],
          },
        },
      ],
    },
  };
}
test("native Facebook bridges are filtered only with matching message, browser and stack", () => {
  assert.equal(isInjectedFacebookError(bridge(), ua), true);
  const iframe = bridge();
  iframe.exception!.values![0]!.value =
    "null is not an object (evaluating 'e.contentWindow.postMessage')";
  assert.equal(isInjectedFacebookError(iframe, ua), true);
  assert.equal(isInjectedFacebookError(bridge(), "Mobile Safari"), false);
  assert.equal(
    isInjectedFacebookError(bridge("app:///_next/static/chunks/app.js"), ua),
    false,
  );
  const missing = bridge();
  delete missing.exception!.values![0]!.stacktrace;
  assert.equal(isInjectedFacebookError(missing, ua), false);
  const mixed = bridge();
  mixed.exception!.values!.push({ type: "Error", value: "Application bug" });
  assert.equal(isInjectedFacebookError(mixed, ua), false);
});

test("Instagram and Android native bridges need exact browser, message and native frames", () => {
  const event = bridge();
  const exception = event.exception!.values![0]!;
  exception.value =
    "undefined is not an object (evaluating 'window._META.IABInnerFrame')";
  assert.equal(isInjectedBrowserError(event, "Instagram 452.0.1"), true);
  assert.equal(isInjectedBrowserError(event, "Mobile Safari"), false);
  assert.equal(isInjectedBrowserError(event, ua), false);
  exception.type = "Error";
  exception.value = "Error invoking postMessage: Java object is gone";
  exception.stacktrace!.frames = [
    {
      filename: "app://navigation_performance_logger_android",
      function: "sendDataToNative",
    },
  ];
  assert.equal(isInjectedBrowserError(event, ua), true);
  assert.equal(isInjectedBrowserError(event, "Chrome Mobile"), false);
  exception.stacktrace!.frames.push({
    filename: "app:///_next/static/chunks/app.js",
  });
  assert.equal(isInjectedBrowserError(event, ua), false);
});

test("Facebook submit instrumentation is distinguished from an application InvalidAccessError", () => {
  const event = bridge();
  const exception = event.exception!.values![0]!;
  exception.type = "InvalidAccessError";
  exception.value = "The object does not support the operation or argument.";
  exception.stacktrace!.frames = [
    { filename: "app:///rezervace", function: "dispatchToBridge" },
    { filename: "app:///rezervace", function: "sendPostMessage" },
    { filename: "app:///rezervace", function: "logSubmitButtonClicked" },
  ];
  assert.equal(isInjectedBrowserError(event, ua), true);
  assert.equal(isInjectedBrowserError(event, "Chrome"), false);
  exception.stacktrace!.frames[0]!.filename =
    "app:///_next/static/chunks/app.js";
  assert.equal(isInjectedBrowserError(event, ua), false);
  exception.stacktrace!.frames = [
    { filename: "app:///rezervace", function: "submitReservation" },
  ];
  assert.equal(isInjectedBrowserError(event, ua), false);
});
test("only known transport TypeErrors receive recoverable severity", () => {
  for (const message of [
    "Load failed",
    "network error",
    "Error in input stream",
    "Failed to fetch",
  ])
    assert.equal(isTransportError(new TypeError(message)), true);
  assert.equal(
    isTransportError(new TypeError("Cannot read properties of undefined")),
    false,
  );
  assert.equal(isTransportError(new Error("Load failed")), false);
});
test("Google Maps fallback does not consume similar application errors", () => {
  const error = new Error('Could not load "onion".');
  assert.equal(isGoogleMapsModuleError(error), false);
  error.stack =
    'Error: Could not load "onion".\n at app:///maps-api-v3/api/js/66/7/intl/cs_ALL/main.js:176:196';
  assert.equal(isGoogleMapsModuleError(error), true);
  error.message = "Unexpected application failure";
  assert.equal(isGoogleMapsModuleError(error), false);
});

test("monitoring drops only the individual error recovered by the mounted map", () => {
  const recovered = new Error('Could not load "onion".');
  const unhandled = new Error('Could not load "onion".');
  assert.equal(wasMapErrorRecovered(recovered), false);
  markMapErrorRecovered(recovered);
  assert.equal(wasMapErrorRecovered(recovered), true);
  assert.equal(wasMapErrorRecovered(unhandled), false);
  assert.equal(wasMapErrorRecovered(undefined), false);
});

test("map worker and renderer failures recover only with a confirmed Maps stack", () => {
  const errors = [
    new Error("~#!#~0~#!#~Script error.~#!#~"),
    new Error("~#!#~3~#!#~EpochMismatch,796, 794~#!#~"),
    new Error(
      "~#!#~3~#!#~CompileError: call to WebAssembly.instantiate() blocked by CSP~#!#~",
    ),
    new TypeError("undefined is not an object (evaluating 'a.getRootNode')"),
  ];
  for (const error of errors) {
    assert.equal(isGoogleMapsModuleError(error), false);
    error.stack = `${error.name}: ${error.message}\n at app:///maps-api-v3/api/js/66/11a/intl/cs_ALL/webgl.js:148:79`;
    assert.equal(isGoogleMapsModuleError(error), true);
    error.stack = `${error.name}: ${error.message}\n at app:///_next/static/chunks/app.js:1:9`;
    assert.equal(isGoogleMapsModuleError(error), false);
  }
  const unknown = new Error("Script error.");
  unknown.stack = "at app:///maps-api-v3/api/js/66/11a/intl/cs_ALL/main.js:1:9";
  assert.equal(isGoogleMapsModuleError(unknown), false);
});
