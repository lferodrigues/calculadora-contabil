# Calculadora RTC: Reforma Tributária do Consumo

Calculadora contábil em **HTML, CSS e JavaScript puro (SPA)** para a Reforma Tributária do Consumo (EC 132/2023 e LC 214/2025). A interface conversa, via API, com as três calculadoras abertas publicadas pela Receita Federal, uma em cada página do sistema:

| Página | O que faz | API usada |
|---|---|---|
| **Regime geral** | Calcula CBS, IBS (UF e município) e Imposto Seletivo por item, com memória de cálculo. Calcula a base unificada da NF-e/NFC-e e gera e valida o XML do grupo de tributação. | [calculadora-rtc-regime-regular](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular) |
| **Simples Nacional** | Calcula IBS e CBS de optantes do Simples por atividade (cAtivSN) e alíquota efetiva, com a lista de atividades vigentes. | [calculadora-rtc-simples-nacional](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional) |
| **Gerador de DANFSe** | Gera o PDF do DANFSe a partir do XML da NFS-e (upload, colagem ou formulário de nota de teste). | [calculadora-rtc-gerador-danfse](https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse) |

Além delas, há um **Painel** com o histórico de apurações do navegador, o status das três APIs e o cronograma da transição, e uma página de **Conexão com as APIs** para configurar os endereços.

---

## Como rodar

### 1. Suba as três APIs da Receita Federal

Cada repositório tem as instruções completas no próprio README. Resumo, com portas que não conflitam entre si:

```bash
# Regime geral (Java 21) — porta 8080
git clone https://github.com/ReceitaFederal/calculadora-rtc-regime-regular.git
cd calculadora-rtc-regime-regular
mkdir -p ./calculadora/db
./mvnw flyway:migrate -Dflyway.configFiles=./flyway/flyway-pro.conf --batch-mode --errors
./mvnw spring-boot:run -Dspring-boot.run.profiles=offline
```

```bash
# Simples Nacional (Java 21) — porta 8082
git clone https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional.git
cd calculadora-rtc-simples-nacional
# gere o banco ./calculadora/db/calculadora-pro.db conforme o README do repositório
./mvnw spring-boot:run -Dspring-boot.run.profiles=offline
```

```bash
# DANFSe (Go 1.27) — porta 8081, para não conflitar com o regime geral
git clone https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse.git
cd calculadora-rtc-gerador-danfse
SERVER_PORT=8081 go run ./cmd/danfse
```

### 2. Rode a interface

Precisa só do Node.js 18 ou mais novo; não há dependências para instalar.

```bash
git clone https://github.com/lferodrigues/calculadora-contabil.git
cd calculadora-contabil
node server.js
```

Abra **http://localhost:3000**. O `server.js` entrega a SPA e faz proxy das chamadas:

| Rota da SPA | Destino padrão | Variável para trocar |
|---|---|---|
| `/proxy/regime/*` | `http://localhost:8080/api` | `REGIME_API_URL` |
| `/proxy/simples/*` | `http://localhost:8082/api` | `SIMPLES_API_URL` |
| `/proxy/danfse/*` | `http://localhost:8081` | `DANFSE_API_URL` |

```bash
PORT=4000 REGIME_API_URL=http://servidor:8080/api node server.js
```

O proxy existe porque as APIs da Receita restringem CORS: a do Simples Nacional, por exemplo, só libera `http://localhost:4200` por padrão.

### Deploy no Vercel

O `vercel.json` publica a interface e as três APIs num único projeto, usando os recursos de *Services* e *Container Runtime* do Vercel (ambos em Beta, disponíveis em todos os planos):

| Caminho público | Serviço | Caminho que a API recebe |
|---|---|---|
| `/proxy/regime/*` | container `deploy/regime` | `/api/*` |
| `/proxy/simples/*` | container `deploy/simples` | `/api/*` |
| `/proxy/danfse/*` | container `deploy/danfse` | `/*` |
| todo o resto | arquivos estáticos de `web/` | — |

Os Dockerfiles baixam o código dos repositórios oficiais da Receita durante o build; para atualizar as APIs, basta fazer um novo deploy.

1. **Banco do Simples Nacional.** O repositório oficial não traz os scripts do banco. Coloque o arquivo `calculadora-pro.db` em `deploy/simples/` e faça commit, ou defina a variável de ambiente `DB_DOWNLOAD_URL` no projeto do Vercel (a API baixa o banco ao iniciar). Sem isso, só a página do Simples fica fora do ar.
2. Em [vercel.com/new](https://vercel.com/new), importe este repositório do GitHub. Não mude o *Root Directory* nem o *Framework Preset*: o `vercel.json` define tudo.
3. Clique em **Deploy**. O primeiro build demora (Maven e Go baixam as dependências).
4. Em **Settings → Functions**, troque a região para São Paulo (`gru1`) e faça um novo deploy.
5. Abra o endereço do projeto. O painel mostra o status das três APIs.

Depois de 5 minutos sem uso, o Vercel desliga os containers; a primeira chamada seguinte espera as APIs Java subirem (alguns segundos). Requisições e respostas têm limite de 4,5 MB.

Pelo terminal, o equivalente é `npm i -g vercel`, `vercel login` e `vercel --prod` na pasta do projeto.

### Hospedagem estática (Live Server, nginx)

A SPA da pasta `web/` também funciona como site estático, porque as rotas usam `#/`. Em `localhost` o navegador chama as APIs diretamente (endereços em `web/env.js` ou na página **Conexão com as APIs**), e cada API precisa liberar a origem do site:

- **Simples Nacional:** `APP_CORS_ALLOWED_ORIGINS=https://seu-site` ao subir a API.
- **Regime geral:** configure CORS no Spring ou use um proxy reverso.
- **DANFSe:** já libera `*` para `POST`.

Abrir o `web/index.html` direto do disco (`file://`) não funciona, porque os navegadores bloqueiam módulos ES nesse caso. Use `node server.js` ou qualquer servidor estático.

### Modo demonstração

Sem as APIs no ar, ligue **Modo demonstração** na barra superior. Os cálculos passam a ser aproximações feitas no navegador (sem diferimento, crédito presumido, monofasia etc.), sempre sinalizadas na tela. O DANFSe não é gerado nesse modo, porque o PDF depende do serviço oficial. Para resultados oficiais, use as APIs.

---

## Estrutura

```
server.js                      servidor local: entrega web/ e faz proxy das três APIs (Node, sem dependências)
vercel.json                    deploy no Vercel: a interface e as três APIs num só projeto
deploy/regime/Dockerfile       imagem da API do regime geral (baixa o código oficial no build)
deploy/simples/Dockerfile      imagem da API do Simples Nacional
deploy/danfse/Dockerfile       imagem do gerador de DANFSe
web/index.html                 casca da SPA (menu lateral, barra superior, rodapé)
web/env.js                     como a interface encontra as APIs (local, server.js ou domínio publicado)
web/css/style.css              estilos
web/js/app.js                  rotas por hash e status das APIs
web/js/api.js                  cliente das três APIs (+ desvio para o modo demonstração)
web/js/demo.js                 simulações do modo demonstração
web/js/grid.js                 grade de itens no estilo de formulário de ERP
web/js/ui.js                   formatação, avisos, diálogo, histórico
web/js/pages/*.js              painel, regime geral, Simples Nacional, DANFSe e conexão
```

## Endpoints consumidos

**Regime geral** (`/api`)
- `POST /calculadora/observabilidade/regime-geral`: cálculo com erros por item
- `POST /calculadora/regime-geral`: cálculo estrito, usado para gerar o XML
- `POST /calculadora/xml/generate?tipo=` e `POST /calculadora/xml/validate?tipo=&subtipo=grupo`
- `POST /calculadora/base-calculo/base-calculo-unificada`
- `GET /calculadora/observabilidade/erros?codigo=`
- `GET /calculadora/dados-abertos/ufs`, `/ufs/municipios?siglaUf=`, `/versao`

**Simples Nacional** (`/api`)
- `POST /calculadora/observabilidade/simples-nacional`
- `GET /calculadora/simples-nacional/atividades?data=&tpDoc=`
- `GET /calculadora/observabilidade/simples-nacional/erros?codigo=`
- `GET /versao`

**DANFSe**
- `POST /api/danfse?stc=&canhoto=` (corpo XML, resposta PDF)
- `GET /health/live`

## Observações

- A partir de 2027 a API do regime geral exige as alíquotas nominais em cada item; antes disso elas são proibidas. A grade bloqueia as colunas de alíquota conforme a data do fato gerador.
- O formulário "Montar nota de teste" do DANFSe gera XML em **ambiente de homologação** (`tpAmb = 2`), e o PDF sai marcado como "NFS-e sem validade jurídica". Para notas reais, envie o XML autorizado.
- O histórico do painel fica só no `localStorage` do navegador; nada é enviado a outro lugar além das APIs configuradas.
- Os resultados vêm das calculadoras oficiais, mas não substituem a conferência de um profissional de contabilidade.

---

Desenvolvido por [Luís Felipe Rodrigues](https://feliperodrigues.net). As calculadoras de base são da Receita Federal do Brasil, publicadas sob licença MIT nos repositórios citados acima.
