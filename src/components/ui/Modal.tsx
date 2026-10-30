"use client";

import { X } from "lucide-react";
import { createContext, useContext, useEffect } from "react";

// Context
const ModalContext = createContext<{ onClose: () => void }>({
  onClose: () => {},
});

// Root
function Modal({
  children,
  open,
  onClose,
}: {
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      // A dropdown open inside the dialog closes first (Radix marks the key as used).
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <ModalContext.Provider value={{ onClose }}>
      <div
        className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4 py-4 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {children}
      </div>
    </ModalContext.Provider>
  );
}

// Content
// A column capped at the screen height: the header and footer keep their size
// and Body takes the rest and scrolls. A <form> placed directly inside joins
// the column too, so Body/Footer can sit inside one.
function Content({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-ink-100 p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] flex flex-col overflow-y-auto overscroll-contain [&>form]:flex [&>form]:flex-col [&>form]:flex-1 [&>form]:min-h-0 ${className}`}
    >
      {children}
    </div>
  );
}

// Header
function Header({ children }: { children: React.ReactNode }) {
  const { onClose } = useContext(ModalContext);
  return (
    <div className="flex items-center justify-between mb-5 shrink-0">
      <h2 className="text-base font-medium text-ink-900">{children}</h2>
      <button
        onClick={onClose}
        className="w-7 h-7 rounded-full flex items-center justify-center text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// Body
// The only part that scrolls, so Header and Footer stay in view.
// The small padding (cancelled by the negative margin) keeps input focus rings
// from being clipped at the edges.
function Body({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1 -my-1 py-1">
      {children}
    </div>
  );
}

// Footer
function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 mt-4 pt-4 border-t border-ink-100 shrink-0">
      {children}
    </div>
  );
}

// Field
function Field({
  label,
  children,
  required,
  htmlFor,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  /** The id of the input, so the label names it. */
  htmlFor?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-xs text-ink-400 mb-1 block">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// Grid — for side by side fields
function Grid({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: number;
}) {
  // Full class names, so Tailwind can see them (it can't read grid-cols-${cols}).
  const COLS: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };
  return (
    <div className={`grid ${COLS[cols] ?? "grid-cols-2"} gap-3`}>{children}</div>
  );
}

// Attach sub-components
Modal.Content = Content;
Modal.Header = Header;
Modal.Body = Body;
Modal.Footer = Footer;
Modal.Field = Field;
Modal.Grid = Grid;

export default Modal;
