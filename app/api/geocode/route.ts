const headers = { "cache-control": "no-store" };

type PhotonResult = {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: {
      name?: string;
      street?: string;
      locality?: string;
      district?: string;
      city?: string;
      state?: string;
      postcode?: string;
    };
  }>;
};

type Candidate = {
  latitude: number;
  longitude: number;
  label: string;
  source: string;
  confidence: "Alta" | "Média" | "Baixa";
  score: number;
};

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const usefulTokens = (value: string) =>
  normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !["rua", "avenida", "travessa", "feira", "santana", "bahia", "brasil"].includes(token));

function relevance(label: string, school: string, address: string, neighborhood: string) {
  const target = normalize(label);
  const schoolTokens = usefulTokens(school);
  const addressTokens = usefulTokens(address);
  const neighborhoodTokens = usefulTokens(neighborhood);
  const schoolHits = schoolTokens.filter((token) => target.includes(token)).length;
  const addressHits = addressTokens.filter((token) => target.includes(token)).length;
  const neighborhoodHits = neighborhoodTokens.filter((token) => target.includes(token)).length;
  return schoolHits * 5 + addressHits * 3 + neighborhoodHits * 2;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  const school = new URL(request.url).searchParams.get("school")?.trim() || "";
  const neighborhood = new URL(request.url).searchParams.get("neighborhood")?.trim() || "";
  if (query.length < 5 || query.length > 300)
    return Response.json({ error: "Informe um endereço válido." }, { status: 400, headers });

  const fullQuery = query.toLowerCase().includes("feira de santana")
    ? query
    : `${query}, Feira de Santana, Bahia, Brasil`;
  const detailedQuery = [school, query, neighborhood, "Feira de Santana", "Bahia", "Brasil"]
    .filter(Boolean)
    .join(", ");
  const candidates: Candidate[] = [];
  try {
    const photon = await fetch(
      `https://photon.komoot.io/api/?limit=10&bbox=-39.35,-12.70,-38.55,-11.80&q=${encodeURIComponent(detailedQuery)}`,
      { headers: { Accept: "application/json", "User-Agent": "VigiAccessSchoolMapper/1.0" } },
    );
    if (photon.ok) {
      const data = (await photon.json()) as PhotonResult;
      for (const result of data.features || []) {
        const context = [
          result.properties?.city,
          result.properties?.district,
          result.properties?.state,
        ]
          .filter(Boolean)
          .join(" ")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        if (
          !context.includes("feira de santana") ||
          !context.includes("bahia") ||
          !result.geometry?.coordinates
        )
          continue;
        const [longitude, latitude] = result.geometry.coordinates;
        const label = [
          result.properties?.name,
          result.properties?.street,
          result.properties?.locality,
          result.properties?.district,
          result.properties?.city,
          result.properties?.postcode,
        ]
          .filter(Boolean)
          .join(", ");
        const score = relevance(label, school, query, neighborhood);
        candidates.push({
            latitude,
            longitude,
            label,
            source: "OpenStreetMap/Photon",
            score,
            confidence: score >= 14 ? "Alta" : score >= 7 ? "Média" : "Baixa",
        });
      }
    }

    const nominatim = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&bounded=1&viewbox=-39.35,-11.80,-38.55,-12.70&q=${encodeURIComponent(fullQuery)}`,
      { headers: { Accept: "application/json", "User-Agent": "VigiAccessSchoolMapper/1.0" } },
    );
    if (nominatim.ok) {
      const results = (await nominatim.json()) as Array<{
        lat: string;
        lon: string;
        display_name?: string;
      }>;
      for (const result of results) {
        const label = result.display_name || fullQuery;
        const score = relevance(label, school, query, neighborhood);
        candidates.push({
          latitude: Number(result.lat),
          longitude: Number(result.lon),
          label,
          source: "OpenStreetMap/Nominatim",
          score,
          confidence: score >= 14 ? "Alta" : score >= 7 ? "Média" : "Baixa",
        });
      }
    }

    if (!candidates.length && school) {
      const fallbackQuery = [school, neighborhood, "Feira de Santana", "Bahia", "Brasil"].filter(Boolean).join(", ");
      const fallback = await fetch(
        `https://photon.komoot.io/api/?limit=8&bbox=-39.35,-12.70,-38.55,-11.80&q=${encodeURIComponent(fallbackQuery)}`,
        { headers: { Accept: "application/json", "User-Agent": "VigiAccessSchoolMapper/1.0" } },
      );
      if (fallback.ok) {
        const data = (await fallback.json()) as PhotonResult;
        for (const result of data.features || []) {
          if (!result.geometry?.coordinates) continue;
          const [longitude, latitude] = result.geometry.coordinates;
          const label = [result.properties?.name, result.properties?.street, result.properties?.district, result.properties?.city].filter(Boolean).join(", ");
          const score = relevance(label, school, query, neighborhood);
          candidates.push({ latitude, longitude, label, source: "OpenStreetMap/Photon", score, confidence: score >= 14 ? "Alta" : score >= 7 ? "Média" : "Baixa" });
        }
      }
    }
  } catch {
    if (!candidates.length)
      return Response.json(
        { error: "O serviço de localização está temporariamente indisponível." },
        { status: 503, headers },
      );
  }

  const unique = candidates.filter(
    (candidate, index, list) =>
      list.findIndex(
        (item) =>
          Math.abs(item.latitude - candidate.latitude) < 0.00005 &&
          Math.abs(item.longitude - candidate.longitude) < 0.00005,
      ) === index,
  ).sort((a, b) => b.score - a.score).slice(0, 8);
  if (unique.length)
    return Response.json({ candidates: unique }, { headers });

  return Response.json(
    { error: "Endereço não encontrado. Tente incluir rua, número e bairro." },
    { status: 404, headers },
  );
}
