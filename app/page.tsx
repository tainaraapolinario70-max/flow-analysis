"use client";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  ChevronRight,
  CircleCheck,
  FileText,
  Gauge,
  Menu,
  MapPin,
  Network,
  Pencil,
  Plus,
  RadioTower,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  StickyNote,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { exportExcel, exportPdf, type ReportRow } from "./report-export";
import ValidationModule from "./validation-module";
import LocationModule from "./location-module";
type SecurityItem = { brand: string; model: string; status: string };
type School = {
  id: number;
  school: string;
  providers: string[];
  ips: string[];
  statuses: string[];
  serviceOrders: string[];
  observation: string;
  subnet: string;
  systemRegistered?: boolean;
  facialCount: number;
  facialModel?: string;
  turnstileCount?: number;
  pneTurnstileCount?: number;
  equipmentInfo?: string;
  remoteAccess?: {
    account: string;
    address: string;
    port: string;
    service: string;
  };
  address?: string;
  neighborhood?: string;
  locationType?: string;
  locationSource?: string;
  locationSourceName?: string;
  latitude?: number;
  longitude?: number;
  mapStatus?: string;
  locationAccuracy?: string;
  geocodeLabel?: string;
  phone?: string;
  email?: string;
  manager?: string;
  network?: { gateway: string; mask: string; notes: string };
  nvr?: SecurityItem;
  nvrQuantity?: number;
  nvrStatus?: string;
  nvrNote?: string;
  alarmCenter?: SecurityItem;
  alarmNumber?: string;
  updatedAt?: string;
};
type Observation = {
  id?: number;
  schoolId: number;
  schoolName: string;
  date: string;
  category: string;
  description: string;
  responsible: string;
  status: string;
  createdAt?: string;
};
type TrashItem = {
  id: number;
  entityType: "school" | "observation";
  entityId: string;
  title: string;
  deletedAt: string;
};
type View =
  | "dashboard"
  | "units"
  | "locations"
  | "providers"
  | "observations"
  | "validation"
  | "reports"
  | "trash"
  | "settings";
type ReportOptions = {
  network: boolean;
  security: boolean;
  provider: boolean;
  equipment: boolean;
  status: boolean;
  serviceOrder: boolean;
  observations: boolean;
  observationRange: "all" | "30" | "custom";
  start: string;
  end: string;
};
const blankSchool = (id: number): School => ({
  id,
  school: "",
  providers: [],
  ips: [],
  statuses: [],
  serviceOrders: [],
  observation: "",
  subnet: "",
  systemRegistered: false,
  facialCount: 0,
  facialModel: "",
  turnstileCount: 0,
  pneTurnstileCount: 0,
  remoteAccess: { account: "", address: "", port: "", service: "" },
  address: "",
  phone: "",
  email: "",
  manager: "",
  network: { gateway: "", mask: "", notes: "" },
  nvr: { brand: "", model: "", status: "Não informado" },
  nvrQuantity: 0,
  nvrStatus: "Não informado",
  nvrNote: "",
  alarmCenter: { brand: "", model: "", status: "Não informado" },
  alarmNumber: "",
});
const account = (s: School) =>
  s.remoteAccess?.account?.trim() || "Não informado";
const normalizeSearch = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const systemLabel = (registered: boolean) =>
  registered ? "Cadastrado no VIGI-ACCESS" : "Não cadastrado no VIGI-ACCESS";
const gateCount = (s: School) => Math.max(0, Number(s.turnstileCount) || 0),
  looseFacial = (s: School) => s.facialCount > 0 && gateCount(s) === 0;
const reportRows = (rows: School[], options?: ReportOptions): ReportRow[] =>
  rows.map((s) => ({
    school: `Conta ${account(s)} — ${s.school}`,
    system: s.systemRegistered
      ? "CADASTRADO NO VIGI-ACCESS"
      : "NÃO CADASTRADO NO VIGI-ACCESS",
    provider:
      s.providers.join("; ") || "Não informado",
    facialTotal: s.facialCount || 0,
    turnstileTotal: gateCount(s),
    turnstilePne: s.pneTurnstileCount || 0,
    pendencies: s.statuses.join("; ") || "Sem pendência",
    statuses: s.statuses.join("; ") || "Sem status",
    serviceOrders: s.serviceOrders.join("; ") || "N/D",
    ips: s.ips.join("; ") || "N/D",
    observation:
      [
        options?.security
          ? `NVR: ${s.nvrQuantity || 0} (${s.nvrStatus || s.nvr?.status || "Não informado"}); Alarme: ${s.alarmNumber || "N/D"}`
          : "",
        options?.observations ? s.observation || "Sem observação" : "",
      ]
        .filter(Boolean)
        .join(" | ") || "Não incluído",
  }));
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (v: string) =>
  v ? new Intl.DateTimeFormat("pt-BR").format(new Date(v + "T12:00:00")) : "—";
const fmtDateTime = (v?: string) =>
  v
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(v))
    : "Data não informada";
const fmtTime = (v?: string) =>
  v
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(v))
    : "horário não informado";
type AppAppearance = {
  appName: string;
  subtitle: string;
  primaryColor: string;
  sidebarColor: string;
  backgroundColor: string;
};
const defaultAppearance: AppAppearance = {
  appName: "Análise de Fluxo",
  subtitle: "Infraestrutura e VIGI-ACCESS",
  primaryColor: "#287f6a",
  sidebarColor: "#203f37",
  backgroundColor: "#cbdad4",
};
const unitStatusPresets = [
  "VALIDADO",
  "VALIDAR",
  "VALIDAR INFRA",
  "VALIDAR NOVAMENTE",
  "PENDENTE",
  "EM ANDAMENTO",
  "CONCLUÍDO",
];
export default function Home() {
  const [view, setView] = useState<View>("dashboard"),
    [menu, setMenu] = useState(false),
    [schools, setSchools] = useState<School[]>([]),
    [observations, setObservations] = useState<Observation[]>([]),
    [trashItems, setTrashItems] = useState<TrashItem[]>([]),
    [appAppearance, setAppAppearance] = useState<AppAppearance>(defaultAppearance),
    [query, setQuery] = useState(""),
    [globalQuery, setGlobalQuery] = useState(""),
    [unitStatus, setUnitStatus] = useState("Todos"),
    [unitProvider, setUnitProvider] = useState("Todos"),
    [unitSituation, setUnitSituation] = useState("Todos"),
    [unitEquipment, setUnitEquipment] = useState("Todos"),
    [selectedProvider, setSelectedProvider] = useState<string | null>(null),
    [selected, setSelected] = useState<School | null>(null),
    [unitModal, setUnitModal] = useState(false),
    [observationModal, setObservationModal] = useState(false),
    [editingObservation, setEditingObservation] = useState<Observation | null>(
      null,
    ),
    [loading, setLoading] = useState(true),
    [reportSchool, setReportSchool] = useState("all"),
    [reportOptions, setReportOptions] = useState<ReportOptions>({
      network: false,
      security: false,
      provider: true,
      equipment: true,
      status: true,
      serviceOrder: true,
      observations: false,
      observationRange: "30",
      start: "",
      end: "",
    }),
    [reportReady, setReportReady] = useState(false);
  useEffect(() => {
    Promise.all([
      fetch("/api/schools", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/records", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/trash", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([s, o, t]) => {
        setSchools(s);
        setObservations(o);
        setTrashItems(t);
      })
      .finally(() => setLoading(false));
  }, []);
  async function refreshSchools(preferred?: School, deletedId?: number) {
    try {
      const response = await fetch(`/api/schools?refresh=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      let latest = (await response.json()) as School[];
      if (deletedId)
        latest = latest.filter((school) => Number(school.id) !== deletedId);
      if (preferred) {
        const preferredId = Number(preferred.id);
        const exists = latest.some(
          (school) => Number(school.id) === preferredId,
        );
        latest = exists
          ? latest.map((school) =>
              Number(school.id) === preferredId ? preferred : school,
            )
          : [preferred, ...latest];
      }
      setSchools(latest);
    } catch {
      // A atualização otimista permanece visível se a sincronização falhar.
    }
  }
  async function refreshObservations() {
    const response = await fetch(`/api/records?refresh=${Date.now()}`, {
      cache: "no-store",
    });
    if (response.ok) setObservations(await response.json());
  }
  async function refreshTrash() {
    const response = await fetch(`/api/trash?refresh=${Date.now()}`, {
      cache: "no-store",
    });
    if (response.ok) setTrashItems(await response.json());
  }
  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((values) => {
        const next = { ...defaultAppearance, ...values };
        if (next.subtitle === "Infraestrutura e suporte")
          next.subtitle = "Infraestrutura e VIGI-ACCESS";
        setAppAppearance(next);
        const root = document.documentElement.style;
        root.setProperty("--green", next.primaryColor);
        root.setProperty("--deep", next.sidebarColor);
        root.setProperty("--bg", next.backgroundColor);
      })
      .catch(() => undefined);
  }, []);
  const providers = useMemo(() => {
    const map = new Map<string, School[]>();
    for (const school of schools)
      for (const name of school.providers || []) {
        const key = name.trim();
        if (key) map.set(key, [...(map.get(key) || []), school]);
      }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [schools]);
  const globalResults = useMemo(() => {
    const term = normalizeSearch(globalQuery).trim();
    if (term.length < 2) return [];
    const unitResults = schools
      .filter((school) =>
        normalizeSearch(
          [
            account(school),
            school.school,
            school.providers?.join(" "),
            school.ips?.join(" "),
            school.serviceOrders?.join(" "),
            school.statuses?.join(" "),
            school.facialModel,
            school.equipmentInfo,
            (school.facialCount || 0) > 0 ? "facial faciais" : "",
            gateCount(school) > 0 ? "catraca catracas" : "",
            (school.pneTurnstileCount || 0) > 0 ? "PNE" : "",
            (school.nvrQuantity || 0) > 0 ? "NVR" : "",
            school.address,
          ].join(" "),
        ).includes(term),
      )
      .map((school) => ({
        kind: "school" as const,
        title: school.school,
        detail: `Conta ${account(school)} · ${school.providers?.join(", ") || "Sem provedor"}`,
        school,
      }));
    const observationResults = observations
      .filter((observation) =>
        normalizeSearch(
          [
            observation.schoolName,
            observation.description,
            observation.category,
            observation.responsible,
            observation.status,
          ].join(" "),
        ).includes(term),
      )
      .map((observation) => ({
        kind: "observation" as const,
        title: observation.schoolName,
        detail: `${observation.category} · ${observation.description}`,
        observation,
      }));
    const providerResults = providers
      .filter(([name]) => normalizeSearch(name).includes(term))
      .map(([name, units]) => ({
        kind: "provider" as const,
        title: name,
        detail: `${units.length} unidade(s) atendida(s)`,
        provider: name,
      }));
    return [...unitResults, ...observationResults, ...providerResults].slice(
      0,
      12,
    );
  }, [globalQuery, schools, observations, providers]);
  const statusOptions = Array.from(
    new Set(schools.flatMap((s) => s.statuses)),
  ).sort();
  const filtered = schools
    .filter((s) =>
      [
        account(s),
        s.school,
        s.providers.join(" "),
        s.statuses.join(" "),
        s.facialModel,
        s.address,
        s.phone,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter((s) => unitStatus === "Todos" || s.statuses.includes(unitStatus))
    .filter(
      (s) => unitProvider === "Todos" || s.providers.includes(unitProvider),
    )
    .filter(
      (s) =>
        unitSituation === "Todos" ||
        (unitSituation === "No sistema"
          ? s.systemRegistered
          : !s.systemRegistered),
    )
    .filter(
      (s) =>
        unitEquipment === "Todos" ||
        (unitEquipment === "Com facial" && (s.facialCount || 0) > 0) ||
        (unitEquipment === "Facial avulso" && looseFacial(s)) ||
        (unitEquipment === "Mais de 1 facial avulso" &&
          looseFacial(s) &&
          (s.facialCount || 0) > 1) ||
        (unitEquipment === "Com catraca" && gateCount(s) > 0) ||
        (unitEquipment === "Com catraca PNE" &&
          (s.pneTurnstileCount || 0) > 0) ||
        (unitEquipment === "Sem facial/catraca" &&
          (s.facialCount || 0) === 0 &&
          gateCount(s) === 0 &&
          (s.pneTurnstileCount || 0) === 0),
    );
  const lastObservations = [...observations]
      .sort((a, b) =>
        (b.createdAt || b.date).localeCompare(a.createdAt || a.date),
      )
      .slice(0, 6),
    recentSchools = [...schools]
      .filter((s) => s.updatedAt)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .slice(0, 8);
  const titles: Record<View, [string, string]> = {
    dashboard: [
      "Painel de controle",
      "Visão geral das unidades, provedores e observações.",
    ],
    units: [
      "Gestão de Unidades Escolares",
      "Cadastros completos identificados pelo Número de Conta.",
    ],
    locations: [
      "Endereços e mapa",
      "Localização das unidades por bairro, distrito e ponto no mapa.",
    ],
    providers: [
      "Gestão de Provedores",
      "Fornecedores e vínculos com as unidades escolares.",
    ],
    observations: [
      "Central de Observações",
      "Eventos, manutenções, instalações e notas por unidade.",
    ],
    reports: [
      "Relatórios personalizáveis",
      "Escolha exatamente quais informações serão incluídas.",
    ],
    validation: [
      "Validação técnica",
      "Checklist de atendimento e acompanhamento das visitas.",
    ],
    trash: [
      "Lixeira do sistema",
      "Restaure registros excluídos ou remova-os definitivamente.",
    ],
    settings: ["Configurações", "Preferências gerais da aplicação."],
  };
  const nav: Array<[View, any, string]> = [
    ["dashboard", Gauge, "Painel"],
    ["units", Building2, "Unidades Escolares"],
    ["locations", MapPin, "Endereços e Mapa"],
    ["providers", Wifi, "Provedores"],
    ["observations", StickyNote, "Observações"],
    ["validation", ClipboardCheck, "Validação"],
    ["reports", FileText, "Relatórios"],
    ["trash", Trash2, "Lixeira"],
    ["settings", Settings, "Configurações"],
  ];
  async function deleteObservation(o: Observation) {
    if (!o.id || !confirm("Excluir esta observação?")) return;
    const response = await fetch(`/api/records?id=${o.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setObservations((current) => current.filter((item) => item.id !== o.id));
      void refreshTrash();
    }
  }
  async function restoreTrashItem(item: TrashItem) {
    const response = await fetch("/api/trash", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    if (!response.ok) return;
    await Promise.all([refreshSchools(), refreshObservations(), refreshTrash()]);
  }
  async function permanentlyDeleteTrashItem(item: TrashItem) {
    if (!confirm(`Excluir definitivamente “${item.title}”? Esta ação não poderá ser desfeita.`))
      return;
    const response = await fetch(`/api/trash?id=${item.id}`, {
      method: "DELETE",
    });
    if (response.ok)
      setTrashItems((current) => current.filter((entry) => entry.id !== item.id));
  }
  return (
    <div className="app-shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="logo">
          <ShieldCheck />
          <div>
            <b>{appAppearance.appName}</b>
            <span>{appAppearance.subtitle}</span>
          </div>
          <button onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <nav>
          {nav.map(([id, Icon, label]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => {
                setView(id);
                setMenu(false);
                setReportReady(false);
              }}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-total">
          <span>UNIDADES CADASTRADAS</span>
          <b>{schools.length}</b>
          <small>Identificação por Número de Conta</small>
        </div>
      </aside>
      <main>
        <header>
          <button className="menu-button" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div className="page-heading">
            <span>GESTÃO DE INFRAESTRUTURA</span>
            <h1>{titles[view][0]}</h1>
            <p>{titles[view][1]}</p>
          </div>
          <div className="global-search">
            <div className="global-search-field">
              <Search />
              <input
                value={globalQuery}
                onChange={(event) => setGlobalQuery(event.target.value)}
                placeholder="Busca geral: conta, unidade, IP, O.S., provedor..."
                aria-label="Busca geral do sistema"
              />
              {globalQuery && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setGlobalQuery("")}
                >
                  <X />
                </button>
              )}
            </div>
            {globalQuery.trim().length >= 2 && (
              <div className="global-search-results">
                {globalResults.length ? (
                  globalResults.map((result, index) => (
                    <button
                      type="button"
                      key={`${result.kind}-${index}`}
                      onClick={() => {
                        setGlobalQuery("");
                        if (result.kind === "school") {
                          setSelected(result.school);
                          setUnitModal(true);
                        } else if (result.kind === "observation") {
                          setEditingObservation(result.observation);
                          setObservationModal(true);
                        } else {
                          setSelectedProvider(result.provider);
                        }
                      }}
                    >
                      <span>
                        {result.kind === "school"
                          ? "UNIDADE"
                          : result.kind === "observation"
                            ? "OBSERVAÇÃO"
                            : "PROVEDOR"}
                      </span>
                      <div>
                        <b>{result.title}</b>
                        <small>{result.detail}</small>
                      </div>
                      <ChevronRight />
                    </button>
                  ))
                ) : (
                  <p>Nenhum resultado encontrado.</p>
                )}
              </div>
            )}
          </div>
          {view === "units" && (
            <button
              className="primary"
              onClick={() => {
                setSelected(
                  blankSchool(Math.max(0, ...schools.map((s) => s.id)) + 1),
                );
                setUnitModal(true);
              }}
            >
              <Plus />
              Nova unidade
            </button>
          )}
          {view === "observations" && (
            <button
              className="primary"
              onClick={() => {
                setEditingObservation(null);
                setObservationModal(true);
              }}
            >
              <Plus />
              Nova observação
            </button>
          )}
        </header>
        {loading ? (
          <div className="loading">Carregando dados...</div>
        ) : (
          <>
            {view === "dashboard" && (
              <section className="page">
                <div className="metrics kpi-grid">
                  <Metric
                    icon={Building2}
                    label="Total de unidades"
                    value={schools.length}
                  />
                  <Metric
                    icon={CircleCheck}
                    label="Cadastradas no VIGI-ACCESS"
                    value={schools.filter((s) => s.systemRegistered).length}
                  />
                  <Metric
                    icon={Wifi}
                    label="Provedores ativos"
                    value={providers.length}
                  />
                  <Metric
                    icon={Network}
                    label="Faciais cadastrados"
                    value={schools.reduce(
                      (n, s) => n + (s.facialCount || 0),
                      0,
                    )}
                  />
                  <Metric
                    icon={ShieldCheck}
                    label="Total de catracas"
                    value={schools.reduce((n, s) => n + gateCount(s), 0)}
                  />
                  <Metric
                    icon={StickyNote}
                    label="Observações"
                    value={observations.length}
                  />
                  <Metric
                    icon={AlertTriangle}
                    label="Não cadastradas no VIGI-ACCESS"
                    value={schools.filter((s) => !s.systemRegistered).length}
                  />
                  <Metric
                    icon={RadioTower}
                    label="Faciais avulsos"
                    value={schools.filter(looseFacial).length}
                  />
                  <Metric
                    icon={ShieldCheck}
                    label="NVRs cadastrados"
                    value={schools.reduce(
                      (total, s) => total + (s.nvrQuantity || 0),
                      0,
                    )}
                  />
                  <Metric
                    icon={FileText}
                    label="Unidades com O.S."
                    value={
                      schools.filter((s) => (s.serviceOrders || []).length > 0)
                        .length
                    }
                  />
                </div>
                <div className="dashboard-grid">
                  <Panel
                    title="Situação das unidades"
                    action="Abrir base"
                    onAction={() => setView("units")}
                  >
                    <div className="status-summary">
                      <div>
                        <span>Cadastradas no VIGI-ACCESS</span>
                        <b>
                          {schools.filter((s) => s.systemRegistered).length}
                        </b>
                      </div>
                      <div>
                        <span>Não cadastradas no VIGI-ACCESS</span>
                        <b>
                          {schools.filter((s) => !s.systemRegistered).length}
                        </b>
                      </div>
                      <div>
                        <span>Faciais avulsos</span>
                        <b>{schools.filter(looseFacial).length}</b>
                      </div>
                      <div>
                        <span>Com catraca</span>
                        <b>{schools.filter((s) => gateCount(s) > 0).length}</b>
                      </div>
                    </div>
                  </Panel>
                  <Panel
                    title="Últimas observações"
                    action="Abrir central"
                    onAction={() => setView("observations")}
                  >
                    <div className="observation-list">
                      {lastObservations.length ? (
                        lastObservations.map((o) => (
                          <button
                            key={o.id}
                            onClick={() => {
                              setEditingObservation(o);
                              setObservationModal(true);
                            }}
                          >
                            <span className="category">{o.category}</span>
                            <b>{o.schoolName}</b>
                            <p>{o.description}</p>
                            <small>
                              {fmt(o.date)} · adicionada às {fmtTime(o.createdAt)}
                            </small>
                          </button>
                        ))
                      ) : (
                        <Empty text="Nenhuma observação registrada." />
                      )}
                    </div>
                  </Panel>
                </div>
                <div className="panel dashboard-alerts">
                  <div className="panel-head">
                    <h2>Unidades editadas recentemente</h2>
                    <button onClick={() => setView("units")}>
                      Ver unidades
                      <ChevronRight />
                    </button>
                  </div>
                  <div className="recent-school-list">
                    {recentSchools.length ? (
                      recentSchools.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setSelected(s);
                            setUnitModal(true);
                          }}
                        >
                          <Pencil />
                          <div>
                            <b>Conta {account(s)}</b>
                            <span>{s.school}</span>
                            <small>
                              Editada em {fmtDateTime(s.updatedAt)} ·{" "}
                              {systemLabel(Boolean(s.systemRegistered))}
                            </small>
                          </div>
                          <div className="recent-equipment">
                            <b>{s.facialCount || 0} facial(is)</b>
                            <small>{gateCount(s)} catraca(s)</small>
                          </div>
                          <ChevronRight />
                        </button>
                      ))
                    ) : (
                      <Empty text="Nenhuma edição recente registrada." />
                    )}
                  </div>
                </div>
              </section>
            )}
            {view === "units" && (
              <section className="page">
                <div className="unit-segments">
                  <div>
                    <span>Base total</span>
                    <b>{schools.length}</b>
                  </div>
                  <div>
                    <span>Cadastradas no VIGI-ACCESS</span>
                    <b>{schools.filter((s) => s.systemRegistered).length}</b>
                  </div>
                  <div>
                    <span>Não cadastradas no VIGI-ACCESS</span>
                    <b>{schools.filter((s) => !s.systemRegistered).length}</b>
                  </div>
                  <div>
                    <span>Faciais avulsos</span>
                    <b>{schools.filter(looseFacial).length}</b>
                  </div>
                  <div>
                    <span>Com catraca</span>
                    <b>{schools.filter((s) => gateCount(s) > 0).length}</b>
                  </div>
                </div>
                <div className="unit-filter-panel">
                  <div className="toolbar">
                    <label>
                      <Search />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por Número de Conta, unidade, provedor, status ou equipamento..."
                      />
                    </label>
                    <span>{filtered.length} unidade(s)</span>
                  </div>
                  <div className="unit-filter-grid">
                    <label>
                      Status
                      <select
                        value={unitStatus}
                        onChange={(e) => setUnitStatus(e.target.value)}
                      >
                        <option>Todos</option>
                        {statusOptions.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Provedor
                      <select
                        value={unitProvider}
                        onChange={(e) => setUnitProvider(e.target.value)}
                      >
                        <option>Todos</option>
                        {providers.map(([name]) => (
                          <option key={name}>{name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Situação
                      <select
                        value={unitSituation}
                        onChange={(e) => setUnitSituation(e.target.value)}
                      >
                        <option>Todos</option>
                        <option value="No sistema">Cadastradas no VIGI-ACCESS</option>
                        <option value="Fora do sistema">Não cadastradas no VIGI-ACCESS</option>
                      </select>
                    </label>
                    <label>
                      Equipamentos
                      <select
                        value={unitEquipment}
                        onChange={(e) => setUnitEquipment(e.target.value)}
                      >
                        <option value="Todos">Todos os equipamentos</option>
                        <option>Com facial</option>
                        <option>Facial avulso</option>
                        <option>Mais de 1 facial avulso</option>
                        <option>Com catraca</option>
                        <option>Com catraca PNE</option>
                        <option>Sem facial/catraca</option>
                      </select>
                    </label>
                    <button
                      onClick={() => {
                        setQuery("");
                        setUnitStatus("Todos");
                        setUnitProvider("Todos");
                        setUnitSituation("Todos");
                        setUnitEquipment("Todos");
                      }}
                    >
                      Limpar filtros
                    </button>
                  </div>
                </div>
                <div className="data-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Número de Conta</th>
                        <th>Unidade Escolar</th>
                        <th>Situação</th>
                        <th>Provedor</th>
                        <th>Equipamentos</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => {
                            setSelected(s);
                            setUnitModal(true);
                          }}
                        >
                          <td>
                            <strong className="account-number">
                              {account(s)}
                            </strong>
                          </td>
                          <td>
                            <b>{s.school}</b>
                            <small>
                              {s.address ||
                                s.subnet ||
                                "Endereço não informado"}
                            </small>
                          </td>
                          <td>
                            <span
                              className={s.systemRegistered ? "ok" : "risk"}
                            >
                              {systemLabel(s.systemRegistered)}
                            </span>
                          </td>
                          <td>{s.providers?.join(", ") || "Não informado"}</td>
                          <td>
                            <div className="equipment-cell">
                              <b>{s.facialCount || 0} facial(is)</b>
                              {s.facialModel && (
                                <span>Modelo: {s.facialModel}</span>
                              )}
                              <span>
                                {gateCount(s)} catraca(s) ·{" "}
                                {s.pneTurnstileCount || 0} PNE
                              </span>
                              {looseFacial(s) && <small>Facial avulso</small>}
                            </div>
                          </td>
                          <td>
                            <div className="status-tags">
                              {s.statuses?.length ? (
                                s.statuses
                                  .slice(0, 2)
                                  .map((status) => (
                                    <span key={status}>{status}</span>
                                  ))
                              ) : (
                                <small>Sem status</small>
                              )}
                            </div>
                          </td>
                          <td>
                            <ChevronRight />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {view === "locations" && (
              <LocationModule
                schools={schools}
                onSaved={(saved) => {
                  const next = saved as School;
                  setSchools((current) =>
                    current.map((school) =>
                      school.id === next.id ? next : school,
                    ),
                  );
                }}
              />
            )}
            {view === "providers" && (
              <section className="page">
                <div className="module-note">
                  <RadioTower />
                  <div>
                    <b>Controle de fornecedores</b>
                    <p>
                      Edite o vínculo de provedor abrindo qualquer unidade. A
                      alteração é refletida imediatamente nesta lista.
                    </p>
                  </div>
                </div>
                <div className="provider-grid">
                  {providers.map(([name, units]) => (
                    <article
                      key={name}
                      className="provider-card-clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedProvider(name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedProvider(name);
                        }
                      }}
                    >
                      <div>
                        <Wifi />
                        <span>ATIVO</span>
                      </div>
                      <h2>{name}</h2>
                      <b>{units.length} unidade(s) vinculada(s)</b>
                      <ul>
                        {units.slice(0, 5).map((s) => (
                          <li key={s.id}>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelected(s);
                                setUnitModal(true);
                              }}
                            >
                              <span>Conta {account(s)}</span>
                              {s.school}
                              <Pencil />
                            </button>
                          </li>
                        ))}
                      </ul>
                      {units.length > 5 && (
                        <small>+ {units.length - 5} outras unidades</small>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}
            {view === "observations" && (
              <section className="page">
                <div className="module-note">
                  <StickyNote />
                  <div>
                    <b>Apontamentos vinculados às unidades</b>
                    <p>
                      Para anotar algo sobre uma escola, use “Nova observação” e
                      selecione obrigatoriamente a unidade.
                    </p>
                  </div>
                </div>
                <div className="observation-board">
                  {observations.length ? (
                    observations.map((o) => (
                      <article key={o.id}>
                        <div>
                          <span className="category">{o.category}</span>
                          <time>
                            {fmt(o.date)} · adicionada às {fmtTime(o.createdAt)}
                          </time>
                        </div>
                        <h3>{o.schoolName}</h3>
                        <p>{o.description}</p>
                        <footer>
                          <span>{o.status}</span>
                          <button
                            onClick={() => {
                              setEditingObservation(o);
                              setObservationModal(true);
                            }}
                          >
                            <Pencil />
                            Editar
                          </button>
                          <button
                            className="danger"
                            onClick={() => void deleteObservation(o)}
                          >
                            <Trash2 />
                            Excluir
                          </button>
                        </footer>
                      </article>
                    ))
                  ) : (
                    <Empty text="Nenhuma observação registrada." />
                  )}
                </div>
              </section>
            )}
            {view === "trash" && (
              <section className="page">
                <div className="trash-summary">
                  <div>
                    <span>Itens na lixeira</span>
                    <b>{trashItems.length}</b>
                  </div>
                  <div>
                    <span>Unidades escolares</span>
                    <b>
                      {
                        trashItems.filter(
                          (item) => item.entityType === "school",
                        ).length
                      }
                    </b>
                  </div>
                  <div>
                    <span>Observações</span>
                    <b>
                      {
                        trashItems.filter(
                          (item) => item.entityType === "observation",
                        ).length
                      }
                    </b>
                  </div>
                </div>
                <div className="panel trash-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Registros excluídos</h2>
                      <p>
                        Restaurar devolve o item ao seu módulo original.
                      </p>
                    </div>
                  </div>
                  {trashItems.length ? (
                    <div className="trash-list">
                      {trashItems.map((item) => (
                        <article key={item.id}>
                          <div className="trash-icon">
                            {item.entityType === "school" ? (
                              <Building2 />
                            ) : (
                              <StickyNote />
                            )}
                          </div>
                          <div>
                            <span>
                              {item.entityType === "school"
                                ? "UNIDADE ESCOLAR"
                                : "OBSERVAÇÃO"}
                            </span>
                            <b>{item.title}</b>
                            <small>
                              Excluído em {fmtDateTime(item.deletedAt)}
                            </small>
                          </div>
                          <button
                            className="restore-button"
                            onClick={() => void restoreTrashItem(item)}
                          >
                            <RotateCcw />
                            Restaurar
                          </button>
                          <button
                            className="permanent-delete-button"
                            onClick={() =>
                              void permanentlyDeleteTrashItem(item)
                            }
                          >
                            <Trash2 />
                            Excluir definitivamente
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <Empty text="A lixeira está vazia." />
                  )}
                </div>
              </section>
            )}
            {view === "reports" && (
              <Reports
                schools={schools}
                observations={observations}
                schoolId={reportSchool}
                setSchoolId={setReportSchool}
                options={reportOptions}
                setOptions={setReportOptions}
                ready={reportReady}
                generate={() => setReportReady(true)}
              />
            )}
            {view === "validation" && <ValidationModule />}
            {view === "settings" && (
              <SettingsPanel onApplied={setAppAppearance} />
            )}
          </>
        )}
      </main>
      {unitModal && selected && (
        <UnitEditor
          school={selected}
          providers={providers.map(([name]) => name)}
          close={() => {
            setUnitModal(false);
            setSelected(null);
          }}
          saved={(saved) => {
            const normalized = { ...saved, id: Number(saved.id) } as School;
            setSchools((current) => {
              const exists = current.some(
                (unit) => Number(unit.id) === normalized.id,
              );
              return exists
                ? current.map((unit) =>
                    Number(unit.id) === normalized.id ? normalized : unit,
                  )
                : [normalized, ...current];
            });
            setUnitModal(false);
            setSelected(null);
            setReportReady(false);
            void refreshSchools(normalized);
          }}
          deleted={(id) => {
            setSchools((current) =>
              current.filter((s) => Number(s.id) !== Number(id)),
            );
            setUnitModal(false);
            setSelected(null);
            setReportReady(false);
            void refreshTrash();
            void refreshSchools(undefined, Number(id));
          }}
        />
      )}
      {selectedProvider && (
        <ProviderSchoolsModal
          name={selectedProvider}
          schools={
            providers.find(([name]) => name === selectedProvider)?.[1] || []
          }
          close={() => setSelectedProvider(null)}
          openSchool={(school) => {
            setSelectedProvider(null);
            setSelected(school);
            setUnitModal(true);
          }}
        />
      )}
      {observationModal && (
        <ObservationEditor
          schools={schools}
          initial={editingObservation}
          close={() => {
            setObservationModal(false);
            setEditingObservation(null);
          }}
          saved={(saved) => {
            setObservations((current) =>
              editingObservation?.id
                ? current.map((o) => (o.id === saved.id ? saved : o))
                : [saved, ...current],
            );
            setObservationModal(false);
            setEditingObservation(null);
          }}
        />
      )}
    </div>
  );
}
function ProviderSchoolsModal({
  name,
  schools,
  close,
  openSchool,
}: {
  name: string;
  schools: School[];
  close: () => void;
  openSchool: (school: School) => void;
}) {
  return (
    <div className="overlay provider-overlay" onMouseDown={close}>
      <section
        className="provider-schools-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="editor-head">
          <div>
            <span>PROVEDOR</span>
            <h2>{name}</h2>
            <p>{schools.length} unidade(s) atendida(s)</p>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </div>
        <div className="provider-school-list">
          {schools.map((s) => (
            <button key={s.id} onClick={() => openSchool(s)}>
              <div>
                <span>Conta {account(s)}</span>
                <b>{s.school}</b>
                <small>
                  {systemLabel(s.systemRegistered)}
                </small>
              </div>
              <ChevronRight />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  alert,
}: {
  icon: any;
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className={`metric-card ${alert ? "metric-alert" : ""}`}>
      <i>
        <Icon />
      </i>
      <div>
        <span>{label}</span>
        <b>{value}</b>
      </div>
    </div>
  );
}
function Panel({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action: string;
  onAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <button onClick={onAction}>
          {action}
          <ChevronRight />
        </button>
      </div>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <CircleCheck />
      <p>{text}</p>
    </div>
  );
}
function UnitEditor({
  school,
  providers,
  close,
  saved,
  deleted,
}: {
  school: School;
  providers: string[];
  close: () => void;
  saved: (s: School) => void;
  deleted: (id: number) => void;
}) {
  const [form, setForm] = useState<School>({
      ...blankSchool(school.id),
      ...school,
      remoteAccess: { ...blankSchool(0).remoteAccess, ...school.remoteAccess },
      network: { ...blankSchool(0).network, ...school.network },
      nvr: { ...blankSchool(0).nvr, ...school.nvr },
      alarmCenter: { ...blankSchool(0).alarmCenter, ...school.alarmCenter },
    }),
    [saving, setSaving] = useState(false),
    [statusChoice, setStatusChoice] = useState(""),
    [message, setMessage] = useState("");
  const set = (key: keyof School, value: any) =>
    setForm({ ...form, [key]: value });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.remoteAccess?.account.trim()) {
      setMessage("Informe o Número de Conta.");
      return;
    }
    if (!form.school.trim()) {
      setMessage("Informe a Unidade Escolar.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/schools", {
        method: school.school ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error();
      saved(await response.json());
    } catch {
      setMessage(
        "Não foi possível salvar a unidade. Verifique se o Número de Conta já existe.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (
      !school.school ||
      !confirm(`Excluir definitivamente a unidade ${school.school}?`)
    )
      return;
    setSaving(true);
    const response = await fetch(`/api/schools?id=${school.id}`, {
      method: "DELETE",
    });
    if (response.ok) deleted(school.id);
    else {
      setMessage("Não foi possível excluir a unidade.");
      setSaving(false);
    }
  }
  return (
    <div className="overlay" onMouseDown={close}>
      <form
        className="editor"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="editor-head">
          <div>
            <span>GESTÃO DE UNIDADES</span>
            <h2>
              {school.school
                ? `Conta ${account(school)}`
                : "Cadastrar nova unidade"}
            </h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </div>
        <Section title="Identificação principal">
          <div className="form-grid">
            <Field label="Número de Conta *">
              <input
                value={form.remoteAccess?.account || ""}
                onChange={(e) =>
                  set("remoteAccess", {
                    ...form.remoteAccess,
                    account: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Unidade Escolar *" wide>
              <input
                value={form.school}
                onChange={(e) => set("school", e.target.value)}
              />
            </Field>
            <Field label="Situação da unidade">
              <select
                value={form.systemRegistered ? "yes" : "no"}
                onChange={(e) =>
                  set("systemRegistered", e.target.value === "yes")
                }
              >
                <option value="yes">Cadastrado no VIGI-ACCESS</option>
                <option value="no">Não cadastrado no VIGI-ACCESS</option>
              </select>
            </Field>
            <Field label="Status / pendências" wide>
              <div className="status-edit-control">
                <select
                  value={statusChoice}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStatusChoice("");
                    if (value && !(form.statuses || []).includes(value))
                      set("statuses", [...(form.statuses || []), value]);
                  }}
                >
                  <option value="">Selecionar e adicionar status</option>
                  {unitStatusPresets.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
                <input
                  value={(form.statuses || []).join("; ")}
                  placeholder="Ou escreva um status; separe vários por ponto e vírgula"
                  onChange={(e) =>
                    set(
                      "statuses",
                      e.target.value
                        .split(";")
                        .map((v) => v.trim().toUpperCase())
                        .filter(Boolean),
                    )
                  }
                />
              </div>
            </Field>
            <Field label="Endereço" wide>
              <input
                value={form.address || ""}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
            <Field label="Bairro / distrito">
              <input
                value={form.neighborhood || ""}
                onChange={(e) => set("neighborhood", e.target.value)}
              />
            </Field>
            <Field label="Classificação da localização">
              <select
                value={form.locationType || "A confirmar"}
                onChange={(e) => set("locationType", e.target.value)}
              >
                <option>Centro</option>
                <option>Bairro</option>
                <option>Distrito</option>
                <option>A confirmar</option>
              </select>
            </Field>
            <Field label="Telefone">
              <input
                value={form.phone || ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                value={form.email || ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Responsável" wide>
              <input
                value={form.manager || ""}
                onChange={(e) => set("manager", e.target.value)}
              />
            </Field>
          </div>
        </Section>
        <Section title="Provedor e suporte">
          <div className="form-grid">
            <Field label="Provedor(es)" wide>
              <input
                list="provider-list"
                value={(form.providers || []).join("; ")}
                onChange={(e) =>
                  set(
                    "providers",
                    e.target.value
                      .split(";")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  )
                }
              />
              <datalist id="provider-list">
                {providers.map((p) => (
                  <option value={p} key={p} />
                ))}
              </datalist>
            </Field>
            <Field label="Endereço remoto">
              <input
                value={form.remoteAccess?.address || ""}
                onChange={(e) =>
                  set("remoteAccess", {
                    ...form.remoteAccess,
                    address: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Porta">
              <input
                value={form.remoteAccess?.port || ""}
                onChange={(e) =>
                  set("remoteAccess", {
                    ...form.remoteAccess,
                    port: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Serviço / perfil" wide>
              <input
                value={form.remoteAccess?.service || ""}
                onChange={(e) =>
                  set("remoteAccess", {
                    ...form.remoteAccess,
                    service: e.target.value,
                  })
                }
              />
            </Field>
          </div>
        </Section>
        <Section title="Equipamentos">
          <div className="form-grid">
            <Field label="Quantidade de faciais">
              <input
                type="number"
                min="0"
                value={form.facialCount || 0}
                onChange={(e) => set("facialCount", Number(e.target.value))}
              />
            </Field>
            <Field label="Modelo dos faciais">
              <select
                value={form.facialModel || ""}
                onChange={(e) => set("facialModel", e.target.value)}
              >
                <option value="">Não informado</option>
                <option value="SS 1530">SS 1530</option>
              </select>
            </Field>
            <Field label="Quantidade de catracas">
              <input
                type="number"
                min="0"
                value={form.turnstileCount || 0}
                onChange={(e) => set("turnstileCount", Number(e.target.value))}
              />
            </Field>
            <Field label="Catracas PNE">
              <input
                type="number"
                min="0"
                value={form.pneTurnstileCount || 0}
                onChange={(e) =>
                  set("pneTurnstileCount", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Quantidade de NVR">
              <input
                type="number"
                min="0"
                value={form.nvrQuantity || 0}
                onChange={(e) => set("nvrQuantity", Number(e.target.value))}
              />
            </Field>
            <Field label="Status do NVR">
              <select
                value={form.nvrStatus || form.nvr?.status || "Não informado"}
                onChange={(e) => {
                  setForm({
                    ...form,
                    nvrStatus: e.target.value,
                    nvr: { ...form.nvr!, status: e.target.value },
                  });
                }}
              >
                <option>Não informado</option>
                <option>Online</option>
                <option>Offline</option>
                <option>Em manutenção</option>
                <option>Inativo</option>
              </select>
            </Field>
            <Field label="Observação sobre NVR" wide>
              <textarea
                rows={3}
                value={form.nvrNote || ""}
                onChange={(e) => set("nvrNote", e.target.value)}
              />
            </Field>
            <Field label="Número da O.S." wide>
              <input
                value={(form.serviceOrders || []).join("; ")}
                onChange={(e) =>
                  set(
                    "serviceOrders",
                    e.target.value
                      .split(";")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="Ex.: 24581; 24592"
              />
            </Field>
          </div>
        </Section>
        <Section title="Dados de rede">
          <div className="form-grid">
            <Field label="IP(s) do facial" wide>
              <textarea
                rows={3}
                value={(form.ips || []).join("\n")}
                onChange={(e) =>
                  set(
                    "ips",
                    e.target.value
                      .split(/[\n,;]+/)
                      .map((v) => v.trim())
                      .filter(Boolean),
                  )
                }
              />
            </Field>
            <Field label="Gateway">
              <input
                value={form.network?.gateway || ""}
                onChange={(e) =>
                  set("network", { ...form.network, gateway: e.target.value })
                }
              />
            </Field>
            <Field label="Máscara">
              <input
                value={form.network?.mask || ""}
                onChange={(e) =>
                  set("network", { ...form.network, mask: e.target.value })
                }
              />
            </Field>
            <Field label="Configurações de infraestrutura" wide>
              <textarea
                rows={3}
                value={form.network?.notes || ""}
                onChange={(e) =>
                  set("network", { ...form.network, notes: e.target.value })
                }
              />
            </Field>
          </div>
        </Section>
        <Section title="Central de Alarme">
          <div className="form-grid">
            <Field label="Status da Central de Alarme">
              <select
                value={form.alarmCenter?.status || "Não informado"}
                onChange={(e) =>
                  set("alarmCenter", {
                    brand: "",
                    model: "",
                    status: e.target.value,
                  })
                }
              >
                <option>Não informado</option>
                <option>Online</option>
                <option>Offline</option>
                <option>Em manutenção</option>
                <option>Inativo</option>
              </select>
            </Field>
            <Field label="Número do Alarme">
              <input
                value={form.alarmNumber || ""}
                onChange={(e) => set("alarmNumber", e.target.value)}
              />
            </Field>
          </div>
        </Section>
        {message && <p className="form-message">{message}</p>}
        <div className="editor-actions">
          {school.school && (
            <button
              type="button"
              className="delete-unit"
              onClick={() => void remove()}
            >
              <Trash2 />
              Excluir unidade
            </button>
          )}
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={saving}>
            <Save />
            {saving ? "Salvando..." : "Salvar unidade"}
          </button>
        </div>
      </form>
    </div>
  );
}
function SecurityFields({
  title,
  value,
  change,
}: {
  title: string;
  value: SecurityItem;
  change: (v: SecurityItem) => void;
}) {
  return (
    <div className="security-group">
      <b>{title}</b>
      <div className="form-grid">
        <Field label="Marca">
          <input
            value={value.brand}
            onChange={(e) => change({ ...value, brand: e.target.value })}
          />
        </Field>
        <Field label="Modelo">
          <input
            value={value.model}
            onChange={(e) => change({ ...value, model: e.target.value })}
          />
        </Field>
        <Field label="Status" wide>
          <select
            value={value.status}
            onChange={(e) => change({ ...value, status: e.target.value })}
          >
            <option>Não informado</option>
            <option>Online</option>
            <option>Offline</option>
            <option>Em manutenção</option>
            <option>Inativo</option>
          </select>
        </Field>
      </div>
    </div>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="form-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "wide" : ""}>
      {label}
      {children}
    </label>
  );
}
function ObservationEditor({
  schools,
  initial,
  close,
  saved,
}: {
  schools: School[];
  initial: Observation | null;
  close: () => void;
  saved: (o: Observation) => void;
}) {
  const [form, setForm] = useState<Observation>(
      initial
        ? { ...initial }
        : {
            schoolId: 0,
            schoolName: "",
            date: today(),
            category: "Nota Geral",
            description: "",
            responsible: "",
            status: "Aberta",
          },
    ),
    [saving, setSaving] = useState(false),
    [schoolSearch, setSchoolSearch] = useState(""),
    [message, setMessage] = useState("");
  const normalizedSearch = schoolSearch
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim(),
    filteredSchools = schools.filter((school) =>
      `${account(school)} ${school.school}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const school = schools.find((s) => s.id === Number(form.schoolId));
    if (!school) {
      setMessage("Selecione uma Unidade Escolar.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        schoolId: school.id,
        schoolName: school.school,
      };
      const response = await fetch("/api/records", {
        method: initial?.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error();
      saved(await response.json());
    } catch {
      setMessage("Não foi possível salvar a observação.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="overlay" onMouseDown={close}>
      <form
        className="observation-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="editor-head">
          <div>
            <span>CENTRAL DE OBSERVAÇÕES</span>
            <h2>{initial ? "Editar observação" : "Nova observação"}</h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </div>
        <Field label="Unidade Escolar *">
          <div className="school-picker">
            <div className="school-search">
              <Search />
              <input
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder="Pesquisar por Número de Conta ou unidade..."
              />
            </div>
            <select
              value={form.schoolId}
              onChange={(e) =>
                setForm({ ...form, schoolId: Number(e.target.value) })
              }
            >
              <option value="0">
                {filteredSchools.length
                  ? "Selecione uma unidade"
                  : "Nenhuma unidade encontrada"}
              </option>
              {filteredSchools.map((s) => (
                <option value={s.id} key={s.id}>
                  Conta {account(s)} — {s.school}
                </option>
              ))}
            </select>
            <small>
              {filteredSchools.length} unidade(s) encontrada(s)
            </small>
          </div>
        </Field>
        <div className="form-grid">
          <Field label="Data da observação">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Categoria">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option>Incidente</option>
              <option>Manutenção</option>
              <option>Instalação</option>
              <option>Nota Geral</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option>Aberta</option>
              <option>Em acompanhamento</option>
              <option>Concluída</option>
            </select>
          </Field>
          <Field label="Responsável">
            <input
              value={form.responsible}
              onChange={(e) =>
                setForm({ ...form, responsible: e.target.value })
              }
            />
          </Field>
          <Field label="Detalhamento" wide>
            <textarea
              rows={7}
              required
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Field>
        </div>
        {message && <p className="form-message">{message}</p>}
        <div className="editor-actions">
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={saving}>
            <Save />
            {saving ? "Salvando..." : "Salvar observação"}
          </button>
        </div>
      </form>
    </div>
  );
}
function Reports({
  schools,
  observations,
  schoolId,
  setSchoolId,
  options,
  setOptions,
  ready,
  generate,
}: {
  schools: School[];
  observations: Observation[];
  schoolId: string;
  setSchoolId: (v: string) => void;
  options: ReportOptions;
  setOptions: (v: ReportOptions) => void;
  ready: boolean;
  generate: () => void;
}) {
  const [system, setSystem] = useState("Todos"),
    [provider, setProvider] = useState("Todos"),
    [equipment, setEquipment] = useState("Todos"),
    [status, setStatus] = useState("Todos");
  const providerList = Array.from(
      new Set(schools.flatMap((s) => s.providers)),
    ).sort(),
    statusList = Array.from(new Set(schools.flatMap((s) => s.statuses))).sort();
  let selected =
    schoolId === "all"
      ? [...schools]
      : schools.filter((s) => s.id === Number(schoolId));
  if (system === "No sistema")
    selected = selected.filter((s) => s.systemRegistered);
  if (system === "Fora do sistema")
    selected = selected.filter((s) => !s.systemRegistered);
  if (provider !== "Todos")
    selected = selected.filter((s) => s.providers.includes(provider));
  if (status !== "Todos")
    selected = selected.filter((s) => s.statuses.includes(status));
  if (equipment === "Faciais avulsos") selected = selected.filter(looseFacial);
  if (equipment === "Faciais avulsos — mais de 1")
    selected = selected.filter((s) => looseFacial(s) && s.facialCount > 1);
  if (equipment === "Com catraca")
    selected = selected.filter((s) => gateCount(s) > 0);
  if (equipment === "Sem catraca")
    selected = selected.filter((s) => gateCount(s) === 0);
  const looseUnits = selected.filter(looseFacial),
    looseTotal = looseUnits.reduce(
      (total, s) => total + (s.facialCount || 0),
      0,
    );
  return (
    <section className="page reports-page">
      <div className="report-hero">
        <div>
          <span>CENTRAL DE RELATÓRIOS</span>
          <h2>Relatórios personalizados</h2>
          <p>
            Filtre as unidades, escolha as informações e exporte somente o que
            precisa.
          </p>
        </div>
        <FileText />
      </div>
      <div className="report-builder panel">
        <div className="report-filter-head">
          <div>
            <span>ANÁLISE POR FILTROS</span>
            <h2>Monte o relatório por opções</h2>
            <p>
              O formato de exportação foi mantido; os novos critérios ampliam a
              seleção.
            </p>
          </div>
        </div>
        <div className="report-filter-grid">
          <label>
            Unidade
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
            >
              <option value="all">Todas as unidades</option>
              {schools.map((s) => (
                <option value={s.id} key={s.id}>
                  Conta {account(s)} — {s.school}
                </option>
              ))}
            </select>
          </label>
          <label>
            Situação
            <select value={system} onChange={(e) => setSystem(e.target.value)}>
              <option>Todos</option>
              <option value="No sistema">Cadastradas no VIGI-ACCESS</option>
              <option value="Fora do sistema">Não cadastradas no VIGI-ACCESS</option>
            </select>
          </label>
          <label>
            Provedor
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option>Todos</option>
              {providerList.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Equipamentos
            <select
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
            >
              <option>Todos</option>
              <option>Faciais avulsos</option>
              <option>Faciais avulsos — mais de 1</option>
              <option>Com catraca</option>
              <option>Sem catraca</option>
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Todos</option>
              {statusList.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="report-kpis">
          <div>
            <span>Unidades selecionadas</span>
            <b>{selected.length}</b>
          </div>
          <div>
            <span>Total de faciais</span>
            <b>
              {selected.reduce((total, s) => total + (s.facialCount || 0), 0)}
            </b>
          </div>
          <div>
            <span>Unidades com faciais avulsos</span>
            <b>{looseUnits.length}</b>
          </div>
          <div>
            <span>Quantidade de faciais avulsos</span>
            <b>{looseTotal}</b>
          </div>
        </div>
        <div className="new-filter-box">
          <b>Escolha quais informações adicionar ao relatório</b>
          <div className="check-grid">
            <Check
              label="Equipamentos e quantidades"
              checked={options.equipment}
              change={(v) => setOptions({ ...options, equipment: v })}
            />
            <Check
              label="Status e pendências"
              checked={options.status}
              change={(v) => setOptions({ ...options, status: v })}
            />
            <Check
              label="Números de O.S."
              checked={options.serviceOrder}
              change={(v) => setOptions({ ...options, serviceOrder: v })}
            />
            <Check
              label="IP(s) do facial"
              checked={options.network}
              change={(v) => setOptions({ ...options, network: v })}
            />
            <Check
              label="Infraestrutura de segurança"
              checked={options.security}
              change={(v) => setOptions({ ...options, security: v })}
            />
            <Check
              label="Dados do provedor"
              checked={options.provider}
              change={(v) => setOptions({ ...options, provider: v })}
            />
            <Check
              label="Histórico de observações"
              checked={options.observations}
              change={(v) => setOptions({ ...options, observations: v })}
            />
          </div>
          {options.observations && (
            <div className="date-options">
              <label>
                Período
                <select
                  value={options.observationRange}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      observationRange: e.target
                        .value as ReportOptions["observationRange"],
                    })
                  }
                >
                  <option value="30">Últimos 30 dias</option>
                  <option value="all">Todo o histórico</option>
                  <option value="custom">Período customizado</option>
                </select>
              </label>
              {options.observationRange === "custom" && (
                <>
                  <label>
                    Início
                    <input
                      type="date"
                      value={options.start}
                      onChange={(e) =>
                        setOptions({ ...options, start: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Fim
                    <input
                      type="date"
                      value={options.end}
                      onChange={(e) =>
                        setOptions({ ...options, end: e.target.value })
                      }
                    />
                  </label>
                </>
              )}
            </div>
          )}
        </div>
        <div className="report-actions">
          <span>{selected.length} unidade(s) no relatório</span>
          <button
            onClick={() =>
              exportPdf(
                equipment.startsWith("Faciais avulsos")
                  ? "Relatório de Faciais Avulsos"
                  : "Relatório de Unidades Escolares",
                reportRows(selected, options),
                options,
              )
            }
          >
            <FileText />
            Exportar PDF
          </button>
          <button
            className="primary"
            onClick={() =>
              exportExcel(
                equipment.startsWith("Faciais avulsos")
                  ? "Relatório de Faciais Avulsos"
                  : "Relatório de Unidades Escolares",
                reportRows(selected, options),
                options,
              )
            }
          >
            <FileText />
            Exportar Excel
          </button>
        </div>
      </div>
      <div className="data-table report-preview">
        <table>
          <thead>
            <tr>
              <th>Número de Conta</th>
              <th>Unidade Escolar</th>
              <th>Situação</th>
              <th>Provedor</th>
              <th>Equipamentos</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {selected.map((s) => (
              <tr key={s.id}>
                <td>
                  <b>{account(s)}</b>
                </td>
                <td>{s.school}</td>
                <td>
                  <span className={s.systemRegistered ? "ok" : "risk"}>
                    {systemLabel(s.systemRegistered)}
                  </span>
                </td>
                <td>{s.providers.join(", ") || "Não informado"}</td>
                <td>
                  {s.facialCount || 0} faciais · {gateCount(s)} catracas
                </td>
                <td>{s.statuses.join(", ") || "Sem status"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function SettingsPanel({ onApplied }: { onApplied: (values: AppAppearance) => void }) {
  const defaults = defaultAppearance;
  const [form, setForm] = useState<AppAppearance>(defaults),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const next = { ...defaults, ...data };
        if (next.subtitle === "Infraestrutura e suporte")
          next.subtitle = "Infraestrutura e VIGI-ACCESS";
        setForm(next as AppAppearance);
        apply(next);
        onApplied(next as AppAppearance);
      });
  }, [onApplied]);
  function apply(values: AppAppearance) {
    const root = document.documentElement.style;
    root.setProperty("--green", values.primaryColor);
    root.setProperty("--deep", values.sidebarColor);
    root.setProperty("--bg", values.backgroundColor);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error();
      const saved = { ...defaults, ...(await response.json()) } as AppAppearance;
      setForm(saved);
      apply(saved);
      onApplied(saved);
      setMessage("Configurações salvas e aplicadas em todo o sistema.");
    } catch {
      setMessage("Não foi possível salvar. Os campos foram mantidos para tentar novamente.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="page">
      <form className="panel settings-form" onSubmit={save}>
        <div className="settings-heading">
          <Settings />
          <div>
            <span>PERSONALIZAÇÃO DO SISTEMA</span>
            <h2>Configurações gerais</h2>
            <p>
              Ajuste a identificação e a paleta visual usada em todas as telas.
            </p>
          </div>
        </div>
        <div className="settings-sections">
          <section className="settings-block">
            <div className="settings-block-head">
              <span>01</span>
              <div>
                <h3>Identificação do sistema</h3>
                <p>Textos exibidos no menu lateral e no cabeçalho.</p>
              </div>
            </div>
            <div className="settings-grid identity-grid">
              <Field label="Nome do sistema">
                <input
                  value={form.appName}
                  onChange={(e) => setForm({ ...form, appName: e.target.value })}
                />
              </Field>
              <Field label="Subtítulo">
                <input
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                />
              </Field>
            </div>
          </section>
          <section className="settings-block">
            <div className="settings-block-head">
              <span>02</span>
              <div>
                <h3>Paleta da interface</h3>
                <p>Escolha as cores principais usadas em todas as telas.</p>
              </div>
            </div>
            <div className="settings-grid settings-colors">
              <Field label="Cor principal">
                <div className="color-control">
                  <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
                  <input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
                </div>
              </Field>
              <Field label="Cor do menu lateral">
                <div className="color-control">
                  <input type="color" value={form.sidebarColor} onChange={(e) => setForm({ ...form, sidebarColor: e.target.value })} />
                  <input value={form.sidebarColor} onChange={(e) => setForm({ ...form, sidebarColor: e.target.value })} />
                </div>
              </Field>
              <Field label="Cor de fundo">
                <div className="color-control">
                  <input type="color" value={form.backgroundColor} onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} />
                  <input value={form.backgroundColor} onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} />
                </div>
              </Field>
            </div>
          </section>
        </div>
        <div
          className="settings-preview"
          style={{ background: form.backgroundColor }}
        >
          <aside style={{ background: form.sidebarColor }}></aside>
          <div>
            <span style={{ background: form.primaryColor }}></span>
            <b>{form.appName || "Prévia do sistema"}</b>
            <small>{form.subtitle || "Infraestrutura e VIGI-ACCESS"}</small>
          </div>
        </div>
        {message && <p className="settings-message">{message}</p>}
        <div className="settings-actions">
          <button
            type="button"
            onClick={() => {
              setForm(defaults);
              apply(defaults);
            }}
          >
            Restaurar padrão
          </button>
          <button className="primary" disabled={saving}>
            <Save />
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </form>
    </section>
  );
}
function Check({
  label,
  checked,
  change,
}: {
  label: string;
  checked: boolean;
  change: (v: boolean) => void;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => change(e.target.checked)}
      />
      <span>{checked ? <CircleCheck /> : null}</span>
      {label}
    </label>
  );
}
function ReportBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  );
}
