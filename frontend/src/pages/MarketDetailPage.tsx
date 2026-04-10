import { Link, useParams } from "react-router-dom";

export function MarketDetailPage() {
  const { gameKey } = useParams<{ gameKey: string }>();

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/" className="back-link">
          ← Markets
        </Link>
        <h1>Market</h1>
        <p className="lede">
          Game key: <code className="inline-code">{gameKey ?? "—"}</code>
        </p>
      </div>

      <div className="grid two">
        <section className="card">
          <h2>Match</h2>
          <dl className="kv">
            <dt>Question</dt>
            <dd>—</dd>
            <dt>Home</dt>
            <dd>—</dd>
            <dt>Away</dt>
            <dd>—</dd>
            <dt>Status</dt>
            <dd>—</dd>
          </dl>
        </section>

        <section className="card">
          <h2>Pools</h2>
          <dl className="kv">
            <dt>Yes / Home</dt>
            <dd>—</dd>
            <dt>No / Away</dt>
            <dd>—</dd>
            <dt>Draw</dt>
            <dd>—</dd>
          </dl>
        </section>
      </div>

      <section className="card">
        <h2>Actions</h2>
        <p className="placeholder-note">
          Place bet, resolve (authority), claim, and collect fees will connect
          here with Anchor + wallet.
        </p>
        <div className="action-row">
          <button type="button" className="button" disabled>
            Place bet
          </button>
          <button type="button" className="button" disabled>
            Claim winnings
          </button>
        </div>
      </section>
    </div>
  );
}
