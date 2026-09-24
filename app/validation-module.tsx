"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileDown,
  Save,
  Search,
  X,
} from "lucide-react";
import validationSchools from "@/data/validation-schools.json";

type ValidationSchool = {
  id: number;
  source: string;
  day: number;
  number: number;
  school: string;
  neighborhood: string;
  provider: string;
  situation: string;
  status: string;
  observation: string;
};
type SavedRecord = {
  validationSchoolId: number;
  schoolName: string;
  status: string;
  payload: ValidationPayload;
  updatedAt?: string;
};
type ValidationPayload = {
  technician: string;
  serviceOrder: string;
  visitDate: string;
  district: string;
  needsIntervention: string;
  provider: string;
  router: string;
  nvrIp: string;
  alarmIp: string;
  accessIp: string;
  answers: Record<string, string>;
  openZones: string;
  unusedPoePorts: string;
  finalResult: string;
  unitResponsible: string;
  notes: string;
};
const schools = validationSchools as ValidationSchool[];
const blankPayload = (school: ValidationSchool): ValidationPayload => ({
  technician: "",
  serviceOrder: "",
  visitDate: new Date().toISOString().slice(0, 10),
  district: school.neighborhood,
  needsIntervention: "",
  provider: school.provider,
  router: "",
  nvrIp: "",
  alarmIp: "",
  accessIp: "",
  answers: {},
  openZones: "",
  unusedPoePorts: "",
  finalResult: "",
  unitResponsible: "",
  notes: school.observation || "",
});
const sections = [
  {
    title: "Conectividade e rede",
    questions: [
      "Internet da unidade funcionando?",
      "Internet da equipe conectada ao RB?",
      "RB funcionando normalmente?",
      "Equipamentos respondendo na rede?",
      "Houve falha na internet da unidade?",
    ],
  },
  {
    title: "Controle de acesso",
    questions: [
      "Faciais/catracas online?",
      "Switch dedicado do controle de acesso funcionando?",
      "Facial limpo e funcionando?",
      "Tela touch funcionando?",
      "Catraca realizando abertura/liberação normalmente?",
      "Foi realizado teste de passagem?",
      "Foi necessário algum ajuste físico/elétrico?",
      "Cadastro no Hik-Connect/HikPartner Pro validado?",
      "Equipamentos apresentados como online?",
    ],
  },
  {
    title: "CFTV e NVR",
    questions: [
      "NVR acessível?",
      "Todas as câmeras estão online?",
      "Existem câmeras sem imagem?",
      "Gravação do NVR funcionando?",
      "Gravação por detecção de movimento configurada?",
      "Horário/NTP sincronizado?",
      "IP fixo configurado?",
      "Portas de acesso remoto 80, 8000 e 554 ativas?",
      "Foi realizada limpeza/manutenção das câmeras?",
      "Foi realizado ajuste de posição/ângulo das câmeras?",
      "Câmeras estão enviando eventos ao sistema?",
      "Escola possui VIGIAI?",
    ],
  },
  {
    title: "Sistema de alarme",
    questions: [
      "Central de alarme comunicando normalmente?",
      "Arme/desarme funcionando?",
      "Disparo de teste realizado?",
      "Eventos sendo transmitidos?",
      "O evento abriu a tela para o monitoramento?",
      "O evento carregou os disparos no VIGIAI?",
      "Central identificada no AMT Remoto/Web?",
      "Foram identificadas zonas abertas/falhas?",
    ],
  },
  {
    title: "Rack e infraestrutura",
    questions: [
      "Rack organizado?",
      "Rack adesivado?",
      "Cabeamento organizado?",
      "Conectores revisados?",
      "Caixas de passagem fechadas/vedadas?",
      "Existem portas PoE sem utilização?",
      "Foram desativadas as portas PoE sem uso?",
    ],
  },
  {
    title: "Sistema VIGIAI e monitoramento",
    questions: [
      "Sistema VIGIAI funcionando?",
      "Equipamentos comunicando com o sistema?",
      "Eventos em tempo real validados?",
      "Alarmes/falhas de comunicação normalizados?",
    ],
  },
  {
    title: "Testes finais",
    questions: [
      "Foram realizados testes de passagem na catraca?",
      "Foram testadas de 3 a 5 passagens?",
      "Registros das passagens chegaram ao sistema?",
      "Eventos das câmeras foram validados?",
      "Sistema de alarme validado após intervenção?",
      "Todos os sistemas ficaram operacionais?",
    ],
  },
  {
    title: "Evidências obrigatórias",
    questions: [
      "Foto/print do facial funcionando?",
      "Foto/print do NVR com câmeras online?",
      "Foto/print da tela de monitoramento?",
      "Foto/print do sistema VIGIAI?",
      "Foto/print da central de alarme?",
    ],
  },
];
const totalQuestions = sections.reduce(
  (sum, section) => sum + section.questions.length,
  0,
);
const displaySystemSituation = (value: string) =>
  value === "JÁ EXISTE NO SISTEMA"
    ? "CADASTRADO NO VIGI-ACCESS"
    : value === "SEM CADASTRO NO SISTEMA"
      ? "NÃO CADASTRADO NO VIGI-ACCESS"
      : value;

const pdfLatin = (value: string) =>
  Array.from(value.replaceAll("–", "-").replaceAll("—", "-").replaceAll("•", "|"))
    .map((character) => (character.charCodeAt(0) <= 255 ? character : "?"))
    .join("");
const pdfEscape = (value: string) =>
  pdfLatin(value.replace(/[\r\n\t]+/g, " "))
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
const wrapPdf = (value: string, limit = 92) => {
  const words = (value || "Não informado").trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= limit) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["Não informado"];
};

function downloadValidationPdf(school: ValidationSchool, payload: ValidationPayload) {
  type PdfRow = {
    text: string;
    kind: "section" | "info" | "question";
    label?: string;
    answer?: string;
  };
  const rows: PdfRow[] = [];
  const add = (label: string, value: string) => {
    const valueLines = wrapPdf(value || "Não informado", 62);
    valueLines.forEach((text, index) =>
      rows.push({ text, label: index === 0 ? label : "", kind: "info" }),
    );
  };
  const heading = (text: string) => rows.push({ text, kind: "section" });

  heading("IDENTIFICAÇÃO DA UNIDADE E DA VISITA");
  add("Unidade escolar", school.school);
  add("Bairro / distrito", payload.district || school.neighborhood);
  add("Roteiro", school.source);
  add("Situação no VIGI-ACCESS", displaySystemSituation(school.situation || school.status));
  add("Nº da Ordem de Serviço", payload.serviceOrder);
  add("Data da visita", payload.visitDate);
  add("Técnico responsável", payload.technician);
  add("Necessário intervenção", payload.needsIntervention);
  add("Provedor", payload.provider);
  add("Tipo/modelo de roteador", payload.router);
  add("IP do NVR", payload.nvrIp);
  add("IP da central de alarme", payload.alarmIp);
  add("IP do facial/catraca", payload.accessIp);

  sections.forEach((section) => {
    heading(section.title.toUpperCase());
    section.questions.forEach((question) => {
      const questionLines = wrapPdf(question, 64);
      questionLines.forEach((text, index) =>
        rows.push({
          text,
          kind: "question",
          answer: index === 0 ? payload.answers[question] || "Não respondido" : "",
        }),
      );
    });
    if (section.title === "Sistema de alarme") add("Zonas abertas ou falhas", payload.openZones);
    if (section.title === "Rack e infraestrutura") add("Portas PoE sem utilização", payload.unusedPoePorts);
  });

  heading("RESULTADO DO ATENDIMENTO");
  add("Situação final", payload.finalResult);
  add("Responsável pela unidade", payload.unitResponsible);
  add("Pendências e observações", payload.notes);

  const rowsPerPage = 24;
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(rows.length / rowsPerPage)) },
    (_, index) => rows.slice(index * rowsPerPage, (index + 1) * rowsPerPage),
  );
  const pageCount = pages.length;
  const fontRegular = 3 + pageCount * 2;
  const fontBold = fontRegular + 1;
  const objects: string[] = [];
  const text = (font: string, size: number, x: number, y: number, value: string) =>
    `BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(value)}) Tj ET`;
  const pageIds = Array.from({ length: pageCount }, (_, index) => 3 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;

  const generatedAt = new Date();
  const generatedDate = generatedAt.toLocaleDateString("pt-BR");
  const generatedTime = generatedAt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  pages.forEach((page, pageIndex) => {
    const commands: string[] = [
      "0.94 0.96 0.95 rg 0 0 595 842 re f",
      "0.12 0.25 0.22 rg 0 758 595 84 re f",
      "1 1 1 rg",
      text("F2", 8.5, 30, 817, "ANÁLISE DE FLUXO | VALIDAÇÃO TÉCNICA"),
      text("F2", 15, 30, 793, "Checklist de Atendimento"),
      text("F1", 8.5, 30, 774, school.school.slice(0, 88)),
      text("F2", 8, 428, 817, `Gerado em ${generatedDate}`),
      text("F1", 7.5, 428, 802, `às ${generatedTime}`),
      text("F1", 8, 511, 774, `${pageIndex + 1} / ${pageCount}`),
    ];
    let y = 728;
    page.forEach((row, rowIndex) => {
      if (row.kind === "section") {
        commands.push(
          `0.13 0.42 0.34 rg 25 ${y - 7} 545 24 re f`,
          "1 1 1 rg",
          text("F2", 8.7, 34, y, row.text),
        );
      } else {
        const fill = rowIndex % 2 === 0 ? "0.98 0.99 0.985" : "0.955 0.975 0.965";
        commands.push(
          `${fill} rg 25 ${y - 7} 545 24 re f`,
          "0.74 0.81 0.78 RG 0.6 w 25 " + (y - 7) + " 545 24 re S",
        );
        if (row.kind === "info") {
          commands.push(
            `0.13 0.42 0.34 rg 25 ${y - 7} 4 24 re f`,
            "0.06 0.32 0.25 rg",
            ...(row.label ? [text("F2", 8.2, 36, y, `${row.label}:`)] : []),
            "0.12 0.20 0.18 rg",
            text("F1", 8.2, row.label ? 180 : 36, y, row.text),
          );
        } else {
          commands.push(
            "0.06 0.32 0.25 rg",
            text("F2", 8.2, 34, y, row.text),
          );
        }
        if (row.kind === "question" && row.answer) {
          const answerColor = row.answer === "Sim" ? "0.10 0.48 0.35" : row.answer === "Não" ? "0.72 0.20 0.18" : "0.37 0.43 0.40";
          commands.push(
            `${answerColor} rg 457 ${y - 3} 103 16 re f`,
            "1 1 1 rg",
            text("F2", 7.5, 466, y + 1, row.answer.slice(0, 20)),
          );
        }
      }
      y -= 27;
    });
    commands.push(
      "0.27 0.36 0.32 rg",
      text("F1", 7.3, 30, 24, `Documento gerado em ${generatedDate} às ${generatedTime}`),
      text("F1", 7.3, 395, 24, "Análise de Fluxo Escolar"),
    );
    const pageId = 3 + pageIndex * 2;
    const contentId = pageId + 1;
    const content = pdfLatin(commands.join("\n"));
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  objects[fontRegular] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[fontBold] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  let pdf = pdfLatin("%PDF-1.4\n%âãÏÓ\n");
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
    .join("\n")}\ntrailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = Uint8Array.from(Array.from(pdf).map((character) => character.charCodeAt(0) & 255));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `checklist-${school.school
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}.pdf`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ValidationModule() {
  const [records, setRecords] = useState<SavedRecord[]>([]),
    [query, setQuery] = useState(""),
    [source, setSource] = useState("Todos"),
    [neighborhood, setNeighborhood] = useState("Todos"),
    [systemSituation, setSystemSituation] = useState("Todos"),
    [status, setStatus] = useState("Todos"),
    [selected, setSelected] = useState<ValidationSchool | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/validation-records", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setRecords)
      .finally(() => setLoading(false));
  }, []);
  const recordMap = useMemo(
    () => new Map(records.map((record) => [record.validationSchoolId, record])),
    [records],
  );
  const neighborhoods = Array.from(
    new Set(schools.map((school) => school.neighborhood).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filtered = schools
    .filter((s) => source === "Todos" || s.source === source)
    .filter(
      (s) => neighborhood === "Todos" || s.neighborhood === neighborhood,
    )
    .filter(
      (s) => systemSituation === "Todos" || s.situation === systemSituation,
    )
    .filter((s) => {
      const current = recordMap.get(s.id)?.status || "Pendente";
      return status === "Todos" || current === status;
    })
    .filter((s) =>
      `${s.school} ${s.neighborhood} ${s.provider} ${s.status}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const completed = records.filter((r) => r.status === "Concluído").length,
    inProgress = records.filter((r) => r.status === "Em andamento").length;
  return (
    <section className="page validation-page">
      <div className="validation-kpis">
        <div>
          <span>Escolas do roteiro</span>
          <b>{schools.length}</b>
        </div>
        <div>
          <span>Concluídas</span>
          <b>{completed}</b>
        </div>
        <div>
          <span>Em andamento</span>
          <b>{inProgress}</b>
        </div>
        <div>
          <span>Pendentes</span>
          <b>{schools.length - completed - inProgress}</b>
        </div>
      </div>
      <div className="validation-toolbar">
        <label>
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar escola, bairro ou provedor..."
          />
        </label>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="Todos">Todos os roteiros</option>
          <option>Principal</option>
          <option>Prioridade 2</option>
        </select>
        <select
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
        >
          <option value="Todos">Todos os bairros</option>
          {neighborhoods.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          value={systemSituation}
          onChange={(e) => setSystemSituation(e.target.value)}
        >
          <option value="Todos">Todas as situações</option>
          <option value="JÁ EXISTE NO SISTEMA">CADASTRADO NO VIGI-ACCESS</option>
          <option value="SEM CADASTRO NO SISTEMA">NÃO CADASTRADO NO VIGI-ACCESS</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="Todos">Todos os status</option>
          <option>Pendente</option>
          <option>Em andamento</option>
          <option>Concluído</option>
        </select>
      </div>
      <div className="validation-table">
        <table>
          <thead>
            <tr>
              <th>Roteiro</th>
              <th>Unidade Escolar</th>
              <th>Bairro / Distrito</th>
              <th>Provedor</th>
              <th>Validação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const record = recordMap.get(s.id),
                current = record?.status || "Pendente";
              return (
                <tr key={s.id} onClick={() => setSelected(s)}>
                  <td>
                    <span className="route-tag">{s.source}</span>
                  </td>
                  <td>
                    <b>{s.school}</b>
                    <small>{displaySystemSituation(s.situation || s.status)}</small>
                  </td>
                  <td>{s.neighborhood || "—"}</td>
                  <td>{s.provider || "Não informado"}</td>
                  <td>
                    <span
                      className={`validation-status ${current
                        .toLowerCase()
                        .replace(" ", "-")
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")}`}
                    >
                      {current}
                    </span>
                  </td>
                  <td>
                    <ChevronRight />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="empty-validation">
            Nenhuma escola encontrada com estes filtros.
          </div>
        )}
      </div>
      {selected && (
        <ChecklistEditor
          school={selected}
          initial={recordMap.get(selected.id)}
          close={() => setSelected(null)}
          saved={(record) => {
            setRecords((current) => [
              ...current.filter(
                (r) => r.validationSchoolId !== record.validationSchoolId,
              ),
              record,
            ]);
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}

function ChecklistEditor({
  school,
  initial,
  close,
  saved,
}: {
  school: ValidationSchool;
  initial?: SavedRecord;
  close: () => void;
  saved: (record: SavedRecord) => void;
}) {
  const [payload, setPayload] = useState<ValidationPayload>(
      initial?.payload || blankPayload(school),
    ),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const answered = Object.values(payload.answers).filter(Boolean).length;
  const update = (key: keyof ValidationPayload, value: any) =>
    setPayload({ ...payload, [key]: value });
  const answer = (question: string, value: string) =>
    setPayload({
      ...payload,
      answers: { ...payload.answers, [question]: value },
    });
  async function submit(nextStatus: string) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/validation-records", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          validationSchoolId: school.id,
          schoolName: school.school,
          status: nextStatus,
          payload,
        }),
      });
      if (!response.ok) throw new Error();
      saved(await response.json());
    } catch {
      setMessage("Não foi possível salvar o checklist. Tente novamente.");
      setSaving(false);
    }
  }
  return (
    <div className="overlay checklist-overlay" onMouseDown={close}>
      <div
        className="checklist-editor"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <span>CHECKLIST DE ATENDIMENTO</span>
            <h2>{school.school}</h2>
            <p>{school.neighborhood} · {school.source}</p>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </header>
        <div className="checklist-progress">
          <div>
            <b>
              {answered} de {totalQuestions}
            </b>
            <span>itens respondidos</span>
          </div>
          <progress value={answered} max={totalQuestions} />
        </div>
        <section className="checklist-section">
          <h3>Identificação da visita</h3>
          <div className="checklist-fields">
            <label>
              Nº da Ordem de Serviço
              <input
                value={payload.serviceOrder}
                onChange={(e) => update("serviceOrder", e.target.value)}
              />
            </label>
            <label>
              Data da visita
              <input
                type="date"
                value={payload.visitDate}
                onChange={(e) => update("visitDate", e.target.value)}
              />
            </label>
            <label>
              Técnico responsável
              <input
                value={payload.technician}
                onChange={(e) => update("technician", e.target.value)}
              />
            </label>
            <label>
              Necessário intervenção?
              <select
                value={payload.needsIntervention}
                onChange={(e) => update("needsIntervention", e.target.value)}
              >
                <option value="">Selecione</option>
                <option>Sim</option>
                <option>Não</option>
              </select>
            </label>
            <label>
              Distrito / bairro
              <input
                value={payload.district}
                onChange={(e) => update("district", e.target.value)}
              />
            </label>
            <label>
              Provedor
              <input
                value={payload.provider}
                onChange={(e) => update("provider", e.target.value)}
              />
            </label>
            <label>
              Tipo/modelo de roteador
              <input
                value={payload.router}
                onChange={(e) => update("router", e.target.value)}
              />
            </label>
            <label>
              IP do NVR
              <input
                value={payload.nvrIp}
                onChange={(e) => update("nvrIp", e.target.value)}
              />
            </label>
            <label>
              IP da central de alarme
              <input
                value={payload.alarmIp}
                onChange={(e) => update("alarmIp", e.target.value)}
              />
            </label>
            <label>
              IP do facial/catraca
              <input
                value={payload.accessIp}
                onChange={(e) => update("accessIp", e.target.value)}
              />
            </label>
          </div>
        </section>
        {sections.map((section) => (
          <section className="checklist-section" key={section.title}>
            <h3>{section.title}</h3>
            <div className="checklist-questions">
              {section.questions.map((question) => (
                <label key={question}>
                  <span>{question}</span>
                  <select
                    value={payload.answers[question] || ""}
                    onChange={(e) => answer(question, e.target.value)}
                  >
                    <option value="">Selecione</option>
                    <option>Sim</option>
                    <option>Não</option>
                    <option>Não se aplica</option>
                  </select>
                </label>
              ))}
            </div>
            {section.title === "Sistema de alarme" && (
              <label className="checklist-note">
                Zonas abertas ou falhas
                <textarea
                  rows={2}
                  value={payload.openZones}
                  onChange={(e) => update("openZones", e.target.value)}
                />
              </label>
            )}
            {section.title === "Rack e infraestrutura" && (
              <label className="checklist-note">
                Portas PoE sem utilização
                <textarea
                  rows={2}
                  value={payload.unusedPoePorts}
                  onChange={(e) => update("unusedPoePorts", e.target.value)}
                />
              </label>
            )}
          </section>
        ))}
        <section className="checklist-section">
          <h3>Resultado do atendimento</h3>
          <div className="checklist-fields">
            <label>
              Situação final
              <select
                value={payload.finalResult}
                onChange={(e) => update("finalResult", e.target.value)}
              >
                <option value="">Selecione</option>
                <option>Sistema normalizado e operacional</option>
                <option>Sistema parcialmente operacional</option>
                <option>Pendência identificada</option>
                <option>Necessário retorno técnico</option>
                <option>Necessário acompanhamento do suporte/NOC</option>
              </select>
            </label>
            <label>
              Responsável pela unidade
              <input
                value={payload.unitResponsible}
                onChange={(e) => update("unitResponsible", e.target.value)}
              />
            </label>
            <label className="wide">
              Pendências e observações
              <textarea
                rows={5}
                value={payload.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </label>
          </div>
        </section>
        {message && <p className="form-message">{message}</p>}
        <footer>
          <button onClick={close}>Cancelar</button>
          <button onClick={() => downloadValidationPdf(school, payload)}>
            <FileDown />
            Gerar PDF
          </button>
          <button disabled={saving} onClick={() => void submit("Em andamento")}>
            <Save />
            Salvar rascunho
          </button>
          <button
            className="primary"
            disabled={saving}
            onClick={() => void submit("Concluído")}
          >
            <CheckCircle2 />
            Concluir validação
          </button>
        </footer>
      </div>
    </div>
  );
}
