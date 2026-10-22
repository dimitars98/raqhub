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
      if (e.key === "Escape") onClose();
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
        className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4"
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
function Content({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-ink-100 p-6 w-full max-w-md ${className}`}
    >
      {children}
    </div>
  );
}

// Header
function Header({ children }: { children: React.ReactNode }) {
  const { onClose } = useContext(ModalContext);
  return (
    <div className="flex items-center justify-between mb-5">
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
function Body({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

// Footer
function Footer({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3 mt-5">{children}</div>;
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
  return <div className={`grid grid-cols-${cols} gap-3`}>{children}</div>;
}

// Attach sub-components
Modal.Content = Content;
Modal.Header = Header;
Modal.Body = Body;
Modal.Footer = Footer;
Modal.Field = Field;
Modal.Grid = Grid;

export default Modal;
