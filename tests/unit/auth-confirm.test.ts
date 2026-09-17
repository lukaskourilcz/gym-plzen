import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { supabaseAuthActionUrl } from "../../src/lib/integrations/supabase-management";

test("hosted auth templates link to the server-side confirmation, not the PKCE exchange", async () => {
  // The default {{ .ConfirmationURL }} only completes in the browser that
  // started the sign-up; a token hash verified on the server works anywhere.
  assert.equal(
    supabaseAuthActionUrl("signup_confirmation"),
    "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}",
  );
  assert.equal(
    supabaseAuthActionUrl("password_reset"),
    "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&redirect_to={{ .RedirectTo }}",
  );
  const adapter = await readFile(
    "src/lib/integrations/supabase-management.ts",
    "utf8",
  );
  assert.doesNotMatch(adapter, /actionUrl: "\{\{ \.ConfirmationURL \}\}"/);

  const route = await readFile("src/app/auth/confirm/route.ts", "utf8");
  assert.match(route, /verifyOtp\(\{/);
  assert.match(route, /token_hash: tokenHash/);
  // Every failure lands on the login page with a reason, never a silent 500.
  assert.match(route, /loginRedirect\(request, "vyprselo", next\)/);
});
