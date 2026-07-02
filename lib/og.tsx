import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT =
  "Island Layout Studio — a browser-based urban island planning studio";

// Colored chips echoing the app's land-use legend.
const USES: { label: string; color: string }[] = [
  { label: "Residential", color: "#e6c79c" },
  { label: "Commercial", color: "#ff7f6b" },
  { label: "Roads", color: "#c9ced6" },
  { label: "Green space", color: "#5bbf5b" },
  { label: "Sports", color: "#37d4d4" },
];

/** Shared 1200x630 social card used by both the OG and Twitter image routes. */
export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#e2e8f0",
          fontFamily: "sans-serif",
          backgroundColor: "#0b1220",
          backgroundImage:
            "linear-gradient(135deg, #0b1220 0%, #0e2233 55%, #0b2a2e 100%)",
        }}
      >
        {/* top badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 54,
              height: 54,
              borderRadius: 27,
              border: "5px solid #22d3ee",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: "#22d3ee",
              }}
            />
          </div>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Satellite / Rule-based / Browser
          </div>
        </div>

        {/* title + tagline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.02,
              color: "#f8fafc",
            }}
          >
            Island Layout Studio
          </div>
          <div
            style={{
              fontSize: 34,
              color: "#a9b4c4",
              maxWidth: 950,
              lineHeight: 1.3,
            }}
          >
            Draw a boundary, sketch roads and parcels, then generate a complete
            land-use layout for Maldives-style islands.
          </div>
        </div>

        {/* land-use chips */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {USES.map((u) => (
            <div
              key={u.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 20px",
                borderRadius: 999,
                backgroundColor: "rgba(30,41,59,0.7)",
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: 26,
                color: "#e2e8f0",
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  backgroundColor: u.color,
                }}
              />
              {u.label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
