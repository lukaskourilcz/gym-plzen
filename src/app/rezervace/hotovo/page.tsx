import { CheckCircle2, Info } from "lucide-react";
import { loadSiteContent } from "@/lib/content/site";
import { getSessionUser } from "@/lib/auth/guards";
import { isPreviewMode } from "@/lib/preview";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata = { title: "Rezervace potvrzena" };

/**
 * Post-checkout confirmation. Reached from Stripe success_url or a free loyalty
 * booking. The actual confirmation + code delivery happen via the Stripe webhook
 * and fulfillment pipeline; this page just reassures the member.
 */
export default async function BookingDonePage({
  searchParams,
}: {
  searchParams: Promise<{ free?: string }>;
}) {
  const { free } = await searchParams;
  const [content, sessionUser] = await Promise.all([loadSiteContent(), getSessionUser()]);
  const preview = isPreviewMode();

  return (
    <>
      <SiteHeader brand={content.get("brand.name")} logoUrl={content.logoUrl} user={sessionUser} />
      <main>
        <Section>
          <Container className="max-w-xl text-center">
            <CheckCircle2 className="mx-auto size-14 text-primary" />
            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              {free ? "Rezervace potvrzena" : "Děkujeme za platbu"}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {free
                ? "Váš vstup zdarma je zarezervovaný."
                : "Vaše platba byla přijata a rezervace potvrzena."}{" "}
              Vstupní kód vám pošleme e-mailem a na WhatsApp — bude platit v čase
              vaší rezervace.
            </p>
            {preview && (
              <p className="mt-4 inline-flex items-start gap-2 rounded-lg border border-border bg-accent/50 p-3 text-left text-sm text-accent-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                Režim náhledu: rezervace se ve skutečnosti nevytvořila. Platby,
                kódy i potvrzení se zapnou po připojení databáze, Stripe a Nuki.
              </p>
            )}
            <div className="mt-8 flex justify-center gap-3">
              <Button href="/account">Můj účet</Button>
              <Button href="/rezervace" variant="outline">
                Další rezervace
              </Button>
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter brand={content.get("brand.name")} termsUrl={content.termsUrl} />
    </>
  );
}
