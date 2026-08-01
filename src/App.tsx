import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store/store';
import { Icon } from './components/Icon';
import { Dashboard } from './pages/Dashboard';
import { Clients } from './pages/Clients';
import { ClientDetail } from './pages/ClientDetail';
import { DevisList } from './pages/DevisList';
import { DevisEditor } from './pages/DevisEditor';
import { Prestations } from './pages/Prestations';
import { Settings } from './pages/Settings';

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: 'dashboard', end: true },
  { to: '/clients', label: 'Clients', icon: 'users' },
  { to: '/devis', label: 'Devis & suivi', icon: 'file' },
  { to: '/prestations', label: 'Prestations', icon: 'layers' },
  { to: '/parametres', label: 'Paramètres', icon: 'settings' },
];

export default function App() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const accent = useStore((s) => s.settings.accentColor);
  const logo = useStore((s) => s.settings.logoDataUrl);

  // Applique le thème + l'accent personnalisé au document.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    if (accent) {
      document.documentElement.style.setProperty('--accent', accent);
      document.documentElement.style.setProperty('--accent-soft', hexToSoft(accent));
    }
  }, [accent]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src={logo || '/logo.svg'} alt="RFD" />
          <div>
            <div className="brand-name">RFD Devis</div>
            <div className="brand-sub">Décontamination</div>
          </div>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name={n.icon} className="ico" />
            {n.label}
          </NavLink>
        ))}
        <div className="sidebar-spacer" />
        <button className="nav-item" onClick={toggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="ico" />
          {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
        </button>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/devis" element={<DevisList />} />
          <Route path="/devis/:id" element={<DevisEditor />} />
          <Route path="/prestations" element={<Prestations />} />
          <Route path="/parametres" element={<Settings />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const location = useLocation();
  const is = (to: string, end?: boolean) =>
    end ? location.pathname === to : location.pathname.startsWith(to) && to !== '/';
  return (
    <nav className="bottomnav">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} className={is(n.to, n.end) ? 'active' : ''}>
          <Icon name={n.icon} className="ico" />
          {n.label.split(' ')[0]}
        </NavLink>
      ))}
    </nav>
  );
}

function hexToSoft(hex: string): string {
  const m = hex.replace('#', '');
  if (m.length !== 6) return 'rgba(255,106,43,0.14)';
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.14)`;
}
