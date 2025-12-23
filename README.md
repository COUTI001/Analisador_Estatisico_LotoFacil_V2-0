# Analisador Estatístico da Loto Fácil

Aplicação web com backend para análise estatística de sorteios da Loto Fácil.

Desenvolvido por: André Luiz Coutinho (COUTIINOVATION)

## Características

- **Backend Node.js/Express**: Lógica de negócio no servidor
- **Detecção de modo anônimo**: Bloqueio de janelas anônimas/privadas via sessões e cookies
- **Controle de limites**: Sistema de limites diários com gerenciamento no backend
- **Códigos de ativação**: Sistema de códigos para desbloquear gerações ilimitadas
- **Análises estatísticas**: Gráficos e análises avançadas dos sorteios

## Instalação Local

1. Instale as dependências:
```bash
npm install
```

2. Inicie o servidor:
```bash
npm start
```

3. Acesse a aplicação em:
```
http://localhost:3000
```

**Nota:** Você precisa executar `npm start` toda vez que quiser usar o sistema localmente.

## Deploy em Produção

Para fazer deploy em servidores de hospedagem (Vercel, Railway, Render, etc.), o `npm start` é executado **automaticamente** após o deploy.

### Opções Recomendadas:
- **Vercel** (Recomendado - Grátis e fácil): Conecte seu repositório GitHub, deploy automático
- **Railway**: Deploy automático do GitHub
- **Render**: Deploy automático do GitHub

⚠️ **GitHub Pages NÃO funciona** - Este projeto precisa de Node.js rodando (servidor backend), GitHub Pages só suporta sites estáticos.

📖 **Veja o arquivo `DEPLOY.md` para instruções detalhadas de deploy.**

## Estrutura

- `server.js`: Backend Node.js com Express e APIs REST
- `index.html`: Interface frontend
- `script.js`: Cliente JavaScript (apenas chamadas à API)
- `styles.css`: Estilos da aplicação
- `package.json`: Dependências do projeto

## APIs

### GET /api/status
Verifica status do usuário e bloqueia modo anônimo

### POST /api/gerar
Gera jogos baseados nos sorteios informados

### POST /api/ativar-codigo
Ativa código de ativação

### GET /api/historico
Retorna histórico de jogos gerados

### DELETE /api/historico
Limpa histórico de jogos

## Bloqueio de Modo Anônimo

O sistema detecta janelas anônimas através de:
- Verificação de cookies habilitados
- Verificação de funcionamento de sessões
- Validação no backend em cada requisição

## Limites

- Usuários sem código ativo: 3 gerações por dia
- Reset automático após 24 horas
- Códigos de ativação podem desbloquear gerações ilimitadas

