export function CreateMarketPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Create market</h1>
        <p className="lede">
          Form fields mirror your{" "}
          <code className="inline-code">create_football_market</code> instruction.
          Submit will call the program once wired.
        </p>
      </div>

      <form className="card form-card" onSubmit={(e) => e.preventDefault()}>
        <label className="field">
          <span>Question</span>
          <input type="text" placeholder="Will the home team win?" disabled />
        </label>
        <div className="grid two">
          <label className="field">
            <span>Home team</span>
            <input type="text" placeholder="Team A" disabled />
          </label>
          <label className="field">
            <span>Away team</span>
            <input type="text" placeholder="Team B" disabled />
          </label>
        </div>
        <label className="field">
          <span>Game key (unique id)</span>
          <input type="text" placeholder="GAME_001" disabled />
        </label>
        <div className="grid three">
          <label className="field">
            <span>Start (unix)</span>
            <input type="text" placeholder="0" disabled />
          </label>
          <label className="field">
            <span>End (unix)</span>
            <input type="text" placeholder="0" disabled />
          </label>
          <label className="field">
            <span>Resolution (unix)</span>
            <input type="text" placeholder="0" disabled />
          </label>
        </div>
        <label className="field">
          <span>Oracle feed (32 bytes)</span>
          <input type="text" placeholder="Set from Switchboard feed" disabled />
        </label>
        <div className="form-actions">
          <button type="submit" className="button primary" disabled>
            Create market
          </button>
        </div>
      </form>
    </div>
  );
}
