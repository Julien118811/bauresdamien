/** Pad de signature électronique (tactile / souris). */

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Modal } from './ui';

export function SignaturePad({
  defaultName,
  onClose,
  onSign,
}: {
  defaultName?: string;
  onClose: () => void;
  onSign: (dataUrl: string, signerName: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [name, setName] = useState(defaultName ?? '');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#16243d';
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasInk(true);
  };
  const up = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const confirm = () => {
    const canvas = canvasRef.current!;
    // Export sur fond blanc.
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const octx = out.getContext('2d')!;
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(canvas, 0, 0);
    onSign(out.toDataURL('image/png'), name.trim() || 'Client');
    onClose();
  };

  return (
    <Modal title="Signature électronique" onClose={onClose}>
      <p className="dim mb-16">
        Le client signe ci-dessous. Une fois validé, le devis est verrouillé et ne peut plus
        être modifié.
      </p>
      <label className="field mb-16">
        Nom du signataire
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom et prénom" />
      </label>
      <div
        style={{
          border: '2px dashed var(--border)',
          borderRadius: 'var(--radius-sm)',
          background: '#fff',
          height: 220,
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          style={{ width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
        />
      </div>
      <div className="row between mt-24" style={{ gap: 10 }}>
        <button className="btn btn-ghost" onClick={clear}>
          <Icon name="undo" size={18} /> Effacer
        </button>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={onClose}>
          Annuler
        </button>
        <button className="btn btn-primary" onClick={confirm} disabled={!hasInk}>
          <Icon name="check" size={18} /> Valider &amp; verrouiller
        </button>
      </div>
    </Modal>
  );
}
