/**
 * Sabor à Mesa · Pedidos de Natal
 * Recebe os pedidos do site e organiza na planilha.
 *
 * Esta versão NÃO usa fórmulas na planilha (nada de vírgula ou ponto e vírgula):
 * o próprio script calcula o status, a Produção e a Agenda.
 *
 * Como instalar (passo a passo completo no LEIA-ME.md):
 *  1. Planilha → Extensões → Apps Script
 *  2. Cole este arquivo inteiro no lugar do que estiver lá e salve
 *  3. Rode a função "configurar" uma vez (autorize quando pedir)
 *  4. Implantar → Gerenciar implantações → lápis → Versão: "Nova versão" → Implantar
 *     (na primeira vez: Implantar → Nova implantação → App da Web,
 *      Executar como: Eu · Quem pode acessar: Qualquer pessoa)
 */

const VERSAO = 'v3-sem-formulas';
const ABA_PEDIDOS = 'Pedidos';
const ABA_ITENS = 'Itens';
const ABA_PRODUCAO = 'Produção';
const ABA_AGENDA = 'Agenda';
const STATUS = ['Novo', 'Confirmado', 'Pago', 'Pronto', 'Entregue', 'Cancelado'];

const CAB_PEDIDOS = ['Recebido em', 'Código', 'Status', 'Nome', 'WhatsApp', 'Data do evento', 'Período',
  'Retirada/Entrega', 'Endereço', 'Pagamento', 'Pratos', 'Total estimado', 'Observações', 'Pessoas'];
const CAB_ITENS = ['Código', 'Data do evento', 'Período', 'Categoria', 'Prato', 'Quantidade', 'Unidade', 'Subtotal', 'Status do pedido'];
const CAB_PRODUCAO = ['Data', 'Período', 'Categoria', 'Prato', 'Quantidade', 'Unidade', 'Nº de pedidos'];
const CAB_AGENDA = ['Data', 'Período', 'Status', 'Código', 'Nome', 'WhatsApp', 'Retirada/Entrega', 'Endereço',
  'Pagamento', 'Pratos', 'Total estimado', 'Observações'];

/* ======================= Menu e gatilhos ======================= */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Pedidos')
    .addItem('Atualizar Produção e Agenda', 'atualizarTudo')
    .addSeparator()
    .addItem('Configurar / consertar a planilha', 'configurar')
    .addToUi();
}

/** Quando ela muda o Status na aba Pedidos, a Produção e a Agenda se atualizam sozinhas. */
function onEdit(e) {
  try {
    const aba = e.range.getSheet().getName();
    if (aba === ABA_PEDIDOS || aba === ABA_ITENS) atualizarTudo();
  } catch (err) { /* ignora */ }
}

/* ======================= Configuração ======================= */

/** Rode uma vez. Pode rodar de novo: não apaga pedidos, só arruma o formato e tira fórmulas antigas. */
function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('America/Sao_Paulo');

  const ped = aba_(ss, ABA_PEDIDOS, CAB_PEDIDOS);
  ped.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
  ped.getRange('F:F').setNumberFormat('dd/MM/yyyy');
  ped.getRange('L:L').setNumberFormat('"R$" #,##0.00');
  ped.getRange('K:K').setWrap(true);
  ped.getRange('M:M').setWrap(true);
  larguras_(ped, [130, 120, 110, 180, 130, 110, 90, 120, 260, 120, 340, 110, 220, 160]);
  ped.getRange('C2:C').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUS, true).setAllowInvalid(false).build());
  coresStatus_(ped, 'C2:C');

  const itens = aba_(ss, ABA_ITENS, CAB_ITENS);
  itens.getRange('B:B').setNumberFormat('dd/MM/yyyy');
  itens.getRange('F:F').setNumberFormat('0.0#');
  itens.getRange('H:H').setNumberFormat('"R$" #,##0.00');
  larguras_(itens, [120, 110, 90, 150, 320, 100, 110, 110, 130]);

  const prod = ss.getSheetByName(ABA_PRODUCAO) || ss.insertSheet(ABA_PRODUCAO);
  prod.clear();
  prod.getRange('A1').setValue('O que produzir em cada dia — soma dos pedidos que não estão cancelados (atualiza sozinho)')
    .setFontWeight('bold').setFontSize(12);
  larguras_(prod, [110, 90, 150, 340, 100, 110, 110]);
  prod.setFrozenRows(3);

  const ag = ss.getSheetByName(ABA_AGENDA) || ss.insertSheet(ABA_AGENDA);
  ag.clear();
  ag.getRange('A1').setValue('Pedidos por data — o status é alterado na aba Pedidos (atualiza sozinho)')
    .setFontWeight('bold').setFontSize(12);
  larguras_(ag, [110, 90, 110, 120, 180, 130, 120, 240, 120, 320, 110, 220]);
  ag.setFrozenRows(3);
  coresStatus_(ag, 'C4:C');

  consertarAntigos_(ss);

  [ABA_PRODUCAO, ABA_AGENDA, ABA_PEDIDOS, ABA_ITENS].forEach((n, i) => {
    ss.setActiveSheet(ss.getSheetByName(n));
    ss.moveActiveSheet(i + 1);
  });
  ['Página1', 'Sheet1', 'Planilha1'].forEach((n) => {
    const s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  atualizarTudo();
  ss.setActiveSheet(ss.getSheetByName(ABA_PRODUCAO));
}

/** Nome antigo, mantido para quem seguiu a instrução anterior. */
function consertarFormulas() { configurar(); }

/** Troca as fórmulas das versões anteriores por valores/links normais. */
function consertarAntigos_(ss) {
  const ped = ss.getSheetByName(ABA_PEDIDOS);
  if (ped.getLastRow() > 1) {
    const n = ped.getLastRow() - 1;
    const range = ped.getRange(2, 5, n, 1);
    const formulas = range.getFormulas();
    const textos = range.getDisplayValues();
    for (let k = 0; k < n; k++) {
      const bruto = formulas[k][0] || textos[k][0];
      const numero = (/wa\.me\/(\d+)/.exec(bruto) || [])[1] || bruto;
      const rt = linkWhats_(numero);
      if (rt) ped.getRange(k + 2, 5).setRichTextValue(rt);
      else if (formulas[k][0]) ped.getRange(k + 2, 5).setValue('');
    }
  }
}

/* ======================= Recebimento do pedido ======================= */

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss.getSheetByName(ABA_PEDIDOS) || !ss.getSheetByName(ABA_ITENS)) configurar();
    const ped = ss.getSheetByName(ABA_PEDIDOS);
    const itensAba = ss.getSheetByName(ABA_ITENS);

    const codigo = txt_(d.codigo, 40);
    if (!codigo) return json_({ ok: false, erro: 'sem código' });
    if (ped.getRange('B:B').createTextFinder(codigo).matchEntireCell(true).findNext()) {
      return json_({ ok: true, duplicado: true, versao: VERSAO });
    }

    const dataEvento = data_(d.data);
    const itens = Array.isArray(d.itens) ? d.itens.slice(0, 60) : [];
    const pratos = itens.map((i) => `${txt_(i.texto, 60)} · ${txt_(i.nome, 160)}`).join('\n');

    const linha = ped.getLastRow() + 1;
    ped.getRange(linha, 1, 1, CAB_PEDIDOS.length).setValues([[
      new Date(), codigo, 'Novo', txt_(d.nome, 120), txt_(d.whatsapp, 30), dataEvento, txt_(d.periodo, 30),
      txt_(d.tipo, 20), txt_(d.endereco, 400), txt_(d.pagamento, 40), pratos, num_(d.total),
      txt_(d.obs, 1000), txt_(d.pessoas, 80),
    ]]);
    const rt = linkWhats_(d.whatsapp);
    if (rt) ped.getRange(linha, 5).setRichTextValue(rt);

    if (itens.length) {
      const inicio = itensAba.getLastRow() + 1;
      const linhas = itens.map((i) => [
        codigo, dataEvento, txt_(d.periodo, 30), txt_(i.categoria, 60), txt_(i.nome, 160),
        num_(i.qtd), txt_(i.unidade, 30), num_(i.subtotal), 'Novo',
      ]);
      itensAba.getRange(inicio, 1, linhas.length, linhas[0].length).setValues(linhas);
    }

    SpreadsheetApp.flush();
    atualizarTudo();
    return json_({ ok: true, versao: VERSAO });
  } catch (err) {
    return json_({ ok: false, erro: String(err), versao: VERSAO });
  } finally {
    lock.releaseLock();
  }
}

/** Abrir a URL /exec no navegador mostra "ok" e a versão — serve para conferir a implantação. */
function doGet() {
  return ContentService.createTextOutput(`ok — Pedidos Sabor à Mesa · ${VERSAO}`);
}

/* ======================= Produção e Agenda ======================= */

function atualizarTudo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ped = ss.getSheetByName(ABA_PEDIDOS);
  const itensAba = ss.getSheetByName(ABA_ITENS);
  if (!ped || !itensAba) return;

  // Status de cada pedido
  const nPed = Math.max(ped.getLastRow() - 1, 0);
  const pedidos = nPed ? ped.getRange(2, 1, nPed, CAB_PEDIDOS.length).getValues() : [];
  const whatsRt = nPed ? ped.getRange(2, 5, nPed, 1).getRichTextValues() : [];
  const statusPorCodigo = {};
  pedidos.forEach((r) => { if (r[1]) statusPorCodigo[String(r[1])] = String(r[2] || ''); });

  // Itens: copia o status do pedido (coluna I)
  const nIt = Math.max(itensAba.getLastRow() - 1, 0);
  const itens = nIt ? itensAba.getRange(2, 1, nIt, CAB_ITENS.length).getValues() : [];
  if (nIt) {
    const novos = itens.map((r) => [statusPorCodigo[String(r[0])] || '']);
    itensAba.getRange(2, 9, nIt, 1).setValues(novos);
    novos.forEach((s, k) => { itens[k][8] = s[0]; });
  }

  // Produção: soma por data, período, categoria, prato
  const decimalVirgula = !/^en/.test(ss.getSpreadsheetLocale() || '');
  const soma = {};
  itens.forEach((r) => {
    if (!r[0] || r[8] === 'Cancelado') return;
    const t = r[1] instanceof Date ? r[1].getTime() : 0;
    const chave = [t, r[2], r[3], r[4], r[6]].join('|');
    const s = soma[chave] || (soma[chave] = { data: r[1], periodo: r[2], categoria: r[3], prato: r[4], unidade: r[6], qtd: 0, pedidos: {} });
    s.qtd += Number(r[5]) || 0;
    s.pedidos[r[0]] = true;
  });
  const prodLinhas = Object.keys(soma).map((k) => soma[k]).sort((a, b) =>
    tempo_(a.data) - tempo_(b.data) || cmp_(a.periodo, b.periodo) || cmp_(a.categoria, b.categoria) || cmp_(a.prato, b.prato))
    .map((s) => [s.data, s.periodo, s.categoria, s.prato, qtdTexto_(s.qtd, decimalVirgula), s.unidade, Object.keys(s.pedidos).length]);
  escreverTabela_(ss.getSheetByName(ABA_PRODUCAO), CAB_PRODUCAO, prodLinhas, (sh, n) => {
    sh.getRange(4, 1, n, 1).setNumberFormat('dd/MM/yyyy');
    sh.getRange(4, 5, n, 1).setHorizontalAlignment('right');
    separarDias_(sh, prodLinhas);
  }, 'Nenhum pedido ainda');

  // Agenda: pedidos por data (sem cancelados)
  const idx = pedidos.map((r, k) => k).filter((k) => pedidos[k][1] && pedidos[k][2] !== 'Cancelado')
    .sort((a, b) => tempo_(pedidos[a][5]) - tempo_(pedidos[b][5]) || cmp_(pedidos[a][6], pedidos[b][6]) || tempo_(pedidos[a][0]) - tempo_(pedidos[b][0]));
  const agLinhas = idx.map((k) => {
    const r = pedidos[k];
    return [r[5], r[6], r[2], r[1], r[3], r[4], r[7], r[8], r[9], r[10], r[11], r[12]];
  });
  escreverTabela_(ss.getSheetByName(ABA_AGENDA), CAB_AGENDA, agLinhas, (sh, n) => {
    sh.getRange(4, 1, n, 1).setNumberFormat('dd/MM/yyyy');
    sh.getRange(4, 11, n, 1).setNumberFormat('"R$" #,##0.00');
    sh.getRange(4, 10, n, 1).setWrap(true);
    const links = idx.map((k) => [whatsRt[k] && whatsRt[k][0] && whatsRt[k][0].getText() ? whatsRt[k][0] : texto_(pedidos[k][4])]);
    sh.getRange(4, 6, n, 1).setRichTextValues(links);
    separarDias_(sh, agLinhas);
  }, 'Nenhum pedido ainda');
}

function escreverTabela_(sh, cab, linhas, formatar, vazio) {
  if (!sh) return;
  const ultima = Math.max(sh.getMaxRows(), 4);
  sh.getRange(3, 1, ultima - 2, Math.max(cab.length, sh.getMaxColumns())).clearContent().setBorder(false, false, false, false, false, false);
  sh.getRange(3, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#7a0e19').setFontColor('#ffffff');
  if (!linhas.length) { sh.getRange(4, 1).setValue(vazio); return; }
  sh.getRange(4, 1, linhas.length, cab.length).setValues(linhas);
  if (formatar) formatar(sh, linhas.length);
}

/** Linha mais grossa entre um dia e outro, para ler fácil. */
function separarDias_(sh, linhas) {
  for (let k = 1; k < linhas.length; k++) {
    if (tempo_(linhas[k][0]) !== tempo_(linhas[k - 1][0])) {
      sh.getRange(4 + k, 1, 1, linhas[0].length)
        .setBorder(true, null, null, null, null, null, '#7a0e19', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    }
  }
}

/* ======================= auxiliares ======================= */

function aba_(ss, nome, cab) {
  const s = ss.getSheetByName(nome) || ss.insertSheet(nome);
  s.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#7a0e19').setFontColor('#ffffff');
  s.setFrozenRows(1);
  return s;
}

function larguras_(sh, ws) { ws.forEach((w, i) => sh.setColumnWidth(i + 1, w)); }

function coresStatus_(sheet, a1) {
  const range = sheet.getRange(a1);
  const cores = { Novo: '#fff3c4', Confirmado: '#dbe8ff', Pago: '#d6f0dc', Pronto: '#e7dcff', Entregue: '#e6e6e6', Cancelado: '#f6d6d6' };
  const outras = sheet.getConditionalFormatRules().filter((r) => !r.getRanges().some((x) => x.getA1Notation() === range.getA1Notation()));
  const novas = Object.keys(cores).map((st) => SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(st).setBackground(cores[st]).setRanges([range]).build());
  sheet.setConditionalFormatRules(outras.concat(novas));
}

/** Link clicável para o WhatsApp do cliente, sem fórmula. */
function linkWhats_(whats) {
  let tel = String(whats || '').replace(/\D/g, '');
  if (tel.startsWith('55') && tel.length > 11) tel = tel.slice(2);
  tel = tel.slice(0, 11);
  if (tel.length < 10) return null;
  const rotulo = tel.length === 11
    ? `(${tel.slice(0, 2)}) ${tel.slice(2, 7)}-${tel.slice(7)}`
    : `(${tel.slice(0, 2)}) ${tel.slice(2, 6)}-${tel.slice(6)}`;
  return SpreadsheetApp.newRichTextValue().setText(rotulo).setLinkUrl(`https://wa.me/55${tel}`).build();
}
function texto_(v) { return SpreadsheetApp.newRichTextValue().setText(String(v == null ? '' : v)).build(); }

function qtdTexto_(n, virgula) {
  const s = String(Math.round(n * 100) / 100);
  return virgula ? s.replace('.', ',') : s;
}
function tempo_(v) { return v instanceof Date ? v.getTime() : 0; }
function cmp_(a, b) { return String(a || '').localeCompare(String(b || ''), 'pt-BR'); }

// Texto seguro: corta o tamanho e impede que vire fórmula
function txt_(v, max) {
  let s = String(v == null ? '' : v).slice(0, max || 500);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function num_(v) {
  const n = Number(v);
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
function data_(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : '';
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
