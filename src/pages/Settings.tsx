import { useRef } from 'react';
import { useStore } from '../store/store';
import type { CompanySettings } from '../types';
import { Icon } from '../components/Icon';
import { useToast } from '../components/ui';

export function Settings() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const { toast } = useToast();
  const logoRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof CompanySettings>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const numeric = ['defaultVatRate', 'quoteCounter', 'defaultValidityDays', 'urssafRate', 'savingsRate', 'workingCapitalRate'];
      const raw = e.target.value;
      setSettings({ [k]: numeric.includes(k as string) ? Number(raw) : raw } as Partial<CompanySettings>);
    };

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setSettings({ logoDataUrl: reader.result as string }); toast('Logo mis à jour'); };
    reader.readAsDataURL(f);
  };

  const exportData = () => {
    const data = localStorage.getItem('rfd-devis-store') ?? '{}';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rfd-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Sauvegarde exportée');
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          <span className="crumb">Personnalisation</span>
          <h1>Paramètres</h1>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="mb-16">Entreprise</h3>
          <div className="form-grid">
            <label className="field full">Nom<input value={settings.name} onChange={set('name')} /></label>
            <label className="field">Forme juridique<input value={settings.legalForm} onChange={set('legalForm')} /></label>
            <label className="field">SIRET<input value={settings.siret} onChange={set('siret')} /></label>
            <label className="field full">Adresse<input value={settings.addressLine1} onChange={set('addressLine1')} /></label>
            <label className="field">Code postal<input value={settings.postalCode} onChange={set('postalCode')} /></label>
            <label className="field">Ville<input value={settings.city} onChange={set('city')} /></label>
            <label className="field">Téléphone<input value={settings.phone} onChange={set('phone')} /></label>
            <label className="field">Email<input value={settings.email} onChange={set('email')} /></label>
            <label className="field full">Site web<input value={settings.website} onChange={set('website')} /></label>
            <label className="field">IBAN<input value={settings.iban} onChange={set('iban')} /></label>
            <label className="field">BIC<input value={settings.bic} onChange={set('bic')} /></label>
          </div>
        </div>

        <div className="stack gap-16">
          <div className="card">
            <h3 className="mb-16">Identité visuelle</h3>
            <div className="row gap-16">
              <img src={settings.logoDataUrl || '/logo.svg'} alt="logo"
                style={{ width: 72, height: 72, borderRadius: 14, border: '1px solid var(--border)' }} />
              <div className="stack gap-8">
                <button className="btn btn-sm" onClick={() => logoRef.current?.click()}><Icon name="upload" size={16} /> Changer le logo</button>
                {settings.logoDataUrl && (
                  <button className="btn btn-sm btn-ghost" onClick={() => setSettings({ logoDataUrl: '' })}>Réinitialiser</button>
                )}
                <input ref={logoRef} type="file" accept="image/*" hidden onChange={onLogo} />
              </div>
            </div>
            <div className="divider" />
            <label className="field">Couleur d’accent
              <div className="row gap-8">
                <input type="color" value={settings.accentColor} onChange={set('accentColor')} style={{ width: 52, padding: 4, height: 42 }} />
                <input value={settings.accentColor} onChange={set('accentColor')} />
              </div>
            </label>
            <div className="row between mt-16">
              <span className="dim">Thème de l’interface</span>
              <button className="btn btn-sm" onClick={toggleTheme}>
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} /> {theme === 'dark' ? 'Clair' : 'Sombre'}
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-16">Numérotation &amp; validité</h3>
            <div className="form-grid">
              <label className="field">Préfixe<input value={settings.quotePrefix} onChange={set('quotePrefix')} /></label>
              <label className="field">Prochain n°<input type="number" value={settings.quoteCounter} onChange={set('quoteCounter')} /></label>
              <label className="field full">Validité par défaut (jours)<input type="number" value={settings.defaultValidityDays} onChange={set('defaultValidityDays')} /></label>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-16">TVA &amp; mentions légales</h3>
          <label className="row between mb-16" style={{ cursor: 'pointer' }}>
            <span className="dim">Assujetti à la TVA</span>
            <input type="checkbox" checked={settings.vatEnabled} style={{ width: 'auto' }}
              onChange={(e) => setSettings({ vatEnabled: e.target.checked })} />
          </label>
          <label className="field mb-16">Taux de TVA par défaut (%)
            <input type="number" value={settings.defaultVatRate} onChange={set('defaultVatRate')} disabled={!settings.vatEnabled} />
          </label>
          <label className="field mb-16">Mention légale<textarea value={settings.legalMention} onChange={set('legalMention')} /></label>
          <label className="field">Conditions générales de vente<textarea style={{ minHeight: 160 }} value={settings.cgv} onChange={set('cgv')} /></label>
        </div>

        <div className="stack gap-16">
          <div className="card">
            <h3 className="mb-16">Rentabilité (micro-entreprise)</h3>
            <p className="small muted mb-16">Paramètres du simulateur « restant dans la poche ».</p>
            <div className="form-grid">
              <label className="field">Charges URSSAF (%)<input type="number" step={0.1} value={settings.urssafRate} onChange={set('urssafRate')} /></label>
              <label className="field">Épargne sécurité (%)<input type="number" value={settings.savingsRate} onChange={set('savingsRate')} /></label>
              <label className="field full">Fonds de roulement / matériel (%)<input type="number" value={settings.workingCapitalRate} onChange={set('workingCapitalRate')} /></label>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-16">Données &amp; sauvegarde</h3>
            <p className="small muted mb-16">
              Vos données sont enregistrées automatiquement sur cet appareil (mode hors-ligne).
              Exportez une sauvegarde régulièrement.
            </p>
            <button className="btn" onClick={exportData}><Icon name="download" size={18} /> Exporter une sauvegarde (.json)</button>
          </div>
        </div>
      </div>
    </>
  );
}
