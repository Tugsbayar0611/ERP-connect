import { useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Агуулга оруулах...",
  className,
  disabled = false,
}: RichTextEditorProps) {
  const quillRef = useRef<ReactQuill>(null);

  // Quill toolbar configuration (Mongolian-friendly)
  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ indent: "-1" }, { indent: "+1" }],
      ["link", "image"],
      [{ align: [] }],
      ["clean"],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "indent",
    "link",
    "image",
    "align",
  ];

  return (
    <div className={cn("rich-text-editor-wrapper", className)}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={disabled}
        className={cn(
          "bg-background rounded-md border",
          "[&_.ql-editor]:min-h-[200px]",
          "[&_.ql-editor]:text-foreground",
          "[&_.ql-toolbar]:border-border [&_.ql-toolbar]:rounded-t-md",
          "[&_.ql-container]:border-border [&_.ql-container]:rounded-b-md",
          "[&_.ql-editor.ql-blank::before]:text-muted-foreground [&_.ql-editor.ql-blank::before]:italic",
          disabled && "[&_.ql-toolbar]:hidden [&_.ql-container]:border-t"
        )}
      />
    </div>
  );
}
