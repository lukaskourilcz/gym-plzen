"use client";

import type { ContentEditorSection } from "@/lib/content/editor";
import { CONTENT_VISUALS } from "@/lib/content/editor-visuals";
import { CanvasContext, type CanvasContextValue } from "./canvas-controls";
import { CanvasSection } from "./canvas-sections";
import "./content-canvas.css";

/** Admin-only rendering: no booking, newsletter, analytics, payment or map provider is mounted. */
export function ContentCanvas({
  section,
  ...context
}: CanvasContextValue & { section: ContentEditorSection }) {
  return (
    <CanvasContext value={context}>
      <div
        className="content-canvas @container overflow-hidden rounded-lg border border-border bg-background"
        role="region"
        aria-label={`Upravitelné rozložení: ${section.title}`}
      >
        <CanvasSection id={CONTENT_VISUALS[section.title]!.id} />
      </div>
    </CanvasContext>
  );
}
