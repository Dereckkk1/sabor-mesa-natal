/* Sabor à Mesa · Cardápio de Natal — calculadora + pedido (sem backend) */
(() => {
  'use strict';

  const C = window.SABOR;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const dec = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const money = (v) => brl.format(v);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const round2 = (n) => Math.round(n * 100) / 100;

  /* ---------------- Cardápio ---------------- */
  const CATS = {};
  const ITEMS = [];
  const BY_ID = {};
  C.categorias.forEach((cat) => {
    CATS[cat.id] = cat;
    cat.itens.forEach((it) => {
      const item = { ...it, categoria: cat.id, categoriaNome: cat.nome, grupo: it.grupo || cat.grupo || it.id };
      ITEMS.push(item);
      BY_ID[item.id] = item;
    });
  });

  const passo = (item) => (item.tipo === 'kg' ? C.calculadora.passoKg || 0.5 : 1);

  function fmtQtd(item, q) {
    if (item.tipo === 'kg') return `${dec.format(q)} kg`;
    if (item.tipo === 'pacote') {
      const [um, varios] = item.embNome || ['pote', 'potes'];
      return `${q} ${q === 1 ? um : varios} de ${item.emb}`;
    }
    return `${q} un.${item.emb ? ` (${item.emb})` : ''}`;
  }
  function unidadeProducao(item) {
    if (item.tipo === 'kg') return 'kg';
    if (item.tipo === 'pacote') return `${(item.embNome || ['pote'])[0]} ${item.emb}`;
    return 'un.';
  }
  function fmtPrecoHtml(item) {
    const suf = item.tipo === 'kg' ? '/kg' : item.emb ? item.emb : 'unidade';
    return `${money(item.preco)}<small>${esc(suf)}</small>`;
  }
  function fmtPrecoTxt(item) {
    if (item.tipo === 'kg') return `${money(item.preco)}/kg`;
    return `${money(item.preco)} ${item.emb ? `(${item.emb})` : 'a unidade'}`;
  }

  const ICONS = {
    folha: '<path d="M5 19C5 10 11 5 20 4c-1 9-6 15-15 15zM5 19l8-8"/>',
    cloche: '<path d="M3 18h18M5 18a7 7 0 0 1 14 0M12 9V7M10 7h4"/>',
    tigela: '<path d="M3 12h18a9 8 0 0 1-18 0zM8.5 8c0-1.3 1-1.3 1-2.6M12 8c0-1.3 1-1.3 1-2.6M15.5 8c0-1.3 1-1.3 1-2.6"/>',
    molheira: '<path d="M3 12h18a9 8 0 0 1-18 0zM14 12l6-8"/>',
    garrafa: '<path d="M10 3h4M10.5 3v4L8 10.5V20a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-9.5L13.5 7V3M8 14h8"/>',
    taca: '<path d="M6 3h12l-1 6a5 5 0 0 1-10 0zM12 14v6M8 21h8"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ICONS.cloche}</svg>`;
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  /* ---------------- Estado ---------------- */
  const STORE_KEY = 'sabor-natal-v1';
  const state = {
    adultos: C.calculadora.adultosPadrao ?? 4,
    criancas: C.calculadora.criancasPadrao ?? 0,
    apetite: 'normal',
    picks: new Set(),
    cart: new Map(), // id -> qtd
    calcInfo: null, // { adultos, criancas } quando o pedido veio da calculadora
  };

  function save() {
    try {
      const form = {};
      $$('#order-form input, #order-form textarea').forEach((el) => {
        if (!el.name) return;
        if (el.type === 'radio') { if (el.checked) form[el.name] = el.value; } else form[el.name] = el.value;
      });
      localStorage.setItem(STORE_KEY, JSON.stringify({
        adultos: state.adultos, criancas: state.criancas, apetite: state.apetite,
        picks: [...state.picks], cart: [...state.cart], calcInfo: state.calcInfo, form,
      }));
    } catch (e) { /* armazenamento indisponível: segue sem salvar */ }
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!d) return null;
      if (d.adultos >= 1) state.adultos = d.adultos;
      if (d.criancas >= 0) state.criancas = d.criancas;
      if (C.calculadora.apetite[d.apetite]) state.apetite = d.apetite;
      (d.picks || []).forEach((id) => BY_ID[id] && state.picks.add(id));
      (d.cart || []).forEach(([id, q]) => BY_ID[id] && q > 0 && state.cart.set(id, q));
      state.calcInfo = d.calcInfo || null;
      return d.form || null;
    } catch (e) { return null; }
  }

  /* ---------------- Calculadora ---------------- */
  function pessoasTxt(a, c) {
    const pa = `${a} ${a === 1 ? 'adulto' : 'adultos'}`;
    if (!c) return pa;
    return `${pa} e ${c} ${c === 1 ? 'criança' : 'crianças'}`;
  }

  function calcular() {
    const k = C.calculadora;
    const P = state.adultos + state.criancas * k.pesoCrianca;
    const gPrincipal = k.apetite[state.apetite].gramas;
    const escolhidos = ITEMS.filter((i) => state.picks.has(i.id));
    const notas = [];
    if (!escolhidos.length) return { linhas: [], total: 0, notas };

    const ehPrincipal = (i) => (k.principal || []).includes(i.categoria);
    const principais = escolhidos.filter(ehPrincipal);
    const porGrupo = {};
    escolhidos.forEach((i) => { (porGrupo[i.grupo] ||= []).push(i); });
    const kgPara = (gramas, i) => {
      const st = passo(i);
      return round2(Math.max(st, Math.ceil(gramas / 1000 / st - 1e-9) * st));
    };

    const linhas = escolhidos.map((i) => {
      let qtd;
      if (ehPrincipal(i)) {
        // Carnes + massas: porção principal dividida igualmente entre todas as escolhidas
        const gramas = (P * gPrincipal) / principais.length;
        qtd = i.tipo === 'kg' ? kgPara(gramas, i) : Math.max(1, Math.ceil(gramas / i.rendeG - 1e-9));
      } else {
        const pessoas = P / porGrupo[i.grupo].length;
        qtd = i.tipo === 'kg' ? kgPara(pessoas * i.gPorPessoa, i) : Math.max(1, Math.ceil(pessoas / i.serve - 1e-9));
      }
      if (i.obs) notas.push(i.obs);
      return { item: i, qtd, subtotal: round2(qtd * i.preco) };
    });

    if (principais.length) {
      const nome = k.apetite[state.apetite].nome.toLowerCase();
      notas.push(`Carnes e massas: ${gPrincipal} g por pessoa (apetite ${nome}), divididos entre ${principais.length === 1 ? 'o prato escolhido' : `os ${principais.length} pratos escolhidos`}.`);
    }
    if (escolhidos.some((i) => i.categoria === 'acompanhamentos')) notas.push('Acompanhamentos: 100 g por pessoa de cada um.');
    if (escolhidos.some((i) => i.tipo === 'kg')) notas.push(`Itens por quilo arredondados para cima, de ${dec.format(passo({ tipo: 'kg' }))} em ${dec.format(passo({ tipo: 'kg' }))} kg.`);
    notas.push('Valores estimados. O valor final é confirmado pelo WhatsApp.');
    return { linhas, total: round2(linhas.reduce((s, l) => s + l.subtotal, 0)), notas };
  }

  function renderMenu() {
    $('#calc-menu').innerHTML = C.categorias.map((cat) => `
      <section class="paper cat" aria-labelledby="cat-${cat.id}">
        <div class="cat__head">
          <span class="ribbon"><span class="ribbon__icon">${icon(cat.icone)}</span><span class="ribbon__name" id="cat-${cat.id}">${esc(cat.nome)}</span></span>
          ${cat.sub ? `<span class="cat__sub">${esc(cat.sub)}</span>` : ''}
        </div>
        ${cat.dica ? `<p class="cat__tip">${esc(cat.dica)}</p>` : ''}
        <ul class="cat__list">
          ${cat.itens.map((it) => {
            const item = BY_ID[it.id];
            return `<li><label class="pick">
              <input type="checkbox" value="${item.id}" ${state.picks.has(item.id) ? 'checked' : ''}>
              <span class="pick__box">${CHECK}</span>
              <span class="pick__body"><span class="pick__name">${esc(item.nome)}</span><span class="pick__dots" aria-hidden="true"></span><span class="pick__price">${fmtPrecoHtml(item)}</span></span>
            </label></li>`;
          }).join('')}
        </ul>
      </section>`).join('');

    $('#calc-menu').addEventListener('change', (e) => {
      const cb = e.target.closest('input[type=checkbox]');
      if (!cb) return;
      cb.checked ? state.picks.add(cb.value) : state.picks.delete(cb.value);
      renderResult();
      save();
    });
  }

  function renderApetite() {
    const wrap = $('#apetite');
    wrap.innerHTML = Object.entries(C.calculadora.apetite).map(([k, v]) => `
      <label><input type="radio" name="apetite" value="${k}" ${state.apetite === k ? 'checked' : ''}><span>${esc(v.nome)}<small>${v.gramas} g</small></span></label>`).join('');
    wrap.addEventListener('change', (e) => { state.apetite = e.target.value; renderResult(); save(); });
  }

  function setupPeopleSteppers() {
    $$('[data-stepper]').forEach((st) => {
      const key = st.dataset.stepper;
      const min = +st.dataset.min;
      const max = +st.dataset.max;
      const out = $('output', st);
      const [minus, plus] = $$('button', st);
      const sync = () => { out.textContent = state[key]; minus.disabled = state[key] <= min; plus.disabled = state[key] >= max; };
      st.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        state[key] = Math.min(max, Math.max(min, state[key] + +b.dataset.dir));
        sync();
        renderResult();
        save();
      });
      sync();
    });
  }

  let lastCalc = { linhas: [], total: 0, notas: [] };
  function renderResult() {
    const r = calcular();
    lastCalc = r;
    const box = $('#calc-result');
    const head = `<h3 class="result__title">Sua ceia</h3><p class="result__people">Para ${pessoasTxt(state.adultos, state.criancas)}</p>`;
    if (!r.linhas.length) {
      box.innerHTML = `${head}<p class="result__empty">Escolha os pratos no cardápio e as quantidades aparecem aqui.</p>`;
    } else {
      box.innerHTML = `${head}
        <ul class="lines">${r.linhas.map((l) => `
          <li class="line"><span class="line__name">${esc(l.item.nome)}</span><span class="line__qty"><strong>${esc(fmtQtd(l.item, l.qtd))}</strong></span><span class="line__sub">${money(l.subtotal)}</span></li>`).join('')}
        </ul>
        <div class="total"><span>Total estimado</span><strong>${money(r.total)}</strong></div>
        <ul class="notes">${r.notas.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        <button type="button" class="btn btn--red btn--block" id="to-order">Quero encomendar isso</button>`;
      $('#to-order').addEventListener('click', levarParaPedido);
    }
    updateBar();
  }

  function levarParaPedido() {
    state.cart = new Map(lastCalc.linhas.map((l) => [l.item.id, l.qtd]));
    state.calcInfo = { adultos: state.adultos, criancas: state.criancas };
    renderCart();
    save();
    $('#pedido').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    toast('Pratos levados para o pedido. Ajuste o que quiser.');
  }

  /* ---------------- Pedido ---------------- */
  function cartLinhas() {
    return ITEMS.filter((i) => state.cart.has(i.id)).map((i) => {
      const qtd = state.cart.get(i.id);
      return { item: i, qtd, subtotal: round2(qtd * i.preco) };
    });
  }
  const cartTotal = () => round2(cartLinhas().reduce((s, l) => s + l.subtotal, 0));

  function renderAddSelect() {
    $('#add-item').innerHTML = '<option value="">Adicionar prato do cardápio…</option>' + C.categorias.map((cat) => `
      <optgroup label="${esc(cat.nome)}">${cat.itens.map((it) => `<option value="${it.id}">${esc(it.nome)} · ${esc(fmtPrecoTxt(BY_ID[it.id]))}</option>`).join('')}</optgroup>`).join('');
    $('#add-item').addEventListener('change', (e) => {
      const id = e.target.value;
      if (!id) return;
      const item = BY_ID[id];
      state.cart.set(id, round2((state.cart.get(id) || 0) + passo(item)));
      e.target.value = '';
      renderCart();
      save();
      toast(`${item.nome} adicionado.`);
    });
  }

  function renderCart() {
    const linhas = cartLinhas();
    const el = $('#cart');
    if (!linhas.length) {
      el.innerHTML = '<p class="cart-empty">Seu pedido está vazio. Use a <a href="#calculadora">calculadora</a> ou adicione os pratos aqui embaixo.</p>';
    } else {
      el.innerHTML = `<ul class="cart">${linhas.map((l) => `
        <li class="cart__row" data-id="${l.item.id}">
          <div class="cart__info"><div class="cart__name">${esc(l.item.nome)}</div><div class="cart__price">${esc(fmtPrecoTxt(l.item))}</div></div>
          <div class="cart__ctrl">
            <div class="stepper stepper--sm">
              <button type="button" data-dir="-1" aria-label="Diminuir ${esc(l.item.nome)}">−</button>
              <output>${esc(l.item.tipo === 'kg' ? `${dec.format(l.qtd)} kg` : l.qtd)}</output>
              <button type="button" data-dir="1" aria-label="Aumentar ${esc(l.item.nome)}">+</button>
            </div>
            <span class="cart__sub">${money(l.subtotal)}</span>
            <button type="button" class="cart__rm" data-rm aria-label="Remover ${esc(l.item.nome)}">${TRASH}</button>
          </div>
        </li>`).join('')}</ul>`;
    }
    if (linhas.length) $('#err-itens').hidden = true;
    renderSummary();
    updateBar();
  }

  function setupCartEvents() {
    $('#cart').addEventListener('click', (e) => {
      const row = e.target.closest('.cart__row');
      if (!row) return;
      const id = row.dataset.id;
      const item = BY_ID[id];
      if (e.target.closest('[data-rm]')) {
        state.cart.delete(id);
      } else {
        const b = e.target.closest('button[data-dir]');
        if (!b) return;
        const q = round2((state.cart.get(id) || 0) + +b.dataset.dir * passo(item));
        if (q <= 0) state.cart.delete(id); else state.cart.set(id, q);
      }
      renderCart();
      save();
    });
  }

  function dataRotulo(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const sem = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
    return { curto: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`, semana: sem.charAt(0).toUpperCase() + sem.slice(1) };
  }

  function renderFormOptions() {
    const datas = C.datas.map((d) => {
      const r = dataRotulo(d.data);
      return `<label class="choice"><input type="radio" name="data" value="${d.data}"><span>${esc(r.curto)} · ${esc(d.nome)}<small>${esc(r.semana)}</small></span></label>`;
    });
    if (C.permitirOutraData) datas.push('<label class="choice"><input type="radio" name="data" value="outra"><span>Outra data<small>Escolher no calendário</small></span></label>');
    $('#f-datas').innerHTML = datas.join('');
    $('#f-periodos').innerHTML = C.periodos.map((p) => `<label class="choice"><input type="radio" name="periodo" value="${esc(p)}"><span>${esc(p)}</span></label>`).join('');
    $('#f-pagamentos').innerHTML = C.pagamentos.map((p) => `<label class="choice"><input type="radio" name="pagamento" value="${esc(p)}"><span>${esc(p)}</span></label>`).join('');
    if (C.pagamentoAviso) { $('#pagamento-note').textContent = C.pagamentoAviso; $('#pagamento-note').hidden = false; }
    if (!C.entrega.ativa) $('#choice-entrega').remove();
    const hoje = new Date();
    $('#f-outra-data').min = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  }

  const radio = (name) => ($(`#order-form input[name="${name}"]:checked`) || {}).value || '';

  function syncConditional() {
    const data = radio('data');
    $('#outra-data-wrap').hidden = data !== 'outra';
    const tipo = radio('tipo');
    $('#address').hidden = tipo !== 'Entrega';
    $('#tipo-note').textContent = tipo === 'Entrega' ? C.entrega.texto : tipo === 'Retirada' ? C.retirada.texto : '';
  }

  function maskPhone(v) {
    let d = v.replace(/\D/g, '');
    if (d.startsWith('55') && d.length > 11) d = d.slice(2);
    d = d.slice(0, 11);
    if (d.length <= 2) return d ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function dadosPedido() {
    const f = (id) => $(id).value.trim();
    const dataSel = radio('data');
    const dataIso = dataSel === 'outra' ? f('#f-outra-data') : dataSel;
    let dataTxt = '';
    if (dataIso) {
      const r = dataRotulo(dataIso);
      const nome = (C.datas.find((d) => d.data === dataIso) || {}).nome;
      dataTxt = `${r.curto} (${r.semana.toLowerCase()})${nome ? ` · ${nome}` : ''}`;
    }
    const tipo = radio('tipo');
    const endereco = tipo === 'Entrega'
      ? [f('#f-rua'), f('#f-bairro'), f('#f-cidade')].filter(Boolean).join(', ') + (f('#f-complemento') ? ` (${f('#f-complemento')})` : '')
      : '';
    const linhas = cartLinhas();
    return {
      nome: f('#f-nome'), whatsapp: f('#f-whats'), dataIso, dataTxt, periodo: radio('periodo'),
      tipo, endereco, pagamento: radio('pagamento'), obs: f('#f-obs'), linhas, total: cartTotal(),
    };
  }

  function renderSummary() {
    const d = dadosPedido();
    const meta = [d.dataTxt && `${d.dataTxt}${d.periodo ? ` · ${d.periodo.toLowerCase()}` : ''}`, d.tipo].filter(Boolean).join(' · ');
    $('#summary').innerHTML = `
      <h3>Resumo</h3>
      <p class="summary__meta">${esc(meta)}</p>
      ${d.linhas.length ? `<ul class="lines">${d.linhas.map((l) => `
        <li class="line"><span class="line__name">${esc(l.item.nome)}</span><span class="line__qty"><strong>${esc(fmtQtd(l.item, l.qtd))}</strong></span><span class="line__sub">${money(l.subtotal)}</span></li>`).join('')}</ul>`
        : '<p class="result__empty">Nenhum prato ainda.</p>'}
      <div class="total"><span>Total estimado</span><strong>${money(d.total)}</strong></div>
      ${d.tipo === 'Entrega' ? '<ul class="notes"><li>Mais a taxa de entrega, combinada pelo WhatsApp.</li></ul>' : ''}
      <p class="summary__err" id="summary-err" hidden>Confira os campos marcados em vermelho.</p>
      <button type="submit" class="btn btn--wa btn--block">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        Enviar pedido pelo WhatsApp
      </button>
      <p class="summary__fine">Abre o WhatsApp com o pedido escrito. É só tocar em enviar.</p>`;
  }

  function setInvalid(el, bad) {
    const field = el.closest('.field');
    if (field) field.classList.toggle('is-invalid', bad);
    el.setAttribute('aria-invalid', bad ? 'true' : 'false');
  }

  function validar() {
    const d = dadosPedido();
    const erros = [];
    const check = (cond, el) => { if (!cond) erros.push(el); return cond; };

    $('#err-itens').hidden = check(d.linhas.length > 0, $('#blk-itens'));
    const nomeOk = check(d.nome.length >= 2, $('#f-nome')); setInvalid($('#f-nome'), !nomeOk);
    const tel = d.whatsapp.replace(/\D/g, '');
    const telOk = check(tel.length >= 10 && tel.length <= 11, $('#f-whats')); setInvalid($('#f-whats'), !telOk);

    const dataSel = radio('data');
    $('#err-data').hidden = check(!!dataSel, $('#f-datas'));
    if (dataSel === 'outra') { const ok = check(!!d.dataIso, $('#f-outra-data')); setInvalid($('#f-outra-data'), !ok); }
    $('#err-periodo').hidden = check(!!d.periodo, $('#f-periodos'));
    $('#err-tipo').hidden = check(!!d.tipo, $('#f-tipo'));
    if (d.tipo === 'Entrega') {
      ['#f-rua', '#f-bairro', '#f-cidade'].forEach((id) => { const ok = check($(id).value.trim().length >= 2, $(id)); setInvalid($(id), !ok); });
    } else {
      ['#f-rua', '#f-bairro', '#f-cidade'].forEach((id) => setInvalid($(id), false));
    }
    $('#err-pagamento').hidden = check(!!d.pagamento, $('#f-pagamentos'));
    return { d, erros };
  }

  function codigoPedido(dataIso) {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let r = '';
    const rnd = new Uint32Array(4);
    (window.crypto || window.msCrypto).getRandomValues(rnd);
    rnd.forEach((n) => { r += abc[n % abc.length]; });
    const [, m, dd] = (dataIso || '').split('-');
    return `SM-${dd || '00'}${m || '00'}-${r}`;
  }

  function mensagemWhats(d, codigo) {
    const L = [];
    L.push(`*Encomenda de Natal · ${C.marca.nome}*`);
    L.push(`Pedido ${codigo}`);
    L.push('');
    L.push(`*Nome:* ${d.nome}`);
    L.push(`*WhatsApp:* ${d.whatsapp}`);
    L.push(`*Data:* ${d.dataTxt}`);
    L.push(`*Período:* ${d.periodo}`);
    L.push(d.tipo === 'Entrega' ? `*Entrega:* ${d.endereco}` : '*Retirada* no local');
    L.push(`*Pagamento:* ${d.pagamento}`);
    if (state.calcInfo) L.push(`*Pessoas:* ${pessoasTxt(state.calcInfo.adultos, state.calcInfo.criancas)}`);
    L.push('');
    L.push('*Pratos*');
    d.linhas.forEach((l) => L.push(`• ${fmtQtd(l.item, l.qtd)} · ${l.item.nome} · ${money(l.subtotal)}`));
    L.push('');
    L.push(`*Total estimado: ${money(d.total)}*${d.tipo === 'Entrega' ? ' + taxa de entrega' : ''}`);
    if (d.obs) { L.push(''); L.push(`*Observações:* ${d.obs}`); }
    return L.join('\n');
  }

  function enviarPlanilha(d, codigo) {
    if (!C.planilhaUrl) return;
    const payload = {
      codigo, nome: d.nome, whatsapp: d.whatsapp, data: d.dataIso, periodo: d.periodo, tipo: d.tipo,
      endereco: d.endereco, pagamento: d.pagamento, obs: d.obs, total: d.total,
      pessoas: state.calcInfo ? pessoasTxt(state.calcInfo.adultos, state.calcInfo.criancas) : '',
      itens: d.linhas.map((l) => ({
        categoria: l.item.categoriaNome, nome: l.item.nome, qtd: l.qtd, unidade: unidadeProducao(l.item),
        texto: fmtQtd(l.item, l.qtd), subtotal: l.subtotal,
      })),
    };
    const body = JSON.stringify(payload);
    // Dois caminhos para garantir no celular (o WhatsApp abre por cima do navegador).
    // A planilha ignora o segundo, porque o código do pedido é o mesmo.
    try {
      fetch(C.planilhaUrl, {
        method: 'POST', mode: 'no-cors', keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      }).catch(() => {});
    } catch (e) { /* segue */ }
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(C.planilhaUrl, new Blob([body], { type: 'text/plain;charset=utf-8' }));
    } catch (e) { /* sem planilha, o WhatsApp ainda leva o pedido */ }
  }

  let ultimoCodigo = null;
  function onSubmit(e) {
    e.preventDefault();
    const { d, erros } = validar();
    if (erros.length) {
      $('#summary-err').hidden = false;
      const first = erros[0];
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = first.matches('input,textarea') ? first : $('input, select', first);
      if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 350);
      return;
    }
    const codigo = ultimoCodigo || codigoPedido(d.dataIso);
    ultimoCodigo = codigo;
    const url = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(mensagemWhats(d, codigo))}`;

    enviarPlanilha(d, codigo);
    // (sem 'noopener' nas features: com ele o window.open sempre devolve null)
    const w = window.open(url, '_blank');
    if (w) { try { w.opener = null; } catch (err) { /* ok */ } }

    $('#done-code').textContent = codigo;
    $('#done-wa').href = url;
    $('#order-form').hidden = true;
    $('#order-done').hidden = false;
    $('#pedido .section__head').scrollIntoView({ behavior: 'smooth' });
    $('#order-done').focus({ preventScroll: true });
    updateBar();
    if (!w) setTimeout(() => { window.location.href = url; }, 400);
  }

  function novoPedido() {
    ultimoCodigo = null;
    state.cart.clear();
    state.calcInfo = null;
    $('#order-form').reset();
    $('#order-form').hidden = false;
    $('#order-done').hidden = true;
    syncConditional();
    renderCart();
    save();
    $('#pedido').scrollIntoView({ behavior: 'smooth' });
  }

  function restoreForm(form) {
    if (!form) return;
    Object.entries(form).forEach(([name, value]) => {
      $$(`#order-form [name="${CSS.escape(name)}"]`).forEach((el) => {
        if (el.type === 'radio') el.checked = el.value === value; else el.value = value;
      });
    });
  }

  /* ---------------- Barra inferior (celular) ---------------- */
  let secaoAtiva = 'calc';
  function updateBar() {
    const bar = $('#bar');
    const done = !$('#order-done').hidden;
    if (secaoAtiva === 'calc') {
      $('#bar-label').textContent = 'Sua ceia · estimativa';
      $('#bar-total').textContent = money(lastCalc.total);
      $('#bar-btn').textContent = 'Ver quantidades';
      $('#bar-btn').setAttribute('href', '#calc-result');
      bar.classList.toggle('is-on', lastCalc.linhas.length > 0);
    } else if (secaoAtiva === 'pedido') {
      $('#bar-label').textContent = 'Seu pedido';
      $('#bar-total').textContent = money(cartTotal());
      $('#bar-btn').textContent = 'Revisar e enviar';
      $('#bar-btn').setAttribute('href', '#summary');
      bar.classList.toggle('is-on', !done && state.cart.size > 0);
    } else {
      bar.classList.remove('is-on');
    }
  }
  function setupBar() {
    $('#bar').hidden = false;
    const resultEl = $('#calc-result');
    const summaryEl = $('#summary');
    const visivel = new Map();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => visivel.set(en.target, en.isIntersecting));
      const calcOn = visivel.get($('#calculadora')) && !visivel.get(resultEl);
      const pedOn = visivel.get($('#pedido')) && !visivel.get(summaryEl);
      secaoAtiva = calcOn ? 'calc' : pedOn ? 'pedido' : 'none';
      updateBar();
    }, { threshold: 0 });
    [$('#calculadora'), $('#pedido'), resultEl, summaryEl].forEach((el) => io.observe(el));
    $('#bar-btn').addEventListener('click', (e) => {
      e.preventDefault();
      const target = $(e.currentTarget.getAttribute('href'));
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------------- Toast ---------------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* ---------------- Marca / extras ---------------- */
  function setupBrand() {
    if (C.marca.logo && C.marca.logo !== $('#logo img')?.getAttribute('src')) $('#logo').innerHTML = `<img src="${esc(C.marca.logo)}" alt="${esc(`${C.marca.nome} — ${C.marca.sub}`)}">`;
    if (C.prazoEncomenda) {
      const r = dataRotulo(C.prazoEncomenda);
      $('#prazo').innerHTML = `Encomendas até <strong>${esc(r.curto)}</strong>`;
      $('#prazo').hidden = false;
    }
    $('#ft-wa').href = `https://wa.me/${C.whatsapp}`;
    $('#ft-wa-txt').textContent = C.whatsappTexto;
    $('#ft-ig').href = C.instagram;
    if (C.entrega.cidadePadrao && !$('#f-cidade').value) $('#f-cidade').value = C.entrega.cidadePadrao;
  }

  /* ---------------- Init ---------------- */
  const savedForm = load();
  renderMenu();
  renderApetite();
  setupPeopleSteppers();
  renderAddSelect();
  renderFormOptions();
  restoreForm(savedForm);
  setupBrand();
  syncConditional();
  renderResult();
  renderCart();
  setupCartEvents();
  setupBar();

  const form = $('#order-form');
  form.addEventListener('submit', onSubmit);
  form.addEventListener('input', (e) => {
    if (e.target.id === 'f-whats') {
      const pos = e.target.value.length;
      e.target.value = maskPhone(e.target.value);
      if (document.activeElement === e.target && pos === e.target.value.length) e.target.setSelectionRange(pos, pos);
    }
    if (e.target.closest('.field.is-invalid')) setInvalid(e.target, false);
    renderSummary();
    save();
  });
  form.addEventListener('change', (e) => {
    const errRadio = { data: '#err-data', periodo: '#err-periodo', tipo: '#err-tipo', pagamento: '#err-pagamento' }[e.target.name];
    if (e.target.type === 'radio' && errRadio) $(errRadio).hidden = true;
    syncConditional();
    renderSummary();
    save();
  });
  $('#done-new').addEventListener('click', novoPedido);
})();
