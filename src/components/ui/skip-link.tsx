"use client";

import { useEffect, useRef } from "react";

export function SkipLink() {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    linkRef.current?.setAttribute("data-ready", "true");
  }, []);

  return (
    <a
      ref={linkRef}
      href="#main-content"
      onClick={(event) => {
        const target = document.getElementById("main-content");
        if (!target) return;
        event.preventDefault();
        target.focus();
        target.scrollIntoView({ block: "start" });

        // A streamed route can replace its main landmark immediately after the
        // click. Restore focus only if that replacement leaves it on the body.
        const observer = new MutationObserver(() => {
          const current = document.getElementById("main-content");
          if (current && document.activeElement === document.body) {
            current.focus();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.setTimeout(() => observer.disconnect(), 1500);
      }}
      className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-sm bg-ink px-4 py-3 font-extrabold text-ink-foreground transition-transform focus:translate-y-0"
    >
      Přeskočit na obsah
    </a>
  );
}
