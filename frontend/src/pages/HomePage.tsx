import { Link } from "react-router-dom";

/** Placeholder rows until markets are fetched from chain. */
const PLACEHOLDER_MARKETS = [
  { gameKey: "DEMO_001", title: "Example: Cup final", status: "Open" as const },
  { gameKey: "DEMO_002", title: "Example: Derby", status: "Open" as const },
];

export function HomePage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Markets</h1>
        <p className="lede">
          Browse open football prediction markets. Data will load from your
          program once the client is connected.
        </p>
      </div>

      <section className="card">
        <div className="card-header">
          <h2>All markets</h2>
          <Link to="/create" className="button primary">
            Create market
          </Link>
        </div>
        <ul className="market-list">
          {PLACEHOLDER_MARKETS.map((m) => (
            <li key={m.gameKey}>
              <Link to={`/markets/${m.gameKey}`} className="market-row">
                <span className="market-title">{m.title}</span>
                <span className="market-meta">{m.gameKey}</span>
                <span className="pill">{m.status}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="placeholder-note">
          Placeholder list only — replace with program accounts / indexer query.
        </p>
      </section>
    </div>
  );
}
