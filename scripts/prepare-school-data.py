import json, re, unicodedata
from pathlib import Path
import pandas as pd

UPLOAD = Path('/workspace/scratch/67147e150696/upload')
OUT = Path(__file__).resolve().parents[1] / 'data' / 'schools.json'

def clean(v):
    if pd.isna(v): return ''
    return re.sub(r'\s+', ' ', str(v)).strip()

def norm(v):
    v = unicodedata.normalize('NFKD', clean(v)).encode('ascii', 'ignore').decode().upper()
    v = re.sub(r'[^A-Z0-9 ]', ' ', v)
    replacements = {
      'ESCOLA MUNICIPAL ': '', 'ESCOLA MUN ': '', 'E M ': '', 'EM ': '',
      'CENTRO MUNICIPAL DE EDUCACAO INFANTIL ': 'CMEI ',
      'CENTRO MUNICIAL DE EDUCACAO INFANTIL ': 'CMEI ',
      'C M E I ': 'CMEI ', 'PROFESSORA ': 'PROF ', 'PROFESSOR ': 'PROF ',
      'DOUTORA ': 'DRA ', 'DOUTOR ': 'DR '
    }
    for a,b in replacements.items(): v=v.replace(a,b)
    return re.sub(r'\s+', ' ', v).strip()

mapping_path = UPLOAD / 'Mapeamento_de_Escolas_e_IPs(2).xlsx'
df = pd.read_excel(mapping_path, header=1)
df.columns = ['school','ips','observation']

status_path = UPLOAD / 'Status_das_Escolas_Organizados(1).md'
lines = status_path.read_text(encoding='utf-8').splitlines()
status_rows=[]
for line in lines[2:]:
    if not line.strip().startswith('|'): continue
    cells=[x.strip() for x in line.strip().strip('|').split('|')]
    if len(cells) >= 5:
        status_rows.append({'school':cells[0], 'statuses':[x for x in cells[1:4] if x], 'os':cells[4]})

records=[]
for _,r in df.iterrows():
    name=clean(r.school)
    if not name: continue
    ips=[x.strip() for x in clean(r.ips).split(',') if x.strip()]
    records.append({
      'id': len(records)+1, 'school':name, 'key':norm(name), 'ips':ips,
      'observation':clean(r.observation), 'statuses':[], 'serviceOrders':[],
      'osState':'N/D', 'sources':['Mapeamento de Escolas e IPs']
    })

def score(a,b):
    A=set(a.split()); B=set(b.split())
    return len(A&B)/max(1,len(A|B))

unmatched=[]
for sr in status_rows:
    k=norm(sr['school'])
    exact=next((x for x in records if x['key']==k),None)
    if not exact:
        ranked=sorted(((score(k,x['key']),x) for x in records), key=lambda z:z[0], reverse=True)
        exact=ranked[0][1] if ranked and ranked[0][0] >= .72 else None
    if not exact:
        exact={'id':len(records)+1,'school':sr['school'],'key':k,'ips':[],'observation':'','statuses':[],
               'serviceOrders':[],'osState':'N/D','sources':[]}
        records.append(exact); unmatched.append(sr['school'])
    exact['statuses']=sr['statuses']
    os_text=sr['os']
    exact['serviceOrders']=re.findall(r'\b\d{4,}\b',os_text)
    exact['osState']='COM O.S.' if exact['serviceOrders'] else ('SEM O.S.' if 'SEM O.S' in os_text else 'N/D')
    exact['sources'].append('Status e Ordens de Serviço')

for x in records:
    x.pop('key',None)
    x['needsAttention']=bool(x['statuses'] or x['observation'])

OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'total':len(records),'with_ips':sum(bool(x['ips']) for x in records),'with_status':sum(bool(x['statuses']) for x in records),'unmatched_added':len(unmatched),'unmatched':unmatched},ensure_ascii=False,indent=2))
