/**
 * Éditeur d'annotation photo (canvas).
 *
 * Outils : flèche, cercle, rectangle, texte, mesure, dessin libre.
 * Les annotations sont vectorielles et normalisées (0..1) → ré-éditables et
 * indépendantes de la résolution. À l'enregistrement, on produit :
 *   - le tableau d'annotations (stocké dans le devis) ;
 *   - une image aplatie (annotations « gravées ») pour l'export PDF/galerie.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Annotation, AnnotationTool, DevisPhoto } from '../types';
import { getBlob, putBlob, invalidateBlobUrl } from '../lib/db';
import { uid } from '../lib/format';
import { Icon } from './Icon';
import { Modal } from './ui';

const COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#0a84ff', '#ffffff', '#000000'];
const TOOLS: { tool: AnnotationTool; icon: string; label: string }[] = [
  { tool: 'arrow', icon: 'arrowRight', label: 'Flèche' },
  { tool: 'circle', icon: 'circleTool', label: 'Cercle' },
  { tool: 'rect', icon: 'square', label: 'Rectangle' },
  { tool: 'free', icon: 'pen', label: 'Libre' },
  { tool: 'measure', icon: 'ruler', label: 'Mesure' },
  { tool: 'text', icon: 'type', label: 'Texte' },
];

export function PhotoAnnotator({
  photo,
  onClose,
  onSave,
}: {
  photo: DevisPhoto;
  onClose: () => void;
  onSave: (annotations: Annotation[], annotatedBlobId: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<AnnotationTool>('arrow');
  const [color, setColor] = useState('#ff3b30');
  const [width, setWidth] = useState(4);
  const [annotations, setAnnotations] = useState<Annotation[]>(photo.annotations);
  const drawing = useRef<Annotation | null>(null);
  const [, force] = useState(0);
  const [ready, setReady] = useState(false);

  // Charge l'image source.
  useEffect(() => {
    let alive = true;
    getBlob(photo.blobId).then(async (blob) => {
      if (!blob || !alive) return;
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        imgRef.current = img;
        setReady(true);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
    return () => {
      alive = false;
    };
  }, [photo.blobId]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const all = drawing.current ? [...annotations, drawing.current] : annotations;
    for (const a of all) drawAnnotation(ctx, a, canvas.width, canvas.height);
  }, [annotations]);

  // Dimensionne le canvas à l'image (borné pour la performance).
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !ready) return;
    const maxW = 1600;
    const scale = Math.min(1, maxW / img.width);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    redraw();
  }, [ready, redraw]);

  useEffect(() => {
    redraw();
  }, [annotations, redraw]);

  const toCanvasPoint = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ready) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toCanvasPoint(e);
    if (tool === 'text') {
      const text = window.prompt('Texte de l’annotation :');
      if (text) {
        setAnnotations((a) => [
          ...a,
          { id: uid(), tool: 'text', color, points: [p], text, strokeWidth: width },
        ]);
      }
      return;
    }
    if (tool === 'measure') {
      drawing.current = { id: uid(), tool, color, points: [p, p], strokeWidth: width, measure: '' };
    } else {
      drawing.current = { id: uid(), tool, color, points: [p, p], strokeWidth: width };
    }
    force((n) => n + 1);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = toCanvasPoint(e);
    const d = drawing.current;
    if (d.tool === 'free') d.points.push(p);
    else d.points[1] = p;
    redraw();
  };

  const onPointerUp = () => {
    const d = drawing.current;
    if (!d) return;
    drawing.current = null;
    if (d.tool === 'measure') {
      const val = window.prompt('Valeur mesurée (ex. « 2,5 m ») :', '');
      d.measure = val ?? '';
    }
    // Ignore les traits trop courts (clics accidentels), sauf dessin libre.
    const [a, b] = [d.points[0], d.points[d.points.length - 1]];
    const dist = Math.hypot((a.x - b.x), (a.y - b.y));
    if (d.tool !== 'free' && d.tool !== 'text' && dist < 0.01) {
      force((n) => n + 1);
      return;
    }
    setAnnotations((prev) => [...prev, d]);
  };

  const undo = () => setAnnotations((a) => a.slice(0, -1));
  const clearAll = () => setAnnotations([]);

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Redessine sans annotation en cours puis exporte.
    drawing.current = null;
    redraw();
    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b!), 'image/jpeg', 0.9),
    );
    // Remplace l'ancien blob annoté s'il existait.
    if (photo.annotatedBlobId) invalidateBlobUrl(photo.annotatedBlobId);
    const id = await putBlob(blob);
    onSave(annotations, id);
    onClose();
  };

  return (
    <Modal title="Annotation de la photo" onClose={onClose} wide>
      <div className="row row-wrap gap-8 mb-16" style={{ alignItems: 'stretch' }}>
        <div className="chips">
          {TOOLS.map((t) => (
            <button
              key={t.tool}
              className={`chip ${tool === t.tool ? 'active' : ''}`}
              onClick={() => setTool(t.tool)}
              title={t.label}
            >
              <Icon name={t.icon} size={16} /> {t.label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <div className="row gap-6">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Couleur ${c}`}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: c,
                border: color === c ? '3px solid var(--accent)' : '2px solid var(--border)',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>

      <div className="row gap-12 mb-16">
        <label className="row gap-8 small dim" style={{ flex: 1, maxWidth: 260 }}>
          Épaisseur
          <input
            type="range"
            min={2}
            max={16}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </label>
        <div className="spacer" />
        <button className="btn btn-sm btn-ghost" onClick={undo} disabled={!annotations.length}>
          <Icon name="undo" size={16} /> Annuler
        </button>
        <button className="btn btn-sm btn-ghost btn-danger" onClick={clearAll} disabled={!annotations.length}>
          <Icon name="trash" size={16} /> Tout effacer
        </button>
      </div>

      <div
        style={{
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-sm)',
          padding: 8,
          display: 'grid',
          placeItems: 'center',
          maxHeight: '58vh',
          overflow: 'auto',
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            maxWidth: '100%',
            touchAction: 'none',
            cursor: 'crosshair',
            borderRadius: 6,
            display: ready ? 'block' : 'none',
          }}
        />
        {!ready && <div className="empty">Chargement de l’image…</div>}
      </div>

      <div className="row between mt-24" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-ghost" onClick={onClose}>
          Annuler
        </button>
        <button className="btn btn-primary" onClick={save}>
          <Icon name="check" size={18} /> Enregistrer l’annotation
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Rendu d'une annotation sur un contexte 2D                           */
/* ------------------------------------------------------------------ */

function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  a: Annotation,
  w: number,
  h: number,
) {
  const pts = a.points.map((p) => ({ x: p.x * w, y: p.y * h }));
  ctx.strokeStyle = a.color;
  ctx.fillStyle = a.color;
  ctx.lineWidth = a.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (a.tool === 'text' && a.text) {
    const p = pts[0];
    const size = Math.max(16, a.strokeWidth * 5);
    ctx.font = `700 ${size}px Inter, sans-serif`;
    const metrics = ctx.measureText(a.text);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(p.x - 4, p.y - size, metrics.width + 8, size + 8);
    ctx.fillStyle = a.color;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(a.text, p.x, p.y);
    return;
  }

  if (pts.length < 2) return;
  const [p0, p1] = [pts[0], pts[pts.length - 1]];

  switch (a.tool) {
    case 'arrow': {
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const len = 10 + a.strokeWidth * 2.5;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p1.x - len * Math.cos(angle - Math.PI / 6), p1.y - len * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p1.x - len * Math.cos(angle + Math.PI / 6), p1.y - len * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      break;
    }
    case 'circle': {
      const cx = (p0.x + p1.x) / 2;
      const cy = (p0.y + p1.y) / 2;
      const rx = Math.abs(p1.x - p0.x) / 2;
      const ry = Math.abs(p1.y - p0.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(rx, 2), Math.max(ry, 2), 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'rect': {
      ctx.strokeRect(
        Math.min(p0.x, p1.x),
        Math.min(p0.y, p1.y),
        Math.abs(p1.x - p0.x),
        Math.abs(p1.y - p0.y),
      );
      break;
    }
    case 'free': {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      break;
    }
    case 'measure': {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      // Embouts perpendiculaires.
      const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x) + Math.PI / 2;
      const cap = 8 + a.strokeWidth;
      for (const p of [p0, p1]) {
        ctx.beginPath();
        ctx.moveTo(p.x - cap * Math.cos(ang), p.y - cap * Math.sin(ang));
        ctx.lineTo(p.x + cap * Math.cos(ang), p.y + cap * Math.sin(ang));
        ctx.stroke();
      }
      if (a.measure) {
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2;
        const size = Math.max(15, a.strokeWidth * 4.5);
        ctx.font = `700 ${size}px Inter, sans-serif`;
        const m = ctx.measureText(a.measure);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(mx - m.width / 2 - 5, my - size - 8, m.width + 10, size + 6);
        ctx.fillStyle = a.color;
        ctx.textAlign = 'center';
        ctx.fillText(a.measure, mx, my - 10);
        ctx.textAlign = 'left';
      }
      break;
    }
  }
}
