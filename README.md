# Lead Flow Manager

Dashboard para acompanhamento de leads em fluxo comercial. A aplicacao combina pipeline visual, acoes em massa, paleta de comandos e um painel de apoio com IA para analisar conversas ou chamadas.

## Funcionalidades

- Pipeline de leads com estados operacionais.
- Acoes em massa para organizar contatos.
- Paleta de comandos para navegação rapida dentro da interface.
- Painel de coaching com Gemini para gerar feedback a partir de transcricoes.
- Componentes de dashboard, importacao e produtividade comercial.

## Stack

- React
- TypeScript
- Vite
- Google Gemini API

## Como Rodar

```bash
npm install
npm run dev
```

Para usar os recursos de IA, configure a chave no ambiente:

```bash
GEMINI_API_KEY=
```

## Estrutura

```text
components/   Interface do dashboard e controles
hooks/        Hooks reutilizaveis
services/     Integracao com IA
types.ts      Tipos principais de leads e pipeline
```

## Por Que Este Projeto E Relevante

Ele demonstra construcao de uma ferramenta operacional: estado de interface, organizacao de dados, componentes reutilizaveis e integracao com IA aplicada a um caso real de vendas.

