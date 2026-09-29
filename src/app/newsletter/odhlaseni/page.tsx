import type { Metadata } from "next";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { newsletter } from "@/lib/services";
import { Container, Section } from "@/components/ui/container";
import { Notice } from "@/components/ui/notice";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = {
  title: "Odhlášení z novinek",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

/**
 * Withdrawing newsletter consent from the personal link in a newsletter. The
 * link alone changes nothing (mail scanners and previews open links); the
 * visitor confirms with one button.
 */
export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const [params, content] = await Promise.all([
    searchParams,
    loadSiteContent(),
  ]);
  const email = params.e?.trim() ?? "";
  const valid =
    Boolean(email && params.t) &&
    newsletter.verifyUnsubscribeToken(email, params.t ?? "");
  const contactEmail = content.get("contact.email");

  return (
    <>
      <SiteHeader brand={content.get("brand.name")} logoUrl={content.logoUrl} />
      <main id="main-content" tabIndex={-1}>
        <Section>
          <Container className="max-w-xl">
            <h1 className="text-3xl font-extrabold tracking-[-.01em]">
              Odhlášení z novinek
            </h1>
            {valid ? (
              <UnsubscribeForm email={email} token={params.t ?? ""} />
            ) : (
              <Notice tone="warning" className="mt-6" role="status">
                Odkaz pro odhlášení není úplný nebo platný. Napište nám prosím
                na {contactEmail} a odběr zrušíme ručně.
              </Notice>
            )}
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
