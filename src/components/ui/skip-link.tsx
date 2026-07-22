"use client";

export function SkipLink() {
  return (
    <a
      href="#main-content"
      onClick={(event) => {
        const main = document.getElementById("main-content");
        if (!main) return;
        event.preventDefault();
        main.focus();
        main.scrollIntoView({ block: "start" });
      }}
      className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-sm bg-ink px-4 py-3 font-extrabold text-ink-foreground transition-transform focus:translate-y-0"
    >
      Přeskočit na obsah
    </a>
  );
}
