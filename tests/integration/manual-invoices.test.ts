import {
  databaseReady,
  resend,
  resetDatabase,
  rows,
  seedProfile,
  setSetting,
  startProviders,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  createAndSendInvoice,
  reservationInvoiceStates,
  sendInvoiceDocument,
} from "../../src/lib/services/invoice-delivery";
import { getInvoice } from "../../src/lib/services/invoices";
import { fulfillReservation } from "../../src/lib/services/fulfillment";
import { emailPage } from "../../src/lib/services/admin-lists";
import { readAdminFilters } from "../../src/lib/helpers/admin-list";

const customer = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "invoice-customer@example.test",
  fullName: "Žofie Fakturová",
};
const operator = "info@navigym.cz";
const profile = {
  legalName: "Lokální faktura s.r.o.",
  street: "Testovací 1",
  city: "Plzeň",
  zip: "301 00",
  ico: "12345678",
  dic: "",
  vatRatePercent: 0,
  bankAccount: "",
  registryNote: "",
};
async function fixture(
  options: {
    status?: string;
    price?: number;
    payment?: boolean;
    amount?: number;
    paidAt?: string | null;
  } = {},
) {
  const id = randomUUID();
  await rows(
    `insert into reservation (id,user_id,starts_at,ends_at,status,contact_name,contact_email,price_cents)
    values ($1,$2,now()-interval '2 days',now()-interval '2 days'+interval '1 hour',$3,$4,$5,$6)`,
    [
      id,
      customer.id,
      options.status ?? "completed",
      customer.fullName,
      customer.email,
      options.price ?? 22900,
    ],
  );
  if (options.payment !== false)
    await rows(
      `insert into payment (reservation_id,user_id,type,status,amount_cents,paid_at)
      values ($1,$2,'one_off','succeeded',$3,$4)`,
      [
        id,
        customer.id,
        options.amount ?? 22900,
        options.paidAt === undefined ? "2026-09-15T10:00:00Z" : options.paidAt,
      ],
    );
  return id;
}
describe("manual invoice delivery", { skip: !databaseReady }, () => {
  before(startProviders);
  after(stopEverything);
  beforeEach(async () => {
    await resetDatabase();
    await rows("delete from email_archive");
    await seedProfile(customer);
    await setSetting("billing.profile", profile);
    await setSetting("messages.email.payment_document", null);
  });

  test("fulfillment never issues or sends a document, even with the legacy automatic switch enabled", async () => {
    const id = await fixture({ status: "confirmed" });
    await setSetting("billing.send_documents", true);
    await fulfillReservation(id);
    await fulfillReservation(id);
    assert.equal((await rows("select id from invoice")).length, 0);
    assert.equal(
      resend.sent.filter((mail) =>
        mail.attachments?.some((a) => a.filename.endsWith(".pdf")),
      ).length,
      0,
    );
  });

  test("past/cancelled paid reservation has one document, separately routed emails, archive and name/kind filters", async () => {
    const id = await fixture({ status: "cancelled" });
    const state = (await reservationInvoiceStates([id])).get(id)!;
    assert.equal(state.eligible, true);
    assert.equal(state.customerEmail, customer.email);
    const first = await createAndSendInvoice(id, "operator");
    assert.deepEqual(first.sent, [operator]);
    const second = await createAndSendInvoice(id, "both");
    assert.equal(second.invoiceId, first.invoiceId);
    assert.deepEqual(second.failed, []);
    await createAndSendInvoice(id, "customer");
    assert.equal(resend.sent.length, 2);
    assert.deepEqual(
      resend.sent.map((mail) => mail.to).sort(),
      [customer.email, operator].sort(),
    );
    for (const mail of resend.sent) {
      assert.equal(mail.attachments!.length, 1);
      assert.match(mail.attachments![0]!.filename, /^doklad-2026-0001.pdf$/);
      assert.equal(
        Buffer.from(mail.attachments![0]!.content, "base64")
          .subarray(0, 5)
          .toString(),
        "%PDF-",
      );
    }
    assert.equal((await rows("select * from invoice")).length, 1);
    const document = (await getInvoice(first.invoiceId))!;
    assert.equal(document.suppliedAt.toISOString(), "2026-09-15T10:00:00.000Z");
    assert.equal(document.totalCents, 22900);
    assert.equal(
      (
        await rows(
          "select id from message_delivery where kind='payment_document' and status='sent' and provider_response is null",
        )
      ).length,
      2,
    );
    const archived = await rows<{ attachment_names: string[] }>(
      "select attachment_names from email_archive",
    );
    assert.equal(archived.length, 2);
    assert.equal(archived[0]!.attachment_names.length, 1);
    assert.equal(
      (
        await emailPage(
          1,
          readAdminFilters({ q: "zofie fakturova", kind: "payment_document" }),
        )
      ).length,
      2,
    );
  });

  test("unpaid/free/mismatched/undated payments are ineligible and cannot create a paid receipt", async () => {
    for (const options of [
      { payment: false },
      { price: 0, amount: 0 },
      { amount: 123 },
      { paidAt: null },
      { status: "pending" },
    ]) {
      const id = await fixture(options);
      assert.equal(
        (await reservationInvoiceStates([id])).get(id)!.eligible,
        false,
      );
      await assert.rejects(createAndSendInvoice(id, "operator"), /zaplacené/);
    }
    assert.equal((await rows("select id from invoice")).length, 0);
    assert.equal(resend.sent.length, 0);
  });

  test("concurrent clicks reuse one number and one send per recipient", async () => {
    const id = await fixture();
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () => createAndSendInvoice(id, "both")),
    );
    assert.equal(new Set(outcomes.map((o) => o.invoiceId)).size, 1);
    assert.ok(outcomes.every((o) => !o.failed.length));
    assert.equal(resend.sent.length, 2);
    const [counter] = await rows<{ value: number }>(
      "select value from document_counter",
    );
    assert.equal(counter?.value, 1);
  });

  test("a paid no-show remains billable and an undated legacy row cannot hide its documented payment", async () => {
    const id = await fixture({ status: "no_show", paidAt: null });
    await rows(
      `insert into payment (reservation_id,type,status,amount_cents,paid_at)
      values ($1,'one_off','succeeded',22900,'2026-09-15T10:00:00Z')`,
      [id],
    );
    assert.equal(
      (await reservationInvoiceStates([id])).get(id)!.eligible,
      true,
    );
    const result = await createAndSendInvoice(id, "operator");
    assert.deepEqual(result.failed, []);
    assert.equal(
      (await getInvoice(result.invoiceId))!.suppliedAt.toISOString(),
      "2026-09-15T10:00:00.000Z",
    );
  });

  test("lost acceptance response and partial delivery retry exact PDF/template/sender bytes without resending the successful recipient", async () => {
    const id = await fixture();
    resend.loseNextAcceptedResponse();
    const first = await createAndSendInvoice(id, "both");
    assert.deepEqual(first.sent, [operator]);
    assert.deepEqual(
      first.failed.map((f) => f.recipient),
      [customer.email],
    );
    assert.equal(resend.sent.length, 2);
    await setSetting("messages.email.payment_document", {
      subject: "Changed after acceptance",
      body: "Changed after acceptance",
    });
    const originalSender = process.env.RESEND_FROM_EMAIL;
    try {
      process.env.RESEND_FROM_EMAIL = "Changed <changed@example.test>";
      const retry = await createAndSendInvoice(id, "both");
      assert.deepEqual(retry.failed, []);
      assert.equal(resend.sent.length, 2);
      assert.equal((await rows("select id from email_archive")).length, 2);
    } finally {
      process.env.RESEND_FROM_EMAIL = originalSender;
    }
  });

  test("archive transaction failure preserves the outbox and safe retry repairs archive without another accepted send", async () => {
    const id = await fixture();
    await rows(
      `create function invoice_test_archive_failure() returns trigger language plpgsql as $$begin raise exception 'isolated archive failure'; end$$`,
    );
    await rows(
      `create trigger invoice_test_archive_failure before insert on email_archive for each row execute function invoice_test_archive_failure()`,
    );
    try {
      const failed = await createAndSendInvoice(id, "operator");
      assert.equal(failed.failed[0]?.reason, "invoice_delivery_unconfirmed");
      assert.equal(resend.sent.length, 1);
      assert.equal((await rows("select id from email_archive")).length, 0);
      assert.equal(
        (
          await rows(
            "select id from message_delivery where status='queued' and provider_response is not null",
          )
        ).length,
        1,
      );
    } finally {
      await rows("drop trigger invoice_test_archive_failure on email_archive");
      await rows("drop function invoice_test_archive_failure()");
    }
    const retry = await createAndSendInvoice(id, "operator");
    assert.deepEqual(retry.failed, []);
    assert.equal(resend.sent.length, 1);
    assert.equal((await rows("select id from email_archive")).length, 1);
  });

  test("uncertain requests beyond the provider key window stop instead of silently sending again", async () => {
    const id = await fixture();
    resend.loseNextAcceptedResponse();
    await createAndSendInvoice(id, "operator");
    await rows(
      "update message_delivery set created_at=now()-interval '24 hours' where kind='payment_document'",
    );
    const retry = await createAndSendInvoice(id, "operator");
    assert.equal(retry.failed[0]?.reason, "retry_window_expired");
    assert.equal(resend.sent.length, 1);
  });

  test("explicit redelivery uses a stable request UUID and never issues a new document", async () => {
    const id = await fixture();
    const first = await createAndSendInvoice(id, "customer");
    const doc = (await getInvoice(first.invoiceId))!;
    const requestId = randomUUID();
    await sendInvoiceDocument(doc, "customer", requestId);
    await sendInvoiceDocument(doc, "customer", requestId);
    assert.equal(resend.sent.length, 2);
    assert.equal((await rows("select id from invoice")).length, 1);
    await assert.rejects(
      sendInvoiceDocument(doc, "customer", "invalid"),
      /Neplatný/,
    );
  });

  test("incomplete issuer or missing customer email cannot cause an invented invoice/send", async () => {
    const id = await fixture();
    await setSetting("billing.profile", { ...profile, ico: "" });
    await assert.rejects(
      createAndSendInvoice(id, "operator"),
      /fakturační údaje/,
    );
    assert.equal((await rows("select id from invoice")).length, 0);
    await setSetting("billing.profile", profile);
    await rows(
      "update reservation set user_id=null,contact_email=null where id=$1",
      [id],
    );
    await assert.rejects(createAndSendInvoice(id, "customer"), /e-mailová/);
    const result = await createAndSendInvoice(id, "operator");
    assert.deepEqual(result.sent, [operator]);
    assert.equal(resend.sent.length, 1);
  });
});
