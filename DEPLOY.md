# 🚀 Guia de Deploy - Analisador Loto Fácil

## 📋 Resumo Rápido

**Sim, você precisa iniciar com `npm start` manualmente** quando rodar localmente ou em um servidor tradicional.

**Para servidores de hospedagem modernos** (Vercel, Railway, Render, etc.), o `npm start` é executado **automaticamente** após o deploy.

---

## 🏠 Uso Local

### Desenvolvimento Local
```bash
npm start
```
O servidor iniciará na porta 3000 (ou na porta definida pela variável de ambiente `PORT`).

**Nota:** Você precisa executar este comando toda vez que quiser usar o sistema localmente.

---

## ☁️ Opções de Deploy

### ⚠️ IMPORTANTE: GitHub Pages NÃO funciona

**GitHub Pages** é apenas para sites estáticos (HTML, CSS, JS puro). Como este projeto precisa de **Node.js rodando** (servidor backend), GitHub Pages **NÃO suporta**.

---

## ✅ Opções Recomendadas de Deploy

### 1. **Vercel** (Recomendado - Grátis e Fácil) ⭐

**Vantagens:**
- ✅ Grátis
- ✅ Deploy automático do GitHub
- ✅ HTTPS automático
- ✅ Executa `npm start` automaticamente
- ✅ Suporta Node.js

**Como fazer:**
1. Faça commit e push para o GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Conecte seu repositório GitHub
4. Vercel detecta automaticamente e faz o deploy
5. Pronto! O `npm start` roda automaticamente

**Configuração necessária:** Nenhuma! Vercel detecta automaticamente.

---

### 2. **Railway** (Grátis com limites)

**Vantagens:**
- ✅ Grátis (com limites)
- ✅ Deploy automático do GitHub
- ✅ Executa `npm start` automaticamente
- ✅ Suporta Node.js

**Como fazer:**
1. Acesse [railway.app](https://railway.app)
2. Conecte seu repositório GitHub
3. Railway detecta automaticamente e faz o deploy
4. Pronto!

---

### 3. **Render** (Grátis com limites)

**Vantagens:**
- ✅ Grátis (com limites)
- ✅ Deploy automático do GitHub
- ✅ Executa `npm start` automaticamente

**Como fazer:**
1. Acesse [render.com](https://render.com)
2. Conecte seu repositório GitHub
3. Selecione "Web Service"
4. Render detecta automaticamente e faz o deploy

---

### 4. **Heroku** (Pago, mas confiável)

**Vantagens:**
- ✅ Muito confiável
- ✅ Deploy automático do GitHub
- ⚠️ Plano grátis foi descontinuado (agora é pago)

**Como fazer:**
1. Crie um arquivo `Procfile` (já incluído neste projeto)
2. Acesse [heroku.com](https://heroku.com)
3. Conecte seu repositório GitHub
4. Heroku executa `npm start` automaticamente

---

### 5. **Servidor VPS/Cloud** (DigitalOcean, AWS, etc.)

**Como funciona:**
- Você precisa configurar manualmente
- Instalar Node.js no servidor
- Executar `npm start` manualmente ou usar um processo manager (PM2)

**Recomendação:** Use PM2 para manter o servidor rodando:
```bash
npm install -g pm2
pm2 start server.js --name "loto-facil"
pm2 save
pm2 startup
```

---

## 📝 O que acontece no Deploy Automático?

Quando você faz deploy em plataformas como Vercel, Railway, Render:

1. ✅ A plataforma detecta o `package.json`
2. ✅ Executa `npm install` automaticamente
3. ✅ Executa `npm start` automaticamente
4. ✅ Mantém o servidor rodando 24/7
5. ✅ Reinicia automaticamente se cair

**Você NÃO precisa fazer nada manualmente!**

---

## 🔧 Configurações Necessárias

### Variável de Ambiente PORT

A maioria das plataformas define automaticamente a variável `PORT`. O código já está preparado:

```javascript
const PORT = process.env.PORT || 3000;
```

Isso significa que:
- Se `PORT` estiver definido (plataformas de deploy), usa essa porta
- Caso contrário, usa 3000 (desenvolvimento local)

---

## 📦 Checklist para Deploy

Antes de fazer deploy, certifique-se de:

- [x] `package.json` tem o script `"start": "node server.js"`
- [x] Todas as dependências estão listadas em `dependencies`
- [x] `.gitignore` inclui `node_modules/`
- [x] Código está no GitHub
- [x] Não há erros ao executar `npm start` localmente

---

## 🎯 Recomendação Final

**Para começar rápido e grátis:** Use **Vercel**

1. É grátis
2. Deploy automático
3. HTTPS incluído
4. Zero configuração
5. Executa `npm start` automaticamente

Basta conectar seu repositório GitHub e pronto!

---

## ❓ Perguntas Frequentes

**P: Preciso fazer algo especial no código para deploy?**
R: Não! O código já está preparado. Apenas faça commit e conecte ao serviço de deploy.

**P: O npm start roda sozinho no deploy?**
R: Sim, em plataformas modernas (Vercel, Railway, Render) sim. Em servidores VPS, você precisa configurar.

**P: Posso usar GitHub Pages?**
R: Não, GitHub Pages não suporta Node.js. Use Vercel, Railway ou Render.

**P: Quanto custa?**
R: Vercel, Railway e Render têm planos grátis suficientes para projetos pessoais.

---

**Desenvolvido por: André Luiz Coutinho (COUTIINOVATION)**

