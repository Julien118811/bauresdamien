import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore, newLine } from '../store/store';
import type { AiAnalysis, DevisLine, DevisPhoto, Prestation } from '../types';
import { devisTotals, lineTotals, profitability, round2 } from '../lib/calc';
import { formatEUR, formatPct, formatDate, toDateInput, uid } from '../lib/format';
import { putBlob, deleteBlob, getBlob } from '../lib/db';
import { analyzePhoto } from '../lib/ai';
import { downloadDevisPdf } from '../lib/pdf';
import { Icon } from '../components/Icon';
import { BlobImage } from '../components/BlobImage';
import { Confirm, Modal, StatusBadge, useToast } from '../components/ui';
import { PhotoAnnotator } from '../components/PhotoAnnotator';
import { SignaturePad } from '../components/SignaturePad';

const PHOTO_CATEGORIES = ['Avant', 'Après', 'Zone rouge', 'Détail', 'Accès', 'Déchets'];

export function DevisEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const devis = useStore((s) => s.devis.find((d) => d.id === id));
  const client = useStore((s) => s.clients.find((c) => c.id === devis?.clientId));
  const settings = useStore((s) => s.settings);
  const prestations = useStore((s) => s.prestations);
  const updateDevis = useStore((s) => s.updateDevis);
  const deleteDevis = useStore((s) => s.deleteDevis);
  const setDevisStatus = useStore((s) => s.setDevisStatus);
  const duplicateDevis = useStore((s) => s.duplicateDevis);

  const [showPresta, setShowPresta] = useState(false);
  const [annotating, setAnnotating] = useState<DevisPhoto | null>(null);
  const [signing, setSigning] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [aiResult, setAiResult] = useState<AiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const captureRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => (devis ? devisTotals(devis, settings) : null), [devis, settings]);
  const profit = useMemo(() => (devis ? profitability(devis, settings) : null), [devis, settings]);

  if (!devis || !client || !totals || !profit) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="file" size={46} />
          Devis introuvable.
          <button className="btn" onClick={() => navigate('/devis')}>Retour aux devis</button>
        </div>
      </div>
    );
  }

  const locked = !!devis.signature?.locked;

  /* ---------- Lignes ---------- */
  const setLine = (lineId: string, patch: Partial<DevisLine>) =>
    updateDevis(devis.id, {
      lines: devis.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
    });
  const addLine = () => updateDevis(devis.id, { lines: [...devis.lines, newLine()] });
  const removeLine = (lineId: string) =>
    updateDevis(devis.id, { lines: devis.lines.filter((l) => l.id !== lineId) });

  const addFromPrestation = (p: Prestation) => {
    updateDevis(devis.id, {
      lines: [
        ...devis.lines,
        newLine({
          prestationId: p.id,
          description: p.label,
          unit: p.unit,
          unitPrice: p.unitPrice,
          unitCost: p.unitCost,
          vatRate: p.vatRate,
        }),
      ],
    });
    setShowPresta(false);
    toast(`« ${p.label} » ajoutée`);
  };

  /* ---------- Site ---------- */
  const setSite = (patch: Partial<typeof devis.site>) =>
    updateDevis(devis.id, { site: { ...devis.site, ...patch } });

  /* ---------- Photos ---------- */
  const onPhotos = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    const photos = [...devis.photos];
    for (const f of list) {
      const blobId = await putBlob(f);
      photos.push({
        id: uid(),
        blobId,
        caption: '',
        category: 'Avant',
        annotations: [],
        createdAt: new Date().toISOString(),
      });
    }
    updateDevis(devis.id, { photos });
    toast(`${list.length} photo(s) ajoutée(s)`);
  };

  const setPhoto = (photoId: string, patch: Partial<DevisPhoto>) =>
    updateDevis(devis.id, {
      photos: devis.photos.map((p) => (p.id === photoId ? { ...p, ...patch } : p)),
    });

  const removePhoto = async (photo: DevisPhoto) => {
    await deleteBlob(photo.blobId);
    if (photo.annotatedBlobId) await deleteBlob(photo.annotatedBlobId);
    updateDevis(devis.id, { photos: devis.photos.filter((p) => p.id !== photo.id) });
  };

  /* ---------- IA ---------- */
  const runAi = async (photo: DevisPhoto) => {
    const blob = await getBlob(photo.blobId);
    if (!blob) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await analyzePhoto({ imageBlob: blob, site: devis.site, prestations });
      setAiResult(res);
    } catch {
      toast('Analyse indisponible');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAi = (res: AiAnalysis) => {
    const lines = [
      ...devis.lines.filter((l) => l.description.trim()),
      ...res.suggestedLines.map((l) => ({ ...l, id: uid() })),
    ];
    updateDevis(devis.id, {
      lines,
      site: {
        ...devis.site,
        floorArea: devis.site.floorArea || res.estimatedAreaM2,
        volume: devis.site.volume || res.estimatedVolumeM3,
      },
      notes: devis.notes || res.damageDescription,
    });
    setAiResult(null);
    toast('Proposition IA appliquée');
  };

  /* ---------- Actions ---------- */
  const doPdf = async () => {
    setPdfLoading(true);
    try {
      await downloadDevisPdf(devis, client, settings);
    } finally {
      setPdfLoading(false);
    }
  };

  const secureLink = `https://devis.rfd.app/d/${devis.id}`;
  const sendText =
    `Bonjour, voici votre devis ${devis.number} (${formatEUR(totals.totalTTC)} TTC) : ${secureLink}`;

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          <span className="crumb link" onClick={() => navigate('/devis')}>← Devis</span>
          <div className="row gap-12">
            <h1 className="mono">{devis.number}</h1>
            <StatusBadge status={devis.status} />
            {locked && <span className="pill" style={{ color: 'var(--amber)' }}>🔒 Verrouillé</span>}
          </div>
        </div>
        <div className="row gap-8 row-wrap">
          <button className="btn" onClick={doPdf} disabled={pdfLoading}>
            <Icon name="download" size={18} /> {pdfLoading ? 'Génération…' : 'PDF'}
          </button>
          <button className="btn" onClick={() => setSending(true)}>
            <Icon name="send" size={18} /> Envoyer
          </button>
          {!locked && (
            <button className="btn btn-primary" onClick={() => setSigning(true)}>
              <Icon name="pen" size={18} /> Signer
            </button>
          )}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 340px', alignItems: 'start' }}>
        {/* -------- Colonne principale -------- */}
        <div className="stack gap-16" style={{ minWidth: 0 }}>
          {/* En-tête devis */}
          <div className="card">
            <div className="form-grid">
              <label className="field full">
                Objet de l’intervention
                <input value={devis.title} disabled={locked}
                  onChange={(e) => updateDevis(devis.id, { title: e.target.value })} />
              </label>
              <div className="field">
                Client
                <div className="row between card" style={{ padding: 10 }}>
                  <span className="row gap-8"><Icon name="user" size={16} />
                    {[client.firstName, client.lastName].filter(Boolean).join(' ') || client.company}
                  </span>
                  <span className="link small" onClick={() => navigate(`/clients/${client.id}`)}>Fiche</span>
                </div>
              </div>
              <label className="field">
                Date de validité
                <input type="date" value={toDateInput(devis.validUntil)} disabled={locked}
                  onChange={(e) => updateDevis(devis.id, { validUntil: new Date(e.target.value).toISOString() })} />
              </label>
            </div>
          </div>

          {/* Paramètres du chantier */}
          <div className="card">
            <h3 className="mb-16">Paramètres du chantier</h3>
            <div className="grid grid-4">
              <label className="field">Surface au sol (m²)
                <input type="number" min={0} value={devis.site.floorArea || ''} disabled={locked}
                  onChange={(e) => setSite({ floorArea: Number(e.target.value) })} /></label>
              <label className="field">Hauteur (m)
                <input type="number" min={0} step={0.1} value={devis.site.ceilingHeight || ''} disabled={locked}
                  onChange={(e) => setSite({ ceilingHeight: Number(e.target.value) })} /></label>
              <label className="field">Volume (m³)
                <input value={round2(devis.site.floorArea * devis.site.ceilingHeight) || 0} readOnly
                  style={{ background: 'var(--bg)' }} /></label>
              <label className="field">Trajet A/R (km)
                <input type="number" min={0} value={devis.site.roundTripKm || ''} disabled={locked}
                  onChange={(e) => setSite({ roundTripKm: Number(e.target.value) })} /></label>
            </div>
          </div>

          {/* Lignes du devis */}
          <div className="card">
            <div className="row between mb-16 row-wrap gap-8">
              <h3>Lignes du devis</h3>
              {!locked && (
                <div className="row gap-8">
                  <button className="btn btn-sm" onClick={() => setShowPresta(true)}>
                    <Icon name="layers" size={16} /> Depuis la bibliothèque
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={addLine}>
                    <Icon name="plus" size={16} /> Ligne
                  </button>
                </div>
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 200 }}>Désignation</th>
                    <th className="num">Qté</th>
                    <th>Unité</th>
                    <th className="num">PU HT</th>
                    <th className="num">Coût U.</th>
                    <th className="num">Rem. %</th>
                    <th className="num">TVA</th>
                    <th className="num">Total HT</th>
                    <th className="num">Marge</th>
                    {!locked && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {devis.lines.map((l) => {
                    const t = lineTotals(l);
                    return (
                      <tr key={l.id}>
                        <td><input className="cell" value={l.description} disabled={locked}
                          onChange={(e) => setLine(l.id, { description: e.target.value })} placeholder="Description…" /></td>
                        <td className="num"><input className="cell num" type="number" min={0} value={l.quantity} disabled={locked}
                          onChange={(e) => setLine(l.id, { quantity: Number(e.target.value) })} /></td>
                        <td><input className="cell" style={{ width: 62 }} value={l.unit} disabled={locked}
                          onChange={(e) => setLine(l.id, { unit: e.target.value })} /></td>
                        <td className="num"><input className="cell num" type="number" min={0} step={0.01} value={l.unitPrice} disabled={locked}
                          onChange={(e) => setLine(l.id, { unitPrice: Number(e.target.value) })} /></td>
                        <td className="num"><input className="cell num" type="number" min={0} step={0.01} value={l.unitCost} disabled={locked}
                          onChange={(e) => setLine(l.id, { unitCost: Number(e.target.value) })} /></td>
                        <td className="num"><input className="cell num" type="number" min={0} max={100} value={l.discountPct} disabled={locked}
                          onChange={(e) => setLine(l.id, { discountPct: Number(e.target.value) })} /></td>
                        <td className="num"><input className="cell num" type="number" min={0} value={l.vatRate} disabled={locked}
                          onChange={(e) => setLine(l.id, { vatRate: Number(e.target.value) })} /></td>
                        <td className="num mono"><b>{formatEUR(t.sellHT)}</b></td>
                        <td className="num mono" style={{ color: t.marginHT >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {formatEUR(t.marginHT)}
                        </td>
                        {!locked && (
                          <td>
                            <button className="btn btn-icon btn-ghost btn-danger btn-sm" onClick={() => removeLine(l.id)}>
                              <Icon name="trash" size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {devis.lines.length === 0 && (
                    <tr><td colSpan={10} className="center muted" style={{ padding: 24 }}>Aucune ligne. Ajoutez-en une.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Photos */}
          <div className="card">
            <div className="row between mb-16 row-wrap gap-8">
              <h3>Photos du chantier</h3>
              {!locked && (
                <div className="row gap-8">
                  <button className="btn btn-sm" onClick={() => captureRef.current?.click()}>
                    <Icon name="camera" size={16} /> Prendre une photo
                  </button>
                  <button className="btn btn-sm" onClick={() => importRef.current?.click()}>
                    <Icon name="upload" size={16} /> Importer
                  </button>
                  <input ref={captureRef} type="file" accept="image/*" capture="environment" hidden
                    onChange={(e) => { onPhotos(e.target.files); e.target.value = ''; }} />
                  <input ref={importRef} type="file" accept="image/*" multiple hidden
                    onChange={(e) => { onPhotos(e.target.files); e.target.value = ''; }} />
                </div>
              )}
            </div>
            {devis.photos.length ? (
              <div className="photo-grid">
                {devis.photos.map((p) => (
                  <div key={p.id} className="stack gap-6">
                    <div className="photo-thumb" onClick={() => !locked && setAnnotating(p)}>
                      <BlobImage blobId={p.annotatedBlobId ?? p.blobId} />
                      <span className="cat">{p.category}</span>
                      {!locked && (
                        <button className="rm" onClick={(e) => { e.stopPropagation(); removePhoto(p); }}>
                          <Icon name="x" size={14} />
                        </button>
                      )}
                    </div>
                    {!locked && (
                      <>
                        <select value={p.category} onChange={(e) => setPhoto(p.id, { category: e.target.value })}
                          style={{ padding: '5px 8px', fontSize: 13 }}>
                          {PHOTO_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                        <div className="row gap-6">
                          <button className="btn btn-sm btn-ghost" style={{ flex: 1 }} onClick={() => setAnnotating(p)}>
                            <Icon name="pen" size={14} /> Annoter
                          </button>
                          <button className="btn btn-sm btn-ghost" style={{ flex: 1 }} onClick={() => runAi(p)}>
                            <Icon name="sparkles" size={14} /> IA
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty"><Icon name="camera" size={40} />Aucune photo. Prenez ou importez des photos du chantier.</div>
            )}
          </div>

          {/* Notes */}
          <div className="card">
            <h3 className="mb-16">Conditions particulières / notes</h3>
            <textarea value={devis.notes} disabled={locked} placeholder="Précisions affichées sur le devis…"
              onChange={(e) => updateDevis(devis.id, { notes: e.target.value })} />
          </div>
        </div>

        {/* -------- Colonne latérale -------- */}
        <div className="stack gap-16">
          {/* Totaux */}
          <div className="card">
            <h3 className="mb-16">Récapitulatif</h3>
            <Row label="Total HT" value={formatEUR(totals.totalHT)} />
            {settings.vatEnabled
              ? totals.vatByRate.filter((v) => v.amount > 0).map((v) => (
                  <Row key={v.rate} label={`TVA ${v.rate} %`} value={formatEUR(v.amount)} dim />
                ))
              : <div className="small muted mb-16">TVA non applicable (art. 293 B du CGI)</div>}
            <div className="divider" />
            <div className="row between">
              <b>Total TTC</b>
              <b style={{ fontSize: '1.3rem', color: 'var(--accent)' }}>{formatEUR(totals.totalTTC)}</b>
            </div>
          </div>

          {/* Rentabilité */}
          <div className="card">
            <h3 className="mb-16">Simulateur de rentabilité</h3>
            <Row label="CA facturé HT" value={formatEUR(profit.invoiceHT)} />
            <Row label="Coûts variables" value={`- ${formatEUR(profit.variableCosts)}`} dim />
            <Row label="Marge brute" value={formatEUR(profit.grossMargin)} />
            <Row label={`URSSAF (${settings.urssafRate} %)`} value={`- ${formatEUR(profit.urssafAmount)}`} dim />
            <Row label="Bénéfice net" value={formatEUR(profit.netOperatingProfit)} />
            <Row label={`Épargne (${settings.savingsRate} %)`} value={`- ${formatEUR(profit.savings)}`} dim />
            <Row label={`Matériel (${settings.workingCapitalRate} %)`} value={`- ${formatEUR(profit.workingCapital)}`} dim />
            <div className="divider" />
            <div className="row between mb-16">
              <b>Restant dans la poche</b>
              <b style={{ color: 'var(--green)' }}>{formatEUR(profit.inPocket)}</b>
            </div>
            <div className="small muted mb-16">Marge nette réelle</div>
            <div className="meter"><span style={{ width: `${Math.min(100, Math.max(0, profit.realMarginPct))}%` }} /></div>
            <div className="row between small mt-8">
              <span className="muted">{formatPct(profit.realMarginPct)}</span>
              <span className="muted">{formatEUR(profit.grossMargin)} de marge</span>
            </div>
          </div>

          {/* Signature */}
          <div className="card">
            <h3 className="mb-16">Signature</h3>
            {devis.signature ? (
              <div className="stack gap-8">
                <img src={devis.signature.dataUrl} alt="signature"
                  style={{ background: '#fff', borderRadius: 8, maxHeight: 90, objectFit: 'contain' }} />
                <div className="small muted">
                  Signé par <b>{devis.signature.signerName}</b><br />le {formatDate(devis.signature.signedAt)}
                </div>
              </div>
            ) : (
              <>
                <p className="small muted mb-16">Faites signer le client sur tablette/téléphone. Le devis sera verrouillé.</p>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setSigning(true)}>
                  <Icon name="pen" size={18} /> Faire signer
                </button>
              </>
            )}
          </div>

          {/* Suivi / statut */}
          <div className="card">
            <h3 className="mb-16">Suivi</h3>
            <div className="chips mb-16">
              {(['brouillon', 'envoye', 'accepte', 'refuse', 'facture', 'paye'] as const).map((s) => (
                <button key={s} className={`chip ${devis.status === s ? 'active' : ''}`}
                  onClick={() => setDevisStatus(devis.id, s)}>
                  {s}
                </button>
              ))}
            </div>
            <div className="section-title">Historique</div>
            <div className="stack gap-8 mt-8">
              {[...devis.history].reverse().map((h, i) => (
                <div className="row gap-8 small" key={i}>
                  <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--accent)', marginTop: 6 }} />
                  <div><div className="dim">{h.label}</div><div className="muted">{formatDate(h.at)}</div></div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions secondaires */}
          <div className="card">
            <div className="stack gap-8">
              <button className="btn btn-ghost" onClick={() => { const c = duplicateDevis(devis.id); if (c) { toast('Devis dupliqué'); navigate(`/devis/${c.id}`); } }}>
                <Icon name="copy" size={18} /> Dupliquer
              </button>
              <button className="btn btn-ghost btn-danger" onClick={() => setConfirmDel(true)}>
                <Icon name="trash" size={18} /> Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* -------- Modales -------- */}
      {showPresta && (
        <Modal title="Bibliothèque de prestations" onClose={() => setShowPresta(false)} wide>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Prestation</th><th>Catégorie</th><th>Unité</th><th className="num">PU HT</th><th></th></tr></thead>
              <tbody>
                {prestations.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.label}</b><div className="small muted">{p.description}</div></td>
                    <td><span className="pill">{p.category}</span></td>
                    <td>{p.unit}</td>
                    <td className="num mono">{formatEUR(p.unitPrice)}</td>
                    <td><button className="btn btn-sm btn-primary" onClick={() => addFromPrestation(p)}>
                      <Icon name="plus" size={15} /> Ajouter</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {annotating && (
        <PhotoAnnotator
          photo={annotating}
          onClose={() => setAnnotating(null)}
          onSave={(annotations, annotatedBlobId) => setPhoto(annotating.id, { annotations, annotatedBlobId })}
        />
      )}

      {(aiLoading || aiResult) && (
        <Modal title="Analyse IA de la photo" onClose={() => { setAiResult(null); setAiLoading(false); }} wide>
          {aiLoading && (
            <div className="empty">
              <Icon name="sparkles" size={40} style={{ color: 'var(--accent)' }} />
              Analyse de la photo en cours…
            </div>
          )}
          {aiResult && <AiPanel res={aiResult} onApply={() => applyAi(aiResult)} />}
        </Modal>
      )}

      {signing && (
        <SignaturePad
          defaultName={[client.firstName, client.lastName].filter(Boolean).join(' ')}
          onClose={() => setSigning(false)}
          onSign={(dataUrl, signerName) => {
            updateDevis(devis.id, {
              signature: { dataUrl, signerName, signedAt: new Date().toISOString(), locked: true },
            });
            if (devis.status === 'brouillon' || devis.status === 'envoye') setDevisStatus(devis.id, 'accepte');
            toast('Devis signé et verrouillé');
          }}
        />
      )}

      {sending && (
        <Modal title="Envoyer le devis" onClose={() => setSending(false)}>
          <p className="dim mb-16">Générez le PDF puis transmettez-le au client via le canal de votre choix.</p>
          <div className="stack gap-8">
            <button className="btn" onClick={doPdf}><Icon name="download" size={18} /> Télécharger le PDF</button>
            <a className="btn" href={`mailto:${client.email}?subject=${encodeURIComponent(`Devis ${devis.number}`)}&body=${encodeURIComponent(sendText)}`}>
              <Icon name="mail" size={18} /> Email {client.email && `(${client.email})`}
            </a>
            <a className="btn" href={`sms:${client.phone}?&body=${encodeURIComponent(sendText)}`}>
              <Icon name="message" size={18} /> SMS
            </a>
            <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(sendText)}`} target="_blank" rel="noreferrer">
              <Icon name="message" size={18} /> WhatsApp
            </a>
            <button className="btn" onClick={() => { navigator.clipboard?.writeText(secureLink); toast('Lien copié'); }}>
              <Icon name="link" size={18} /> Copier le lien sécurisé
            </button>
          </div>
          {devis.status === 'brouillon' && (
            <button className="btn btn-primary mt-16" style={{ width: '100%' }}
              onClick={() => { setDevisStatus(devis.id, 'envoye'); setSending(false); toast('Marqué comme envoyé'); }}>
              <Icon name="check" size={18} /> Marquer comme envoyé
            </button>
          )}
        </Modal>
      )}

      {confirmDel && (
        <Confirm title="Supprimer le devis" message="Cette action est irréversible." confirmLabel="Supprimer" danger
          onConfirm={() => { deleteDevis(devis.id); navigate('/devis'); }}
          onCancel={() => setConfirmDel(false)} />
      )}
    </>
  );
}

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="row between" style={{ marginBottom: 8 }}>
      <span className={dim ? 'muted small' : 'dim'}>{label}</span>
      <span className={`mono ${dim ? 'muted small' : ''}`}>{value}</span>
    </div>
  );
}

function AiPanel({ res, onApply }: { res: AiAnalysis; onApply: () => void }) {
  return (
    <div className="stack gap-16">
      <div className="row gap-8 row-wrap">
        <span className="pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          Contamination : {res.contaminationLevel}
        </span>
        <span className="pill">Surface ≈ {res.estimatedAreaM2} m²</span>
        <span className="pill">Volume ≈ {res.estimatedVolumeM3} m³</span>
        <span className="pill">Temps ≈ {res.estimatedTimeH} h</span>
        <span className="pill">Prix conseillé ≈ {formatEUR(res.suggestedPriceHT)} HT</span>
      </div>
      <div>
        <div className="section-title">Description des dégâts</div>
        <p className="dim">{res.damageDescription}</p>
      </div>
      <div className="grid grid-2">
        <AiList title="Travaux recommandés" items={res.recommendedWork} />
        <AiList title="Matériel conseillé" items={res.recommendedEquipment} />
        <AiList title="EPI" items={res.ppe} />
        <AiList title="Produits" items={res.products} />
      </div>
      <div>
        <div className="section-title mb-16">Lignes proposées</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Désignation</th><th className="num">Qté</th><th>Unité</th><th className="num">PU HT</th></tr></thead>
            <tbody>
              {res.suggestedLines.map((l, i) => (
                <tr key={i}><td>{l.description}</td><td className="num">{l.quantity}</td><td>{l.unit}</td>
                  <td className="num mono">{formatEUR(l.unitPrice)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="row between">
        <span className="small muted">Vous pourrez tout modifier après application.</span>
        <button className="btn btn-primary" onClick={onApply}><Icon name="check" size={18} /> Appliquer au devis</button>
      </div>
    </div>
  );
}

function AiList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="section-title">{title}</div>
      <ul className="dim small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}
