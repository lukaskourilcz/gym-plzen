import Link from "next/link";
import { Notice } from "@/components/ui/notice";

/** Guests keep their selected slots and may still purchase without an account. */
export function RegistrationNotice({
  cadence,
  returnTo,
  className,
}: {
  cadence: number;
  returnTo: string;
  className?: string;
}) {
  return (
    <Notice title="S účtem máš každý vstup přehledně" className={className}>
      <p>
        Zaregistruj se a přihlas ještě před zaplacením. Rezervace vytvořené po
        přihlášení najdeš ve svém účtu a každý {cadence}. vstup máš zdarma.
        Dřívější rezervace bez přihlášení se k účtu automaticky nepřiřazují.
      </p>
      <p className="mt-2">
        <Link
          href={`/login?next=${encodeURIComponent(returnTo)}`}
          className="font-bold text-accent-foreground underline"
        >
          Přihlásit se nebo se zaregistrovat
        </Link>
        <span className="ml-2">Pokračovat můžeš i bez registrace.</span>
      </p>
    </Notice>
  );
}
