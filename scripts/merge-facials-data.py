import json, re, unicodedata, subprocess
from pathlib import Path
import pandas as pd

SOURCE=Path('/workspace/scratch/67147e150696/upload/01-faciais_agrupados_por_escola.xlsx')
DATA=Path(__file__).resolve().parents[1]/'data'/'schools.json'

def clean(v):
    if pd.isna(v): return ''
    return re.sub(r'\s+',' ',str(v)).strip()

def norm(v):
    v=unicodedata.normalize('NFKD',clean(v)).encode('ascii','ignore').decode().upper()
    v=re.sub(r'[^A-Z0-9 ]',' ',v)
    v=re.sub(r'\s+',' ',v).strip()
    for a,b in {
      'ESCOLA MUNICIPAL ':'','ESCOLA MUN ':'','E M ':'','EM ':'',
      'CENTRO MUNICIPAL DE EDUCACAO INFANTIL ':'CMEI ',
      'CENTRO MUNICIAL DE EDUCACAO INFANTIL ':'CMEI ',
      'C M E I ':'CMEI ','PROFESSORA ':'PROF ','PROFESSOR ':'PROF ',
      'DOUTORA ':'DRA ','DOUTOR ':'DR '
    }.items(): v=v.replace(a,b)
    return re.sub(r'\s+',' ',v).strip()

def score(a,b):
    A,B=set(a.split()),set(b.split())
    return len(A&B)/max(1,len(A|B))

records=json.loads(subprocess.check_output(['git','show','HEAD:data/schools.json'],cwd=DATA.parents[1]))
aliases={
 norm('CMEI IRMA ROSA DE LIMA'):norm('CENTRO MUNICIPAL DE EDUCAÇÃO INFANTIL IRMA ROSA DE LIMA CARIBE AMORIM'),
 norm('E. M. JOSE MARTINS DOS SANTOS'):norm('ESCOLA JOSE MARTINS DOS SANTOS'),
 norm('E. M. MARIA ESTHER FALCAO DE FREITAS'):norm('ESCOLA MUNICIPAL MARIA ESTER FALCAO DE FREITAS')
}
for r in records:
    r['facials']=[];r['facialCount']=0;r['pneCount']=0;r['commonCount']=0;r['disabledCount']=0;r['subnet']=''

details=pd.read_excel(SOURCE,sheet_name='Faciais por Escola',header=3)
matched_ids=set();added=[]
for school,group in details.groupby('Escola',sort=False):
    name=clean(school);key=norm(name);key=aliases.get(key,key)
    target=next((r for r in records if norm(r['school'])==key),None)
    if not target:
        ranked=sorted(((score(key,norm(r['school'])),r) for r in records),key=lambda x:x[0],reverse=True)
        target=ranked[0][1] if ranked and ranked[0][0]>=.90 else None
    if not target:
        target={'id':max(r['id'] for r in records)+1,'school':name,'ips':[],'observation':'','statuses':[],
                'serviceOrders':[],'osState':'N/D','sources':[],'needsAttention':False}
        records.append(target);added.append(name)
    matched_ids.add(target['id']);target['school']=name
    facials=[]
    for _,row in group.iterrows():
        rules=None if pd.isna(row['Nº de regras']) else int(row['Nº de regras'])
        facials.append({'name':clean(row['Equipamento']),'type':clean(row['Tipo']),'ip':clean(row['IP']),
                        'direction':clean(row['Direção']),'rules':rules,'disabled':clean(row['Situação']).lower()=='desativado'})
    target['facials']=facials;target['ips']=[f['ip'] for f in facials]
    target['facialCount']=len(facials);target['pneCount']=sum(f['type']=='PNE' for f in facials)
    target['commonCount']=sum(f['type']=='Comum' for f in facials);target['disabledCount']=sum(f['disabled'] for f in facials)
    first=target['ips'][0].split('.') if target['ips'] else []
    target['subnet']='.'.join(first[:3])+'.0/24' if len(first)==4 else ''
    if 'Faciais agrupados por escola' not in target['sources']:target['sources'].append('Faciais agrupados por escola')

old_unmatched=[]
for r in records:
    if r['id'] not in matched_ids and r.get('ips'):
        old_unmatched.append(r['school']);r['ips']=[]
    r['needsAttention']=bool(r.get('statuses') or r.get('observation'))

DATA.write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'total_schools':len(records),'schools_with_facials':sum(bool(r['facials']) for r in records),
 'facials':sum(r['facialCount'] for r in records),'pne':sum(r['pneCount'] for r in records),
 'disabled':sum(r['disabledCount'] for r in records),'new_schools':added,'old_ip_schools_not_found':old_unmatched},ensure_ascii=False,indent=2))
