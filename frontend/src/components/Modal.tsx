import type { ReactNode } from "react";

export function Modal({
  title,
  children,
  error,
  onClose,
}: {
  title: string;
  children: ReactNode;
  error?: string | null;
  onClose: () => void;
}) {
  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="title">{title}</div>
          <button className="btn" onClick={onClose}>
            إغلاق
          </button>
        </div>
        {error ? (
          <div className="statusPill stNever" style={{ marginBottom: 10 }}>
            {error}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
