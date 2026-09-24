const headers = { "cache-control": "no-store" };

const allowedHost = (hostname: string) =>
  hostname === "google.com" ||
  hostname.endsWith(".google.com") ||
  hostname === "goo.gl" ||
  hostname === "maps.app.goo.gl";

function coordinatesFromUrl(value: string) {
  const decoded = decodeURIComponent(value);
  const patterns = [
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
  ];
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match) return { latitude: Number(match[1]), longitude: Number(match[2]) };
  }
  try {
    const url = new URL(decoded);
    for (const key of ["q", "query", "ll"]) {
      const match = url.searchParams.get(key)?.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
      if (match) return { latitude: Number(match[1]), longitude: Number(match[2]) };
    }
  } catch {}
  return null;
}

const inFeiraDeSantana = (latitude: number, longitude: number) =>
  latitude >= -12.8 && latitude <= -11.7 && longitude >= -39.5 && longitude <= -38.4;

export async function POST(request: Request) {
  const input = (await request.json().catch(() => ({}))) as { url?: string };
  const rawUrl = String(input.url || "").trim();
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return Response.json({ error: "Cole um link válido do Google Maps." }, { status: 400, headers });
  }
  if (current.protocol !== "https:" || !allowedHost(current.hostname))
    return Response.json({ error: "Use somente um link compartilhado pelo Google Maps." }, { status: 400, headers });

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const found = coordinatesFromUrl(current.toString());
    if (found) {
      if (!inFeiraDeSantana(found.latitude, found.longitude))
        return Response.json({ error: "O ponto do link fica fora da região de Feira de Santana." }, { status: 400, headers });
      return Response.json({ ...found, resolvedUrl: current.toString() }, { headers });
    }
    try {
      const response = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 VigiAccessSchoolMapper/1.0" },
      });
      const location = response.headers.get("location");
      if (!location) break;
      const next = new URL(location, current);
      if (next.protocol !== "https:" || !allowedHost(next.hostname)) break;
      current = next;
    } catch {
      break;
    }
  }

  return Response.json(
    { error: "Não encontrei as coordenadas nesse link. No Google Maps, marque o ponto e use Compartilhar > Copiar link." },
    { status: 422, headers },
  );
}
