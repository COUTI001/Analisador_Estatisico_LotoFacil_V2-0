/**
 * Desenvolvido por: André Luiz Coutinho(COUTIINOVATION)
 * Versão JavaScript/HTML
 */

// Elementos do DOM
const form = document.getElementById('sorteioForm');
const btnGerar = document.getElementById('btnGerar');
const resultadoContainer = document.getElementById('resultadoContainer');
const jogosGerados = document.getElementById('jogosGerados');
const errorMessage = document.getElementById('errorMessage');
const estatisticasContainer = document.getElementById('estatisticasContainer');
const maisSorteadosDiv = document.getElementById('maisSorteados');
const menosSorteadosDiv = document.getElementById('menosSorteados');
const limiteContainer = document.getElementById('limiteContainer');

// Constantes para controle de limite
const MAX_GERACOES_POR_DIA = 3;
const STORAGE_KEY_CONTADOR = 'lotoFacil_contador';
const STORAGE_KEY_TIMESTAMP = 'lotoFacil_timestamp';
const STORAGE_KEY_HISTORICO = 'lotoFacil_historico';
const STORAGE_KEY_TEMA = 'lotoFacil_tema';
const STORAGE_KEY_NUMEROS_EXCLUIR = 'lotoFacil_numeros_excluir';
const STORAGE_KEY_NUMEROS_INCLUIR = 'lotoFacil_numeros_incluir';

// Estado global
let numerosExcluir = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY_NUMEROS_EXCLUIR) || '[]'));
let numerosIncluir = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY_NUMEROS_INCLUIR) || '[]'));

/**
 * Converte uma linha de texto em uma lista de 15 inteiros (1 a 25, sem repetição).
 */
function parseSorteio(texto, nomeCampo) {
    if (!texto || texto.trim() === '') {
        throw new Error(`${nomeCampo}: digite 15 números separados por vírgula.`);
    }

    const partes = texto.split(',').map(p => p.trim()).filter(p => p !== '');
    
    if (partes.length !== 15) {
        throw new Error(`${nomeCampo}: você deve informar exatamente 15 números.`);
    }

    const numeros = [];
    const numerosVistos = new Set();

    for (const parte of partes) {
        const valor = parseInt(parte, 10);
        
        if (isNaN(valor)) {
            throw new Error(`${nomeCampo}: certifique-se de digitar apenas números inteiros separados por vírgula.`);
        }

        if (valor < 1 || valor > 25) {
            throw new Error(`${nomeCampo}: todos os números devem estar entre 1 e 25.`);
        }

        if (numerosVistos.has(valor)) {
            throw new Error(`${nomeCampo}: os 15 números não devem conter repetições.`);
        }

        numeros.push(valor);
        numerosVistos.add(valor);
    }

    return numeros;
}

/**
 * Lê e valida os 3 últimos sorteios informados pelo usuário.
 */
function lerTresSorteios() {
    const sorteio1 = parseSorteio(
        document.getElementById('sorteio1').value,
        'Sorteio 1'
    );
    const sorteio2 = parseSorteio(
        document.getElementById('sorteio2').value,
        'Sorteio 2'
    );
    const sorteio3 = parseSorteio(
        document.getElementById('sorteio3').value,
        'Sorteio 3'
    );

    return [sorteio1, sorteio2, sorteio3];
}

/**
 * Obtém o modo de geração selecionado
 */
function obterModoGeracao() {
    const select = document.getElementById('modoGeracao');
    return select ? select.value : 'balanceado';
}

/**
 * Gera 15 números combinando:
 * - Números que NÃO foram sorteados no resultado atual
 * - Média dos números que mais saíram nos 3 últimos sorteios
 */
function realizarSorteioComBaseNosTresSorteios(tresSorteios, resultadoAtual, modo = 'balanceado') {
    const numerosSorteados = [];

    // Identifica os números que NÃO foram sorteados no resultado atual
    const numerosNaoSorteados = [];
    for (let i = 1; i <= 25; i++) {
        if (!resultadoAtual.includes(i)) {
            numerosNaoSorteados.push(i);
        }
    }

    // Conta a frequência de cada número (1..25) nos três sorteios
    const frequencias = new Array(26).fill(0); // índice 0 não usado
    
    for (const sorteio of tresSorteios) {
        for (const num of sorteio) {
            if (num >= 1 && num <= 25) {
                frequencias[num]++;
            }
        }
    }

    // Calcula a média de frequência (soma das frequências / 3)
    let somaFrequencias = 0;
    for (let i = 1; i <= 25; i++) {
        somaFrequencias += frequencias[i];
    }
    const mediaFrequencia = somaFrequencias / 3.0;

    // Cria lista de números possíveis e seus "pesos" combinando:
    // - Prioridade para números NÃO sorteados no resultado atual
    // - Peso baseado na frequência acima da média nos três últimos sorteios
    const numerosDisponiveis = [];
    const pesos = [];

    // Ajusta pesos baseado no modo de geração
    let pesoNaoSorteados = 5;
    let pesoFrequencia = 2;
    let pesoNumerosFrios = 0;

    if (modo === 'conservador') {
        pesoNaoSorteados = 3;
        pesoFrequencia = 5; // Prioriza frequência
        pesoNumerosFrios = 0;
    } else if (modo === 'agressivo') {
        pesoNaoSorteados = 7;
        pesoFrequencia = 1;
        pesoNumerosFrios = 4; // Prioriza números frios
    }

    for (let i = 1; i <= 25; i++) {
        // Exclui números marcados para exclusão
        if (numerosExcluir.has(i)) {
            continue;
        }

        numerosDisponiveis.push(i);
        let peso = 1; // peso base mínimo

        // Se está na lista de inclusão forçada, peso muito alto
        if (numerosIncluir.has(i)) {
            peso += 20;
        }

        // Bônus se o número NÃO foi sorteado no resultado atual
        if (numerosNaoSorteados.includes(i)) {
            peso += pesoNaoSorteados;
        }

        // Bônus se a frequência está acima da média nos três últimos sorteios
        if (frequencias[i] > mediaFrequencia) {
            peso += Math.floor((frequencias[i] - mediaFrequencia) * pesoFrequencia);
        } else if (modo === 'agressivo' && frequencias[i] < mediaFrequencia) {
            // Para modo agressivo, bônus para números frios
            peso += Math.floor((mediaFrequencia - frequencias[i]) * pesoNumerosFrios);
        }

        pesos.push(peso);
    }

    // Sorteia 15 números sem repetição, usando pesos (probabilidade proporcional ao peso)
    for (let i = 0; i < 15 && numerosDisponiveis.length > 0; i++) {
        // Soma total dos pesos atuais
        let somaPesos = 0;
        for (const peso of pesos) {
            somaPesos += peso;
        }

        const r = Math.floor(Math.random() * somaPesos) + 1; // valor entre 1 e somaPesos
        let acumulado = 0;
        let indiceEscolhido = 0;

        for (let j = 0; j < pesos.length; j++) {
            acumulado += pesos[j];
            if (r <= acumulado) {
                indiceEscolhido = j;
                break;
            }
        }

        const numeroSorteado = numerosDisponiveis[indiceEscolhido];
        numerosSorteados.push(numeroSorteado);

        // Remove o número e seu peso para não repetir
        numerosDisponiveis.splice(indiceEscolhido, 1);
        pesos.splice(indiceEscolhido, 1);
    }

    // Ordena os números sorteados antes de retornar
    numerosSorteados.sort((a, b) => a - b);

    return numerosSorteados;
}

/**
 * Salva jogo no histórico
 */
function salvarNoHistorico(listaJogos) {
    const historico = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORICO) || '[]');
    const novoItem = {
        data: new Date().toISOString(),
        jogos: listaJogos,
        modo: obterModoGeracao()
    };
    historico.unshift(novoItem);
    // Mantém apenas os últimos 50 registros
    if (historico.length > 50) {
        historico.splice(50);
    }
    localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify(historico));
}

/**
 * Copia números para área de transferência
 */
async function copiarNumeros(numeros) {
    const texto = numeros.join(', ');
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    } catch (err) {
        // Fallback para navegadores antigos
        const textArea = document.createElement('textarea');
        textArea.value = texto;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch (e) {
            document.body.removeChild(textArea);
            return false;
        }
    }
}

/**
 * Exibe os jogos gerados na interface
 */
function exibirJogos(listaJogos) {
    jogosGerados.innerHTML = '';
    
    // Salva no histórico
    salvarNoHistorico(listaJogos);
    
    listaJogos.forEach((jogo, index) => {
        const jogoSection = document.createElement('div');
        jogoSection.className = 'jogo-section';
        
        const jogoHeader = document.createElement('div');
        jogoHeader.className = 'resultado-header';
        const jogoTitle = document.createElement('h2');
        jogoTitle.className = 'resultado-title';
        jogoTitle.textContent = `Jogo ${index + 1}`;
        
        const btnCopiar = document.createElement('button');
        btnCopiar.className = 'btn-copiar-jogo';
        btnCopiar.innerHTML = '<span>📋</span> Copiar';
        btnCopiar.title = 'Copiar números para área de transferência';
        btnCopiar.addEventListener('click', async () => {
            const sucesso = await copiarNumeros(jogo);
            if (sucesso) {
                btnCopiar.innerHTML = '<span>✓</span> Copiado!';
                btnCopiar.classList.add('copiado');
                setTimeout(() => {
                    btnCopiar.innerHTML = '<span>📋</span> Copiar';
                    btnCopiar.classList.remove('copiado');
                }, 2000);
            }
        });
        
        jogoHeader.appendChild(jogoTitle);
        jogoHeader.appendChild(btnCopiar);
        jogoSection.appendChild(jogoHeader);
        
        const numerosGrid = document.createElement('div');
        numerosGrid.className = 'numeros-grid';
        
        jogo.forEach((numero) => {
            const numeroBola = document.createElement('div');
            numeroBola.className = 'numero-bola';
            numeroBola.textContent = numero;
            numerosGrid.appendChild(numeroBola);
        });
        
        jogoSection.appendChild(numerosGrid);
        jogosGerados.appendChild(jogoSection);
    });

    resultadoContainer.classList.remove('hidden');
    
    // Scroll suave para o resultado
    resultadoContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Calcula estatísticas dos últimos 3 sorteios
 */
function calcularEstatisticas(tresSorteios) {
    // Conta a frequência de cada número (1..25) nos três sorteios
    const frequencias = new Array(26).fill(0); // índice 0 não usado
    
    for (const sorteio of tresSorteios) {
        for (const num of sorteio) {
            if (num >= 1 && num <= 25) {
                frequencias[num]++;
            }
        }
    }

    // Cria lista de números com suas frequências
    const numerosComFrequencia = [];
    for (let i = 1; i <= 25; i++) {
        numerosComFrequencia.push({
            numero: i,
            frequencia: frequencias[i]
        });
    }

    // Ordena por frequência (maior para menor)
    const maisSorteados = [...numerosComFrequencia]
        .sort((a, b) => b.frequencia - a.frequencia)
        .slice(0, 10); // Top 10

    // Ordena por frequência (menor para maior)
    const menosSorteados = [...numerosComFrequencia]
        .sort((a, b) => a.frequencia - b.frequencia)
        .slice(0, 10); // Bottom 10

    // Análises avançadas
    const distribuicaoDezenas = {
        '1-5': 0, '6-10': 0, '11-15': 0, '16-20': 0, '21-25': 0
    };
    
    let pares = 0;
    let impares = 0;
    const sequencias = [];

    for (const sorteio of tresSorteios) {
        const sorted = [...sorteio].sort((a, b) => a - b);
        
        // Distribuição por dezenas
        for (const num of sorted) {
            if (num <= 5) distribuicaoDezenas['1-5']++;
            else if (num <= 10) distribuicaoDezenas['6-10']++;
            else if (num <= 15) distribuicaoDezenas['11-15']++;
            else if (num <= 20) distribuicaoDezenas['16-20']++;
            else distribuicaoDezenas['21-25']++;
            
            // Pares vs ímpares
            if (num % 2 === 0) pares++;
            else impares++;
        }

        // Detecta sequências consecutivas
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
        frequencias,
        distribuicaoDezenas,
        pares: (pares / 3).toFixed(1),
        impares: (impares / 3).toFixed(1),
        mediaSequencias,
        totalSequencias: sequencias.length
    };
}

/**
 * Exibe gráfico de frequência
 */
function exibirGraficoFrequencia(frequencias) {
    const container = document.getElementById('graficoFrequencia');
    if (!container) return;
    
    container.innerHTML = '';
    const maxFreq = Math.max(...frequencias.slice(1));
    
    for (let i = 1; i <= 25; i++) {
        const barContainer = document.createElement('div');
        barContainer.className = 'bar-container';
        
        const label = document.createElement('div');
        label.className = 'bar-label';
        label.textContent = i;
        
        const barWrapper = document.createElement('div');
        barWrapper.className = 'bar-wrapper';
        
        const bar = document.createElement('div');
        bar.className = 'bar';
        const altura = maxFreq > 0 ? (frequencias[i] / maxFreq) * 100 : 0;
        bar.style.height = `${altura}%`;
        bar.setAttribute('data-freq', frequencias[i]);
        
        const freqLabel = document.createElement('div');
        freqLabel.className = 'bar-freq';
        freqLabel.textContent = frequencias[i];
        
        barWrapper.appendChild(bar);
        barWrapper.appendChild(freqLabel);
        barContainer.appendChild(label);
        barContainer.appendChild(barWrapper);
        container.appendChild(barContainer);
    }
}

/**
 * Exibe análises avançadas
 */
function exibirAnalisesAvancadas(dados) {
    // Distribuição por dezenas
    const distContainer = document.getElementById('distribuicaoDezenas');
    if (distContainer) {
        distContainer.innerHTML = Object.entries(dados.distribuicaoDezenas)
            .map(([range, count]) => 
                `<div class="dist-item"><strong>${range}:</strong> ${(count / 3).toFixed(1)} por sorteio</div>`
            ).join('');
    }

    // Pares vs Ímpares
    const paresContainer = document.getElementById('paresImpares');
    if (paresContainer) {
        paresContainer.innerHTML = `
            <div class="par-impar-item"><strong>Pares:</strong> ${dados.pares} por sorteio</div>
            <div class="par-impar-item"><strong>Ímpares:</strong> ${dados.impares} por sorteio</div>
        `;
    }

    // Sequências consecutivas
    const seqContainer = document.getElementById('sequenciasConsecutivas');
    if (seqContainer) {
        seqContainer.innerHTML = `
            <div class="seq-item"><strong>Total de sequências:</strong> ${dados.totalSequencias}</div>
            <div class="seq-item"><strong>Média de tamanho:</strong> ${dados.mediaSequencias}</div>
        `;
    }
}

/**
 * Exibe as estatísticas na interface
 */
function exibirEstatisticas(tresSorteios) {
    const dados = calcularEstatisticas(tresSorteios);
    const { maisSorteados, menosSorteados } = dados;

    // Limpa conteúdo anterior
    maisSorteadosDiv.innerHTML = '';
    menosSorteadosDiv.innerHTML = '';

    // Cria tabela de mais sorteados
    maisSorteados.forEach((item, index) => {
        const linha = document.createElement('div');
        linha.className = 'estatistica-linha';
        
        const posicao = document.createElement('span');
        posicao.className = 'estatistica-posicao';
        posicao.textContent = `${index + 1}º`;
        
        const numero = document.createElement('span');
        numero.className = 'estatistica-numero';
        numero.textContent = item.numero.toString().padStart(2, '0');
        
        const frequencia = document.createElement('span');
        frequencia.className = 'estatistica-frequencia';
        frequencia.textContent = `${item.frequencia}x`;
        
        linha.appendChild(posicao);
        linha.appendChild(numero);
        linha.appendChild(frequencia);
        maisSorteadosDiv.appendChild(linha);
    });

    // Cria tabela de menos sorteados
    menosSorteados.forEach((item, index) => {
        const linha = document.createElement('div');
        linha.className = 'estatistica-linha';
        
        const posicao = document.createElement('span');
        posicao.className = 'estatistica-posicao';
        posicao.textContent = `${index + 1}º`;
        
        const numero = document.createElement('span');
        numero.className = 'estatistica-numero';
        numero.textContent = item.numero.toString().padStart(2, '0');
        
        const frequencia = document.createElement('span');
        frequencia.className = 'estatistica-frequencia';
        frequencia.textContent = `${item.frequencia}x`;
        
        linha.appendChild(posicao);
        linha.appendChild(numero);
        linha.appendChild(frequencia);
        menosSorteadosDiv.appendChild(linha);
    });

    // Exibe gráfico de frequência
    exibirGraficoFrequencia(dados.frequencias);
    
    // Exibe análises avançadas
    exibirAnalisesAvancadas(dados);

    estatisticasContainer.classList.remove('hidden');
}


/**
 * Verifica se já passou 24 horas desde a primeira geração
 */
function passou24Horas(timestamp) {
    const agora = Date.now();
    const diferenca = agora - timestamp;
    const vinteQuatroHoras = 24 * 60 * 60 * 1000; // 24 horas em milissegundos
    return diferenca >= vinteQuatroHoras;
}

/**
 * Obtém o contador de gerações do dia
 */
function obterContadorGerações() {
    const timestamp = localStorage.getItem(STORAGE_KEY_TIMESTAMP);
    const contador = localStorage.getItem(STORAGE_KEY_CONTADOR);

    // Se não existe timestamp ou passou 24 horas, reseta
    if (!timestamp || passou24Horas(parseInt(timestamp, 10))) {
        return { contador: 0, timestamp: null };
    }

    return {
        contador: parseInt(contador || '0', 10),
        timestamp: parseInt(timestamp, 10)
    };
}

/**
 * Incrementa o contador de gerações
 */
function incrementarContador() {
    const agora = Date.now();
    const dados = obterContadorGerações();

    let novoContador;
    let novoTimestamp;

    if (dados.timestamp === null || passou24Horas(dados.timestamp)) {
        // Primeira geração do dia ou passou 24 horas
        novoContador = 1;
        novoTimestamp = agora;
    } else {
        // Incrementa contador existente
        novoContador = dados.contador + 1;
        novoTimestamp = dados.timestamp;
    }

    localStorage.setItem(STORAGE_KEY_CONTADOR, novoContador.toString());
    localStorage.setItem(STORAGE_KEY_TIMESTAMP, novoTimestamp.toString());

    return { contador: novoContador, timestamp: novoTimestamp };
}

/**
 * Verifica se o usuário pode gerar jogos
 */
function podeGerar() {
    const dados = obterContadorGerações();
    return dados.contador < MAX_GERACOES_POR_DIA;
}

/**
 * Calcula o tempo restante até liberar novamente (em horas e minutos)
 */
function calcularTempoRestante() {
    const dados = obterContadorGerações();
    
    if (dados.timestamp === null || passou24Horas(dados.timestamp)) {
        return null; // Já pode usar
    }

    const agora = Date.now();
    const diferenca = dados.timestamp - agora + (24 * 60 * 60 * 1000); // Tempo restante
    const horas = Math.floor(diferenca / (1000 * 60 * 60));
    const minutos = Math.floor((diferenca % (1000 * 60 * 60)) / (1000 * 60));

    return { horas, minutos };
}

/**
 * Atualiza a exibição do limite de gerações
 */
function atualizarExibicaoLimite() {
    if (!limiteContainer) return;

    const dados = obterContadorGerações();
    const restantes = MAX_GERACOES_POR_DIA - dados.contador;

    if (dados.contador === 0) {
        limiteContainer.classList.add('hidden');
        return;
    }

    limiteContainer.classList.remove('hidden');
    const contadorSpan = limiteContainer.querySelector('.limite-contador');
    const tempoSpan = limiteContainer.querySelector('.limite-tempo');

    if (contadorSpan) {
        contadorSpan.textContent = `${dados.contador} de ${MAX_GERACOES_POR_DIA}`;
    }

    if (restantes === 0) {
        // Bloqueado
        limiteContainer.className = 'limite-container limite-bloqueado';
        const tempoRestante = calcularTempoRestante();
        if (tempoRestante && tempoSpan) {
            tempoSpan.textContent = `Libera em: ${tempoRestante.horas}h ${tempoRestante.minutos}min`;
        }
        // Atualiza o botão - bloqueado
        btnGerar.disabled = true;
        btnGerar.classList.add('btn-bloqueado');
        btnGerar.querySelector('.btn-text').textContent = 'Limite Atingido';
    } else {
        // Ainda pode usar
        limiteContainer.className = 'limite-container limite-ativo';
        if (tempoSpan) {
            tempoSpan.textContent = '';
        }
        // Atualiza o botão - liberado
        btnGerar.disabled = false;
        btnGerar.classList.remove('btn-bloqueado');
        btnGerar.querySelector('.btn-text').textContent = 'Gerar Jogos';
    }
}

/**
 * Exibe mensagem de erro
 */
function exibirErro(mensagem) {
    errorMessage.textContent = mensagem;
    errorMessage.classList.remove('hidden');
    
    // Oculta o erro após 5 segundos
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 5000);
}

/**
 * Manipula o envio do formulário
 */
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Verifica se pode gerar
    if (!podeGerar()) {
        const tempoRestante = calcularTempoRestante();
        if (tempoRestante) {
            exibirErro(`Limite diário atingido! Você já gerou ${MAX_GERACOES_POR_DIA} jogos hoje. Tente novamente em ${tempoRestante.horas}h ${tempoRestante.minutos}min.`);
        } else {
            exibirErro(`Limite diário atingido! Você já gerou ${MAX_GERACOES_POR_DIA} jogos hoje.`);
        }
        return;
    }
    
    // Oculta mensagens anteriores
    errorMessage.classList.add('hidden');
    resultadoContainer.classList.add('hidden');
    estatisticasContainer.classList.add('hidden');
    
    // Desabilita o botão durante o processamento
    btnGerar.disabled = true;
    btnGerar.querySelector('.btn-text').textContent = 'Processando...';

    try {
        // Pequeno delay para melhorar UX
        setTimeout(() => {
            try {
                const tresSorteios = lerTresSorteios();
                const resultadoAtual = parseSorteio(
                    document.getElementById('resultadoAtual').value,
                    'Resultado do Jogo Atual'
                );
                
                // Obtém a quantidade de jogos a gerar
                const quantidadeJogos = parseInt(
                    document.getElementById('quantidadeJogos').value,
                    10
                );
                
                // Obtém modo de geração
                const modo = obterModoGeracao();
                
                // Gera múltiplos jogos
                const listaJogos = [];
                for (let i = 0; i < quantidadeJogos; i++) {
                    const jogo = realizarSorteioComBaseNosTresSorteios(
                        tresSorteios,
                        resultadoAtual,
                        modo
                    );
                    listaJogos.push(jogo);
                }
                
                // Incrementa contador após gerar com sucesso
                incrementarContador();
                
                exibirJogos(listaJogos);
                exibirEstatisticas(tresSorteios);
                
                // Atualiza exibição do limite após incrementar (isso já desabilita o botão se necessário)
                atualizarExibicaoLimite();
            } catch (error) {
                exibirErro(error.message);
                // Se deu erro, verifica se ainda pode gerar para reabilitar o botão
                if (podeGerar()) {
                    btnGerar.disabled = false;
                    btnGerar.querySelector('.btn-text').textContent = 'Gerar Jogos';
                    btnGerar.classList.remove('btn-bloqueado');
                } else {
                    // Se atingiu o limite, atualiza a exibição corretamente
                    atualizarExibicaoLimite();
                }
            }
        }, 300);
    } catch (error) {
        exibirErro(error.message);
        // Se deu erro, verifica se ainda pode gerar para reabilitar o botão
        if (podeGerar()) {
            btnGerar.disabled = false;
            btnGerar.querySelector('.btn-text').textContent = 'Gerar Jogos';
            btnGerar.classList.remove('btn-bloqueado');
        } else {
            // Se atingiu o limite, atualiza a exibição corretamente
            atualizarExibicaoLimite();
        }
    }
});

// ========== FUNÇÕES DE INICIALIZAÇÃO ==========

/**
 * Inicializa seletores numéricos para cada campo
 */
function inicializarSeletoresNumericos() {
    document.querySelectorAll('.seletor-numeros').forEach(container => {
        const targetId = container.dataset.target;
        const grid = document.createElement('div');
        grid.className = 'numeros-seletor-grid';
        
        for (let i = 1; i <= 25; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-numero-seletor';
            btn.textContent = i;
            btn.setAttribute('data-numero', i);
            btn.setAttribute('aria-label', `Selecionar número ${i}`);
            
            btn.addEventListener('click', () => {
                const input = document.getElementById(targetId);
                const valores = input.value.split(',').map(v => v.trim()).filter(v => v);
                
                if (valores.includes(i.toString())) {
                    // Remove se já existe
                    valores.splice(valores.indexOf(i.toString()), 1);
                } else {
                    // Adiciona se não existe e tem espaço
                    if (valores.length < 15) {
                        valores.push(i.toString());
                    }
                }
                
                input.value = valores.join(', ');
                input.dispatchEvent(new Event('input'));
                atualizarContador(targetId);
            });
            
            grid.appendChild(btn);
        }
        
        container.appendChild(grid);
    });
}

/**
 * Atualiza contador de números em um campo
 */
function atualizarContador(campoId) {
    const input = document.getElementById(campoId);
    if (!input) return;
    
    let contadorId;
    if (campoId === 'sorteio1') contadorId = 'contador1';
    else if (campoId === 'sorteio2') contadorId = 'contador2';
    else if (campoId === 'sorteio3') contadorId = 'contador3';
    else if (campoId === 'resultadoAtual') contadorId = 'contador4';
    else return;
    
    const contador = document.getElementById(contadorId);
    if (!contador) return;
    
    const valores = input.value.split(',').map(v => v.trim()).filter(v => v && !isNaN(v));
    const count = valores.length;
    contador.textContent = `${count}/15`;
    
    // Atualiza cores dos botões do seletor
    const seletor = input.parentElement.querySelector('.seletor-numeros');
    if (seletor) {
        seletor.querySelectorAll('.btn-numero-seletor').forEach(btn => {
            const num = parseInt(btn.dataset.numero);
            if (valores.includes(num.toString())) {
                btn.classList.add('selecionado');
            } else {
                btn.classList.remove('selecionado');
            }
            if (count >= 15 && !valores.includes(num.toString())) {
                btn.disabled = true;
            } else {
                btn.disabled = false;
            }
        });
    }
    
    // Atualiza cor do contador
    if (count === 15) {
        contador.classList.add('completo');
    } else {
        contador.classList.remove('completo');
    }
}

/**
 * Inicializa filtros de números (excluir/incluir)
 */
function inicializarFiltrosNumeros() {
    const containerExcluir = document.getElementById('numerosExcluir');
    const containerIncluir = document.getElementById('numerosIncluir');
    
    [containerExcluir, containerIncluir].forEach((container, index) => {
        if (!container) return;
        const isExcluir = index === 0;
        const numerosSet = isExcluir ? numerosExcluir : numerosIncluir;
        
        for (let i = 1; i <= 25; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `btn-numero-filtro ${numerosSet.has(i) ? 'ativo' : ''}`;
            btn.textContent = i;
            btn.setAttribute('data-numero', i);
            
            btn.addEventListener('click', () => {
                const outroSet = isExcluir ? numerosIncluir : numerosExcluir;
                const num = parseInt(btn.dataset.numero);
                
                // Remove do outro conjunto se estiver lá
                outroSet.delete(num);
                
                // Toggle no conjunto atual
                if (numerosSet.has(num)) {
                    numerosSet.delete(num);
                    btn.classList.remove('ativo');
                } else {
                    numerosSet.add(num);
                    btn.classList.add('ativo');
                }
                
                // Salva no localStorage
                localStorage.setItem(
                    isExcluir ? STORAGE_KEY_NUMEROS_EXCLUIR : STORAGE_KEY_NUMEROS_INCLUIR,
                    JSON.stringify(Array.from(numerosSet))
                );
            });
            
            container.appendChild(btn);
        }
    });
}

/**
 * Inicializa tema claro/escuro
 */
function inicializarTema() {
    const temaSalvo = localStorage.getItem(STORAGE_KEY_TEMA) || 'light';
    document.body.className = `theme-${temaSalvo}`;
    
    const toggleBtn = document.getElementById('toggleTheme');
    if (toggleBtn) {
        const icon = toggleBtn.querySelector('.theme-icon');
        icon.textContent = temaSalvo === 'light' ? '🌙' : '☀️';
        
        toggleBtn.addEventListener('click', () => {
            const temaAtual = document.body.classList.contains('theme-light') ? 'light' : 'dark';
            const novoTema = temaAtual === 'light' ? 'dark' : 'light';
            
            document.body.className = `theme-${novoTema}`;
            localStorage.setItem(STORAGE_KEY_TEMA, novoTema);
            icon.textContent = novoTema === 'light' ? '🌙' : '☀️';
        });
    }
}

/**
 * Inicializa histórico
 */
function exibirHistorico() {
    const historico = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORICO) || '[]');
    const container = document.getElementById('historicoLista');
    if (!container) return;
    
    if (historico.length === 0) {
        container.innerHTML = '<p class="historico-vazio">Nenhum jogo gerado ainda.</p>';
        return;
    }
    
    container.innerHTML = historico.map((item, index) => {
        const data = new Date(item.data);
        return `
            <div class="historico-item">
                <div class="historico-header">
                    <strong>${data.toLocaleString('pt-BR')}</strong>
                    <span class="historico-modo">Modo: ${item.modo}</span>
                </div>
                ${item.jogos.map((jogo, jIndex) => `
                    <div class="historico-jogo">
                        <span class="historico-jogo-title">Jogo ${jIndex + 1}:</span>
                        <div class="historico-numeros">
                            ${jogo.map(n => `<span class="historico-numero">${n}</span>`).join('')}
                        </div>
                        <button class="btn-copiar-historico" data-numeros="${jogo.join(',')}">📋 Copiar</button>
                    </div>
                `).join('')}
            </div>
        `;
    }).join('');
    
    // Event listeners para copiar
    container.querySelectorAll('.btn-copiar-historico').forEach(btn => {
        btn.addEventListener('click', async () => {
            const numeros = btn.dataset.numeros.split(',').map(n => n.trim());
            const sucesso = await copiarNumeros(numeros);
            if (sucesso) {
                btn.textContent = '✓ Copiado!';
                setTimeout(() => {
                    btn.textContent = '📋 Copiar';
                }, 2000);
            }
        });
    });
}

/**
 * Exporta jogos como PDF
 */
async function exportarPDF() {
    const elemento = document.getElementById('jogosGerados');
    if (!elemento) return;
    
    const opt = {
        margin: 1,
        filename: `loto-facil-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    if (typeof html2pdf !== 'undefined') {
        await html2pdf().set(opt).from(elemento).save();
    }
}

/**
 * Exporta jogos como imagem
 */
async function exportarImagem() {
    const elemento = document.getElementById('jogosGerados');
    if (!elemento) return;
    
    if (typeof html2canvas !== 'undefined') {
        const canvas = await html2canvas(elemento);
        const imgData = canvas.toDataURL('image/png');
        
        const link = document.createElement('a');
        link.download = `loto-facil-${new Date().toISOString().split('T')[0]}.png`;
        link.href = imgData;
        link.click();
    }
}

/**
 * Exibe dashboard de uso
 */
function exibirDashboard() {
    const dados = obterContadorGerações();
    const historico = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORICO) || '[]');
    const tempoRestante = calcularTempoRestante();
    
    const container = document.getElementById('dashboardContent');
    if (!container) return;
    
    const totalJogosGerados = historico.reduce((sum, item) => sum + item.jogos.length, 0);
    const restantes = MAX_GERACOES_POR_DIA - dados.contador;
    
    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="dashboard-card">
                <h3>📊 Uso Hoje</h3>
                <div class="dashboard-value">${dados.contador} / ${MAX_GERACOES_POR_DIA}</div>
                <div class="dashboard-progress">
                    <div class="dashboard-progress-bar" style="width: ${(dados.contador / MAX_GERACOES_POR_DIA) * 100}%"></div>
                </div>
                ${restantes === 0 && tempoRestante ? 
                    `<p class="dashboard-info">⏱️ Libera em: ${tempoRestante.horas}h ${tempoRestante.minutos}min</p>` :
                    `<p class="dashboard-info">✅ ${restantes} gerações restantes hoje</p>`
                }
            </div>
            
            <div class="dashboard-card">
                <h3>📋 Total de Jogos</h3>
                <div class="dashboard-value">${totalJogosGerados}</div>
                <p class="dashboard-info">Jogos gerados no histórico</p>
            </div>
            
            <div class="dashboard-card">
                <h3>📅 Histórico</h3>
                <div class="dashboard-value">${historico.length}</div>
                <p class="dashboard-info">Registros salvos</p>
            </div>
        </div>
    `;
}

// Inicializa a exibição do limite ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    // Inicializações básicas
    atualizarExibicaoLimite();
    inicializarTema();
    inicializarSeletoresNumericos();
    inicializarFiltrosNumeros();
    
    // Atualiza contadores dos campos existentes
    ['sorteio1', 'sorteio2', 'sorteio3', 'resultadoAtual'].forEach(campoId => {
        const input = document.getElementById(campoId);
        if (input) {
            input.addEventListener('input', () => atualizarContador(campoId));
            atualizarContador(campoId);
        }
    });
    
    // Botões de limpar campo
    document.querySelectorAll('.btn-limpar-campo').forEach(btn => {
        btn.addEventListener('click', () => {
            const campoId = btn.dataset.campo;
            const input = document.getElementById(campoId);
            if (input) {
                input.value = '';
                atualizarContador(campoId);
            }
        });
    });
    
    // Toggle opções avançadas
    const toggleAvancado = document.getElementById('toggleAvancado');
    const opcoesAvancadas = document.getElementById('opcoesAvancadas');
    if (toggleAvancado && opcoesAvancadas) {
        toggleAvancado.addEventListener('click', () => {
            const isHidden = opcoesAvancadas.classList.contains('hidden');
            opcoesAvancadas.classList.toggle('hidden', !isHidden);
            toggleAvancado.querySelector('span:first-child').textContent = isHidden ? 'Ocultar' : 'Mostrar';
            toggleAvancado.setAttribute('aria-expanded', isHidden);
        });
    }
    
    // Limpar filtros
    const btnLimparFiltros = document.getElementById('limparFiltros');
    if (btnLimparFiltros) {
        btnLimparFiltros.addEventListener('click', () => {
            numerosExcluir.clear();
            numerosIncluir.clear();
            localStorage.removeItem(STORAGE_KEY_NUMEROS_EXCLUIR);
            localStorage.removeItem(STORAGE_KEY_NUMEROS_INCLUIR);
            inicializarFiltrosNumeros();
        });
    }
    
    // Exportar PDF
    const btnExportarPDF = document.getElementById('exportarPDF');
    if (btnExportarPDF) {
        btnExportarPDF.addEventListener('click', exportarPDF);
    }
    
    // Exportar Imagem
    const btnExportarImagem = document.getElementById('exportarImagem');
    if (btnExportarImagem) {
        btnExportarImagem.addEventListener('click', exportarImagem);
    }
    
    // Histórico
    const btnVerHistorico = document.getElementById('verHistorico');
    const historicoModal = document.getElementById('historicoModal');
    const fecharHistorico = document.getElementById('fecharHistorico');
    if (btnVerHistorico && historicoModal) {
        btnVerHistorico.addEventListener('click', () => {
            exibirHistorico();
            historicoModal.classList.remove('hidden');
            historicoModal.setAttribute('aria-hidden', 'false');
        });
        if (fecharHistorico) {
            fecharHistorico.addEventListener('click', () => {
                historicoModal.classList.add('hidden');
                historicoModal.setAttribute('aria-hidden', 'true');
            });
        }
    }
    
    // Dashboard
    const btnDashboard = document.getElementById('btnDashboard');
    const dashboardModal = document.getElementById('dashboardModal');
    const fecharDashboard = document.getElementById('fecharDashboard');
    if (btnDashboard && dashboardModal) {
        btnDashboard.addEventListener('click', () => {
            exibirDashboard();
            dashboardModal.classList.remove('hidden');
            dashboardModal.setAttribute('aria-hidden', 'false');
        });
        if (fecharDashboard) {
            fecharDashboard.addEventListener('click', () => {
                dashboardModal.classList.add('hidden');
                dashboardModal.setAttribute('aria-hidden', 'true');
            });
        }
    }
    
    // Limpar histórico
    const btnLimparHistorico = document.getElementById('limparHistorico');
    if (btnLimparHistorico) {
        btnLimparHistorico.addEventListener('click', () => {
            if (confirm('Tem certeza que deseja limpar todo o histórico?')) {
                localStorage.removeItem(STORAGE_KEY_HISTORICO);
                exibirHistorico();
            }
        });
    }
    
    // Limpar todos os dados
    const btnLimparDados = document.getElementById('btnLimparDados');
    if (btnLimparDados) {
        btnLimparDados.addEventListener('click', () => {
            if (confirm('Tem certeza que deseja limpar TODOS os dados? Isso inclui histórico, filtros e configurações.')) {
                localStorage.clear();
                location.reload();
            }
        });
    }
    
    // Atalhos de teclado
    document.addEventListener('keydown', (e) => {
        // Enter para gerar (se não estiver em textarea)
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.target.closest('.modal')) {
            e.preventDefault();
            if (podeGerar() && !btnGerar.disabled) {
                form.dispatchEvent(new Event('submit'));
            }
        }
        // ESC para fechar modais
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                if (!modal.classList.contains('hidden')) {
                    modal.classList.add('hidden');
                    modal.setAttribute('aria-hidden', 'true');
                }
            });
        }
    });
    
    // Atualiza o tempo restante a cada minuto se estiver bloqueado
    setInterval(() => {
        atualizarExibicaoLimite();
    }, 60000); // Atualiza a cada 1 minuto
});

// Adiciona validação visual em tempo real nos inputs (mantido para compatibilidade, mas atualizarContador já faz isso)

