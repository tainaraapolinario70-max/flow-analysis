"""Importa a aba principal do relatório XML do Excel para a base da aplicação.

O arquivo .xls exportado pela aplicação é um SpreadsheetML (XML). O script não
executa nem interpreta conteúdo do relatório: lê somente a aba "1. Unidades",
associa cada linha à unidade da base e atualiza os dados consolidados.
"""
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHOOLS_PATH = ROOT / "data" / "schools.json"
PROVIDERS_PATH = ROOT / "data" / "providers.json"
NS = {"ss": "urn:schemas-microsoft-com:office:spreadsheet"}


def clean(value):
    return re.sub(r"\s+", " ", (value or "").strip())


def normalize(value):
    value = unicodedata.normalize("NFD", clean(value)).encode("ascii", "ignore").decode().upper()
    value = re.sub(r"\b(ESCOLA|E|M|MUNICIPAL|MUN|PROFESSORA|PROFESSOR)\b", " ", value)
    return re.sub(r"[^A-Z0-9]+", " ", value).strip()


def similarity(left, right):
    a, b = set(normalize(left).split()), set(normalize(right).split())
    return len(a & b) / max(1, len(a | b))


def cell_values(row):
    values, column = [], 1
    for cell in row.findall("ss:Cell", NS):
        indexed = cell.get("{urn:schemas-microsoft-com:office:spreadsheet}Index")
        if indexed:
            column = int(indexed)
        while len(values) < column - 1:
            values.append("")
        data = cell.find("ss:Data", NS)
        values.append(clean(data.text if data is not None else ""))
        column += 1
    return values


def parse_report(path):
    root = ET.parse(path).getroot()
    sheet = next((x for x in root.findall("ss:Worksheet", NS)
                  if x.get("{urn:schemas-microsoft-com:office:spreadsheet}Name") == "1. Unidades"), None)
    if sheet is None:
        raise ValueError("A aba '1. Unidades' não foi encontrada.")
    rows = sheet.findall("ss:Table/ss:Row", NS)
    header_index = next(i for i, row in enumerate(rows) if "Unidade escolar" in cell_values(row))
    header = cell_values(rows[header_index])
    result = []
    for row in rows[header_index + 1:]:
        values = cell_values(row)
        if not values or not values[0].isdigit():
            continue
        result.append(dict(zip(header, values)))
    return result


def list_value(value):
    value = clean(value)
    return [] if value in {"", "N/D", "Não informado", "Sem observação"} else [x.strip() for x in value.split(";") if x.strip()]


def number(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def main(report_path):
    rows = parse_report(Path(report_path))
    schools = json.loads(SCHOOLS_PATH.read_text(encoding="utf-8"))
    providers = json.loads(PROVIDERS_PATH.read_text(encoding="utf-8"))
    by_key = {normalize(s["school"]): s for s in schools}
    imported, unmatched, fuzzy = 0, [], []

    for row in rows:
        name = row["Unidade escolar"]
        school = by_key.get(normalize(name))
        if school is None:
            candidates = sorted(((similarity(name, s["school"]), s) for s in schools), reverse=True, key=lambda x: x[0])
            if candidates and candidates[0][0] >= 0.74:
                school = candidates[0][1]
                fuzzy.append({"report": name, "school": school["school"], "score": round(candidates[0][0], 3)})
            else:
                unmatched.append(name)
                continue

        school["systemRegistered"] = row["Situação no sistema"] == "JÁ EXISTE NO SISTEMA"
        school["providers"] = list_value(row["Provedor de internet"])
        providers[str(school["id"])] = school["providers"]
        school["remoteAccess"] = {
            "account": row["Conta (NAME)"],
            "address": row["REMOTE-ADDRESS"],
            "port": row["Porta"],
            "service": row["Serviço / perfil"],
        }
        school["equipmentInfo"] = row["Informações dos equipamentos"]
        school["facialCount"] = number(row["Faciais"])
        school["turnstileCount"] = number(row["Catracas"])
        school["pneTurnstileCount"] = number(row["Catracas PNE"])
        school["statuses"] = list_value(row["Status atual"])
        school["serviceOrders"] = list_value(row["O.S."])
        school["osState"] = "COM O.S." if school["serviceOrders"] else ("SEM O.S." if row["O.S."] == "SEM O.S." else "N/D")
        school["ips"] = list_value(row["IPs cadastrados"])
        observation = clean(row["Observações adicionadas"])
        school["observation"] = "" if observation in {"", "N/D", "Sem observação"} else observation
        school["needsAttention"] = bool(school["statuses"] or school["observation"])
        school["sources"] = ["Relatório de fluxo escolar 22/09/2026"]
        imported += 1

    SCHOOLS_PATH.write_text(json.dumps(schools, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PROVIDERS_PATH.write_text(json.dumps(providers, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"report_rows": len(rows), "imported": imported, "fuzzy_matches": fuzzy, "unmatched": unmatched}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main(sys.argv[1])
