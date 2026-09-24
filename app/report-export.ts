export type ReportRow={
 school:string;
 system:string;
 provider:string;
 facialTotal:number;
 turnstileTotal:number;
 turnstilePne:number;
 pendencies:string;
 statuses:string;
 serviceOrders:string;
 ips:string;
 observation:string;
};

export type ReportPage={title:string;rows:ReportRow[]};
export type ReportExportOptions={
 provider:boolean;
 equipment:boolean;
 status:boolean;
 serviceOrder:boolean;
 network:boolean;
 security:boolean;
 observations:boolean;
};

const xml=(value:string|number)=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

function download(content:BlobPart[],type:string,name:string){
 const url=URL.createObjectURL(new Blob(content,{type}));
 const link=document.createElement("a");
 link.href=url;
 link.download=name;
 link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

const isInSystem=(row:ReportRow)=>row.system.includes("CADASTRADO NO VIGI-ACCESS")&&!row.system.includes("NÃO CADASTRADO");
const hasPending=(row:ReportRow)=>row.pendencies!=="Sem pendência";
const hasFacials=(row:ReportRow)=>row.facialTotal>0;
const hasLooseFacials=(row:ReportRow)=>(row.facialTotal===1||row.facialTotal===2)&&row.turnstileTotal===0;
const hasTurnstile=(row:ReportRow)=>row.turnstileTotal>0;
const hasPneTurnstile=(row:ReportRow)=>row.turnstilePne>0;

export function buildReportPages(rows:ReportRow[]):ReportPage[]{
 const categoryPages=[
  {title:"Unidades",rows},
  {title:"Cadastradas no VIGI-ACCESS",rows:rows.filter(isInSystem)},
  {title:"Não cadastradas no VIGI-ACCESS",rows:rows.filter(row=>!isInSystem(row))},
  {title:"Com pendências",rows:rows.filter(hasPending)},
  {title:"Com faciais",rows:rows.filter(hasFacials)},
  {title:"Faciais avulsos",rows:rows.filter(hasLooseFacials)},
  {title:"Com catraca",rows:rows.filter(hasTurnstile)},
  {title:"Catraca PNE",rows:rows.filter(hasPneTurnstile)}
 ];
 const providers=Array.from(new Set(rows.flatMap(row=>row.provider.split(";").map(value=>value.trim()).filter(value=>value&&value!=="Não informado"))));
 return [...categoryPages,...providers.map(provider=>({title:`Provedor ${provider}`,rows:rows.filter(row=>row.provider.split(";").map(value=>value.trim()).includes(provider))}))];
}

function reportTotals(rows:ReportRow[]){
 return {
  inSystem:rows.filter(isInSystem).length,
  outSystem:rows.filter(row=>!isInSystem(row)).length,
  pending:rows.filter(hasPending).length,
  facialSchools:rows.filter(hasFacials).length,
  facials:rows.reduce((sum,row)=>sum+row.facialTotal,0),
  looseFacialSchools:rows.filter(hasLooseFacials).length,
  turnstileSchools:rows.filter(hasTurnstile).length,
  turnstiles:rows.reduce((sum,row)=>sum+row.turnstileTotal,0),
  pneSchools:rows.filter(hasPneTurnstile).length,
  pne:rows.reduce((sum,row)=>sum+row.turnstilePne,0),
  serviceOrders:rows.filter(row=>row.serviceOrders!=="SEM O.S."&&row.serviceOrders!=="N/D").length
 };
}

const safeSheetName=(value:string,index:number)=>`${index}. ${value}`.replace(/[\\/\?\*\[\]:]/g," ").slice(0,31);

export function buildExcelXml(title:string,rows:ReportRow[],pages:ReportPage[]=buildReportPages(rows),options?:ReportExportOptions){
 const generatedAt=new Date().toLocaleString("pt-BR"),reportTitle=title||"Relatório de unidades escolares";
 const selected=options||{provider:true,equipment:true,status:true,serviceOrder:true,network:true,security:true,observations:true};
 const columnDefs=[
  {label:"Nº",value:(row:ReportRow,index:number)=>index+1,width:42,kind:"number"},
  {label:"Unidade escolar",value:(row:ReportRow)=>row.school,width:260,kind:"school"},
  {label:"Situação no sistema",value:(row:ReportRow)=>row.system,width:165,kind:"system"},
  ...(selected.provider?[{label:"Provedor de internet",value:(row:ReportRow)=>row.provider,width:140,kind:"text"}]:[]),
  ...(selected.equipment?[{label:"Faciais",value:(row:ReportRow)=>row.facialTotal,width:70,kind:"number"},{label:"Catracas",value:(row:ReportRow)=>row.turnstileTotal,width:78,kind:"number"},{label:"Catracas PNE",value:(row:ReportRow)=>row.turnstilePne,width:92,kind:"number"}]:[]),
  ...(selected.status?[{label:"Pendências por categoria",value:(row:ReportRow)=>row.pendencies,width:230,kind:"pendency"},{label:"Status atual",value:(row:ReportRow)=>row.statuses,width:240,kind:"text"}]:[]),
  ...(selected.serviceOrder?[{label:"O.S.",value:(row:ReportRow)=>row.serviceOrders,width:110,kind:"text"}]:[]),
  ...(selected.network?[{label:"IP(s) do facial",value:(row:ReportRow)=>row.ips,width:210,kind:"text"}]:[]),
  ...((selected.security||selected.observations)?[{label:selected.security&&selected.observations?"Segurança e observações":selected.security?"Infraestrutura de segurança":"Observações",value:(row:ReportRow)=>row.observation,width:340,kind:"text"}]:[])
 ];
 const categoryCounts=new Map<string,number>(),statusCounts=new Map<string,number>();
 rows.forEach(row=>{
  row.pendencies.split(";").map(value=>value.trim()).filter(value=>value&&value!=="Sem pendência").forEach(value=>categoryCounts.set(value,(categoryCounts.get(value)||0)+1));
  row.statuses.split(";").map(value=>value.trim()).filter(value=>value&&value!=="Sem status").forEach(value=>statusCounts.set(value,(statusCounts.get(value)||0)+1));
 });
 const pendencySummary=[...categoryCounts].sort((a,b)=>b[1]-a[1]),statusSummary=[...statusCounts].sort((a,b)=>b[1]-a[1]),totals=reportTotals(rows);
 const cell=(value:string|number,style="Cell",index?:number)=>`<Cell${index?` ss:Index="${index}"`:""} ss:StyleID="${style}"><Data ss:Type="${typeof value==="number"?"Number":"String"}">${xml(value)}</Data></Cell>`;
 const mergedCell=(value:string|number,style:string,mergeAcross:number,index?:number)=>`<Cell${index?` ss:Index="${index}"`:""} ss:MergeAcross="${mergeAcross}" ss:StyleID="${style}"><Data ss:Type="${typeof value==="number"?"Number":"String"}">${xml(value)}</Data></Cell>`;
 const summaryRows=Array.from({length:Math.max(pendencySummary.length,statusSummary.length,1)},(_,index)=>`<Row ss:Height="22">${mergedCell(pendencySummary[index]?.[0]||"","SummaryCell",2)}${cell(pendencySummary[index]?.[1]||"","SummaryNumber")}${mergedCell(statusSummary[index]?.[0]||"","SummaryCell",2,5)}${cell(statusSummary[index]?.[1]||"","SummaryNumber")}</Row>`).join("");
 const detailWorksheet=(page:ReportPage,index:number)=>{
  const body=page.rows.map((row,rowIndex)=>{const base=rowIndex%2===0?"Even":"Odd";return `<Row ss:AutoFitHeight="1">${columnDefs.map(column=>{const value=column.value(row,rowIndex);if(column.kind==="number")return cell(value,`${base}Number`);if(column.kind==="school")return cell(value,`${base}School`);if(column.kind==="system")return cell(value,String(value).includes("CADASTRADO NO VIGI-ACCESS")&&!String(value).includes("NÃO CADASTRADO")?"SystemYes":"SystemNo");if(column.kind==="pendency")return cell(value,value==="Sem pendência"?"Resolved":"Pending");return cell(value,base)}).join("")}</Row>`}).join("");
  const lastColumn=columnDefs.length,mergeAcross=Math.max(0,lastColumn-1);
  return `<Worksheet ss:Name="${xml(safeSheetName(page.title,index))}"><Table>
 ${columnDefs.map(column=>`<Column ss:AutoFitWidth="0" ss:Width="${column.width}"/>`).join("")}
 <Row ss:Height="31"><Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="Title"><Data ss:Type="String">ANÁLISE DE FLUXO — ${xml(page.title)}</Data></Cell></Row>
 <Row ss:Height="23"><Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="Meta"><Data ss:Type="String">${xml(reportTitle)} | Gerado em ${generatedAt} | ${page.rows.length} unidade(s)</Data></Cell></Row>
 <Row ss:Height="42">${columnDefs.map(column=>cell(column.label,"Header")).join("")}</Row>${body}
</Table><AutoFilter x:Range="R3C1:R${Math.max(3,page.rows.length+3)}C${lastColumn}" xmlns="urn:schemas-microsoft-com:office:excel"/><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>3</SplitHorizontal><TopRowBottomPane>3</TopRowBottomPane><DoNotDisplayGridlines/><PageSetup><Layout x:Orientation="Landscape"/><PageMargins x:Bottom="0.5" x:Left="0.25" x:Right="0.25" x:Top="0.5"/></PageSetup><Print><FitWidth>1</FitWidth><ValidPrinterInfo/></Print></WorksheetOptions></Worksheet>`;
 };
 const report=`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
 <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:FontName="Calibri" ss:Size="10"/></Style>
 <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="17" ss:Color="#FFFFFF"/><Interior ss:Color="#30473F" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>
 <Style ss:ID="Meta"><Font ss:Italic="1" ss:Color="#526B62"/><Interior ss:Color="#E3F0E9" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>
 <Style ss:ID="Section"><Font ss:Bold="1" ss:Size="11" ss:Color="#FFFFFF"/><Interior ss:Color="#2F9F87" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>
 <Style ss:ID="MetricLabel"><Font ss:Bold="1" ss:Color="#526B62"/><Interior ss:Color="#EDF6F2" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C9DDD4"/></Borders></Style>
 <Style ss:ID="MetricValue"><Font ss:Bold="1" ss:Size="13" ss:Color="#177A67"/><Interior ss:Color="#EDF6F2" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C9DDD4"/></Borders></Style>
 <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2F9F87" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/></Style>
 <Style ss:ID="Cell"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D5E2DC"/></Borders><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
 <Style ss:ID="Even" ss:Parent="Cell"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
 <Style ss:ID="Odd" ss:Parent="Cell"><Interior ss:Color="#F5F9F7" ss:Pattern="Solid"/></Style>
 <Style ss:ID="EvenSchool" ss:Parent="Even"><Font ss:Bold="1" ss:Color="#233B33"/></Style>
 <Style ss:ID="OddSchool" ss:Parent="Odd"><Font ss:Bold="1" ss:Color="#233B33"/></Style>
 <Style ss:ID="EvenNumber" ss:Parent="Even"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
 <Style ss:ID="OddNumber" ss:Parent="Odd"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
 <Style ss:ID="SystemYes" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#08745E"/><Interior ss:Color="#E3F3EC" ss:Pattern="Solid"/></Style>
 <Style ss:ID="SystemNo" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#9A5A19"/><Interior ss:Color="#FFF2DF" ss:Pattern="Solid"/></Style>
 <Style ss:ID="Resolved" ss:Parent="Cell"><Font ss:Color="#08745E"/><Interior ss:Color="#EDF8F4" ss:Pattern="Solid"/></Style>
 <Style ss:ID="Pending" ss:Parent="Cell"><Font ss:Color="#8A4C13"/><Interior ss:Color="#FFF7E9" ss:Pattern="Solid"/></Style>
 <Style ss:ID="SummaryCell" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#30473F"/></Style>
 <Style ss:ID="SummaryNumber" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#177A67"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
</Styles>
<Worksheet ss:Name="Resumo"><Table>
 <Column ss:AutoFitWidth="0" ss:Width="190"/><Column ss:AutoFitWidth="0" ss:Width="55"/><Column ss:AutoFitWidth="0" ss:Width="190"/><Column ss:AutoFitWidth="0" ss:Width="55"/><Column ss:AutoFitWidth="0" ss:Width="190"/><Column ss:AutoFitWidth="0" ss:Width="55"/><Column ss:AutoFitWidth="0" ss:Width="190"/><Column ss:AutoFitWidth="0" ss:Width="55"/>
 <Row ss:Height="31"><Cell ss:MergeAcross="7" ss:StyleID="Title"><Data ss:Type="String">ANÁLISE DE FLUXO — ${xml(reportTitle)}</Data></Cell></Row>
 <Row ss:Height="23"><Cell ss:MergeAcross="7" ss:StyleID="Meta"><Data ss:Type="String">Relatório gerado em ${generatedAt} | ${rows.length} unidade(s) escolar(es) | Consulte as abas por categoria</Data></Cell></Row>
 <Row ss:Height="8"/>
 <Row ss:Height="24"><Cell ss:MergeAcross="7" ss:StyleID="Section"><Data ss:Type="String">RESUMO EXECUTIVO</Data></Cell></Row>
 <Row ss:Height="29">${cell("Total de unidades","MetricLabel")}${cell(rows.length,"MetricValue")}${cell("Cadastradas no VIGI-ACCESS","MetricLabel")}${cell(totals.inSystem,"MetricValue")}${cell("Não cadastradas no VIGI-ACCESS","MetricLabel")}${cell(totals.outSystem,"MetricValue")}${cell("Com pendências","MetricLabel")}${cell(totals.pending,"MetricValue")}</Row>
 <Row ss:Height="29">${cell("Escolas com faciais","MetricLabel")}${cell(totals.facialSchools,"MetricValue")}${cell("Faciais cadastrados","MetricLabel")}${cell(totals.facials,"MetricValue")}${cell("Escolas com faciais avulsos","MetricLabel")}${cell(totals.looseFacialSchools,"MetricValue")}${cell("Com O.S.","MetricLabel")}${cell(totals.serviceOrders,"MetricValue")}</Row>
 <Row ss:Height="29">${cell("Escolas com catraca","MetricLabel")}${cell(totals.turnstileSchools,"MetricValue")}${cell("Total de catracas","MetricLabel")}${cell(totals.turnstiles,"MetricValue")}${cell("Escolas com catraca PNE","MetricLabel")}${cell(totals.pneSchools,"MetricValue")}${cell("Catracas PNE","MetricLabel")}${cell(totals.pne,"MetricValue")}</Row>
 <Row ss:Height="12"/>
 <Row ss:Height="26">${mergedCell("PENDÊNCIAS POR CATEGORIA","Section",3)}${mergedCell("STATUS ENCONTRADOS","Section",3,5)}</Row>
 ${summaryRows}
</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><Selected/><DoNotDisplayGridlines/></WorksheetOptions></Worksheet>
${pages.map((page,index)=>detailWorksheet(page,index+1)).join("\n")}
</Workbook>`;
 return report;
}

export function exportExcel(title:string,rows:ReportRow[],options?:ReportExportOptions){
 const report=buildExcelXml(title,rows,buildReportPages(rows),options);
 download(["\ufeff",report],"application/vnd.ms-excel;charset=utf-8","analise-de-fluxo-relatorio-escolas.xls");
}

const latin=(value:string)=>Array.from(value.replaceAll("–","-").replaceAll("—","-").replaceAll("•","|")).map(char=>char.charCodeAt(0)<=255?char:"?").join("");
const pdfEscape=(value:string)=>latin(value.replace(/[\r\n\t]+/g," ")).replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)");
const short=(value:string,size:number)=>value.length>size?value.slice(0,size-3)+"...":value;

export function exportPdf(title:string,rows:ReportRow[],options?:ReportExportOptions){
 const selected=options||{provider:true,equipment:true,status:true,serviceOrder:true,network:true,security:true,observations:true};
 const rowLines=(row:ReportRow)=>{
  const lines:{label:string;value:string}[]=[
   {label:selected.provider?"Situação / provedor":"Situação",value:`${row.system}${selected.provider?` | ${row.provider}`:""}`}
  ];
  if(selected.equipment)lines.push({label:"Equipamentos",value:`${row.facialTotal} faciais | ${row.turnstileTotal} catracas | ${row.turnstilePne} catracas PNE${selected.serviceOrder?` | O.S. ${row.serviceOrders}`:""}`});
  if(selected.status)lines.push({label:"Pendências",value:row.pendencies},{label:"Status",value:row.statuses});
  if(selected.serviceOrder&&!selected.equipment)lines.push({label:"O.S.",value:row.serviceOrders});
  if(selected.network)lines.push({label:"IP(s) do facial",value:row.ips});
  if(selected.security||selected.observations)lines.push({label:selected.security&&selected.observations?"Segurança / observações":selected.security?"Segurança":"Observações",value:row.observation});
  return lines;
 };
 const lineCount=rowLines(rows[0]||({system:""} as ReportRow)).length;
 const lineGap=12,cardGap=7,cardHeight=Math.max(52,28+lineCount*lineGap);
 const perPage=Math.max(1,Math.floor((462+cardGap)/(cardHeight+cardGap)));
 const detailPages=Array.from({length:Math.max(1,Math.ceil(rows.length/perPage))},(_,index)=>rows.slice(index*perPage,(index+1)*perPage)),pageCount=detailPages.length;
 const fontRegular=3+pageCount*2,fontBold=fontRegular+1,objects:string[]=[];
 const text=(font:string,size:number,x:number,y:number,value:string)=>`BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(value)}) Tj ET`;
 const pageIds=Array.from({length:pageCount},(_,index)=>3+index*2);
 objects[1]="<< /Type /Catalog /Pages 2 0 R >>";
 objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;
 const allCommands=detailPages.map((page,pageIndex)=>{
  const commands:string[]=[
   "0.19 0.28 0.25 rg 0 515 842 80 re f","1 1 1 rg",
   text("F2",9,28,574,"ANALISE DE FLUXO | UNIDADES DO RELATORIO"),text("F2",15,28,551,title||"Relatório de unidades escolares"),
   text("F1",8.5,28,532,`${rows.length} escola(s) no filtro atual`),text("F1",8.5,748,574,`Página ${pageIndex+1} de ${pageCount}`)
  ];
  page.forEach((row,index)=>{
   const y=493-index*(cardHeight+cardGap),bottom=y+10-cardHeight,lines=rowLines(row);
   commands.push(
    `0.95 0.98 0.97 rg 26 ${bottom} 790 ${cardHeight} re f`,
    `0.18 0.62 0.53 rg 26 ${bottom} 5 ${cardHeight} re f`,
    "0.15 0.23 0.20 rg",
    text("F2",10.5,39,y,short(row.school,104))
   );
   lines.forEach((line,lineIndex)=>{
    const lineY=y-17-lineIndex*lineGap;
    commands.push(
     `0.87 0.94 0.91 rg 39 ${lineY-3} 112 11 re f`,
     "0.10 0.39 0.32 rg",
     text("F2",7.4,44,lineY,line.label.toUpperCase()),
     "0.15 0.23 0.20 rg",
     text("F1",8,158,lineY,short(line.value,105))
    );
   });
  });
  commands.push("0.35 0.45 0.41 rg",text("F1",7.5,28,25,"Análise de Fluxo | Dados consolidados para acompanhamento das unidades escolares"));
  return commands;
 });
 allCommands.forEach((commands,pageIndex)=>{
  const pageId=3+pageIndex*2,contentId=pageId+1,content=latin(commands.join("\n"));
  objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`;
  objects[contentId]=`<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
 });
 objects[fontRegular]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
 objects[fontBold]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
 let pdf=latin("%PDF-1.4\n%âãÏÓ\n"),offsets=[0];
 for(let id=1;id<objects.length;id++){offsets[id]=pdf.length;pdf+=`${id} 0 obj\n${objects[id]}\nendobj\n`}
 const xref=pdf.length;
 pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,"0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 download([Uint8Array.from(Array.from(pdf).map(char=>char.charCodeAt(0)&255))],"application/pdf","analise-de-fluxo-relatorio-escolas.pdf");
}
