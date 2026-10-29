import { z } from "zod";

export type EmailMark = { type: "bold" | "italic" | "underline" };
export type EmailInline =
  { type: "text"; text: string; marks?: EmailMark[] } | { type: "hardBreak" };
export type EmailBlock =
  | { type: "paragraph"; content?: EmailInline[] }
  | { type: "heading"; attrs: { level: 1 | 2 | 3 }; content?: EmailInline[] }
  | { type: "bulletList"; content: EmailListItem[] }
  | {
      type: "orderedList";
      attrs?: { start?: number; type?: "1" | "a" | "A" | "i" | "I" | null };
      content: EmailListItem[];
    };
export interface EmailListItem {
  type: "listItem";
  content: EmailBlock[];
}
export interface EmailDocument {
  type: "doc";
  content: EmailBlock[];
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const only = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));

/** Bounded, explicit JSON schema; no HTML, arbitrary styles, links or embedded content. */
function validDocument(value: unknown): value is EmailDocument {
  let nodes = 0;
  let characters = 0;
  function node(value: unknown, allowed: string[], depth: number): boolean {
    if (
      depth > 12 ||
      ++nodes > 1000 ||
      !object(value) ||
      !allowed.includes(String(value.type))
    )
      return false;
    const type = value.type;
    if (type === "text") {
      if (
        !only(value, ["type", "text", "marks"]) ||
        typeof value.text !== "string" ||
        !value.text.length
      )
        return false;
      characters += value.text.length;
      return (
        characters <= 8000 &&
        (value.marks === undefined ||
          (Array.isArray(value.marks) &&
            value.marks.length <= 3 &&
            new Set(value.marks.map((mark) => object(mark) && mark.type))
              .size === value.marks.length &&
            value.marks.every(
              (mark) =>
                object(mark) &&
                only(mark, ["type"]) &&
                ["bold", "italic", "underline"].includes(String(mark.type)),
            )))
      );
    }
    if (type === "hardBreak") return only(value, ["type"]);
    if (
      !only(value, [
        "type",
        "content",
        ...(["heading", "orderedList"].includes(String(type)) ? ["attrs"] : []),
      ])
    )
      return false;
    if (
      type === "heading" &&
      (!object(value.attrs) ||
        !only(value.attrs, ["level"]) ||
        ![1, 2, 3].includes(Number(value.attrs.level)) ||
        typeof value.attrs.level !== "number")
    )
      return false;
    if (type === "orderedList" && value.attrs !== undefined) {
      if (!object(value.attrs) || !only(value.attrs, ["start", "type"]))
        return false;
      if (
        value.attrs.start !== undefined &&
        (!Number.isInteger(value.attrs.start) ||
          Number(value.attrs.start) < 1 ||
          Number(value.attrs.start) > 10000)
      )
        return false;
      if (
        value.attrs.type != null &&
        !["1", "a", "A", "i", "I"].includes(String(value.attrs.type))
      )
        return false;
    }
    const content = value.content ?? [];
    if (!Array.isArray(content) || content.length > 1000) return false;
    if (type === "paragraph" || type === "heading")
      return content.every((child) =>
        node(child, ["text", "hardBreak"], depth + 1),
      );
    if (type === "listItem")
      return (
        content.length > 0 &&
        object(content[0]) &&
        content[0].type === "paragraph" &&
        content.every((child, index) =>
          node(
            child,
            index === 0
              ? ["paragraph"]
              : ["paragraph", "bulletList", "orderedList"],
            depth + 1,
          ),
        )
      );
    if (type === "bulletList" || type === "orderedList")
      return (
        content.length > 0 &&
        content.every((child) => node(child, ["listItem"], depth + 1))
      );
    return (
      type === "doc" &&
      content.length > 0 &&
      content.every((child) =>
        node(
          child,
          ["paragraph", "heading", "bulletList", "orderedList"],
          depth + 1,
        ),
      )
    );
  }
  return node(value, ["doc"], 0);
}
export const emailDocumentSchema = z.custom<EmailDocument>(
  validDocument,
  "Formátování e-mailu není platné nebo je příliš rozsáhlé.",
);

/** Literal replacement, never reparsed as formatting or HTML. */
function replace(value: string, variables: Record<string, string>) {
  return value.replace(/\{([a-z_]+)\}/g, (token, key: string) =>
    Object.hasOwn(variables, key) ? variables[key]! : token,
  );
}
function escape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
const inlineText = (content: EmailInline[] = []) =>
  content.map((n) => (n.type === "hardBreak" ? "\n" : n.text)).join("");

export function emailDocumentToText(
  document: EmailDocument,
  variables: Record<string, string> = {},
): string {
  function blocks(content: EmailBlock[], depth = 0): string {
    return content
      .map((block) => {
        if (block.type === "paragraph" || block.type === "heading")
          return replace(inlineText(block.content), variables);
        return block.content
          .map((item, index) => {
            const prefix =
              block.type === "orderedList"
                ? `${(block.attrs?.start ?? 1) + index}.`
                : "•";
            return `${"  ".repeat(depth)}${prefix} ${blocks(item.content, depth + 1)}`;
          })
          .join("\n");
      })
      .join("\n\n");
  }
  return blocks(document.content)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Import existing plain-text / **bold** templates without interpreting their text as HTML. */
export function legacyEmailDocument(body: string): EmailDocument {
  return {
    type: "doc",
    content: body.split(/\n{2,}/).map((paragraph) => {
      const content: EmailInline[] = [];
      paragraph.split("\n").forEach((line, index) => {
        if (index) content.push({ type: "hardBreak" });
        let cursor = 0;
        for (const match of line.matchAll(/\*\*([^*\n]+)\*\*/g)) {
          if (match.index > cursor)
            content.push({
              type: "text",
              text: line.slice(cursor, match.index),
            });
          content.push({
            type: "text",
            text: match[1]!,
            marks: [{ type: "bold" }],
          });
          cursor = match.index + match[0].length;
        }
        if (cursor < line.length)
          content.push({ type: "text", text: line.slice(cursor) });
      });
      return { type: "paragraph", content };
    }),
  };
}

export function mapEmailDocumentText(
  document: EmailDocument,
  map: (value: string) => string,
): EmailDocument {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!object(value)) return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        key === "text" && typeof child === "string" ? map(child) : walk(child),
      ]),
    );
  };
  return walk(document) as EmailDocument;
}

/** Only validated node types are emitted, with fixed mail-client-compatible styles. */
export function emailDocumentHtml(
  document: EmailDocument,
  variables: Record<string, string>,
  style: { font: string; color: string },
): string {
  const base = `font-family:${style.font};color:${style.color};`;
  function inline(content: EmailInline[] = []): string {
    return content
      .map((node) => {
        if (node.type === "hardBreak") return "<br />";
        let text = escape(replace(node.text, variables)).replaceAll(
          "\n",
          "<br />",
        );
        for (const mark of node.marks ?? []) {
          if (mark.type === "bold")
            text = `<strong style="font-weight:bold">${text}</strong>`;
          if (mark.type === "italic")
            text = `<em style="font-style:italic">${text}</em>`;
          if (mark.type === "underline")
            text = `<u style="text-decoration:underline">${text}</u>`;
        }
        return text;
      })
      .join("");
  }
  function blocks(content: EmailBlock[], list = false): string {
    return content
      .map((node) => {
        if (node.type === "paragraph" || node.type === "heading") {
          const source = inlineText(node.content);
          if (source && !replace(source, variables).trim()) return "";
          if (node.type === "heading") {
            const tag = `h${node.attrs.level}`;
            const size = { 1: 28, 2: 22, 3: 18 }[node.attrs.level];
            return `<${tag} style="${base}font-size:${size}px;line-height:1.3;font-weight:bold;margin:0 0 18px">${inline(node.content)}</${tag}>`;
          }
          return `<p style="${base}font-size:16px;line-height:1.65;margin:0 0 ${list ? 6 : 18}px">${inline(node.content) || "<br />"}</p>`;
        }
        const tag = node.type === "orderedList" ? "ol" : "ul";
        const start =
          node.type === "orderedList"
            ? ` start="${node.attrs?.start ?? 1}"${node.attrs?.type ? ` type="${node.attrs.type}"` : ""}`
            : "";
        return `<${tag}${start} style="${base}font-size:16px;line-height:1.65;margin:0 0 18px;padding-left:24px;${tag === "ul" ? "list-style-type:disc;" : ""}">${node.content.map((item) => `<li style="margin:0 0 6px">${blocks(item.content, true)}</li>`).join("")}</${tag}>`;
      })
      .join("");
  }
  return blocks(document.content);
}
