"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Crosshair, ExternalLink, Layers, MapPin, Navigation, Save, Search } from "lucide-react";

type SchoolLocation = {
  id: number;
  school: string;
  address?: string;
  neighborhood?: string;
  locationType?: string;
  locationSource?: string;
  latitude?: number;
  longitude?: number;
  mapStatus?: string;
  locationAccuracy?: "Confirmada" | "Aproximada" | "Pendente" | string;
  geocodeLabel?: string;
  googleMapsUrl?: string;
  remoteAccess?: { account?: string };
  [key: string]: unknown;
};
type GeocodeCandidate = {
  latitude: number;
  longitude: number;
  label: string;
  source: string;
  confidence?: "Alta" | "Média" | "Baixa";
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const hasPoint = (school: SchoolLocation) =>
  Number.isFinite(Number(school.latitude)) &&
  Number.isFinite(Number(school.longitude));

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export default function LocationModule({
  schools,
  onSaved,
}: {
  schools: SchoolLocation[];
  onSaved: (school: SchoolLocation) => void;
}) {
  const [query, setQuery] = useState("");
  const [neighborhood, setNeighborhood] = useState("Todos");
  const [locationType, setLocationType] = useState("Todos");
  const [positionStatus, setPositionStatus] = useState("Todos");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<SchoolLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolvingGoogle, setResolvingGoogle] = useState(false);
  const [geocodeCandidates, setGeocodeCandidates] = useState<GeocodeCandidate[]>([]);
  const [message, setMessage] = useState("");
  const [mapStyle, setMapStyle] = useState<"street" | "satellite">("street");
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  const neighborhoods = useMemo(
    () =>
      Array.from(
        new Set(schools.map((school) => school.neighborhood).filter(Boolean)),
      ).sort((a, b) => String(a).localeCompare(String(b))),
    [schools],
  );
  const locationTypes = useMemo(
    () =>
      Array.from(
        new Set(schools.map((school) => school.locationType).filter(Boolean)),
      ).sort((a, b) => String(a).localeCompare(String(b))),
    [schools],
  );
  const filtered = useMemo(() => {
    const term = normalize(query).trim();
    return schools.filter((school) => {
      const matchesQuery =
        !term ||
        normalize(
          `${school.remoteAccess?.account || ""} ${school.school} ${school.address || ""} ${school.neighborhood || ""}`,
        ).includes(term);
      const matchesNeighborhood =
        neighborhood === "Todos" || school.neighborhood === neighborhood;
      const matchesType =
        locationType === "Todos" || school.locationType === locationType;
      const matchesPosition =
        positionStatus === "Todos" ||
        (positionStatus === "No mapa" && hasPoint(school)) ||
        (positionStatus === "Pendente" && !hasPoint(school)) ||
        positionStatus === "Confirmadas" ||
        positionStatus === "Aproximadas";
      const matchesQuality =
        positionStatus !== "Confirmadas" && positionStatus !== "Aproximadas"
          ? true
          : positionStatus === "Confirmadas"
            ? school.locationAccuracy === "Confirmada"
            : hasPoint(school) && school.locationAccuracy !== "Confirmada";
      return matchesQuery && matchesNeighborhood && matchesType && matchesPosition && matchesQuality;
    });
  }, [schools, query, neighborhood, locationType, positionStatus]);

  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !mapElement.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(mapElement.current, {
        center: [-12.2664, -38.9663],
        zoom: 11,
        zoomControl: true,
      });
      tileLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
        subdomains: "abc",
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 100);
    });
    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    tileLayerRef.current = mapStyle === "satellite"
      ? L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          maxZoom: 19,
          attribution: "Esri, Maxar, Earthstar Geographics e comunidade GIS",
        })
      : L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
          subdomains: "abc",
        });
    tileLayerRef.current.addTo(mapRef.current);
    tileLayerRef.current.bringToBack();
  }, [mapReady, mapStyle]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    layerRef.current.clearLayers();
    filtered.filter(hasPoint).forEach((school) => {
      const point: [number, number] = [
        Number(school.latitude),
        Number(school.longitude),
      ];
      const marker = L.circleMarker(point, {
        radius: school.id === selectedId ? 9 : 6,
        color: school.id === selectedId ? "#173f35" : "#ffffff",
        weight: 2,
        fillColor:
          school.id === selectedId
            ? "#173f35"
            : school.locationAccuracy === "Confirmada"
              ? "#25836d"
              : "#df8a2d",
        fillOpacity: 1,
      }).addTo(layerRef.current);
      marker.bindTooltip(
        `<strong>${escapeHtml(school.school)}</strong><br>${escapeHtml(school.neighborhood || "Bairro não informado")}`,
      );
      marker.on("click", () => selectSchool(school));
    });

    geocodeCandidates.forEach((candidate, index) => {
      const point: [number, number] = [candidate.latitude, candidate.longitude];
      const marker = L.marker(point, {
        zIndexOffset: 1200 - index,
        icon: L.divIcon({
          className: "geocode-pin-wrap",
          html: `<div class="geocode-pin${index === 0 ? " best" : ""}"><span>${index + 1}</span></div>`,
          iconSize: [42, 50],
          iconAnchor: [21, 47],
          tooltipAnchor: [0, -42],
        }),
      }).addTo(layerRef.current);
      marker.bindTooltip(
        `<strong>Resultado ${index + 1} · Precisão ${candidate.confidence || "aproximada"}</strong><br>${escapeHtml(candidate.label || "Localização encontrada")}<br><small>Clique para selecionar</small>`,
        { direction: "top", opacity: 1 },
      );
      marker.on("click", (event: any) => {
        L.DomEvent.stopPropagation(event);
        useCandidate(candidate);
      });
    });

    if (form && hasPoint(form) && geocodeCandidates.length === 0) {
      L.marker([Number(form.latitude), Number(form.longitude)], {
        zIndexOffset: 1400,
        icon: L.divIcon({
          className: "selected-pin-wrap",
          html: '<div class="selected-map-pin"><span></span></div>',
          iconSize: [46, 54],
          iconAnchor: [23, 51],
          tooltipAnchor: [0, -46],
        }),
      })
        .addTo(layerRef.current)
        .bindTooltip(`<strong>${escapeHtml(form.school)}</strong><br>Ponto selecionado para salvar`, { direction: "top", opacity: 1 });
    }

  }, [filtered, selectedId, mapReady, geocodeCandidates, form?.latitude, form?.longitude]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const handleClick = (event: any) => {
      if (!form) return;
      setForm((current) =>
        current
          ? {
              ...current,
              latitude: Number(event.latlng.lat.toFixed(7)),
              longitude: Number(event.latlng.lng.toFixed(7)),
              locationAccuracy: "Confirmada",
              mapStatus: "Posição confirmada manualmente no mapa",
            }
          : current,
      );
      setMessage("Ponto selecionado. Salve para confirmar a localização.");
    };
    mapRef.current.on("click", handleClick);
    return () => mapRef.current?.off("click", handleClick);
  }, [form?.id, mapReady]);

  function focusMap(latitude: number, longitude: number, zoom = 17) {
    mapElement.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      mapRef.current?.invalidateSize();
      mapRef.current?.setView([latitude, longitude], zoom, { animate: true });
    }, 180);
  }

  function selectSchool(school: SchoolLocation) {
    setSelectedId(school.id);
    setForm({ ...school });
    setMessage("");
    setGeocodeCandidates([]);
    if (hasPoint(school)) {
      focusMap(Number(school.latitude), Number(school.longitude), 17);
      return;
    }
    if (String(school.address || school.school).trim()) void locateSchool(school, true);
  }

  useEffect(() => {
    if (!query.trim() || filtered.length !== 1) return;
    const timer = window.setTimeout(() => selectSchool(filtered[0]), 500);
    return () => window.clearTimeout(timer);
  }, [query, filtered.length, filtered[0]?.id]);

  async function save() {
    if (!form) return;
    if (!String(form.address || "").trim()) {
      setMessage("Informe o endereço da unidade.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/school-location", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          address: form.address,
          neighborhood: form.neighborhood,
          locationType: form.locationType,
          latitude: form.latitude,
          longitude: form.longitude,
          mapStatus: form.mapStatus,
          locationAccuracy: form.locationAccuracy,
          geocodeLabel: form.geocodeLabel,
          googleMapsUrl: form.googleMapsUrl,
        }),
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error.error || "Não foi possível salvar a localização.");
      }
      const saved = (await response.json()) as SchoolLocation;
      setForm(saved);
      onSaved(saved);
      setMessage("Endereço e ponto no mapa salvos.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a localização.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function locateSchool(target: SchoolLocation, automatic = false) {
    const searchText = String(target.address || target.school || "").trim();
    if (!searchText) {
      setMessage("Informe o endereço ou o nome da unidade antes de localizar.");
      return;
    }
    setLocating(true);
    setMessage("Localizando endereço...");
    try {
      const params = new URLSearchParams({
        q: searchText,
        school: String(target.school || ""),
        neighborhood: String(target.neighborhood || ""),
      });
      const response = await fetch(`/api/geocode?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as {
        candidates?: GeocodeCandidate[];
        error?: string;
      };
      if (!response.ok || !result.candidates?.length)
        throw new Error(
          result.error || "Endereço não encontrado. Informe rua, número e bairro.",
        );
      setGeocodeCandidates(result.candidates);
      setSelectedId(target.id);
      setForm({ ...target });
      if (mapRef.current && leafletRef.current) {
        const bounds = leafletRef.current.latLngBounds(
          result.candidates.map((candidate) => [candidate.latitude, candidate.longitude]),
        );
        mapRef.current.fitBounds(bounds, { padding: [70, 70], maxZoom: 17 });
      }
      mapElement.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setMessage(automatic
        ? `${result.candidates.length} possível(is) localização(ões) encontrada(s) para esta escola. Escolha o marcador correto.`
        : `${result.candidates.length} localização(ões) encontrada(s). Escolha um marcador numerado no mapa.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "A consulta não foi concluída. Marque o ponto manualmente no mapa.",
      );
    } finally {
      setLocating(false);
    }
  }

  async function locateByAddress() {
    if (form) await locateSchool(form);
  }

  function openGoogleMaps() {
    if (!form) return;
    const search = [form.school, form.address, form.neighborhood, "Feira de Santana", "Bahia"]
      .filter(Boolean)
      .join(", ");
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search)}`, "_blank", "noopener,noreferrer");
  }

  async function useGoogleMapsLocation() {
    const url = String(form?.googleMapsUrl || "").trim();
    if (!form || !url) {
      setMessage("Cole o link compartilhado pelo Google Maps.");
      return;
    }
    setResolvingGoogle(true);
    setMessage("Lendo o ponto confirmado no Google Maps...");
    try {
      const response = await fetch("/api/google-maps-location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        latitude?: number;
        longitude?: number;
        resolvedUrl?: string;
        error?: string;
      };
      if (!response.ok || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude))
        throw new Error(result.error || "Não foi possível importar esse ponto.");
      const latitude = Number(result.latitude);
      const longitude = Number(result.longitude);
      setForm((current) => current ? {
        ...current,
        latitude,
        longitude,
        googleMapsUrl: result.resolvedUrl || url,
        geocodeLabel: "Ponto confirmado pelo Google Maps",
        locationAccuracy: "Confirmada",
        mapStatus: "Localização confirmada pelo Google Maps",
      } : current);
      setGeocodeCandidates([]);
      focusMap(latitude, longitude, 19);
      setMessage("Ponto do Google Maps importado. Clique em Salvar para confirmar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível importar esse ponto.");
    } finally {
      setResolvingGoogle(false);
    }
  }

  function useCandidate(candidate: GeocodeCandidate) {
    setForm((current) =>
      current
        ? {
            ...current,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
            geocodeLabel: candidate.label,
            locationAccuracy: "Aproximada",
            mapStatus: "Localização escolhida na busca — confirmar",
          }
        : current,
    );
    setGeocodeCandidates([]);
    focusMap(candidate.latitude, candidate.longitude, 18);
    setMessage("Ponto escolhido. Confira no mapa e salve a alteração.");
  }

  const mappedCount = schools.filter(hasPoint).length;
  const addressedCount = schools.filter((school) => school.address?.trim()).length;

  return (
    <section className="page location-page">
      <div className="location-summary">
        <div><span>Unidades</span><b>{schools.length}</b></div>
        <div><span>Com endereço</span><b>{addressedCount}</b></div>
        <div><span>Marcadas no mapa</span><b>{mappedCount}</b></div>
        <div><span>Pendentes de ponto</span><b>{schools.length - mappedCount}</b></div>
      </div>

      <div className="location-filters panel">
        <label className="location-search">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por Número de Conta, unidade ou endereço..."
          />
        </label>
        <label>Bairro / distrito
          <select value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}>
            <option>Todos</option>
            {neighborhoods.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>Tipo
          <select value={locationType} onChange={(event) => setLocationType(event.target.value)}>
            <option>Todos</option>
            {locationTypes.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>Posição
          <select value={positionStatus} onChange={(event) => setPositionStatus(event.target.value)}>
            <option>Todos</option>
            <option>No mapa</option>
            <option>Confirmadas</option>
            <option>Aproximadas</option>
            <option>Pendente</option>
          </select>
        </label>
      </div>

      <div className="location-workspace">
        <aside className="location-list panel">
          <div className="location-list-head">
            <b>{filtered.length} unidade(s)</b>
            <span>{filtered.filter(hasPoint).length} com ponto</span>
          </div>
          <div>
            {filtered.map((school) => (
              <button
                key={school.id}
                className={school.id === selectedId ? "active" : ""}
                onClick={() => selectSchool(school)}
              >
                <i className={hasPoint(school) ? (school.locationAccuracy === "Confirmada" ? "mapped" : "approximate") : "pending"}><MapPin /></i>
                <span>
                  <small>Conta {school.remoteAccess?.account || "Não informado"}</small>
                  <b>{school.school}</b>
                  <em>{school.neighborhood || "Bairro não informado"}</em>
                  {hasPoint(school) && <em className="map-quality">{school.locationAccuracy === "Confirmada" ? "Ponto confirmado" : "Ponto aproximado"}</em>}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="location-map-panel panel">
          <div className="map-toolbar">
            <div>
              <b>Mapa das unidades</b>
              <span>Clique no mapa para posicionar a unidade selecionada.</span>
              <small className="map-layer-note">Ruas atualizadas: OpenStreetMap · Satélite: Esri · Pontos confirmados podem usar coordenadas do Google Maps</small>
            </div>
            <div className="map-toolbar-actions">
              <span><MapPin /> {filtered.filter(hasPoint).length} ponto(s)</span>
              <div className="basemap-toggle" aria-label="Tipo de mapa">
                <button type="button" className={mapStyle === "street" ? "active" : ""} onClick={() => setMapStyle("street")}><Layers /> Mapa atualizado</button>
                <button type="button" className={mapStyle === "satellite" ? "active" : ""} onClick={() => setMapStyle("satellite")}><Layers /> Satélite</button>
              </div>
            </div>
          </div>
          <div ref={mapElement} className="school-map" aria-label="Mapa das unidades escolares" />
          {geocodeCandidates.length > 0 && (
            <div className="map-candidate-banner" role="status">
              <MapPin />
              <span>
                <b>{geocodeCandidates.length} resultado(s) encontrado(s)</b>
                Clique em um marcador numerado para escolher o endereço correto.
              </span>
            </div>
          )}
        </div>

        <aside className="location-editor panel">
          {form ? (
            <>
              <div className="location-editor-head">
                <Building2 />
                <div><span>EDITAR LOCALIZAÇÃO</span><b>{form.school}</b></div>
                <button type="button" className="primary save-at-top" disabled={saving} onClick={() => void save()}>
                  <Save /> {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
              <label>Endereço
                <textarea rows={3} value={String(form.address || "")} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              </label>
              <label>Bairro / distrito
                <input value={String(form.neighborhood || "")} onChange={(event) => setForm({ ...form, neighborhood: event.target.value })} />
              </label>
              <label>Classificação
                <select value={String(form.locationType || "A confirmar")} onChange={(event) => setForm({ ...form, locationType: event.target.value })}>
                  <option>Centro</option><option>Bairro</option><option>Distrito</option><option>A confirmar</option>
                </select>
              </label>
              <div className="coordinate-grid">
                <label>Latitude<input type="number" step="0.0000001" value={form.latitude ?? ""} onChange={(event) => setForm({ ...form, latitude: event.target.value ? Number(event.target.value) : undefined })} /></label>
                <label>Longitude<input type="number" step="0.0000001" value={form.longitude ?? ""} onChange={(event) => setForm({ ...form, longitude: event.target.value ? Number(event.target.value) : undefined })} /></label>
              </div>
              <label>Status da localização
                <select value={String(form.locationAccuracy || "Pendente")} onChange={(event) => setForm({ ...form, locationAccuracy: event.target.value, mapStatus: event.target.value === "Confirmada" ? "Localização confirmada pelo usuário" : event.target.value === "Aproximada" ? "Localização aproximada — confirmar" : "Pendente de confirmação" })}>
                  <option>Confirmada</option><option>Aproximada</option><option>Pendente</option>
                </select>
              </label>
              {form.mapStatus && <p className="map-status-detail">{String(form.mapStatus)}</p>}
              <p className="location-source">Fonte do endereço: {String(form.locationSource || "Informação cadastrada no sistema")}</p>
              <button className="position-help" type="button" onClick={() => mapRef.current?.setView(hasPoint(form) ? [Number(form.latitude), Number(form.longitude)] : [-12.2664, -38.9663], hasPoint(form) ? 16 : 12)}>
                <Crosshair /> Ajustar ponto no mapa
              </button>
              <button className="position-help" type="button" disabled={locating} onClick={() => void locateByAddress()}>
                <Search /> {locating ? "Buscando no mapa..." : "Buscar endereço no mapa"}
              </button>
              <div className="google-location-box">
                <div className="google-location-head">
                  <div><Navigation /><span><b>Conferir no Google Maps</b><small>Referência externa opcional, sem necessidade de chave.</small></span></div>
                  <button type="button" onClick={openGoogleMaps}><ExternalLink /> Pesquisar</button>
                </div>
                <label>Link compartilhado do Google Maps
                  <input
                    type="url"
                    value={String(form.googleMapsUrl || "")}
                    onChange={(event) => setForm({ ...form, googleMapsUrl: event.target.value })}
                    placeholder="https://maps.app.goo.gl/..."
                  />
                </label>
                <button className="google-import-button" type="button" disabled={resolvingGoogle} onClick={() => void useGoogleMapsLocation()}>
                  <MapPin /> {resolvingGoogle ? "Importando ponto..." : "Usar este ponto no mapa"}
                </button>
              </div>
              {geocodeCandidates.length > 0 && (
                <div className="geocode-results">
                  <b>Escolha o endereço correto</b>
                  {geocodeCandidates.map((candidate, index) => (
                    <button key={`${candidate.latitude}-${candidate.longitude}-${index}`} type="button" onClick={() => useCandidate(candidate)}>
                      <MapPin />
                      <span><b>{index + 1}. {candidate.label || "Localização encontrada"}</b><small>Precisão {candidate.confidence || "aproximada"} · {candidate.source}</small></span>
                    </button>
                  ))}
                </div>
              )}
              {message && <p className="location-message">{message}</p>}
              <button className="primary location-save" disabled={saving} onClick={() => void save()}>
                <Save /> {saving ? "Salvando..." : "Salvar localização"}
              </button>
            </>
          ) : (
            <div className="location-empty"><MapPin /><b>Selecione uma unidade</b><p>Edite o endereço e marque a posição exata no mapa.</p></div>
          )}
        </aside>
      </div>
    </section>
  );
}
