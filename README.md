# Central de Pagamentos · Esteves

Página estática de cobrança: cada pessoa escolhe o próprio nome, vê só as suas pendências
(agrupadas por categoria ou por mês), marca o que quer pagar e gera o PIX (QR Code ou Copia e Cola).

## Estrutura

```
index.html          página completa (layout, lógica e configuração)
assets/dados.js     base de dívidas (gerada a partir da planilha)
assets/qrcode.js    gerador de QR Code (sem dependências externas)
assets/pix.js       gerador do código PIX Copia e Cola (BR Code + CRC16)
assets/logo.png     logo adaptado ao tema escuro
assets/favicon.png
gerar_dados.py      converte Dividas.xlsx em assets/dados.js
Dividas.xlsx        planilha de origem
```

## Publicar no GitHub Pages

1. Crie um repositório e envie todos os arquivos desta pasta.
2. Em **Settings → Pages**, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. O site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

## Link direto para cada pessoa

Acrescente `?pessoa=nome` ao endereço (sem acento, espaços viram hífen):

```
https://SEU-USUARIO.github.io/NOME-DO-REPO/?pessoa=davidson
https://SEU-USUARIO.github.io/NOME-DO-REPO/?pessoa=ana-flavia
https://SEU-USUARIO.github.io/NOME-DO-REPO/?pessoa=lourenco
```

Dentro do painel há o botão **Copiar link**, que copia o endereço da pessoa aberta.

## Atualizar a base

Basta substituir o `Dividas.xlsx` no repositório (mesmo nome, mesmas colunas: DATA, LOCAL,
DESCRIÇÃO, VALOR, DESC CONTA, CLASSIFICAÇÃO, PACOTE, RESPONSÁVEL). A página lê a planilha
direto (`assets/xlsx.js`); o GitHub Pages leva cerca de 1 minuto para publicar a troca.

`assets/dados.js` é só uma cópia de segurança, usada quando a página é aberta como arquivo
local (duplo clique). Para atualizá-la: `pip install openpyxl` e `python gerar_dados.py`.

Valores negativos são convertidos em positivos. As categorias exibidas ficam no dicionário
`CATEGORIAS` de `assets/xlsx.js` (classificação nova sem mapeamento aparece com o próprio nome).

## Configuração do PIX

No início do `<script>` do `index.html`, objeto `CONFIG`:

| Campo | Valor atual |
|---|---|
| `chavePix` | `+5531971480692` (chave de celular) |
| `nomeRecebedor` | `ESTEVES` |
| `cidadeRecebedor` | `RIBEIRAO NEVES` |
| `ocultarPessoas` | `[]` (ex.: `['DARLITON']` para tirar alguém da tela inicial) |

O banco do pagador sempre mostra o nome real do titular da chave antes da confirmação.

> **Privacidade:** o GitHub Pages é público. Quem tiver o link consegue abrir a página
> de qualquer nome da lista, e `dados.js`/`Dividas.xlsx` ficam visíveis no repositório.
