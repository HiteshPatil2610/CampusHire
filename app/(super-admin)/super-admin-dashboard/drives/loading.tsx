export default function Loading() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 24, width: 220 }} />
        <div
          className="skeleton"
          style={{ height: 14, width: 420, marginTop: 8 }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 320px) 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div>
          {[0, 1, 2, 3].map((row) => (
            <div className="card" key={row} style={{ marginBottom: 10 }}>
              <div className="skeleton" style={{ height: 14, width: "60%" }} />
              <div
                className="skeleton"
                style={{ height: 12, width: "80%", marginTop: 8 }}
              />
              <div
                className="skeleton"
                style={{ height: 10, width: "50%", marginTop: 8 }}
              />
            </div>
          ))}
        </div>

        <div>
          {[0, 1, 2].map((section) => (
            <div className="card" key={section} style={{ marginBottom: 16 }}>
              <div className="skeleton" style={{ height: 16, width: "40%" }} />
              <div
                className="skeleton"
                style={{ height: 12, width: "70%", marginTop: 12 }}
              />
              <div
                className="skeleton"
                style={{ height: 12, width: "55%", marginTop: 8 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
