import { CreatorSearch } from "../../components/creator-search";

export default function CreatorsPage() {
  return (
    <div className="page subpage">
      <p className="eyebrow">02 / Creators</p>
      <h1>
        The people.
        <br />
        The <span className="highlight">record.</span>
      </h1>
      <p className="hero-copy">
        Look past the following. Inspect the evidence.
      </p>
      <CreatorSearch />
      <div className="section-heading">
        <h2>Creator registry</h2>
        <span className="tag">No records yet</span>
      </div>
      <div className="empty-state panel">
        <h3>No creators have been indexed.</h3>
        <p>
          Linked identity, locked stake, and scored-call coverage will appear
          for each creator.
        </p>
      </div>
    </div>
  );
}
