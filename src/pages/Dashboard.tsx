import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '../store/store';
import { devisTotals } from '../lib/calc';
import { formatEUR, formatEUR0, formatDate } from '../lib/format';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/ui';

export function Dashboard() {
  const devis = useStore((s) => s.devis);
  const clients = useStore((s) => s.clients);
  const settings = useStore((s) => s.settings);
  const navigate = useNavigate();

  const data = useMemo(() => {
    let signed = 0;
    let potential = 0;
    let accepted = 0;
    let refused = 0;
    const monthly = new Map<string, { ca: number; count: number }>();

    for (const d of devis) {
      const t = devisTotals(d, settings);
      if (d.status === 'accepte' || d.status === 'facture' || d.status === 'paye') {
        signed += t.totalTTC;
        accepted++;
      } else if (d.status === 'refuse') {
        refused++;
      } else {
        potential += t.totalTTC;
      }
      const key = new Date(d.createdAt).toLocaleDateString('fr-FR', {
        month: 'short',
        year: '2-digit',
      });
      const m = monthly.get(key) ?? { ca: 0, count: 0 };
      m.count++;
      if (d.status === 'accepte' || d.status === 'facture' || d.status === 'paye')
        m.ca += t.totalTTC;
      monthly.set(key, m);
    }

    const months = [...monthly.entries()].map(([name, v]) => ({ name, ...v })).slice(-8);
    return { signed, potential, accepted, refused, months };
  }, [devis, settings]);

  const conversionRate = devis.length
    ? Math.round((data.accepted / devis.length) * 100)
    : 0;

  const pieData = [
    { name: 'Acceptés', value: data.accepted, color: 'var(--green)' },
    { name: 'Refusés', value: data.refused, color: 'var(--red)' },
    {
      name: 'En cours',
      value: devis.length - data.accepted - data.refused,
      color: 'var(--blue)',
    },
  ].filter((d) => d.value > 0);

  const recent = [...devis]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 6);

  const clientName = (id: string) => {
    const c = clients.find((x) => x.id === id);
    if (!c) return 'Client supprimé';
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.company || '—';
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          <span className="crumb">Vue d’ensemble</span>
          <h1>Tableau de bord</h1>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/devis')}>
          <Icon name="plus" size={18} /> Nouveau devis
        </button>
      </div>

      <div className="grid grid-4 mb-24">
        <Stat icon="file" label="Devis créés" value={String(devis.length)} sub={`${clients.length} clients`} />
        <Stat icon="check" label="Devis acceptés" value={String(data.accepted)} sub={`Taux ${conversionRate} %`} />
        <Stat icon="trendingDown" label="Devis refusés" value={String(data.refused)} />
        <Stat icon="euro" label="CA signé (TTC)" value={formatEUR0(data.signed)} sub="Accepté / facturé" />
      </div>

      <div className="grid grid-3 mb-24">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="row between mb-16">
            <h3>Chiffre d’affaires mensuel</h3>
            <span className="pill">Signé TTC</span>
          </div>
          {data.months.length ? (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={data.months} margin={{ left: -18, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="ca" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-mute)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-mute)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [formatEUR(v), 'CA signé']}
                />
                <Area type="monotone" dataKey="ca" stroke="var(--accent)" strokeWidth={2.5} fill="url(#ca)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Empty>Aucune donnée pour le moment.</Empty>
          )}
        </div>

        <div className="card">
          <h3 className="mb-16">Répartition</h3>
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={52} outerRadius={82} paddingAngle={3}>
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={d.color} stroke="var(--surface)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Empty>Pas encore de devis.</Empty>
          )}
          <div className="stack gap-6 mt-8">
            {pieData.map((d) => (
              <div className="row between small" key={d.name}>
                <span className="row gap-8">
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
                  {d.name}
                </span>
                <b>{d.value}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-3 mb-24">
        <div className="card">
          <h3 className="mb-16">CA potentiel</h3>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{formatEUR0(data.potential)}</div>
          <p className="muted small mt-8">Devis en attente de réponse client.</p>
        </div>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 className="mb-16">Volume de devis</h3>
          {data.months.length ? (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={data.months} margin={{ left: -22, right: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-mute)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--text-mute)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'devis']} />
                <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty>Aucune donnée.</Empty>
          )}
        </div>
      </div>

      <div className="card">
        <div className="row between mb-16">
          <h3>Historique des interventions</h3>
          <span className="link" onClick={() => navigate('/devis')}>
            Tout voir
          </span>
        </div>
        {recent.length ? (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Client</th>
                  <th>Objet</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th className="num">Montant TTC</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id} onClick={() => navigate(`/devis/${d.id}`)} style={{ cursor: 'pointer' }}>
                    <td className="mono"><b>{d.number}</b></td>
                    <td>{clientName(d.clientId)}</td>
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
          <Empty>Aucune intervention enregistrée. Créez votre premier devis.</Empty>
        )}
      </div>
    </>
  );
}

function Stat({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-ico"><Icon name={icon} /></span>
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

const tooltipStyle = {
  background: 'var(--bg-elev)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 13,
} as const;
