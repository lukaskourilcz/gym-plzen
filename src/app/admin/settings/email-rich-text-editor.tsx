"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Undo2,
  Redo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmailDocument } from "@/lib/config/email-document";
import "./email-rich-text-editor.css";

/** Structured authoring only. The mail renderer, not pasted HTML, determines outgoing markup. */
export function EmailRichTextEditor({
  initialDocument,
  onChange,
}: {
  initialDocument: EmailDocument;
  onChange: (document: EmailDocument) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: false,
      }),
    ],
    content: initialDocument,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        id: "emailTemplateBody",
        role: "textbox",
        "aria-label": "Text e-mailu",
        "aria-multiline": "true",
        "aria-describedby": "email-format-help",
        class: "email-rich-editor min-h-80 p-3 outline-none",
      },
    },
    // ProseMirror attributes have null prototypes; transport plain JSON through Server Actions.
    onUpdate: ({ editor }) =>
      onChange(JSON.parse(JSON.stringify(editor.getJSON())) as EmailDocument),
  });
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      underline: editor?.isActive("underline") ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      orderedList: editor?.isActive("orderedList") ?? false,
      heading: editor?.isActive("heading")
        ? String(editor.getAttributes("heading").level)
        : "paragraph",
      undo: editor?.can().undo() ?? false,
      redo: editor?.can().redo() ?? false,
    }),
  });
  // A template switch or a confirmed save resets content. Typing never replaces
  // the document from parent props, so selection and undo remain intact.
  useEffect(() => {
    editor?.commands.setContent(initialDocument, { emitUpdate: false });
  }, [editor, initialDocument]);
  if (!editor)
    return (
      <p role="status" className="py-4 text-sm text-muted-foreground">
        Načítám editor…
      </p>
    );
  return (
    <div className="rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
      <div
        onMouseDown={(event) => {
          if (event.target instanceof Element && event.target.closest("button"))
            event.preventDefault();
        }}
        role="group"
        aria-label="Formátování e-mailu"
        className="flex flex-wrap items-center gap-1 border-b border-border p-2"
      >
        <select
          aria-label="Styl textu"
          className="min-h-11 rounded-md border border-input bg-card py-2 pl-3 pr-8 text-sm"
          value={active?.heading ?? "paragraph"}
          onChange={(event) => {
            if (event.target.value === "paragraph")
              editor.chain().focus().setParagraph().run();
            else
              editor
                .chain()
                .focus()
                .setHeading({ level: Number(event.target.value) as 1 | 2 | 3 })
                .run();
          }}
        >
          <option value="paragraph">Běžný text</option>
          <option value="1">Nadpis 1</option>
          <option value="2">Nadpis 2</option>
          <option value="3">Nadpis 3</option>
        </select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Tučně"
          title="Tučně (Ctrl/Cmd+B)"
          aria-pressed={active?.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Kurzíva"
          title="Kurzíva (Ctrl/Cmd+I)"
          aria-pressed={active?.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Podtržení"
          title="Podtržení (Ctrl/Cmd+U)"
          aria-pressed={active?.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Seznam s odrážkami"
          title="Seznam s odrážkami"
          aria-pressed={active?.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Číslovaný seznam"
          title="Číslovaný seznam"
          aria-pressed={active?.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Zpět"
          title="Zpět"
          disabled={!active?.undo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Znovu"
          title="Znovu"
          disabled={!active?.redo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 aria-hidden="true" />
        </Button>
      </div>
      <EditorContent editor={editor} />
      <p
        id="email-format-help"
        className="border-t border-border px-3 py-2 text-xs text-muted-foreground"
      >
        Označte text a zvolte formátování. Proměnné v závorkách zachovejte.
        Náhled se mění bez odeslání.
      </p>
    </div>
  );
}
