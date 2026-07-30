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
        const link = event.currentTarget;
        event.preventDefault();
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "start" });

        // A streamed route can replace its main landmark immediately after the
        // click. Restore focus only while it remains on the link or body; never
        // take it back after the user has already continued with the keyboard.
        const restoreFocus = () => {
          const current = document.getElementById("main-content");
          if (
            current &&
            (document.activeElement === document.body ||
              document.activeElement === link ||
              !target.isConnected)
          ) {
            current.focus({ preventScroll: true });
          }
        };
        window.requestAnimationFrame(restoreFocus);
        window.setTimeout(restoreFocus, 100);

        const observer = new MutationObserver(() => {
          restoreFocus();
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
