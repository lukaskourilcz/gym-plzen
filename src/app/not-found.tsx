import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5">
      <div className="max-w-lg text-center">
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-primary">
          404
        </p>
        <h1 className="mt-3 text-4xl font-black">Tato stránka neexistuje</h1>
        <p className="mt-4 text-muted-foreground">
          Zkontrolujte adresu nebo se vraťte na úvod.
        </p>
        <Button href="/" className="mt-7">
          Zpět na úvod
        </Button>
      </div>
    </main>
  );
}
