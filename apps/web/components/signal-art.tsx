export function SignalArt({
  kind,
}: {
  kind: "identity" | "stake" | "execution";
}) {
  return (
    <div className={`x-signal-art x-art-${kind}`} aria-hidden="true">
      {kind === "identity" ? (
        <div className="x-orbital-system">
          <i />
          <i />
          <i />
          <b>𝕏</b>
          <span />
          <span />
        </div>
      ) : kind === "stake" ? (
        <div className="x-vault-system">
          <div className="x-vault-cube">
            {["front", "back", "left", "right", "top", "bottom"].map((face) => (
              <i className={`x-cube-${face}`} key={face}>
                <span>↗</span>
              </i>
            ))}
          </div>
        </div>
      ) : (
        <svg viewBox="0 0 320 180">
          <title>Signal paths</title>
          <path
            className="x-route-track"
            d="M10 130 H80 Q110 130 110 100 V65 Q110 35 140 35 H210 Q240 35 240 65 V115 Q240 145 270 145 H310"
          />
          <path
            className="x-route-track"
            d="M10 55 H70 Q95 55 95 85 V110 Q95 135 125 135 H175 Q205 135 205 105 V60 Q205 35 235 35 H310"
          />
          <path
            className="x-route-signal"
            d="M10 130 H80 Q110 130 110 100 V65 Q110 35 140 35 H210 Q240 35 240 65 V115 Q240 145 270 145 H310"
          />
          <path
            className="x-route-signal x-route-second"
            d="M10 55 H70 Q95 55 95 85 V110 Q95 135 125 135 H175 Q205 135 205 105 V60 Q205 35 235 35 H310"
          />
          <circle cx="10" cy="130" r="4" />
          <circle cx="310" cy="145" r="4" />
        </svg>
      )}
    </div>
  );
}
