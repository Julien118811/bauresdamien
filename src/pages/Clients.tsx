import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import type { Client } from '../types';
import { Icon } from '../components/Icon';
import { Modal, useToast } from '../components/ui';
import { formatDate } from '../lib/format';

const EMPTY: Omit<Client, 'id' | 'createdAt' | 'documents'> = {
  firstName: '',
  lastName: '',
  company: '',
  addressLine1: '',
  postalCode: '',
  city: '',
  phone: '',
  email: '',
  notes: '',
};

export function Clients() {
  const clients = useStore((s) => s.clients);
  const devis = useStore((s) => s.devis);
  const addClient = useStore((s) => s.addClient);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.firstName, c.lastName, c.company, c.city, c.phone, c.email]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [clients, query]);

  const devisCount = (id: string) => devis.filter((d) => d.clientId === id).length;

  const submit = () => {
    if (!form.lastName && !form.company) {
      toast('Renseignez au moins un nom ou une entreprise.');
      return;
    }
    const c = addClient(form);
    setOpen(false);
    setForm(EMPTY);
    toast('Client créé');
    navigate(`/clients/${c.id}`);
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          <span className="crumb">{clients.length} fiche(s)</span>
          <h1>Clients</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <Icon name="plus" size={18} /> Nouveau client
        </button>
      </div>

      <div className="card mb-16" style={{ padding: 10 }}>
        <div className="row gap-8">
          <Icon name="user" className="ico" style={{ color: 'var(--text-mute)', marginLeft: 6 }} />
          <input
            style={{ border: 'none', background: 'transparent', padding: '6px 4px' }}
            placeholder="Rechercher un client…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {filtered.length ? (
        <div className="grid grid-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/clients/${c.id}`)}
            >
              <div className="row between">
                <div className="stat-ico"><Icon name="user" /></div>
                <span className="pill">{devisCount(c.id)} devis</span>
              </div>
              <h3 className="mt-16">
                {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.company || 'Sans nom'}
              </h3>
              {c.company && <div className="dim small">{c.company}</div>}
              <div className="stack gap-6 mt-16 small muted">
                {c.city && <span className="row gap-8"><Icon name="mapPin" size={14} />{c.postalCode} {c.city}</span>}
                {c.phone && <span className="row gap-8"><Icon name="phone" size={14} />{c.phone}</span>}
                {c.email && <span className="row gap-8"><Icon name="mail" size={14} />{c.email}</span>}
              </div>
              <div className="divider" />
              <div className="small muted">Créé le {formatDate(c.createdAt)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty">
            <Icon name="users" size={46} />
            {query ? 'Aucun client ne correspond.' : 'Aucun client pour l’instant.'}
            {!query && (
              <button className="btn btn-primary" onClick={() => setOpen(true)}>
                <Icon name="plus" size={18} /> Ajouter un client
              </button>
            )}
          </div>
        </div>
      )}

      {open && (
        <Modal
          title="Nouveau client"
          onClose={() => setOpen(false)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={submit}><Icon name="check" size={18} /> Créer</button>
            </>
          }
        >
          <ClientForm form={form} setForm={setForm} />
        </Modal>
      )}
    </>
  );
}

export function ClientForm({
  form,
  setForm,
}: {
  form: Omit<Client, 'id' | 'createdAt' | 'documents'>;
  setForm: (f: Omit<Client, 'id' | 'createdAt' | 'documents'>) => void;
}) {
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });
  return (
    <div className="form-grid">
      <label className="field">Prénom<input value={form.firstName} onChange={set('firstName')} /></label>
      <label className="field">Nom<input value={form.lastName} onChange={set('lastName')} /></label>
      <label className="field full">Entreprise<input value={form.company} onChange={set('company')} /></label>
      <label className="field full">Adresse<input value={form.addressLine1} onChange={set('addressLine1')} /></label>
      <label className="field">Code postal<input value={form.postalCode} onChange={set('postalCode')} /></label>
      <label className="field">Ville<input value={form.city} onChange={set('city')} /></label>
      <label className="field">Téléphone<input value={form.phone} onChange={set('phone')} inputMode="tel" /></label>
      <label className="field">Email<input value={form.email} onChange={set('email')} inputMode="email" /></label>
      <label className="field full">Notes<textarea value={form.notes} onChange={set('notes')} /></label>
    </div>
  );
}
