export default function Loading() {
  return (
    <div className="dashboard-empty" role="status">
      <span className="empty-symbol" aria-hidden="true">
        ◫
      </span>
      <h3>Opening your workspace…</h3>
      <p>Preparing the page. Live data availability is shown separately.</p>
    </div>
  );
}
