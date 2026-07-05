import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2
} from "lucide-react";
import { useEffect } from "react";
import { cn } from "../lib/cn.js";

const toolbarButtonClassName =
  "inline-flex h-9 max-w-44 shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md border border-bybs-border bg-white px-3 text-sm font-medium text-bybs-body transition hover:bg-bybs-pale hover:text-bybs-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bybs-pale disabled:pointer-events-none disabled:opacity-50";

const activeToolbarButtonClassName = "border-bybs-blue bg-bybs-pale text-bybs-blue";

function ToolbarButton({ active, children, icon: Icon, ...props }) {
  return (
    <button
      className={cn(toolbarButtonClassName, active ? activeToolbarButtonClassName : "")}
      type="button"
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

function normalizedHtml(value = "") {
  return value === "<p></p>" ? "" : value;
}

function normalizeEditorLink(rawUrl = "") {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) return "";

  const urlWithProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;

  try {
    const parsedUrl = new URL(urlWithProtocol);
    return ["http:", "https:", "mailto:", "tel:"].includes(parsedUrl.protocol) ? urlWithProtocol : "";
  } catch {
    return "";
  }
}

export function RichTextEditor({
  id,
  value = "",
  onChange,
  placeholder = "Write the details here...",
  minHeightClassName = "min-h-48"
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3]
        }
      }),
      LinkExtension.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false
      })
    ],
    content: value || "",
    editorProps: {
      attributes: {
        "aria-label": placeholder,
        class: cn(
          minHeightClassName,
          "min-w-0 w-full max-w-full overflow-x-hidden break-words rounded-b-md px-3 py-3 text-sm leading-6 text-bybs-body outline-none [overflow-wrap:anywhere]",
          "[&_a]:break-words [&_a]:font-medium [&_a]:text-bybs-blue [&_a]:underline",
          "[&_blockquote]:border-l-4 [&_blockquote]:border-bybs-rose [&_blockquote]:bg-bybs-blush [&_blockquote]:px-4 [&_blockquote]:py-2",
          "[&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-bybs-navy",
          "[&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-bybs-blue",
          "[&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1",
          "[&_p]:my-2 [&_p]:break-words",
          "[&_pre]:max-w-full [&_pre]:overflow-x-auto",
          "[&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1"
        )
      }
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChange?.(normalizedHtml(activeEditor.getHTML()));
    }
  });

  useEffect(() => {
    if (!editor) return;

    const nextValue = value || "";
    const currentValue = normalizedHtml(editor.getHTML());

    if (currentValue !== nextValue) {
      editor.commands.setContent(nextValue, { emitUpdate: false });
    }
  }, [editor, value]);

  function setLink() {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("Enter link URL", previousUrl);

    if (url === null) return;

    const safeUrl = normalizeEditorLink(url);

    if (!safeUrl) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: safeUrl }).run();
  }

  if (!editor) {
    return (
      <div className="rounded-md border border-bybs-border bg-white px-3 py-8 text-sm text-bybs-muted">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-md border border-bybs-border bg-white focus-within:border-bybs-blue focus-within:ring-2 focus-within:ring-bybs-pale">
      <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain scroll-smooth border-b border-bybs-border bg-bybs-pale p-2 [-webkit-overflow-scrolling:touch]">
        <div className="flex min-w-max gap-2 pr-2 sm:min-w-0 sm:flex-wrap sm:pr-0">
          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            icon={Heading2}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            Heading
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 3 })}
            icon={Heading3}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            Subheading
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("bold")}
            icon={Bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            Bold
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            icon={Italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            Italic
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("bulletList")}
            icon={List}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            Bullet list
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("orderedList")}
            icon={ListOrdered}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            Number list
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("blockquote")}
            icon={Quote}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            Quote
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("link")} icon={Link} onClick={setLink}>
            Link
          </ToolbarButton>
          <ToolbarButton
            disabled={!editor.can().undo()}
            icon={Undo2}
            onClick={() => editor.chain().focus().undo().run()}
          >
            Undo
          </ToolbarButton>
          <ToolbarButton
            disabled={!editor.can().redo()}
            icon={Redo2}
            onClick={() => editor.chain().focus().redo().run()}
          >
            Redo
          </ToolbarButton>
        </div>
      </div>
      <EditorContent
        className="w-full min-w-0 max-w-full overflow-x-hidden [&_.ProseMirror]:min-w-0 [&_.ProseMirror]:max-w-full [&_.ProseMirror]:break-words [&_.ProseMirror]:[overflow-wrap:anywhere]"
        editor={editor}
        id={id}
      />
    </div>
  );
}
