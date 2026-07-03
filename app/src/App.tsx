import { useState } from "react";
import { HeroDemo } from "./views/HeroDemo.tsx";
import { InstitutionView } from "./views/InstitutionView.tsx";
import { CounterpartyView } from "./views/CounterpartyView.tsx";
import { AuditorView } from "./views/AuditorView.tsx";
import { PublicExplorerView } from "./views/PublicExplorerView.tsx";

type ViewId = "live" | "institution" | "counterparty" | "auditor" | "explorer";

interface NavEntry {
  id: ViewId;
  label: string;
  hint: string;
}

const NAV: NavEntry[] = [
  { id: "live", label: "Live Demo", hint: "Prove" },
  { id: "institution", label: "Institution", hint: "Settle" },
  { id: "counterparty", label: "Counterparty", hint: "Receive" },
  { id: "auditor", label: "Auditor", hint: "Disclose" },
  { id: "explorer", label: "Public Explorer", hint: "Observe" },
];

const VIEWS: Record<ViewId, () => JSX.Element> = {
  live: HeroDemo,
  institution: InstitutionView,
  counterparty: CounterpartyView,
  auditor: AuditorView,
  explorer: PublicExplorerView,
};

export function App() {
  const [view, setView] = useState<ViewId>("live");
  const ActiveView = VIEWS[view];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__mark">
            <span className="sidebar__aperture-glyph" aria-hidden="true" />
            <span className="sidebar__name">Aperture</span>
          </div>
          <p className="sidebar__tagline">
            Open by default, private when needed, auditable on demand.
          </p>
          <span className="net-badge"><span className="net-badge__dot" /> Stellar testnet · live</span>
        </div>

        <nav className="sidebar__nav" aria-label="Primary">
          <div className="sidebar__section-label">Personas</div>
          {NAV.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="nav-item"
              aria-current={view === entry.id ? "page" : undefined}
              onClick={() => setView(entry.id)}
            >
              <span>{entry.label}</span>
              <span className="nav-item__hint">{entry.hint}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          Compliant selective-disclosure ZK primitive for Stellar / Soroban.
          <br />
          Live on Stellar testnet · real proofs.
        </div>
      </aside>

      <main className="content">
        <ActiveView />
      </main>
    </div>
  );
}
