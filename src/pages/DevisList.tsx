import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { devisTotals } from '../lib/calc';
import { formatDate, formatEUR } from '../lib/format';
import type { DevisStatus } from '../types';
import { Icon } from '../components/Icon';
import { Modal, StatusBadge, STATUS_LABEL, useToast } from '../components/ui';

const COLUMNS: { status: DevisStatus; label: string }[] = [
  { status: 'brouillon', label: 'Brouillon' },
  { status: 'envoye', label: 'En attente' },
  { status: 'accepte', label: 'Accepté' },
  { status: 'refuse', label: 'Refusé' },
  { status: 'facture', label: 'Facturé' },
  { status: 'paye', label: 'Payé' },
];

export function DevisList() {
  const devis = useStore((s) => s.devis);
  const clients = useStore((s) => s.clients);
  const settings = useStore((s) => s.settings);
  const createDevis = useStore((s) => s.createDevis);
  const setDevisStatus = useStore((s) => s.setDevisStatus);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [view, setView] = useState<'board' | 'list'>('board');
  const [picker, setPicker] = useState(false);

  const clientName = (id: string) => {
    const c = clients.find((x) => x.id === id);
    return c ? [c.firstName, c.lastName].filter(Boolean).join(' ') || c.company : '—';
  };

  const grouped = useMemo(() => {
    const map: Record<DevisStatus, typeof devis> = {
      brouillon: [], envoye: [], accepte: [], refuse: [], facture: [], paye: [],
    };
    for (const d of devis) map[d.status].push(d);
    return map;
  }, [devis]);

  // Relances : devis envoyés dont la validité approche / est dépassée.
  const relances = useMemo(
    () =>
      devis.filter((d) => {
        if (d.status !== 'envoye') return false;
        const days = (+new Date(d.validUntil) - Date.now()) / 86400000;
        return days < 5;
      }),
    [devis],
  );

  const start = (clientId: string) => {
    const d = createDevis(clientId);
    setPicker(false);
    navigate(`/devis/${d.id}`);
  };

  const advance = (id: string, status: DevisStatus) => {
    setDevisStatus(id, status);
    toast(`Statut : ${STATUS_LABEL[status]}`);
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          <span className="crumb">{devis.length} devis</span>
          <h1>Devis &amp; suivi</h1>
        </div>
        <div className="row gap-8">
          <div className="chips">
            <button className={`chip ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')}>
              <Icon name="layers" size={16} /> Tableau
            </button>
            <button className={`chip ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>
              <Icon name="file" size={16} /> Liste
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => setPicker(true)}>
            <Icon name="plus" size={18} /> Nouveau devis
          </button>
        </div>
      </div>

      {relances.length > 0 && (
        <div className="card mb-16" style={{ borderColor: 'var(--amber)', background: 'rgba(251,191,36,0.08)' }}>
          <div className="row gap-12">
            <Icon name="bell" style={{ color: 'var(--amber)' }} />
            <div>
              <b>{relances.length} relance(s) à prévoir</b>
              <div className="small muted">
                Devis en attente dont la validité expire bientôt :{' '}
                {relances.map((d) => d.number).join(', ')}.
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'board' ? (
        <div className="kanban">
          {COLUMNS.map((col) => (
            <div className="kanban-col" key={col.status}>
              <h4>
                <span>{col.label}</span>
                <span className="pill">{grouped[col.status].length}</span>
              </h4>
              {grouped[col.status].map((d) => (
                <div className="kanban-card" key={d.id} onClick={() => navigate(`/devis/${d.id}`)}>
                  <div className="row between">
                    <b className="mono small">{d.number}</b>
                    <span className="small mono">{formatEUR(devisTotals(d, settings).totalTTC)}</span>
                  </div>
                  <div className="small dim mt-8">{clientName(d.clientId)}</div>
                  <div className="small muted">{d.title}</div>
                  <div className="row gap-6 mt-8" onClick={(e) => e.stopPropagation()}>
                    {nextStatuses(d.status).map((s) => (
                      <button key={s} className="btn btn-sm btn-ghost" onClick={() => advance(d.id, s)}>
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {grouped[col.status].length === 0 && (
                <div className="small muted center" style={{ padding: '18px 0' }}>—</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          {devis.length ? (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Numéro</th><th>Client</th><th>Objet</th><th>Créé</th><th>Validité</th>
                    <th>Statut</th><th className="num">TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {[...devis]
                    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
                    .map((d) => (
                      <tr key={d.id} onClick={() => navigate(`/devis/${d.id}`)} style={{ cursor: 'pointer' }}>
                        <td className="mono"><b>{d.number}</b></td>
                        <td>{clientName(d.clientId)}</td>
                        <td className="dim">{d.title}</td>
                        <td className="dim">{formatDate(d.createdAt)}</td>
                        <td className="dim">{formatDate(d.validUntil)}</td>
                        <td><StatusBadge status={d.status} /></td>
                        <td className="num mono">{formatEUR(devisTotals(d, settings).totalTTC)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty"><Icon name="file" size={46} />Aucun devis. Créez-en un pour démarrer.</div>
          )}
        </div>
      )}

      {picker && (
        <Modal title="Choisir un client" onClose={() => setPicker(false)}>
          {clients.length ? (
            <div className="stack gap-8">
              {clients.map((c) => (
                <button
                  key={c.id}
                  className="btn btn-ghost between"
                  style={{ justifyContent: 'space-between' }}
                  onClick={() => start(c.id)}
                >
                  <span className="row gap-8"><Icon name="user" size={18} />
                    {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.company}
                  </span>
                  <Icon name="chevronRight" size={18} />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty">
              <Icon name="users" size={40} />
              Créez d’abord un client.
              <button className="btn btn-primary" onClick={() => { setPicker(false); navigate('/clients'); }}>
                Aller aux clients
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function nextStatuses(status: DevisStatus): DevisStatus[] {
  switch (status) {
    case 'brouillon': return ['envoye'];
    case 'envoye': return ['accepte', 'refuse'];
    case 'accepte': return ['facture'];
    case 'facture': return ['paye'];
    default: return [];
  }
}
