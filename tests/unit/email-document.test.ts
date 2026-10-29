import assert from "node:assert/strict";
import test from "node:test";
import {
  emailDocumentSchema,
  emailDocumentToText,
  legacyEmailDocument,
  type EmailDocument,
} from "../../src/lib/config/email-document";
import {
  emailTemplateToHtml,
  renderEmailTemplateText,
} from "../../src/lib/config/email-templates";
import { emailTemplateSchema } from "../../src/lib/validations/settings";

const document: EmailDocument = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Pravidla pro {name}" }],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Noční klid" }],
    },
    {
      type: "heading",
      attrs: { level: 3 },
      content: [{ type: "text", text: "Po 22. hodině" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Hudbu jen do sluchátek.",
          marks: [{ type: "bold" }, { type: "italic" }, { type: "underline" }],
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "První pravidlo" }],
            },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 2, type: null },
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Druhé pravidlo" }],
            },
          ],
        },
      ],
    },
    { type: "paragraph", content: [{ type: "text", text: "Kód: {code}" }] },
  ],
};

test("rich mail renders headings, emphasis and lists with a readable text alternative", () => {
  assert.ok(emailDocumentSchema.safeParse(document).success);
  const template = {
    subject: "Kód",
    body: emailDocumentToText(document),
    bodyDocument: document,
  };
  const variables = {
    name: '<img src=x onerror="alert(1)"> **Host**',
    code: "123456",
  };
  const html = emailTemplateToHtml(template, variables);
  for (const tag of ["h1", "h2", "h3", "strong", "em", "u", "ul", "ol", "li"])
    assert.match(html, new RegExp(`<${tag}[ >]`));
  assert.match(html, /font-size:28px/);
  assert.match(html, /font-size:22px/);
  assert.match(html, /font-size:18px/);
  assert.match(html, /<ol start="2"/);
  assert.match(
    html,
    /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; \*\*Host\*\*/,
  );
  assert.doesNotMatch(html, /<img src=x|<strong[^>]*>Host/);
  const text = renderEmailTemplateText(template, variables).body;
  assert.match(text, /• První pravidlo/);
  assert.match(text, /2\. Druhé pravidlo/);
  assert.match(text, /Kód: 123456/);
  assert.match(text, /\*\*Host\*\*/);
  assert.doesNotMatch(text, /<h1|<strong|<ul/);
});

test("rich template validation rejects HTML, unsafe nodes, attributes and excessive documents without throwing", () => {
  const invalid: unknown[] = [
    null,
    {},
    { type: "doc" },
    {
      type: "doc",
      content: [{ type: "html", html: "<script>alert(1)</script>" }],
    },
    {
      type: "doc",
      content: [{ type: "heading", attrs: { level: 4 }, content: [] }],
    },
    {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1, style: "color:red" },
          content: [],
        },
      ],
    },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Unsafe",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "image", attrs: { src: "https://example.com/track" } },
          ],
        },
      ],
    },
    {
      type: "doc",
      content: [{ type: "orderedList", attrs: { start: -1 }, content: [] }],
    },
    legacyEmailDocument("x".repeat(8001)),
    {
      type: "doc",
      content: Array.from({ length: 1001 }, () => ({ type: "paragraph" })),
    },
  ];
  let nested: unknown = {
    type: "paragraph",
    content: [{ type: "text", text: "Nested" }],
  };
  for (let i = 0; i < 14; i++)
    nested = {
      type: "bulletList",
      content: [{ type: "listItem", content: [{ type: "paragraph" }, nested] }],
    };
  invalid.push({ type: "doc", content: [nested] });
  for (const bodyDocument of invalid) {
    assert.equal(emailDocumentSchema.safeParse(bodyDocument).success, false);
    assert.equal(
      emailTemplateSchema.safeParse({
        id: "access_code",
        subject: "Předmět",
        body: "Platný text šablony",
        bodyDocument,
      }).success,
      false,
    );
  }
});

test("importing legacy templates preserves variables and literal HTML and only converts existing bold markup", () => {
  const source =
    "Ahoj {name},\n\n**Noční klid.**\nKód: {code}\n\nDoslova <b>text</b> a neznámé {missing}.";
  const doc = legacyEmailDocument(source);
  assert.ok(emailDocumentSchema.safeParse(doc).success);
  const variables = { name: "Klára", code: "123456" };
  assert.equal(
    renderEmailTemplateText(
      { subject: "Kód", body: source, bodyDocument: doc },
      variables,
    ).body,
    renderEmailTemplateText({ subject: "Kód", body: source }, variables).body,
  );
  const html = emailTemplateToHtml(
    { subject: "Kód", body: source, bodyDocument: doc },
    variables,
  );
  assert.match(html, /<strong[^>]*>Noční klid\.<\/strong>/);
  assert.match(html, /&lt;b&gt;text&lt;\/b&gt;/);
  assert.match(html, /\{missing\}/);
  assert.equal(
    emailTemplateSchema.safeParse({
      id: "access_code",
      subject: "Předmět",
      body: "Bezpečný text šablony",
    }).success,
    true,
  );
});

test("formatting part of a variable never prevents its complete safe substitution", () => {
  const bodyDocument: EmailDocument = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Kód: " },
          { type: "text", text: "{co", marks: [{ type: "bold" }] },
          { type: "text", text: "de}", marks: [{ type: "italic" }] },
          { type: "text", text: " pro {na" },
          { type: "text", text: "me}", marks: [{ type: "underline" }] },
        ],
      },
    ],
  };
  const html = emailTemplateToHtml(
    { subject: "Kód", body: emailDocumentToText(bodyDocument), bodyDocument },
    { code: "123456", name: "<Host> {code}" },
  );
  assert.match(html, /<strong[^>]*>123456<\/strong>/);
  assert.match(html, /&lt;Host&gt; \{code\}/);
  assert.doesNotMatch(html, /\{name\}|\{co<|\{na<|de}<\/em>/);
});
