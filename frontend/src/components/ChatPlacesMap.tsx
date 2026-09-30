import { useMemo, useState } from "react";

export type ChatPlacePin = {
  name: string;
  address?: string | null;
  rating?: number | null;
  maps_url?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function mapsSearchUrl(places: ChatPlacePin[]): string {
  const withCoords = places.filter(
    (p) => typeof p.lat === "number" && typeof p.lng === "number",
  );
  if (withCoords.length >= 1) {
    const first = withCoords[0];
    if (typeof first.lat === "number" && typeof first.lng === "number") {
      return `https://www.google.com/maps/search/?api=1&query=${first.lat}%2C${first.lng}`;
    }
  }
  const name = places[0]?.name;
  const addr = places[0]?.address;
  const q = [name, addr].filter(Boolean).join(" ");
  return q
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    : "https://www.google.com/maps";
}

function embedSrc(places: ChatPlacePin[]): string | null {
  const withCoords = places.filter(
    (p) =>
      typeof p.lat === "number" &&
      typeof p.lng === "number" &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng),
  );
  if (withCoords.length) {
    const lat =
      withCoords.reduce((s, p) => s + (p.lat as number), 0) / withCoords.length;
    const lng =
      withCoords.reduce((s, p) => s + (p.lng as number), 0) / withCoords.length;
    return `https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`;
  }
  const q = places[0]?.name || places[0]?.address;
  if (!q) return null;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`;
}

/**
 * Embedded map + pin links for place-list chat replies.
 */
export function ChatPlacesMap({
  places,
  apiBase,
}: {
  places: ChatPlacePin[];
  apiBase?: string;
}) {
  const pins = useMemo(
    () => (places || []).filter((p) => (p.name || "").trim()),
    [places],
  );
  const src = useMemo(() => embedSrc(pins), [pins]);
  const openUrl = useMemo(() => mapsSearchUrl(pins), [pins]);
  const staticUrl = useMemo(() => {
    if (!apiBase) return null;
    const coords = pins.filter(
      (p) => typeof p.lat === "number" && typeof p.lng === "number",
    );
    if (coords.length < 1) return null;
    const markers = coords
      .slice(0, 8)
      .map((p) => `${p.lat},${p.lng}`)
      .join("|");
    return `${apiBase.replace(/\/$/, "")}/public/places_map.png?markers=${encodeURIComponent(markers)}`;
  }, [apiBase, pins]);
  const [useStatic, setUseStatic] = useState(Boolean(staticUrl));

  if (!pins.length || !src) return null;

  return (
    <div className="hm-chat-map">
      <div className="hm-chat-map__frame">
        {useStatic && staticUrl ? (
          <a href={openUrl} target="_blank" rel="noopener noreferrer" className="hm-chat-map__static-link">
            <img
              src={staticUrl}
              alt="Map of recommended places"
              className="hm-chat-map__img"
              loading="lazy"
              onError={() => setUseStatic(false)}
            />
          </a>
        ) : (
          <iframe
            title="Map"
            src={src}
            className="hm-chat-map__iframe"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        )}
      </div>
      <div className="hm-chat-map__pins">
        {pins.slice(0, 6).map((p, i) => {
          const href =
            typeof p.lat === "number" && typeof p.lng === "number"
              ? `https://www.google.com/maps/search/?api=1&query=${p.lat}%2C${p.lng}`
              : p.maps_url ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  [p.name, p.address].filter(Boolean).join(" "),
                )}`;
          return (
            <a
              key={`${p.name}-${i}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="hm-chat-map__pin"
              title={p.address || p.name}
            >
              <span className="hm-chat-map__pin-idx">{i + 1}</span>
              <span className="hm-chat-map__pin-name">{p.name}</span>
              {typeof p.rating === "number" ? (
                <span className="hm-chat-map__pin-rating">★ {p.rating.toFixed(1)}</span>
              ) : null}
            </a>
          );
        })}
      </div>
      <a
        className="hm-chat-map__open"
        href={openUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open in Google Maps
      </a>
    </div>
  );
}
