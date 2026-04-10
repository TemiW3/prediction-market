export function PortfolioPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Portfolio</h1>
        <p className="lede">
          Your positions across markets will appear here after wallet connection
          and account fetching.
        </p>
      </div>

      <section className="card">
        <h2>Positions</h2>
        <p className="empty-state">No wallet connected — nothing to show yet.</p>
        <ul className="market-list muted">
          <li className="market-row static">
            <span className="market-title">Example position row</span>
            <span className="market-meta">—</span>
            <span className="pill muted">Placeholder</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
