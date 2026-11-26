# Sabor à Mesa · Cardápio de Natal

Página com duas funções:

1. **Calculadora da ceia.** O cliente informa quantas pessoas vêm e escolhe os pratos. A página mostra as quantidades e o valor estimado, sem compromisso.
2. **Encomenda.** O cliente preenche os dados e o pedido abre pronto no WhatsApp **(47) 99929-1542**. Se a planilha estiver ligada, o pedido também entra no Google Planilhas.

Não tem servidor nem banco de dados. São arquivos estáticos publicados no GitHub Pages.

## Arquivos

| Arquivo | O que é |
|---|---|
| `config.js` | **O único arquivo para editar:** preços, datas, porções, pagamentos e o link da planilha |
| `index.html`, `styles.css`, `app.js` | A página |
| `planilha/Code.gs` | O script da planilha de pedidos |
| `assets/` | Favicon (e o logo, quando chegar) |

## Ajustes no `config.js`

- **Preços e pratos:** ficam em `categorias`. Cada prato tem `nome` e `preco`.
- **Porções:**
  - `gPorPessoa`: gramas por pessoa, para itens vendidos por kg.
  - `serve`: quantas pessoas uma unidade ou um pote serve.
  - Hoje está com a média de buffet. Se a dona tiver os números dela, troque aqui.
- **Datas:** a lista `datas`. `prazoEncomenda: '2026-12-20'` mostra "Encomendas até 20/12" no topo da página.
- **Pagamento:** a lista `pagamentos`. Em `pagamentoAviso` dá para escrever, por exemplo, "50% de sinal via Pix".
- **Entrega e retirada:** os textos em `entrega.texto` e `retirada.texto`. Com `entrega.ativa: false`, a opção de entrega some.
- **Logo:** salve o arquivo como `assets/logo.png` (de preferência com fundo transparente) e coloque `logo: 'assets/logo.png'` em `marca`.

## Ligar a planilha de pedidos (uns 5 minutos, na conta Google da dona)

1. Abra o [Google Planilhas](https://sheets.new) e crie uma planilha chamada, por exemplo, **Pedidos de Natal**.
2. Vá em **Extensões → Apps Script**.
3. Apague o que estiver no editor, cole todo o conteúdo de `planilha/Code.gs` e salve (ícone do disquete).
4. No menu de funções lá em cima, escolha **configurar** e clique em **Executar**.
   - O Google vai pedir autorização. Clique em **Avançado → Acessar (não seguro)**. O aviso aparece porque o script é seu e não foi publicado na loja do Google.
5. Clique em **Implantar → Nova implantação**:
   - Engrenagem → tipo **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Clique em **Implantar** e copie a **URL do app da Web** (ela termina em `/exec`).
6. Cole essa URL em `planilhaUrl` no `config.js` e publique de novo.

Para testar, abra a URL `/exec` no navegador. Ela deve mostrar `ok`. Depois faça um pedido de teste na página.

### Como a planilha fica organizada

- **Produção:** quanto fazer de cada prato, por dia e período. Exemplo: 24/12, noite, Arroz à Grega, 6 kg. Pedidos cancelados ficam fora da conta.
- **Agenda:** todos os pedidos em ordem de data, com cliente, endereço e pagamento.
- **Pedidos:** um pedido por linha. Aqui ela muda o **Status** (Novo → Confirmado → Pago → Pronto → Entregue, ou Cancelado). Clicar no WhatsApp do cliente abre a conversa com ele.
- **Itens:** um prato por linha. É a base da aba Produção e não precisa mexer.

> O WhatsApp abre com a mensagem escrita, mas quem toca em "enviar" é o cliente. Então um pedido pode aparecer na planilha sem ter chegado no WhatsApp. O status **Novo** serve para isso: o pedido só vira **Confirmado** depois que ela falar com o cliente.

> Se o `Code.gs` for alterado depois, publique de novo em **Implantar → Gerenciar implantações → editar → Nova versão**. Assim a URL continua a mesma.

## Publicar no GitHub Pages

```powershell
gh repo create sabor-mesa-natal --public --source . --push
gh api -X POST repos/{owner}/sabor-mesa-natal/pages -f "source[branch]=main" -f "source[path]=/"
```

O site fica em `https://<usuario>.github.io/sabor-mesa-natal/`. Para atualizar, faça commit e push e o Pages publica sozinho.
