"use client";

import * as React from "react";

interface AlertDialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null);

function useAlertDialog() {
  const context = React.useContext(AlertDialogContext);
  if (!context) {
    throw new Error("AlertDialog components must be used within AlertDialog");
  }
  return context;
}

export function AlertDialog({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <AlertDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

export function AlertDialogTrigger({ children }: { children: React.ReactNode }) {
  const { setOpen } = useAlertDialog();
  
  return (
    <div onClick={() => setOpen(true)} style={{ display: 'inline-block' }}>
      {children}
    </div>
  );
}

export function AlertDialogContent({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useAlertDialog();

  if (!open) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 50,
        }}
        onClick={() => setOpen(false)}
      />
      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 51,
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}

export function AlertDialogHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: '16px' }}>{children}</div>;
}

export function AlertDialogTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
      {children}
    </h2>
  );
}

export function AlertDialogDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted" style={{ fontSize: '13px', lineHeight: 1.5 }}>
      {children}
    </p>
  );
}

export function AlertDialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginTop: '20px',
      }}
    >
      {children}
    </div>
  );
}

export function AlertDialogCancel({ children }: { children: React.ReactNode }) {
  const { setOpen } = useAlertDialog();
  
  return (
    <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
      {children}
    </button>
  );
}

export function AlertDialogAction({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const { setOpen } = useAlertDialog();
  
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => {
        onClick?.();
        setOpen(false);
      }}
    >
      {children}
    </button>
  );
}
