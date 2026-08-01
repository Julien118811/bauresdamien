/** Primitives d'interface réutilisables : Modal, Toast, Confirm, Badge. */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { DevisStatus } from '../types';

/* ---------- Modal ---------- */

export function Modal({
  title,
  onClose,
  children,
  actions,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={wide ? { width: 'min(1100px, 100%)' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Fermer">
            <Icon name="x" />
          </button>
        </div>
        {children}
        {actions && (
          <div className="row between mt-24" style={{ justifyContent: 'flex-end', gap: 10 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */

interface ToastCtx {
  toast: (msg: string) => void;
}
const ToastContext = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 2600);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-wrap">
        {items.map((i) => (
          <div className="toast" key={i.id}>
            <Icon name="check" />
            {i.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- Confirm ---------- */

export function Confirm({
  title,
  message,
  confirmLabel = 'Confirmer',
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onCancel}>
            Annuler
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="dim">{message}</p>
    </Modal>
  );
}

/* ---------- Badge de statut ---------- */

const STATUS: Record<DevisStatus, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  accepte: 'Accepté',
  refuse: 'Refusé',
  facture: 'Facturé',
  paye: 'Payé',
};

export function StatusBadge({ status }: { status: DevisStatus }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className="dot" />
      {STATUS[status]}
    </span>
  );
}

export const STATUS_LIST: DevisStatus[] = [
  'brouillon',
  'envoye',
  'accepte',
  'refuse',
  'facture',
  'paye',
];
export { STATUS as STATUS_LABEL };
