import { getCreditBalance } from "@/lib/services/credits";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { uuidSchema } from "@/lib/validations/common";
import {
  getParticipantBooking,
  listParticipantAdditions,
  refreshParticipantAddition,
} from "@/lib/services/participants";
import { getParticipantPricing } from "@/lib/services/block-pricing";
import { participantLabel } from "@/lib/config/participants";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { formatDate, formatTimeRange, formatMoney } from "@/lib/helpers/format";
import { ParticipantsForm } from "./participants-form";

export const metadata = {
  title: "Přidat doprovod",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function ParticipantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ addition_id?: string }>;
}) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const user = await requireUser(`/account/rezervace/${id}/osoby`);
  if (user.isDemo || !(await getParticipantBooking(user.id, id))) notFound();
  let refreshFailed = false;
  try {
    await refreshParticipantAddition(user.id, id);
  } catch {
    refreshFailed = true;
  }
  const [booking, additions, pricing, content, query] = await Promise.all([
    getParticipantBooking(user.id, id),
    listParticipantAdditions(user.id, id),
    getParticipantPricing(),
    loadSiteContent(),
    searchParams,
  ]);
  if (!booking) notFound();
  const wallet = await getCreditBalance(user.id);
  const returned = query.addition_id
    ? additions.find((a) => a.id === query.addition_id)
    : undefined;
  const pending = additions.find((a) => a.status === "pending");
  const available =
    booking.status === "confirmed" &&
    booking.startsAt > new Date() &&
    !booking.rescheduleStartsAt &&
    booking.extraPeople < 2;
  return (
    <>
      <SiteHeader
        brand={content.get("brand.name")}
        logoUrl={content.logoUrl}
        accountHref="/account"
        accountLabel="Můj účet"
      />
      <main id="main-content" tabIndex={-1}>
        <Section className="py-12">
          <Container className="max-w-2xl">
            <Button href="/account" variant="ghost">
              Zpět do mého účtu
            </Button>
            <h1 className="mt-6 text-3xl font-extrabold">Přidat doprovod</h1>
            <p className="mt-3">
              {formatDate(booking.startsAt)} ·{" "}
              {formatTimeRange(booking.startsAt, booking.endsAt)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              V rezervaci: {participantLabel(booking.extraPeople)}.
            </p>
            {refreshFailed ? (
              <Notice tone="warning" className="mt-5">
                Stav doplatku se teď nepodařilo ověřit. Rezervace zůstává
                platná. Obnovte stránku později.
              </Notice>
            ) : null}
            {returned?.status === "confirmed" ? (
              <Notice
                tone="success"
                title="Doprovod je přidaný"
                className="mt-5"
                role="status"
              >
                V rezervaci je nyní {participantLabel(booking.extraPeople)}.
                Původní termín i vstupní kód zůstávají stejné.
              </Notice>
            ) : null}
            {returned?.status === "failed" ? (
              <Notice tone="warning" className="mt-5">
                Platba za doprovod neproběhla. Původní rezervace zůstává platná;
                můžete to zkusit znovu.
              </Notice>
            ) : null}
            {returned?.status === "review_needed" ? (
              <Notice tone="warning" className="mt-5">
                Doplatek byl přijat, ale rezervace se mezitím změnila. Doprovod
                se nepřidal. Kontaktujte provozovatele kvůli kontrole doplatku.
              </Notice>
            ) : null}
            <div className="mt-7">
              {!pricing.enabled ? (
                <Notice>
                  Doprovod je momentálně vypnutý. Nové osoby ani příplatky nyní
                  nepřidáváme.
                </Notice>
              ) : pending ? (
                <>
                  <Notice title="Platba za doprovod se zpracovává">
                    Požadovaný doprovod +{pending.toCount}, doplatek{" "}
                    {formatMoney(pending.amountCents - pending.creditCents)}
                    {pending.creditCents > 0
                      ? ` a rezervovaný kredit ${formatMoney(pending.creditCents)}`
                      : ""}
                    . Dokončete původní platbu, případně obnovte stránku po její
                    úhradě.
                  </Notice>
                  <Button
                    variant="outline"
                    href={`/account/rezervace/${id}/osoby`}
                    className="mt-4"
                  >
                    Obnovit stav
                  </Button>
                  <ParticipantsForm
                    key={pending.id}
                    fixedTarget={pending.toCount}
                    heldCreditCents={pending.creditCents}
                    reservationId={id}
                    fromCount={pending.fromCount}
                    pricing={{
                      amountCents:
                        pending.amountCents /
                        (pending.pricingMode === "per_person"
                          ? pending.toCount - pending.fromCount
                          : 1),
                      mode:
                        pending.pricingMode === "per_person"
                          ? "per_person"
                          : "flat",
                    }}
                  />
                </>
              ) : available ? (
                <ParticipantsForm
                  key={`${booking.extraPeople}:${pricing.amountCents}:${pricing.mode}`}
                  reservationId={id}
                  availableCreditCents={wallet.availableCents}
                  fromCount={booking.extraPeople}
                  pricing={pricing}
                />
              ) : (
                <Notice>
                  {booking.extraPeople >= 2
                    ? "Rezervace už zahrnuje dvě další osoby."
                    : "Doprovod lze přidat jen k budoucí potvrzené rezervaci. Probíhající změnu termínu nejdříve dokončete."}
                </Notice>
              )}
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
