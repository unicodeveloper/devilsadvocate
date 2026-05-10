"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";

type MarkdownStorage = { getMarkdown: () => string };
function getMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as { markdown: MarkdownStorage };
  return storage.markdown.getMarkdown();
}

/**
 * Lightweight WYSIWYG editor with markdown round-trip.
 *
 * - Initial value is markdown; `onChange` emits markdown.
 * - StarterKit + Markdown extension covers headings, bold/italic, lists,
 *   blockquote, code blocks, hard breaks, history.
 * - Link + Placeholder are the only additions beyond the starter set.
 */
export function RichEditor({
  value,
  onChange,
  placeholder,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Markdown extension handles its own linkification via tiptap-markdown
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-accent underline underline-offset-2",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Start typing…",
        showOnlyWhenEditable: true,
        showOnlyCurrent: false,
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: true,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value,
    autofocus: autoFocus ? "end" : false,
    immediatelyRender: false, // required for SSR/Next.js
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc dark:prose-invert max-w-none min-h-full p-6 focus:outline-none prose-headings:text-text prose-p:text-text prose-li:text-text prose-strong:text-text prose-code:text-text prose-blockquote:text-text-muted prose-a:text-accent",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(getMarkdown(editor));
    },
  });

  // Keep external value in sync (e.g. when "Cancel" reverts content)
  useEffect(() => {
    if (!editor) return;
    const current = getMarkdown(editor);
    if (current.trim() === value.trim()) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className={`flex min-h-[400px] items-start rounded-lg border border-border bg-surface p-6 text-sm text-text-subtle ${className ?? ""}`}
      >
        Loading editor…
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-[400px] flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors focus-within:border-accent ${className ?? ""}`}
    >
      <Toolbar editor={editor} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}

// ─── Toolbar ───────────────────────────────────────────────────────────

type EditorInstance = NonNullable<ReturnType<typeof useEditor>>;

function Toolbar({ editor }: { editor: EditorInstance }) {
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-2 px-2 py-1.5"
    >
      <HeadingDropdown editor={editor} />
      <Sep />
      <ToolBtn
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        shortcut="⌘B"
      >
        <span className="font-bold">B</span>
      </ToolBtn>
      <ToolBtn
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        shortcut="⌘I"
      >
        <span className="italic">I</span>
      </ToolBtn>
      <ToolBtn
        label="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <span className="font-mono text-xs">{`</>`}</span>
      </ToolBtn>
      <Sep />
      <ToolBtn
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <BulletIcon />
      </ToolBtn>
      <ToolBtn
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <OrderedIcon />
      </ToolBtn>
      <ToolBtn
        label="Blockquote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <QuoteIcon />
      </ToolBtn>
      <Sep />
      <ToolBtn
        label="Add link"
        active={editor.isActive("link")}
        onClick={() => addLink(editor)}
      >
        <LinkIcon />
      </ToolBtn>
      <ToolBtn
        label="Horizontal rule"
        active={false}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <HrIcon />
      </ToolBtn>
      <Sep />
      <ToolBtn
        label="Undo"
        active={false}
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
        shortcut="⌘Z"
      >
        <UndoIcon />
      </ToolBtn>
      <ToolBtn
        label="Redo"
        active={false}
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
        shortcut="⇧⌘Z"
      >
        <RedoIcon />
      </ToolBtn>
    </div>
  );
}

function HeadingDropdown({ editor }: { editor: EditorInstance }) {
  const current = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : "p";

  return (
    <select
      aria-label="Block style"
      value={current}
      onChange={(e) => {
        const v = e.target.value;
        const chain = editor.chain().focus();
        if (v === "p") chain.setParagraph().run();
        else if (v === "h1") chain.toggleHeading({ level: 1 }).run();
        else if (v === "h2") chain.toggleHeading({ level: 2 }).run();
        else if (v === "h3") chain.toggleHeading({ level: 3 }).run();
        if (current === v && v !== "p") chain.setParagraph().run();
      }}
      className="h-7 rounded-md border-none bg-transparent px-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface-3 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
    >
      <option value="p">Paragraph</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
    </select>
  );
}

function ToolBtn({
  label,
  active,
  disabled,
  onClick,
  children,
  shortcut,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] ${
        active
          ? "bg-accent text-accent-fg shadow-sm"
          : "text-text-muted hover:bg-surface-3 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return (
    <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
  );
}

function addLink(editor: EditorInstance) {
  const previous = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link URL", previous ?? "https://");
  if (url === null) return;
  if (url === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  let safe = url.trim();
  if (!/^(https?:\/\/|mailto:|#|\/)/.test(safe)) {
    safe = `https://${safe}`;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
}

// ─── Tiny icons (single-color stroke) ──────────────────────────────────

const baseIcon = "h-3.5 w-3.5";

function BulletIcon() {
  return (
    <svg className={baseIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="3" cy="4" r="1.2" />
      <circle cx="3" cy="8" r="1.2" />
      <circle cx="3" cy="12" r="1.2" />
      <rect x="6" y="3.4" width="9" height="1.2" rx="0.6" />
      <rect x="6" y="7.4" width="9" height="1.2" rx="0.6" />
      <rect x="6" y="11.4" width="9" height="1.2" rx="0.6" />
    </svg>
  );
}

function OrderedIcon() {
  return (
    <svg className={baseIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <text x="0.5" y="5.5" fontSize="4" fontFamily="ui-monospace, monospace">1.</text>
      <text x="0.5" y="9.5" fontSize="4" fontFamily="ui-monospace, monospace">2.</text>
      <text x="0.5" y="13.5" fontSize="4" fontFamily="ui-monospace, monospace">3.</text>
      <rect x="6" y="3.4" width="9" height="1.2" rx="0.6" />
      <rect x="6" y="7.4" width="9" height="1.2" rx="0.6" />
      <rect x="6" y="11.4" width="9" height="1.2" rx="0.6" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg
      className={baseIcon}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 3v10" />
      <path d="M6 6h7" />
      <path d="M6 9h5" />
      <path d="M6 12h6" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      className={baseIcon}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6.5 9.5l3-3" />
      <path d="M9 4.5L10.5 3a2.5 2.5 0 0 1 3.5 3.5L12.5 8" />
      <path d="M7 8L5.5 9.5A2.5 2.5 0 0 0 9 13l1.5-1.5" />
    </svg>
  );
}

function HrIcon() {
  return (
    <svg
      className={baseIcon}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 8h12" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg
      className={baseIcon}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7h7a3.5 3.5 0 1 1 0 7H6" />
      <path d="M5.5 4 3 7l2.5 3" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg
      className={baseIcon}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13 7H6a3.5 3.5 0 1 0 0 7h4" />
      <path d="M10.5 4 13 7l-2.5 3" />
    </svg>
  );
}
