/* ==========================================================================
   CONFIGURAÇÃO — Sabor à Mesa · Cardápio de Natal
   Tudo o que muda de um ano para o outro fica aqui: preços, datas,
   regras de porção, formas de pagamento e o link da planilha.
   Não precisa mexer em nenhum outro arquivo.
   ========================================================================== */
window.SABOR = {
  marca: {
    nome: 'Sabor à Mesa',
    sub: 'Buffet & Eventos',
    // Para usar o logo oficial: salve o arquivo em assets/logo.png e troque null por 'assets/logo.png'
    logo: null,
  },

  // WhatsApp que recebe os pedidos (55 + DDD + número, só números)
  whatsapp: '5547999291542',
  whatsappTexto: '(47) 99929-1542',
  instagram: 'https://www.instagram.com/sabor.mesa/',

  // URL do Apps Script da planilha (veja LEIA-ME.md). Vazio = pedidos vão só pelo WhatsApp.
  planilhaUrl: '',

  // Prazo para encomendas (AAAA-MM-DD). null = não mostra prazo.
  prazoEncomenda: null,

  // Datas que aparecem no pedido. O cliente também pode escolher "Outra data".
  datas: [
    { data: '2026-12-24', nome: 'Véspera de Natal' },
    { data: '2026-12-25', nome: 'Natal' },
    { data: '2026-12-31', nome: 'Véspera de Ano-Novo' },
    { data: '2027-01-01', nome: 'Ano-Novo' },
  ],
  permitirOutraData: true,

  periodos: ['Meio-dia', 'Noite'],

  pagamentos: ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro'],
  pagamentoAviso: '', // ex.: 'Pedidos confirmados com 50% de sinal via Pix.'

  retirada: {
    texto: 'O endereço e o horário de retirada são combinados pelo WhatsApp.',
  },
  entrega: {
    ativa: true,
    texto: 'Taxa de entrega combinada pelo WhatsApp, conforme o bairro.',
    cidadePadrao: '',
  },

  /* ------------------------------------------------------------------------
     Regras da calculadora
     - Criança conta como `pesoCrianca` de um adulto.
     - Itens do mesmo "grupo" dividem a porção (ex.: escolheu 2 carnes,
       cada uma faz metade).
     - tipo 'kg'     → gPorPessoa = gramas por pessoa quando é o único do grupo
       tipo 'un'     → serve = pessoas que 1 unidade serve sozinha
       tipo 'pacote' → serve = pessoas que 1 embalagem serve sozinha
     ------------------------------------------------------------------------ */
  calculadora: {
    adultosPadrao: 4,
    criancasPadrao: 0,
    pesoCrianca: 0.5,
    passoKg: 0.5, // itens por kg são arredondados para cima de 0,5 em 0,5 kg
    apetite: {
      leve: { nome: 'Leve', fator: 0.85 },
      normal: { nome: 'Normal', fator: 1 },
      farto: { nome: 'Bem servido', fator: 1.2 },
    },
  },

  categorias: [
    {
      id: 'entradas', nome: 'Entradas', icone: 'folha', grupo: 'entradas',
      dica: 'Divididas entre as opções escolhidas.',
      itens: [
        { id: 'pate-amendoas', nome: 'Patê de Amêndoas', preco: 55, tipo: 'pacote', emb: '500 g', embNome: ['pote', 'potes'], serve: 10 },
        { id: 'caponata', nome: 'Caponata de Berinjela', preco: 65, tipo: 'pacote', emb: '500 g', embNome: ['pote', 'potes'], serve: 10 },
        { id: 'rosbife', nome: 'Rosbife ao Molho de Mostarda Dijon', preco: 195, tipo: 'pacote', emb: '700 g', embNome: ['porção', 'porções'], serve: 12 },
      ],
    },
    {
      id: 'carnes', nome: 'Carnes', icone: 'cloche', grupo: 'carnes',
      dica: 'A quantidade de carne é dividida entre as opções escolhidas.',
      itens: [
        { id: 'chester', nome: 'Chester Recheado e Decorado', preco: 365, tipo: 'un', serve: 10 },
        { id: 'peru', nome: 'Peru Recheado e Decorado', preco: 145, tipo: 'kg', gPorPessoa: 450, obs: 'Peru é peça inteira: o peso final depende da ave.' },
        { id: 'frango', nome: 'Frango Recheado e Decorado', preco: 155, tipo: 'un', serve: 5 },
        { id: 'costelinha', nome: 'Costelinha Suína Barbecue', preco: 195, tipo: 'kg', gPorPessoa: 500 },
        { id: 'paleta', nome: 'Paleta Suína com Mostarda e Mel', preco: 205, tipo: 'kg', gPorPessoa: 400 },
        { id: 'alcatra', nome: 'Alcatra ao Molho Madeira', preco: 235, tipo: 'kg', gPorPessoa: 350 },
        { id: 'mignon', nome: 'Mignon ao 4 Queijos', preco: 440, tipo: 'kg', gPorPessoa: 300 },
        { id: 'lombinho', nome: 'Lombinho Recheado com Bacon, Pupunha e Queijo, ao Molho de Frutas Vermelhas', preco: 250, tipo: 'kg', gPorPessoa: 350 },
        { id: 'salmao', nome: 'Salmão com Camarão e Alcaparras', preco: 420, tipo: 'kg', gPorPessoa: 300 },
        { id: 'tender', nome: 'Tender Cravejado', preco: 195, tipo: 'un', serve: 12 },
      ],
    },
    {
      id: 'acompanhamentos', nome: 'Acompanhamentos', icone: 'tigela',
      dica: 'Arroz com arroz e farofa com farofa dividem a porção.',
      // Muitos acompanhamentos ao mesmo tempo → cada um sai um pouco menor
      reducaoVariedade: [[4, 0.85], [6, 0.75]],
      itens: [
        { id: 'arroz-grega', nome: 'Arroz à Grega', preco: 125, tipo: 'kg', gPorPessoa: 130, grupo: 'arroz' },
        { id: 'arroz-amendoas', nome: 'Arroz com Amêndoas', preco: 115, tipo: 'kg', gPorPessoa: 130, grupo: 'arroz' },
        { id: 'salpicao', nome: 'Salpicão', preco: 165, tipo: 'kg', gPorPessoa: 100 },
        { id: 'maionese', nome: 'Maionese de Batatas', preco: 60, tipo: 'kg', gPorPessoa: 100 },
        { id: 'farofa-bacon', nome: 'Farofa de Bacon', preco: 90, tipo: 'kg', gPorPessoa: 60, grupo: 'farofa' },
        { id: 'farofa-agridoce', nome: 'Farofa de Natal Agridoce', preco: 120, tipo: 'kg', gPorPessoa: 60, grupo: 'farofa' },
        { id: 'legumes', nome: 'Legumes Salteados', preco: 125, tipo: 'kg', gPorPessoa: 100 },
        { id: 'empadao', nome: 'Empadão de Frango, Palmito e Requeijão', preco: 130, tipo: 'un', emb: '10 fatias', serve: 10 },
      ],
    },
    {
      id: 'massas', nome: 'Massas', icone: 'cloche', grupo: 'massas',
      dica: 'Com carne na ceia, a massa entra como acompanhamento (meia porção).',
      fatorComCarnes: 0.5,
      itens: [
        { id: 'espaguete', nome: 'Espaguete', preco: 40, tipo: 'kg', gPorPessoa: 200 },
        { id: 'penne', nome: 'Penne', preco: 40, tipo: 'kg', gPorPessoa: 200 },
        { id: 'lasanha-frango', nome: 'Lasanha de Frango', preco: 85, tipo: 'kg', gPorPessoa: 250 },
        { id: 'lasanha-bolonhesa', nome: 'Lasanha à Bolonhesa', preco: 105, tipo: 'kg', gPorPessoa: 250 },
        { id: 'rondelle', nome: 'Rondelle Queijo e Peito de Peru Defumado ao Molho 4 Queijos', preco: 158, tipo: 'kg', gPorPessoa: 250 },
        { id: 'lasanha-funghi', nome: 'Lasanha ao Molho Funghi', preco: 125, tipo: 'kg', gPorPessoa: 250 },
      ],
    },
    {
      id: 'molhos', nome: 'Molhos', icone: 'molheira', grupo: 'molhos',
      dica: 'Para acompanhar espaguete e penne.',
      itens: [
        { id: 'molho-margarita', nome: 'Margarita', preco: 49, tipo: 'pacote', emb: '500 g', embNome: ['pote', 'potes'], serve: 6 },
        { id: 'molho-funghi', nome: 'Funghi', preco: 78, tipo: 'pacote', emb: '500 g', embNome: ['pote', 'potes'], serve: 6 },
        { id: 'molho-bolonhesa', nome: 'Bolonhesa', preco: 68, tipo: 'pacote', emb: '500 g', embNome: ['pote', 'potes'], serve: 6 },
        { id: 'molho-4queijos', nome: 'Quatro Queijos', preco: 58, tipo: 'pacote', emb: '500 g', embNome: ['pote', 'potes'], serve: 6 },
      ],
    },
    {
      id: 'molhos-salada', nome: 'Molhos para Salada', icone: 'garrafa', grupo: 'molhos-salada',
      itens: [
        { id: 'mostarda-mel', nome: 'Mostarda e Mel', preco: 35, tipo: 'pacote', emb: '300 g', embNome: ['pote', 'potes'], serve: 15 },
        { id: 'pesto', nome: 'Pesto', preco: 58, tipo: 'pacote', emb: '300 g', embNome: ['pote', 'potes'], serve: 15 },
      ],
    },
    {
      id: 'sobremesas', nome: 'Sobremesas', icone: 'taca', grupo: 'sobremesas', sub: 'Servem 6 pessoas',
      itens: [
        { id: 'pudim', nome: 'Pudim de Leite', preco: 55, tipo: 'un', emb: 'serve 6', serve: 6 },
        { id: 'musse-limao', nome: 'Musse de Limão', preco: 55, tipo: 'un', emb: 'serve 6', serve: 6 },
        { id: 'morango-suspiro', nome: 'Morango com Suspiros e Creme de Nata', preco: 140, tipo: 'un', emb: 'serve 6', serve: 6 },
      ],
    },
  ],
};
