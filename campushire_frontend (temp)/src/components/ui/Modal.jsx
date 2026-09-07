/* Generic modal overlay — port of .modal-overlay / openModal() / closeModal() */
export default function Modal({ open = true, onClose, children, size = '' }) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={`modal-card ${size}`}>
        {children}
      </div>
    </div>
  );
}

