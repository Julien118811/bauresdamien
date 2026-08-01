import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import type { Prestation, PrestationCategory } from '../types';
import { formatEUR } from '../lib/format';
import { Icon } from '../components/Icon';
import { Confirm, Modal, useToast } from '../components/ui';

const CATEGORIES: PrestationCategory[] = [
  'Post-mortem', 'Décontamination', 'Désinfection', 'Odeurs', 'Industriel',
  'Sinistre', 'Déchets', 'Déplacement', 'Main-d’œuvre', 'Divers',
];

const EMPTY: Omit<Prestation, 'id'> = {
  label: '', description: '', category: 'Décontamination', unit: 'm²',
  unitPrice: 0, unitCost: 0, vatRate: 20, averageTimeH: 0, equipment: '', products: '',
};

export function Prestations() {
  const prestations = useStore((s) => s.prestations);
  const addPrestation = useStore((s) => s.addPrestation);
  const updatePrestation = useStore((s) => s.updatePrestation);
  const deletePrestation = useStore((s) => s.deletePrestation);
  const { toast } = useToast();

  const [cat, setCat] = useState<PrestationCategory | 'Toutes'>('Toutes');
  const [editing, setEditing] = useState<Prestation | null>(null);
  const [form, setForm] = useState<Omit<Prestation, 'id'>>(EMPTY);
  const [open, setOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (cat === 'Toutes' ? prestations : prestations.filter((p) => p.category === cat)),
    [prestations, cat],
  );

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p: Prestation) => { setEditing(p); const { id: _id, ...rest } = p; void _id; setForm(rest); setOpen(true); };

  const save = () => {
    if (!form.label.trim()) { toast('Indiquez un libellé.'); return; }
    if (editing) { updatePrestation(editing.id, form); toast('Prestation mise à jour'); }
    else { addPrestation(form); toast('Prestation créée'); }
    setOpen(false);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const num = ['unitPrice', 'unitCost', 'vatRate', 'averageTimeH'].includes(k);
    setForm({ ...form, [k]: num ? Number(e.target.value) : e.target.value });
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          <span className="crumb">{prestations.length} prestation(s)</span>
          <h1>Bibliothèque de prestations</h1>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={18} /> Nouvelle prestation</button>
      </div>

      <div className="chips mb-16">
        <button className={`chip ${cat === 'Toutes' ? 'active' : ''}`} onClick={() => setCat('Toutes')}>Toutes</button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      <div className="grid grid-3">
        {filtered.map((p) => (
          <div className="card" key={p.id}>
            <div className="row between">
              <span className="pill">{p.category}</span>
              <span className="mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatEUR(p.unitPrice)}<span className="muted small">/{p.unit}</span></span>
            </div>
            <h3 className="mt-16">{p.label}</h3>
            {p.description && <p className="small muted mt-8">{p.description}</p>}
            <div className="divider" />
            <div className="row between small dim">
              <span>Coût : {formatEUR(p.unitCost)}</span>
              <span>Marge : {formatEUR(p.unitPrice - p.unitCost)}</span>
              {p.averageTimeH > 0 && <span>≈ {p.averageTimeH} h</span>}
            </div>
            <div className="row gap-8 mt-16">
              <button className="btn btn-sm btn-ghost" style={{ flex: 1 }} onClick={() => openEdit(p)}><Icon name="edit" size={15} /> Modifier</button>
              <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setDelId(p.id)}><Icon name="trash" size={15} /></button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <Modal
          title={editing ? 'Modifier la prestation' : 'Nouvelle prestation'}
          onClose={() => setOpen(false)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save}><Icon name="check" size={18} /> Enregistrer</button>
            </>
          }
        >
          <div className="form-grid">
            <label className="field full">Libellé<input value={form.label} onChange={set('label')} /></label>
            <label className="field">Catégorie
              <select value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="field">Unité<input value={form.unit} onChange={set('unit')} /></label>
            <label className="field">Prix de vente HT<input type="number" step={0.01} value={form.unitPrice} onChange={set('unitPrice')} /></label>
            <label className="field">Coût de revient HT<input type="number" step={0.01} value={form.unitCost} onChange={set('unitCost')} /></label>
            <label className="field">TVA (%)<input type="number" value={form.vatRate} onChange={set('vatRate')} /></label>
            <label className="field">Temps moyen (h)<input type="number" step={0.1} value={form.averageTimeH} onChange={set('averageTimeH')} /></label>
            <label className="field full">Description<textarea value={form.description} onChange={set('description')} /></label>
            <label className="field full">Matériel<input value={form.equipment} onChange={set('equipment')} /></label>
            <label className="field full">Produits<input value={form.products} onChange={set('products')} /></label>
          </div>
        </Modal>
      )}

      {delId && (
        <Confirm title="Supprimer la prestation" message="Cette prestation sera retirée de la bibliothèque." confirmLabel="Supprimer" danger
          onConfirm={() => { deletePrestation(delId); toast('Prestation supprimée'); }}
          onCancel={() => setDelId(null)} />
      )}
    </>
  );
}
