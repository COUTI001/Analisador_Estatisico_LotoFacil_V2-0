/**
 * Desenvolvido por: André Luiz Coutinho (COUTIINOVATION)
 * Backend do Analisador Estatístico da Loto Fácil
 */

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de sessão - detecta modo anônimo
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware de CORS
app.use(cors({
    origin: true,
    credentials: true // Permite cookies
}));

// Configuração de sessão
app.use(session({
    secret: 'loto-facil-secret-key-2024-coutiinnovation',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // true em produção com HTTPS
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    },
    name: 'lotoFacilSession'
}));

// Middleware para detectar modo anônimo
app.use((req, res, next) => {
    // Marca sessão como inicializada
    if (!req.session.initialized) {
        req.session.initialized = true;
        req.session.initialTime = Date.now();
        req.session.requestCount = 0;
    }
    
    req.session.requestCount = (req.session.requestCount || 0) + 1;
    
    // Verifica se a sessão está funcionando corretamente
    // Em modo anônimo, sessões podem não funcionar adequadamente
    if (!req.session || !req.session.id || !req.session.initialized) {
        console.log('[BLOQUEIO] Sessão inválida detectada - possível modo anônimo');
        req.session.anonimoDetectado = true;
        return next();
    }
    
    // Verificação mais rigorosa: após algumas requisições, o cookie DEVE existir
    const testCookie = req.cookies['lotoFacilTest'];
    const tempoDesdeInicializacao = Date.now() - (req.session.initialTime || Date.now());
    
    if (!testCookie) {
        // Primeira requisição - define cookie
        if (req.session.requestCount === 1) {
            res.cookie('lotoFacilTest', 'test_' + Date.now(), {
                httpOnly: false,
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000 // 24 horas
            });
            req.session.anonimoDetectado = false;
            console.log('[BLOQUEIO] Cookie de teste definido na primeira requisição');
        } else if (req.session.requestCount > 2 && tempoDesdeInicializacao > 2000) {
            // Após 2+ requisições e mais de 2 segundos, se não tem cookie = modo anônimo
            console.log('[BLOQUEIO] Cookie não encontrado após múltiplas requisições - modo anônimo detectado');
            req.session.anonimoDetectado = true;
        } else {
            req.session.anonimoDetectado = false;
        }
    } else {
        // Cookie existe - verifica se pode ser lido e se é válido
        if (testCookie.startsWith('test_')) {
            req.session.anonimoDetectado = false;
        } else {
            // Cookie inválido - possível manipulação
            console.log('[BLOQUEIO] Cookie inválido detectado');
            req.session.anonimoDetectado = true;
        }
    }
    
    next();
});

// Armazenamento em memória (em produção, usar banco de dados)
const usuarios = new Map(); // userId -> dados
const codigosAtivos = new Map(); // codigo -> { userId, expiracao }
const historico = new Map(); // userId -> array de jogos

// Constantes
const MAX_GERACOES_POR_DIA = 3;
const CODIGO_ILIMITADO = -1;
const CODIGOS_VALIDOS = {
    'ATIVO15D': 15,
    'LOTO15D': 15,
    'PREMIUM15D': 15,
    'ATIVO30D': 30,
    'LOTO30D': 30,
    'PREMIUM30D': 30,
    'COUTI30D': 30,
    'ATIVO6M': 180,
    'LOTO6M': 180,
    'PREMIUM6M': 180,
    'COUTI6M': 180,
    'UNLIMITED6M': 180,
    'ATIVO1A': 365,
    'LOTO1A': 365,
    'PREMIUM1A': 365,
    'COUTI1A': 365,
    'UNLIMITED1A': 365,
    'VIP2024': 365,
    'P&RSONAL001': CODIGO_ILIMITADO,
    'PERSON@L002': CODIGO_ILIMITADO,
    'PROFILE003': CODIGO_ILIMITADO,
    '$Atenccao004': CODIGO_ILIMITADO,
    '*#COABITACAO005': CODIGO_ILIMITADO
};

// Função para obter ou criar ID de usuário
function getUserId(req) {
    if (!req.session.userId) {
        req.session.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(7);
        usuarios.set(req.session.userId, {
            contador: 0,
            timestamp: null,
            codigoAtivo: null,
            codigoExpiracao: null
        });
    }
    return req.session.userId;
}

// Função para verificar modo anônimo (mais rigorosa)
function verificarModoAnonimo(req, res) {
    // Verifica se sessão foi marcada como anônima pelo middleware
    if (req.session.anonimoDetectado === true) {
        console.log('[BLOQUEIO] Modo anônimo confirmado pela sessão');
        return true;
    }
    
    // Verifica se a sessão está funcionando
    if (!req.session || !req.session.id || !req.session.initialized) {
        console.log('[BLOQUEIO] Sessão inválida - bloqueando');
        return true;
    }
    
    // Verificação adicional: cookie deve existir após primeira requisição
    const testCookie = req.cookies['lotoFacilTest'];
    const tempoDesdeInicializacao = req.session.initialTime ? (Date.now() - req.session.initialTime) : 0;
    const requestCount = req.session.requestCount || 0;
    
    // Se passou tempo suficiente e não tem cookie = modo anônimo
    if (requestCount > 1 && tempoDesdeInicializacao > 2000) {
        if (!testCookie || !testCookie.startsWith('test_')) {
            console.log('[BLOQUEIO] Cookie ausente ou inválido após múltiplas requisições - modo anônimo');
            req.session.anonimoDetectado = true;
            return true;
        }
    }
    
    // Verificação extra: se o cookie foi definido mas não persiste entre requisições
    if (requestCount > 3 && !testCookie) {
        console.log('[BLOQUEIO] Cookie não persiste entre requisições - modo anônimo');
        req.session.anonimoDetectado = true;
        return true;
    }
    
    return false;
}

// Função para verificar se código está ativo
function isCodigoAtivo(userId) {
    const user = usuarios.get(userId);
    if (!user || !user.codigoAtivo) {
        return false;
    }
    
    if (user.codigoExpiracao === CODIGO_ILIMITADO) {
        return true;
    }
    
    if (Date.now() > user.codigoExpiracao) {
        user.codigoAtivo = null;
        user.codigoExpiracao = null;
        return false;
    }
    
    return true;
}

// Função para verificar se pode gerar (com validações rigorosas)
function podeGerar(userId, quantidade = 1) {
    // Valida quantidade
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 3) {
        console.log(`[LIMITE] Quantidade inválida: ${quantidade}`);
        return false;
    }
    
    // Se tem código ativo, pode gerar
    if (isCodigoAtivo(userId)) {
        console.log(`[LIMITE] Usuário ${userId} tem código ativo - permitindo geração`);
        return true;
    }
    
    const user = usuarios.get(userId);
    if (!user) {
        console.log(`[LIMITE] Usuário ${userId} não encontrado`);
        return false;
    }
    
    const agora = Date.now();
    const vinteQuatroHoras = 24 * 60 * 60 * 1000;
    
    // Verifica se passou 24 horas desde o primeiro uso do dia
    if (!user.timestamp || (agora - user.timestamp) >= vinteQuatroHoras) {
        // Reset do dia - pode gerar até MAX_GERACOES_POR_DIA
        const podeGerarQuantidade = quantidade <= MAX_GERACOES_POR_DIA;
        console.log(`[LIMITE] Novo dia ou primeiro uso - pode gerar ${quantidade}? ${podeGerarQuantidade}`);
        return podeGerarQuantidade;
    }
    
    // Mesmo dia - verifica se não ultrapassa o limite
    const totalAposGeracao = user.contador + quantidade;
    const podeGerar = totalAposGeracao <= MAX_GERACOES_POR_DIA;
    
    console.log(`[LIMITE] Usuário ${userId} - Contador atual: ${user.contador}, Tentando gerar: ${quantidade}, Total após: ${totalAposGeracao}, Pode gerar: ${podeGerar}`);
    
    return podeGerar;
}

// Função para incrementar contador (com validações)
function incrementarContador(userId, quantidade = 1) {
    const user = usuarios.get(userId);
    if (!user) {
        console.error(`[LIMITE] Erro: tentativa de incrementar contador para usuário inexistente: ${userId}`);
        return;
    }
    
    // Não incrementa se código está ativo
    if (isCodigoAtivo(userId)) {
        console.log(`[LIMITE] Usuário ${userId} tem código ativo - não incrementando contador`);
        return;
    }
    
    // Valida quantidade
    if (!Number.isInteger(quantidade) || quantidade < 1) {
        console.error(`[LIMITE] Erro: quantidade inválida para incremento: ${quantidade}`);
        return;
    }
    
    const agora = Date.now();
    const vinteQuatroHoras = 24 * 60 * 60 * 1000;
    
    // Se passou 24 horas ou é primeiro uso, reseta contador
    if (!user.timestamp || (agora - user.timestamp) >= vinteQuatroHoras) {
        const contadorAnterior = user.contador;
        user.contador = quantidade;
        user.timestamp = agora;
        console.log(`[LIMITE] Reset do dia para ${userId} - Contador anterior: ${contadorAnterior}, Novo: ${quantidade}`);
    } else {
        // Mesmo dia - incrementa
        const contadorAnterior = user.contador;
        user.contador += quantidade;
        console.log(`[LIMITE] Incremento para ${userId} - Contador anterior: ${contadorAnterior}, Novo: ${user.contador}`);
        
        // Garante que não ultrapassa o limite (proteção extra)
        if (user.contador > MAX_GERACOES_POR_DIA) {
            console.warn(`[LIMITE] ATENÇÃO: Contador ultrapassou limite para ${userId} - Limitando a ${MAX_GERACOES_POR_DIA}`);
            user.contador = MAX_GERACOES_POR_DIA;
        }
    }
}

// Função para gerar jogos
function realizarSorteioComBaseNosTresSorteios(tresSorteios, resultadoAtual, modo = 'balanceado', numerosExcluir = [], numerosIncluir = []) {
    const numerosSorteados = [];
    const numerosExcluirSet = new Set(numerosExcluir);
    const numerosIncluirSet = new Set(numerosIncluir);
    
    // Identifica números não sorteados no resultado atual
    const numerosNaoSorteados = [];
    for (let i = 1; i <= 25; i++) {
        if (!resultadoAtual.includes(i)) {
            numerosNaoSorteados.push(i);
        }
    }
    
    // Conta frequências
    const frequencias = new Array(26).fill(0);
    for (const sorteio of tresSorteios) {
        for (const num of sorteio) {
            if (num >= 1 && num <= 25) {
                frequencias[num]++;
            }
        }
    }
    
    // Calcula média
    let somaFrequencias = 0;
    for (let i = 1; i <= 25; i++) {
        somaFrequencias += frequencias[i];
    }
    const mediaFrequencia = somaFrequencias / 3.0;
    
    // Ajusta pesos baseado no modo
    let pesoNaoSorteados = 5;
    let pesoFrequencia = 2;
    let pesoNumerosFrios = 0;
    
    if (modo === 'conservador') {
        pesoNaoSorteados = 3;
        pesoFrequencia = 5;
        pesoNumerosFrios = 0;
    } else if (modo === 'agressivo') {
        pesoNaoSorteados = 7;
        pesoFrequencia = 1;
        pesoNumerosFrios = 4;
    }
    
    // Cria lista de números disponíveis com pesos
    const numerosDisponiveis = [];
    const pesos = [];
    
    for (let i = 1; i <= 25; i++) {
        if (numerosExcluirSet.has(i)) {
            continue;
        }
        
        numerosDisponiveis.push(i);
        let peso = 1;
        
        if (numerosIncluirSet.has(i)) {
            peso += 20;
        }
        
        if (numerosNaoSorteados.includes(i)) {
            peso += pesoNaoSorteados;
        }
        
        if (frequencias[i] > mediaFrequencia) {
            peso += Math.floor((frequencias[i] - mediaFrequencia) * pesoFrequencia);
        } else if (modo === 'agressivo' && frequencias[i] < mediaFrequencia) {
            peso += Math.floor((mediaFrequencia - frequencias[i]) * pesoNumerosFrios);
        }
        
        pesos.push(peso);
    }
    
    // Garante que há números suficientes
    if (numerosDisponiveis.length < 15) {
        throw new Error(`Não há números suficientes disponíveis. Apenas ${numerosDisponiveis.length} números disponíveis após aplicar filtros.`);
    }
    
    // Sorteia 15 números
    for (let i = 0; i < 15; i++) {
        if (numerosDisponiveis.length === 0) {
            throw new Error('Erro ao gerar jogo: números disponíveis esgotados durante o sorteio.');
        }
        
        let somaPesos = 0;
        for (const peso of pesos) {
            somaPesos += peso;
        }
        
        if (somaPesos <= 0) {
            // Se não há pesos, escolhe aleatoriamente
            const indiceAleatorio = Math.floor(Math.random() * numerosDisponiveis.length);
            const numeroSorteado = numerosDisponiveis[indiceAleatorio];
            numerosSorteados.push(numeroSorteado);
            numerosDisponiveis.splice(indiceAleatorio, 1);
            pesos.splice(indiceAleatorio, 1);
            continue;
        }
        
        const r = Math.random() * somaPesos;
        let acumulado = 0;
        let indiceEscolhido = 0;
        
        for (let j = 0; j < pesos.length; j++) {
            acumulado += pesos[j];
            if (r < acumulado) {
                indiceEscolhido = j;
                break;
            }
        }
        
        const numeroSorteado = numerosDisponiveis[indiceEscolhido];
        if (!numeroSorteado) {
            throw new Error('Erro ao selecionar número: índice inválido.');
        }
        
        numerosSorteados.push(numeroSorteado);
        
        numerosDisponiveis.splice(indiceEscolhido, 1);
        pesos.splice(indiceEscolhido, 1);
    }
    
    if (numerosSorteados.length !== 15) {
        throw new Error(`Erro: foram gerados apenas ${numerosSorteados.length} números em vez de 15.`);
    }
    
    return numerosSorteados.sort((a, b) => a - b);
}

// Função para calcular estatísticas
function calcularEstatisticas(tresSorteios) {
    const frequencias = new Array(26).fill(0);
    
    for (const sorteio of tresSorteios) {
        for (const num of sorteio) {
            if (num >= 1 && num <= 25) {
                frequencias[num]++;
            }
        }
    }
    
    const numerosComFrequencia = [];
    for (let i = 1; i <= 25; i++) {
        numerosComFrequencia.push({ numero: i, frequencia: frequencias[i] });
    }
    
    const maisSorteados = [...numerosComFrequencia]
        .sort((a, b) => b.frequencia - a.frequencia)
        .slice(0, 10);
    
    const menosSorteados = [...numerosComFrequencia]
        .sort((a, b) => a.frequencia - b.frequencia)
        .slice(0, 10);
    
    const distribuicaoDezenas = { '1-5': 0, '6-10': 0, '11-15': 0, '16-20': 0, '21-25': 0 };
    let pares = 0;
    let impares = 0;
    const sequencias = [];
    
    for (const sorteio of tresSorteios) {
        const sorted = [...sorteio].sort((a, b) => a - b);
        
        for (const num of sorted) {
            if (num <= 5) distribuicaoDezenas['1-5']++;
            else if (num <= 10) distribuicaoDezenas['6-10']++;
            else if (num <= 15) distribuicaoDezenas['11-15']++;
            else if (num <= 20) distribuicaoDezenas['16-20']++;
            else distribuicaoDezenas['21-25']++;
            
            if (num % 2 === 0) pares++;
            else impares++;
        }
        
        let sequenciaAtual = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === sorted[i-1] + 1) {
                sequenciaAtual.push(sorted[i]);
            } else {
                if (sequenciaAtual.length >= 2) {
                    sequencias.push(sequenciaAtual.length);
                }
                sequenciaAtual = [sorted[i]];
            }
        }
        if (sequenciaAtual.length >= 2) {
            sequencias.push(sequenciaAtual.length);
        }
    }
    
    const mediaSequencias = sequencias.length > 0
        ? (sequencias.reduce((a, b) => a + b, 0) / sequencias.length).toFixed(1)
        : 0;
    
    return {
        maisSorteados,
        menosSorteados,
        frequencias: frequencias.slice(1),
        distribuicaoDezenas,
        pares: (pares / 3).toFixed(1),
        impares: (impares / 3).toFixed(1),
        mediaSequencias,
        totalSequencias: sequencias.length
    };
}

// API: Verificar status inicial
app.get('/api/status', (req, res) => {
    console.log('[STATUS] Verificando status do usuário');
    
    // PRIMEIRO: Verifica modo anônimo ANTES de criar userId
    if (verificarModoAnonimo(req, res)) {
        console.log('[BLOQUEIO] ✗ Modo anônimo detectado na verificação de status');
        return res.json({
            sucesso: false,
            erro: 'MODO_ANONIMO',
            mensagem: 'Este aplicativo não funciona em janela anônima/privada. Por favor, use uma janela normal do navegador.'
        });
    }
    
    // Só cria userId se passou na verificação de modo anônimo
    const userId = getUserId(req);
    const user = usuarios.get(userId);
    
    if (!user) {
        console.error('[ERRO] Usuário não encontrado após getUserId');
        return res.json({
            sucesso: false,
            erro: 'USUARIO_NAO_ENCONTRADO',
            mensagem: 'Erro ao verificar status do usuário.'
        });
    }
    
    const podeGerarAgora = podeGerar(userId, 1);
    
    console.log(`[STATUS] Usuário ${userId} - Contador: ${user.contador}/${MAX_GERACOES_POR_DIA}, Pode gerar: ${podeGerarAgora}`);
    
    res.json({
        sucesso: true,
        contador: user.contador || 0,
        maxGeracoes: MAX_GERACOES_POR_DIA,
        codigoAtivo: isCodigoAtivo(userId),
        timestamp: user.timestamp,
        podeGerar: podeGerarAgora
    });
});

// API: Gerar jogos
app.post('/api/gerar', (req, res) => {
    console.log('=== REQUISIÇÃO PARA GERAR JOGOS ===');
    console.log('IP:', req.ip || req.connection.remoteAddress);
    console.log('User-Agent:', req.get('user-agent'));
    
    // PRIMEIRO: Verifica modo anônimo ANTES de criar userId
    if (verificarModoAnonimo(req, res)) {
        console.log('[BLOQUEIO] ✗ Modo anônimo detectado - BLOQUEANDO requisição');
        return res.status(403).json({
            sucesso: false,
            erro: 'MODO_ANONIMO',
            mensagem: 'Este aplicativo não funciona em janela anônima/privada. Por favor, use uma janela normal do navegador.'
        });
    }
    
    // Só cria userId se passou na verificação de modo anônimo
    const userId = getUserId(req);
    console.log('[USUÁRIO] UserId:', userId);
    
    // Verifica se o usuário existe (deve existir após getUserId)
    if (!usuarios.has(userId)) {
        console.error('[ERRO] Usuário não encontrado após getUserId - criando...');
        usuarios.set(userId, {
            contador: 0,
            timestamp: null,
            codigoAtivo: null,
            codigoExpiracao: null
        });
    }
    
    const { sorteio1, sorteio2, sorteio3, resultadoAtual, modoGeracao, quantidadeJogos, numerosExcluir, numerosIncluir } = req.body;
    
    console.log('Dados recebidos:', {
        sorteio1: sorteio1?.length,
        sorteio2: sorteio2?.length,
        sorteio3: sorteio3?.length,
        resultadoAtual: resultadoAtual?.length,
        modoGeracao,
        quantidadeJogos
    });
    
    // Validações
    if (!sorteio1 || !sorteio2 || !sorteio3 || !resultadoAtual) {
        console.log('Dados incompletos');
        return res.status(400).json({
            sucesso: false,
            erro: 'DADOS_INCOMPLETOS',
            mensagem: 'Por favor, preencha todos os sorteios e o resultado atual.'
        });
    }
    
    const quantidade = parseInt(quantidadeJogos) || 1;
    
    // Valida quantidade antes de verificar limite
    if (quantidade < 1 || quantidade > 3) {
        console.log(`[BLOQUEIO] Quantidade inválida: ${quantidade}`);
        return res.status(400).json({
            sucesso: false,
            erro: 'QUANTIDADE_INVALIDA',
            mensagem: 'Quantidade de jogos deve estar entre 1 e 3.'
        });
    }
    
    // Verifica se pode gerar ANTES de processar
    if (!podeGerar(userId, quantidade)) {
        const user = usuarios.get(userId);
        const agora = Date.now();
        const vinteQuatroHoras = 24 * 60 * 60 * 1000;
        const tempoRestante = user && user.timestamp ? Math.max(0, vinteQuatroHoras - (agora - user.timestamp)) : 0;
        const horasRestantes = Math.ceil(tempoRestante / (60 * 60 * 1000));
        
        console.log(`[BLOQUEIO] ✗ Limite atingido para userId: ${userId}`);
        console.log(`[BLOQUEIO] Contador atual: ${user?.contador || 0}, Tentando gerar: ${quantidade}`);
        console.log(`[BLOQUEIO] Tempo restante: ${horasRestantes} horas`);
        
        return res.status(403).json({
            sucesso: false,
            erro: 'LIMITE_ATINGIDO',
            mensagem: `Limite diário atingido! Você já gerou ${user?.contador || 0} de ${MAX_GERACOES_POR_DIA} jogos hoje. Tente novamente em ${horasRestantes} hora(s).`,
            contador: user?.contador || 0,
            maxGeracoes: MAX_GERACOES_POR_DIA,
            tempoRestante
        });
    }
    
    console.log(`[LIMITE] ✓ Usuário ${userId} pode gerar ${quantidade} jogo(s)`);
    
    try {
        // Valida formato dos arrays
        const validarArray = (arr, nome) => {
            if (!Array.isArray(arr)) {
                throw new Error(`${nome} deve ser um array.`);
            }
            if (arr.length !== 15) {
                throw new Error(`${nome} deve conter exatamente 15 números.`);
            }
            for (const num of arr) {
                if (!Number.isInteger(num) || num < 1 || num > 25) {
                    throw new Error(`${nome} contém número inválido: ${num}. Todos os números devem estar entre 1 e 25.`);
                }
            }
        };
        
        validarArray(sorteio1, 'Sorteio 1');
        validarArray(sorteio2, 'Sorteio 2');
        validarArray(sorteio3, 'Sorteio 3');
        validarArray(resultadoAtual, 'Resultado Atual');
        
        const tresSorteios = [sorteio1, sorteio2, sorteio3];
        const modo = modoGeracao || 'balanceado';
        
        const listaJogos = [];
        for (let i = 0; i < quantidade; i++) {
            const jogo = realizarSorteioComBaseNosTresSorteios(
                tresSorteios,
                resultadoAtual,
                modo,
                Array.isArray(numerosExcluir) ? numerosExcluir : [],
                Array.isArray(numerosIncluir) ? numerosIncluir : []
            );
            
            // Valida o jogo gerado
            if (!Array.isArray(jogo) || jogo.length !== 15) {
                throw new Error(`Erro ao gerar jogo ${i + 1}: jogo inválido gerado.`);
            }
            
            listaJogos.push(jogo);
        }
        
        incrementarContador(userId, quantidade);
        
        // Salva no histórico
        if (!historico.has(userId)) {
            historico.set(userId, []);
        }
        historico.get(userId).unshift({
            data: new Date().toISOString(),
            jogos: listaJogos,
            modo
        });
        // Mantém apenas os últimos 50 registros
        if (historico.get(userId).length > 50) {
            historico.set(userId, historico.get(userId).slice(0, 50));
        }
        
        const estatisticas = calcularEstatisticas(tresSorteios);
        const user = usuarios.get(userId);
        
        console.log('Jogos gerados com sucesso:', listaJogos.length);
        console.log('Contador atual:', user.contador);
        
        res.json({
            sucesso: true,
            jogos: listaJogos,
            estatisticas,
            contador: user.contador,
            maxGeracoes: MAX_GERACOES_POR_DIA
        });
    } catch (error) {
        console.error('Erro ao gerar jogos:', error);
        console.error('Stack:', error.stack);
        res.status(400).json({
            sucesso: false,
            erro: 'ERRO_VALIDACAO',
            mensagem: error.message || 'Erro desconhecido ao gerar jogos.'
        });
    }
});

// API: Ativar código
app.post('/api/ativar-codigo', (req, res) => {
    if (verificarModoAnonimo(req, res)) {
        return res.status(403).json({
            sucesso: false,
            erro: 'MODO_ANONIMO',
            mensagem: 'Este aplicativo não funciona em janela anônima/privada.'
        });
    }
    
    const userId = getUserId(req);
    const { codigo } = req.body;
    
    if (!codigo || codigo.trim() === '') {
        return res.status(400).json({
            sucesso: false,
            erro: 'CODIGO_VAZIO',
            mensagem: 'Código vazio'
        });
    }
    
    const codigoLimpo = codigo.trim().toUpperCase();
    const diasValidade = CODIGOS_VALIDOS[codigoLimpo];
    
    if (diasValidade === undefined) {
        return res.status(400).json({
            sucesso: false,
            erro: 'CODIGO_INVALIDO',
            mensagem: 'Código inválido'
        });
    }
    
    // Verifica se código já foi usado
    if (codigosAtivos.has(codigoLimpo)) {
        const codigoInfo = codigosAtivos.get(codigoLimpo);
        if (codigoInfo.userId !== userId) {
            return res.status(403).json({
                sucesso: false,
                erro: 'CODIGO_JA_USADO',
                mensagem: 'Este código já foi utilizado por outro usuário. Cada código só pode ser usado por um usuário.'
            });
        }
    }
    
    const user = usuarios.get(userId);
    const agora = Date.now();
    const expiracao = diasValidade === CODIGO_ILIMITADO 
        ? CODIGO_ILIMITADO 
        : agora + (diasValidade * 24 * 60 * 60 * 1000);
    
    user.codigoAtivo = codigoLimpo;
    user.codigoExpiracao = expiracao;
    codigosAtivos.set(codigoLimpo, { userId, expiracao });
    
    res.json({
        sucesso: true,
        dias: diasValidade,
        ilimitado: diasValidade === CODIGO_ILIMITADO,
        expiracao: expiracao === CODIGO_ILIMITADO ? null : expiracao
    });
});

// API: Obter histórico
app.get('/api/historico', (req, res) => {
    if (verificarModoAnonimo(req, res)) {
        return res.status(403).json({
            sucesso: false,
            erro: 'MODO_ANONIMO',
            mensagem: 'Este aplicativo não funciona em janela anônima/privada.'
        });
    }
    
    const userId = getUserId(req);
    const historicoUser = historico.get(userId) || [];
    
    res.json({
        sucesso: true,
        historico: historicoUser
    });
});

// API: Limpar histórico
app.delete('/api/historico', (req, res) => {
    if (verificarModoAnonimo(req, res)) {
        return res.status(403).json({
            sucesso: false,
            erro: 'MODO_ANONIMO',
            mensagem: 'Este aplicativo não funciona em janela anônima/privada.'
        });
    }
    
    const userId = getUserId(req);
    historico.delete(userId);
    
    res.json({
        sucesso: true,
        mensagem: 'Histórico limpo com sucesso'
    });
});

// Servir arquivos estáticos (DEPOIS de todas as rotas da API)
app.use(express.static(path.join(__dirname)));

// Rota catch-all para servir index.html em rotas não-API
app.get('*', (req, res) => {
    // Se não for uma rota de API, serve o index.html
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        res.status(404).json({ erro: 'Rota não encontrada' });
    }
});

// Exporta o app para Vercel (serverless)
// Se estiver rodando localmente, inicia o servidor normalmente
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Servidor rodando em http://localhost:${PORT}`);
        console.log('Analisador Estatístico da Loto Fácil - Backend');
        console.log('Desenvolvido por: André Luiz Coutinho (COUTIINOVATION)');
    });
}

// Exporta para Vercel
module.exports = app;

