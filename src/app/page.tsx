import Link from "next/link";

/**
 * Public home page — deliberately a bare skeleton. The public-facing design and
 * live calendar come in a later phase (see the task brief). For now it links to
 * the two working surfaces: sign-in and the administration.
 */
export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Gym Plzeň</h1>
      <p>
        Rezervační systém a administrace. Veřejný web (úvodní stránka, live
        kalendář, galerie, pravidla, kontakt) se dodělává v další fázi.
      </p>
      <ul>
        <li>
          <Link href="/login">Přihlášení / registrace</Link>
        </li>
        <li>
          <Link href="/admin">Administrace</Link>
        </li>
      </ul>
    </main>
  );
}
