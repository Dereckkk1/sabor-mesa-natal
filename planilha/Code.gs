/**
 * Sabor à Mesa · Pedidos de Natal
 * Recebe os pedidos do site e organiza na planilha.
 *
 * Como instalar (passo a passo completo no LEIA-ME.md):
 *  1. Planilha nova no Google Planilhas → Extensões → Apps Script
 *  2. Cole este arquivo inteiro no lugar do que estiver lá e salve
 *  3. Rode a função "configurar" uma vez (autorize quando pedir)
 *  4. Implantar → Nova implantação → App da Web
 *     Executar como: Eu · Quem pode acessar: Qualquer pessoa
 *  5. Copie a URL que termina em /exec e cole em planilhaUrl no config.js
 */

const ABA_PEDIDOS = 'Pedidos';
const ABA_ITENS = 'Itens';
const ABA_PRODUCAO = 'Produção';
const ABA_AGENDA = 'Agenda';
const STATUS = ['Novo', 'Confirmado', 'Pago', 'Pronto', 'Entregue', 'Cancelado'];

const CAB_PEDIDOS = ['Recebido em', 'Código', 'Status', 'Nome', 'WhatsApp', 'Data do evento', 'Período',
  'Retirada/Entrega', 'Endereço', 'Pagamento', 'Pratos', 'Total estimado', 'Observações', 'Pessoas'];
const CAB_ITENS = ['Código', 'Data do evento', 'Período', 'Categoria', 'Prato', 'Quantidade', 'Unidade', 'Subtotal', 'Status do pedido'];

/** Rode uma vez para criar as abas. Pode rodar de novo sem perder dados. */
function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('America/Sao_Paulo');

  // Pedidos
  const ped = aba_(ss, ABA_PEDIDOS, CAB_PEDIDOS);
  ped.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
  ped.getRange('F:F').setNumberFormat('dd/MM/yyyy');
  ped.getRange('L:L').setNumberFormat('"R$" #,##0.00');
  ped.getRange('K:K').setWrap(true);
  ped.getRange('M:M').setWrap(true);
  [130, 120, 110, 180, 130, 110, 90, 120, 260, 120, 340, 110, 220, 160].forEach((w, i) => ped.setColumnWidth(i + 1, w));
  const regra = SpreadsheetApp.newDataValidation().requireValueInList(STATUS, true).setAllowInvalid(false).build();
  ped.getRange('C2:C').setDataValidation(regra);
  coresStatus_(ped, 'C2:C');

  // Itens (uma linha por prato; alimenta a aba Produção)
  const itens = aba_(ss, ABA_ITENS, CAB_ITENS);
  itens.getRange('B:B').setNumberFormat('dd/MM/yyyy');
  itens.getRange('F:F').setNumberFormat('0.##');
  itens.getRange('H:H').setNumberFormat('"R$" #,##0.00');
  [120, 110, 90, 150, 320, 100, 110, 110, 130].forEach((w, i) => itens.setColumnWidth(i + 1, w));

  // Produção: soma por dia, período e prato (ignora cancelados)
  const prod = ss.getSheetByName(ABA_PRODUCAO) || ss.insertSheet(ABA_PRODUCAO);
  prod.clear();
  prod.getRange('A1').setValue('O que produzir em cada dia — soma de todos os pedidos que não estão cancelados')
    .setFontWeight('bold').setFontSize(12);
  prod.getRange('A3').setFormula(
    '=IFERROR(QUERY(Itens!A:I,"select B, C, D, E, sum(F), G where A is not null and I <> \'Cancelado\' ' +
    'group by B, C, D, E, G order by B, C, D, E ' +
    'label B \'Data\', C \'Período\', D \'Categoria\', E \'Prato\', sum(F) \'Quantidade\', G \'Unidade\'",1),"Nenhum pedido ainda")');
  prod.getRange('A:A').setNumberFormat('dd/MM/yyyy');
  prod.getRange('E:E').setNumberFormat('0.##');
  prod.getRange('3:3').setFontWeight('bold');
  [110, 90, 150, 340, 100, 110].forEach((w, i) => prod.setColumnWidth(i + 1, w));
  prod.setFrozenRows(3);

  // Agenda: pedidos em ordem de data (ignora cancelados)
  const ag = ss.getSheetByName(ABA_AGENDA) || ss.insertSheet(ABA_AGENDA);
  ag.clear();
  ag.getRange('A1').setValue('Pedidos por data — o status é alterado na aba Pedidos').setFontWeight('bold').setFontSize(12);
  ag.getRange('A3').setFormula(
    '=IFERROR(QUERY(Pedidos!A:N,"select F, G, C, B, D, E, H, I, J, K, L, M where B is not null and C <> \'Cancelado\' order by F, G",1),"Nenhum pedido ainda")');
  ag.getRange('A:A').setNumberFormat('dd/MM/yyyy');
  ag.getRange('K:K').setNumberFormat('"R$" #,##0.00');
  ag.getRange('J:J').setWrap(true);
  ag.getRange('3:3').setFontWeight('bold');
  [110, 90, 110, 120, 180, 130, 120, 240, 120, 320, 110, 220].forEach((w, i) => ag.setColumnWidth(i + 1, w));
  ag.setFrozenRows(3);
  coresStatus_(ag, 'C4:C');

  // Ordem das abas e remoção da aba vazia padrão
  [ABA_PRODUCAO, ABA_AGENDA, ABA_PEDIDOS, ABA_ITENS].forEach((n, i) => {
    ss.setActiveSheet(ss.getSheetByName(n));
    ss.moveActiveSheet(i + 1);
  });
  ['Página1', 'Sheet1', 'Planilha1'].forEach((n) => {
    const s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  ss.setActiveSheet(ss.getSheetByName(ABA_PRODUCAO));
}

/** Recebe o pedido enviado pelo site. */
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
    // Evita duplicar se o cliente tocar duas vezes em enviar
    if (ped.getRange('B:B').createTextFinder(codigo).matchEntireCell(true).findNext()) return json_({ ok: true, duplicado: true });

    const dataEvento = data_(d.data);
    const itens = Array.isArray(d.itens) ? d.itens.slice(0, 60) : [];
    const pratos = itens.map((i) => `${txt_(i.texto, 60)} · ${txt_(i.nome, 160)}`).join('\n');
    const tel = String(d.whatsapp || '').replace(/\D/g, '').slice(0, 13);
    const telLink = tel ? `=HYPERLINK("https://wa.me/${tel.length <= 11 ? '55' + tel : tel}","${txt_(d.whatsapp, 30).replace(/"/g, '')}")` : '';

    ped.appendRow([
      new Date(), codigo, 'Novo', txt_(d.nome, 120), telLink, dataEvento, txt_(d.periodo, 30),
      txt_(d.tipo, 20), txt_(d.endereco, 400), txt_(d.pagamento, 40), pratos, num_(d.total),
      txt_(d.obs, 1000), txt_(d.pessoas, 80),
    ]);

    if (itens.length) {
      const inicio = itensAba.getLastRow() + 1;
      const linhas = itens.map((i, k) => [
        codigo, dataEvento, txt_(d.periodo, 30), txt_(i.categoria, 60), txt_(i.nome, 160),
        num_(i.qtd), txt_(i.unidade, 30), num_(i.subtotal),
        `=IFERROR(VLOOKUP(A${inicio + k},Pedidos!B:C,2,FALSE),"")`,
      ]);
      itensAba.getRange(inicio, 1, linhas.length, linhas[0].length).setValues(linhas);
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, erro: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Abrir a URL /exec no navegador mostra "ok" — serve para testar a implantação. */
function doGet() {
  return ContentService.createTextOutput('ok — Pedidos Sabor à Mesa');
}

/* ---------------- auxiliares ---------------- */
function aba_(ss, nome, cab) {
  const s = ss.getSheetByName(nome) || ss.insertSheet(nome);
  s.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#7a0e19').setFontColor('#ffffff');
  s.setFrozenRows(1);
  return s;
}

function coresStatus_(sheet, a1) {
  const range = sheet.getRange(a1);
  const cores = { Novo: '#fff3c4', Confirmado: '#dbe8ff', Pago: '#d6f0dc', Pronto: '#e7dcff', Entregue: '#e6e6e6', Cancelado: '#f6d6d6' };
  const outras = sheet.getConditionalFormatRules().filter((r) => !r.getRanges().some((x) => x.getA1Notation() === range.getA1Notation()));
  const novas = Object.keys(cores).map((st) => SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(st).setBackground(cores[st]).setRanges([range]).build());
  sheet.setConditionalFormatRules(outras.concat(novas));
}

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
