"use client";

import { createContext, useContext, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Info, Pencil } from "lucide-react";
import {
  getContentEditorItem,
  type ContentEditorItem,
} from "@/lib/content/editor";
import {
  getContentAsset,
  type ContentAsset,
} from "@/lib/content/editor-visuals";

export interface ContentPreviewData {
  texts: Record<string, string>;
  price: string;
  hours: string;
  freeEntryEvery: number;
  isPromo: boolean;
}
export interface CanvasContextValue {
  preview: ContentPreviewData;
  assets: Record<string, string>;
  onEdit: (item: ContentEditorItem) => void;
  onEditAsset: (asset: ContentAsset) => void;
}
export const CanvasContext = createContext<CanvasContextValue | null>(null);
export function useCanvas() {
  const value = useContext(CanvasContext);
  if (!value) throw new Error("Canvas controls require CanvasContext");
  return value;
}

/** Real copy with an adjacent, keyboard-accessible edit control. Never contentEditable. */
export function Text({
  field,
  as: Tag = "span",
  className = "",
  children,
}: {
  field: string;
  as?: "span" | "p" | "h2" | "h3" | "div";
  className?: string;
  children?: ReactNode;
}) {
  const { preview, onEdit } = useCanvas();
  const item = { key: field, label: getContentEditorItem(field).label };
  return (
    <Tag
      className={`canvas-text whitespace-pre-wrap break-words ${className}`}
      data-content-field={field}
    >
      {children ?? preview.texts[field]}
      <button
        type="button"
        className="canvas-pencil"
        aria-label={`Upravit: ${item.label}`}
        onClick={() => onEdit(item)}
      >
        <Pencil aria-hidden="true" className="size-3.5" />
      </button>
    </Tag>
  );
}

/** Only the authorised asset action can publish a photo; preview controls never upload on their own. */
export function Photo({
  assetKey,
  altField,
  className = "aspect-[4/3]",
  imageClassName = "",
  src,
  alt = "",
}: {
  assetKey?: string;
  altField?: string;
  className?: string;
  imageClassName?: string;
  src?: string;
  alt?: string;
}) {
  const { assets, preview, onEditAsset } = useCanvas();
  const asset = assetKey ? getContentAsset(assetKey) : undefined;
  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-lg bg-muted ${className}`}
    >
      <Image
        src={src ?? assets[assetKey!] ?? "/images/photos/hero.webp"}
        alt={altField ? (preview.texts[altField] ?? "") : alt}
        fill
        sizes="(max-width: 700px) 100vw, 50vw"
        unoptimized
        className={`object-cover ${imageClassName}`}
      />
      <div className="absolute inset-x-2 top-2 flex flex-wrap items-start justify-end gap-2">
        {asset ? (
          <button
            type="button"
            className="canvas-photo-control"
            aria-label={`Upravit: ${asset.label}`}
            onClick={() => onEditAsset(asset)}
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            Fotografie
          </button>
        ) : null}
        {altField ? (
          <Text field={altField} className="canvas-photo-control">
            <span>Popis pro čtečky</span>
          </Text>
        ) : null}
      </div>
    </div>
  );
}

export function Source({
  children,
  kind = "price",
}: {
  children: ReactNode;
  kind?: "price" | "hours" | "loyalty";
}) {
  const href =
    kind === "hours"
      ? "/admin/schedule"
      : kind === "loyalty"
        ? "/admin/how-it-works"
        : "/admin/memberships";
  const label =
    kind === "hours"
      ? "Otevírací doba a délka bloků"
      : kind === "loyalty"
        ? "Pravidla věrnostních vstupů"
        : "Cena se načítá z Ceníku a doprovodu";
  return (
    <span className="break-words">
      {children}
      <Link
        className="canvas-pencil"
        href={href}
        aria-label={label}
        title={label}
      >
        <Info aria-hidden="true" className="size-3.5" />
      </Link>
    </span>
  );
}
export function Cta({
  field,
  gold = false,
}: {
  field: string;
  gold?: boolean;
}) {
  return (
    <div
      className={`inline-flex min-h-11 items-center justify-center rounded-sm px-5 py-3 font-bold ${gold ? "bg-gold text-gold-foreground" : "bg-primary text-primary-foreground"}`}
    >
      <Text field={field} />
    </div>
  );
}
export function Backdrop({
  children,
  hero = false,
}: {
  children: ReactNode;
  hero?: boolean;
}) {
  const { assets, onEditAsset } = useCanvas();
  const asset = getContentAsset(
    hero ? "branding.hero_image_url" : "branding.sections_image_url",
  )!;
  return (
    <div className="relative isolate overflow-hidden bg-ink p-5 text-ink-foreground @2xl:p-8 @4xl:p-12">
      <Image
        src={assets[asset.key]!}
        alt=""
        fill
        unoptimized
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink/70" />
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          className="canvas-photo-control"
          aria-label={`Upravit: ${asset.label}`}
          onClick={() => onEditAsset(asset)}
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Pozadí
        </button>
      </div>
      {children}
    </div>
  );
}
