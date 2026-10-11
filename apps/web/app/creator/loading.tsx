export default function Loading() {
  return (
    <div className="dashboard-empty" role="status">
      <span className="empty-symbol" aria-hidden="true">
        ◇
      </span>
      <h3>Opening the creator studio…</h3>
      <p>
        Preparing the page. Identity and stake status require verified data.
      </p>
    </div>
  );
}
