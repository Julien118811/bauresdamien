import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/store';
import { devisTotals } from '../lib/calc';
import { formatDate, formatEUR, uid } from '../lib/format';
import { putBlob, deleteBlob } from '../lib/db';
import { BlobImage } from '../components/BlobImage';
import { Icon } from '../components/Icon';
import { Confirm, Modal, StatusBadge, useToast } from '../components/ui';
import { ClientForm } from './Clients';

export function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const client = useStore((s) => s.clients.find((c) => c.id === id));
  const allDevis = useStore((s) => s.devis);
  const devis = useMemo(() => allDevis.filter((d) => d.clientId === id), [allDevis, id]);
  const settings = useStore((s) => s.settings);
  const updateClient = useStore((s) => s.updateClient);
  const deleteClient = useStore((s) => s.deleteClient);
  const createDevis = useStore((s) => s.createDevis);

  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [form, setForm] = useState(() =>
    client
      ? { ...client }
      : null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    let signed = 0;
    for (const d of devis) {
      if (['accepte', 'facture', 'paye'].includes(d.status))
        signed += devisTotals(d, settings).totalTTC;
    }
    return { signed, count: devis.length };
  }, [devis, settings]);

  if (!client) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="user" size={46} />
          Client introuvable.
          <button className="btn" onClick={() => navigate('/clients')}>Retour aux clients</button>
        </div>
      </div>
    );
  }

  const name = [client.firstName, client.lastName].filter(Boolean).join(' ') || client.company;

  const newQuote = () => {
    const d = createDevis(client.id);
    navigate(`/devis/${d.id}`);
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const docs = [...client.documents];
    for (const f of files) {
      const blobId = await putBlob(f);
      docs.push({ id: uid(), name: f.name, mime: f.type, blobId, addedAt: new Date().toISOString() });
    }
    updateClient(client.id, { documents: docs });
    toast(`${files.length} document(s) ajouté(s)`);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeDoc = async (docId: string, blobId: string) => {
    await deleteBlob(blobId);
    updateClient(client.id, { documents: client.documents.filter((d) => d.id !== docId) });
  };

  const photoDocs = client.documents.filter((d) => d.mime.startsWith('image/'));
  const otherDocs = client.documents.filter((d) => !d.mime.startsWith('image/'));

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          <span className="crumb link" onClick={() => navigate('/clients')}>← Clients</span>
          <h1>{name || 'Sans nom'}</h1>
        </div>
        <div className="row gap-8">
          <button className="btn btn-ghost" onClick={() => { setForm({ ...client }); setEditing(true); }}>
            <Icon name="edit" size={18} /> Modifier
          </button>
          <button className="btn btn-primary" onClick={newQuote}>
            <Icon name="plus" size={18} /> Nouveau devis
          </button>
        </div>
      </div>

      <div className="grid grid-3 mb-24">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 className="mb-16">Coordonnées</h3>
          <div className="form-grid">
            <Info label="Entreprise" value={client.company} />
            <Info label="Téléphone" value={client.phone} />
            <Info label="Email" value={client.email} />
            <Info label="Adresse" value={[client.addressLine1, `${client.postalCode} ${client.city}`.trim()].filter(Boolean).join(', ')} />
          </div>
          {client.notes && (
            <>
              <div className="divider" />
              <div className="section-title">Notes</div>
              <p className="dim" style={{ whiteSpace: 'pre-wrap' }}>{client.notes}</p>
            </>
          )}
        </div>
        <div className="stack gap-16">
          <div className="stat">
            <div className="stat-label">CA signé</div>
            <div className="stat-value">{formatEUR(stats.signed)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Devis</div>
            <div className="stat-value">{stats.count}</div>
          </div>
        </div>
      </div>

      <div className="card mb-24">
        <h3 className="mb-16">Historique des devis &amp; factures</h3>
        {devis.length ? (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr><th>Numéro</th><th>Objet</th><th>Date</th><th>Statut</th><th className="num">TTC</th></tr>
              </thead>
              <tbody>
                {devis.map((d) => (
                  <tr key={d.id} onClick={() => navigate(`/devis/${d.id}`)} style={{ cursor: 'pointer' }}>
                    <td className="mono"><b>{d.number}</b></td>
                    <td className="dim">{d.title}</td>
                    <td className="dim">{formatDate(d.createdAt)}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td className="num mono">{formatEUR(devisTotals(d, settings).totalTTC)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty"><Icon name="file" size={40} />Aucun devis pour ce client.</div>
        )}
      </div>

      <div className="card">
        <div className="row between mb-16">
          <h3>Photos &amp; documents joints</h3>
          <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> Ajouter
          </button>
          <input ref={fileRef} type="file" multiple hidden onChange={onUpload} />
        </div>
        {photoDocs.length > 0 && (
          <div className="photo-grid mb-16">
            {photoDocs.map((d) => (
              <div className="photo-thumb" key={d.id}>
                <BlobImage blobId={d.blobId} />
                <button className="rm" onClick={() => removeDoc(d.id, d.blobId)}><Icon name="x" size={14} /></button>
              </div>
            ))}
          </div>
        )}
        {otherDocs.length > 0 ? (
          <div className="stack gap-8">
            {otherDocs.map((d) => (
              <div className="row between card" key={d.id} style={{ padding: 12 }}>
                <span className="row gap-8"><Icon name="file" size={18} />{d.name}</span>
                <button className="btn btn-sm btn-ghost btn-danger" onClick={() => removeDoc(d.id, d.blobId)}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          photoDocs.length === 0 && <div className="empty"><Icon name="image" size={40} />Aucun document.</div>
        )}
      </div>

      <div className="mt-24">
        <button className="btn btn-ghost btn-danger" onClick={() => setConfirmDel(true)}>
          <Icon name="trash" size={16} /> Supprimer ce client
        </button>
      </div>

      {editing && form && (
        <Modal
          title="Modifier le client"
          onClose={() => setEditing(false)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(false)}>Annuler</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const { id: _id, createdAt: _c, documents: _d, ...rest } = form;
                  void _id; void _c; void _d;
                  updateClient(client.id, rest);
                  setEditing(false);
                  toast('Client mis à jour');
                }}
              >
                <Icon name="check" size={18} /> Enregistrer
              </button>
            </>
          }
        >
          <ClientForm form={form} setForm={(f) => setForm({ ...client, ...f })} />
        </Modal>
      )}

      {confirmDel && (
        <Confirm
          title="Supprimer le client"
          message="Cette action supprime aussi tous les devis associés. Elle est irréversible."
          confirmLabel="Supprimer"
          danger
          onConfirm={() => { deleteClient(client.id); navigate('/clients'); }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="section-title">{label}</div>
      <div className="dim">{value || '—'}</div>
    </div>
  );
}

