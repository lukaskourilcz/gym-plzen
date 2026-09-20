import assert from "node:assert/strict";
import test from "node:test";
import { createNukiClient } from "../../src/lib/integrations/nuki";
import { generateKeypadCode, hashCode } from "../../src/lib/helpers/crypto";
import type { httpRequest, RequestOptions } from "../../src/lib/helpers/http";

const params = {
  name: "Rezervace test", code: 123456,
  allowedFrom: new Date("2026-10-01T08:45:00.000Z"),
  allowedUntil: new Date("2026-10-01T10:15:00.000Z"),
};
const auth = {
  id: "auth-1", smartlockId: 123, type: 13, code: params.code, enabled: true,
  allowedFromDate: params.allowedFrom.toISOString(),
  allowedUntilDate: params.allowedUntil.toISOString(), allowedWeekDays: 127,
  allowedFromTime: 0, allowedUntilTime: 0,
};
const identity = { ...params, codeHash: hashCode(String(params.code)) };
const pause = async () => {};

test("Nuki PINs contain six enterable digits, never zero", () => {
  for (let i=0; i<1000; i++) assert.match(generateKeypadCode(), /^[1-9]{6}$/);
});

test("async empty PUT waits for a synced auth; only one create is sent", async () => {
  let puts=0, gets=0;
  const request: typeof httpRequest = async <T>(_url: string, opts: RequestOptions = {}) => {
    if (opts.method === "PUT") {
      puts++; assert.equal(opts.retries, 0);
      assert.deepEqual(opts.json, {
        name: params.name, type: 13, code: params.code, remoteAllowed: false,
        allowedFromDate: auth.allowedFromDate, allowedUntilDate: auth.allowedUntilDate,
        allowedWeekDays:127, allowedFromTime:0, allowedUntilTime:0,
      });
      return null as T;
    }
    gets++;
    return (gets === 1 ? [{...auth, operationId:"pending"}] : [auth]) as T;
  };
  assert.deepEqual(await createNukiClient({token:"test",lockId:"123"},request,pause).create(params), {created:true,nukiAuthId:auth.id});
  assert.equal(puts,1); assert.equal(gets,2);
});

test("lost PUT response recovers without duplicate creation", async () => {
  let puts=0;
  const request: typeof httpRequest = async <T>(_url: string, opts: RequestOptions = {}) => {
    if (opts.method === "PUT") { puts++; throw new Error("connection lost"); }
    return [auth] as T;
  };
  assert.equal((await createNukiClient({token:"test",lockId:"123"},request,pause).create(params)).created,true);
  assert.equal(puts,1);
});

test("recovery rejects mismatched, incomplete, ambiguous or unsynced authorizations", async () => {
  for (const rows of [[],[auth,auth],[{...auth,code:999999}],[{...auth,smartlockId:456}],
    [{...auth,enabled:false}],[{...auth,type:0}],[{...auth,allowedUntilDate:undefined}],
    [{...auth,allowedUntilDate:"2026-10-02T10:15:00Z"}],[{...auth,error:"offline"}],
    [{...auth,operationId:"pending"}],[{...auth,allowedWeekDays:1}], [{...auth,allowedFromTime:60}]]) {
    const request: typeof httpRequest = async <T>() => rows as T;
    assert.equal(await createNukiClient({token:"test",lockId:"123"},request,pause).recover(identity),null);
  }
});

test("an undelivered PIN can be recovered without mutation and must match its saved id", async () => {
  const request: typeof httpRequest = async <T>(_url: string, opts: RequestOptions = {}) => {
    assert.equal(opts.method,undefined); return [auth] as T;
  };
  const client=createNukiClient({token:"test",lockId:"123"},request,pause);
  assert.deepEqual(await client.recover({...identity,nukiAuthId:auth.id}),{nukiAuthId:auth.id,plaintext:"123456"});
  assert.equal(await client.recover({...identity,nukiAuthId:"other"}),null);
});

test("pending provisioning remains unknown; invalid PIN is rejected before network", async () => {
  let calls=0;
  const request: typeof httpRequest = async <T>() => {calls++; return [] as T;};
  const client=createNukiClient({token:"test",lockId:"123"},request,pause);
  assert.equal((await client.create({...params,code:102345})).created,false);
  assert.equal(calls,0);
  assert.deepEqual(await client.create(params),{created:false,error:"provisioning_unknown"});
  assert.equal(calls,4);
});
