import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/guards";
import { safeInternalPath } from "@/lib/security/redirects";
import { PhoneForm } from "./phone-form";
import { Container, Section } from "@/components/ui/container";

export const metadata = {
  title: "Doplnění telefonu",
  robots: { index: false, follow: false },
};
export default async function CompletePhonePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const safeNext = safeInternalPath(params.next);
  const next = safeNext.startsWith("/account/telefon") ? "/account" : safeNext;
  const user = await getSessionUser();
  if (!user)
    redirect(
      `/login?next=${encodeURIComponent("/account/telefon?next=" + encodeURIComponent(next))}`,
    );
  if (!user.needsPhone) redirect(next);
  return (
    <main id="main-content" tabIndex={-1}>
      <Section>
        <Container className="max-w-md">
          <h1 className="text-3xl font-extrabold">Doplňte telefonní číslo</h1>
          <p className="mt-3 text-muted-foreground">
            Pro dokončení registrace potřebujeme kontaktní telefon k vašim
            rezervacím.
          </p>
          <PhoneForm next={next} />
        </Container>
      </Section>
    </main>
  );
}
