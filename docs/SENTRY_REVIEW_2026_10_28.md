# Sentry review: 14 September–28 October 2026

Status: investigation in progress. Branch: `codex/sentry-errors-2026-10-28`.
Baseline: production merge `c41ef6a8045f28bf6eaa0d244113725e2b3cce27`.

## Boundary

Review only NaviGym (`gym-plzen`, Sentry project `4511808885030992`).
The user explicitly excluded Devshark. Read the user's open Gmail in Chrome,
including matching alerts outside the Important label, and inspect linked Sentry
events. Do not resolve/archive Sentry issues, change production configuration,
run production customer workflows, send notifications, merge or deploy this branch.
Use isolated databases and local provider replacements for regression tests.

## Coverage ledger

| Area | Evidence / status |
| --- | --- |
| Alert inventory | Important label read; expanded sender/date search also found X, V and 14. Digest alerts include multiple issues and need individual enumeration. |
| Browser monitoring | Reviewed instrumentation, error classification and existing regression tests; narrow bridge filter currently covers only Q/M. |
| Map lifecycle / CSP | Reviewed loader, iframe fallback, cleanup and policy; investigating Maps worker/WASM/WebGL failures. |
| Booking / account recovery | Reviewed existing price validation, action rejection handling and transport feedback; trace C still occurs on current production release. |
| Database / lock handling | Reviewed read-only bounded retry, advisory locks and watchdog isolation; inspect S/T/V callers and regression tests. |
| Payment webhook | Reviewed authentication, size bounds, response handling and existing reconciliation; X currently discards the underlying error. |
| Versions / deployment | Reviewed current Next config and dependency versions; investigate stale action requests without replaying writes. |
| Verification | Pending focused regression tests, full suites, build, types, lint, format and dependency audit. |

## Observed issue groups (not yet conclusions)

| IDs (`GYM-PLZEN-…`) | Observed symptom |
| --- | --- |
| 7, 8 | Server Action not found / incompatible deployment request |
| 9 | Expected rejection: another customer already holds the slot |
| A | Missing Date in price resolution (`getTime`); baseline already has guard and regression test |
| B | RSC connection closed |
| C, R, P, K | Browser transport failures: Load failed / input stream / network error |
| D, J, M, Q, 12, 14 | Native browser bridge failures (Facebook, Instagram, Friendly) |
| E, F, H, W, Z, 11 | Google Maps modules / WebAssembly CSP / worker or WebGL errors |
| S, T | Database confirmation read failure / statement timeout |
| V | Advisory lock acquisition timeout in watchdog |
| X | Payment notification failed; underlying exception not retained in this alert |
| Y | A browser timer was terminated; cause still under investigation |
| 10 | Redacted Server Component rendering error; inspect digest and context |
| 13 | React attempted to remove a DOM node changed outside its ownership |

Final findings must distinguish newly fixed defects, already fixed historical
events, external browser failures and any evidence that is no longer retained.
Do not claim an old exception's exact cause when the retained alert lacks it.
