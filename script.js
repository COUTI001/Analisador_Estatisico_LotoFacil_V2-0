/**
 * Desenvolvido por: André Luiz Coutinho (COUTIINOVATION)
 * Frontend simplificado - Apenas chamadas à API
 */

// Detecta automaticamente a URL base da API
// Se estiver rodando em localhost:3000, usa relativo (mesma origem)
// Caso contrário (Live Server, etc), usa http://localhost:3000
let API_BASE = '';
const currentPort = window.location.port;
const currentHost = window.location.hostname;

// Se não está na porta 3000 e está em localhost/127.0.0.1, usa URL absoluta
if (currentPort !== '3000' && (currentHost === 'localhost' || currentHost === '127.0.0.1')) {
    API_BASE = 'http://localhost:3000';
    console.log(`[API] Detectado servidor diferente (porta ${currentPort}), usando API_BASE: ${API_BASE}`);
} else if (currentPort === '3000') {
    console.log('[API] Servidor na mesma origem (porta 3000), usando API_BASE relativo');
} else {
    // Para outros casos (produção, etc), tenta detectar
    console.log(`[API] Host: ${currentHost}:${currentPort}, usando API_BASE relativo`);
}

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

// Estado local (apenas para UI)
let numerosExcluir = new Set();
let numerosIncluir = new Set();

// Função para exibir erro
function exibirErro(mensagem) {
    if (!errorMessage) {
        console.error('Elemento errorMessage não encontrado! Mensagem:', mensagem);
        alert('ERRO: ' + mensagem); // Fallback para alert
        return;
    }
    
    console.error('[ERRO EXIBIDO]', mensagem);
    errorMessage.textContent = mensagem;
    errorMessage.classList.remove('hidden');
    
    // Scroll para a mensagem de erro
    errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Remove a mensagem após 10 segundos (aumentado para dar tempo de ler)
    setTimeout(() => {
        if (errorMessage) {
            errorMessage.classList.add('hidden');
        }
    }, 10000);
}

// Função para fazer requisições à API
async function apiRequest(endpoint, method = 'GET', data = null) {
    const url = API_BASE + endpoint;
    console.log(`[API Request] ${method} ${url}`, data);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos de timeout
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Importante para cookies
            signal: controller.signal
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        console.log(`[API Request] Enviando requisição para: ${url}`);
        const response = await fetch(url, options);
        clearTimeout(timeoutId);
        
        console.log(`[API Response] Status: ${response.status} ${response.statusText}`);
        console.log(`[API Response] Headers:`, Object.fromEntries(response.headers.entries()));
        
        // Verifica se a resposta é JSON
        let result;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            result = await response.json();
            console.log(`[API Response] JSON recebido:`, result);
        } else {
            const text = await response.text();
            console.error(`[API Response] Resposta não é JSON:`, text.substring(0, 200));
            throw new Error(`Resposta inválida do servidor: ${text.substring(0, 100)}`);
        }
        
        if (!response.ok) {
            console.error(`[API Error] Status ${response.status}:`, result);
            throw new Error(result.mensagem || result.erro || `Erro na requisição: ${response.status} ${response.statusText}`);
        }
        
        console.log(`[API Success] Requisição bem-sucedida`);
        return result;
    } catch (error) {
        console.error(`[API Error] Erro na requisição ${method} ${endpoint}:`, error);
        if (error.name === 'AbortError') {
            throw new Error('Tempo de espera esgotado. O servidor está demorando muito para responder.');
        }
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error('Erro de conexão com o servidor. Verifique se o servidor está rodando em http://localhost:3000');
        }
        throw error;
    }
}

// Função para verificar status inicial
async function verificarStatus() {
    try {
        const status = await apiRequest('/api/status');
        
        if (!status.sucesso) {
            if (status.erro === 'MODO_ANONIMO') {
                bloquearAplicacao();
                exibirErro(status.mensagem);
                return false;
            }
            // Se houver outro erro, ainda tenta atualizar com dados padrão
            atualizarExibicaoLimite({
                contador: 0,
                maxGeracoes: 3,
                codigoAtivo: false
            });
            return true;
        }
        
        atualizarExibicaoLimite(status);
        return true;
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        // Em caso de erro de conexão, habilita o botão por padrão
        // (o usuário pode tentar gerar e verá o erro específico)
        atualizarExibicaoLimite({
            contador: 0,
            maxGeracoes: 3,
            codigoAtivo: false
        });
        return true; // Retorna true para não bloquear a aplicação completamente
    }
}

// Função para bloquear aplicação (modo anônimo detectado)
function bloquearAplicacao() {
    if (btnGerar) {
        btnGerar.disabled = true;
        btnGerar.classList.add('btn-bloqueado');
        const btnText = btnGerar.querySelector('.btn-text');
        if (btnText) {
            btnText.textContent = 'Janela Anônima Não Suportada';
        }
    }
    
    const inputs = document.querySelectorAll('#sorteioForm input, #sorteioForm select, #sorteioForm button');
    inputs.forEach(input => {
        if (input.id !== 'btnGerar') {
            input.disabled = true;
        }
    });
    
    const codigoContainer = document.getElementById('codigoAtivacaoContainer');
    if (codigoContainer) {
        codigoContainer.style.display = 'none';
    }
}

// Função para atualizar exibição do limite
function atualizarExibicaoLimite(status) {
    if (!limiteContainer || !status) {
        // Se não há status, habilita o botão por padrão
        if (btnGerar) {
            btnGerar.disabled = false;
            btnGerar.classList.remove('btn-bloqueado');
            const btnText = btnGerar.querySelector('.btn-text');
            if (btnText) {
                btnText.textContent = 'Gerar Jogos';
            }
        }
        return;
    }
    
    // Verifica se pode gerar (nova propriedade do status)
    const podeGerar = status.podeGerar !== undefined ? status.podeGerar : (status.contador < status.maxGeracoes);
    
    if (status.codigoAtivo) {
        limiteContainer.classList.add('hidden');
        btnGerar.disabled = false;
        btnGerar.classList.remove('btn-bloqueado');
        const btnText = btnGerar.querySelector('.btn-text');
        if (btnText) {
            btnText.textContent = 'Gerar Jogos';
        }
        return;
    }
    
    if (status.contador === 0) {
        limiteContainer.classList.add('hidden');
        // Habilita o botão quando contador é 0 (ainda pode gerar)
        btnGerar.disabled = false;
        btnGerar.classList.remove('btn-bloqueado');
        const btnText = btnGerar.querySelector('.btn-text');
        if (btnText) {
            btnText.textContent = 'Gerar Jogos';
        }
        return;
    }
    
    limiteContainer.classList.remove('hidden');
    const contadorSpan = limiteContainer.querySelector('.limite-contador');
    if (contadorSpan) {
        contadorSpan.textContent = `${status.contador} de ${status.maxGeracoes}`;
    }
    
    const restantes = status.maxGeracoes - status.contador;
    
    // Usa a propriedade podeGerar se disponível, senão calcula
    if (!podeGerar || restantes === 0) {
        limiteContainer.className = 'limite-container limite-bloqueado';
        btnGerar.disabled = true;
        btnGerar.classList.add('btn-bloqueado');
        const btnText = btnGerar.querySelector('.btn-text');
        if (btnText) {
            btnText.textContent = 'Limite Atingido';
        }
        
        // Adiciona informação de tempo restante se disponível
        if (status.tempoRestante) {
            const horasRestantes = Math.ceil(status.tempoRestante / (60 * 60 * 1000));
            const tempoSpan = limiteContainer.querySelector('.limite-tempo');
            if (tempoSpan) {
                tempoSpan.textContent = `Liberado em ${horasRestantes} hora(s)`;
            }
        }
    } else {
        limiteContainer.className = 'limite-container limite-ativo';
        btnGerar.disabled = false;
        btnGerar.classList.remove('btn-bloqueado');
        const btnText = btnGerar.querySelector('.btn-text');
        if (btnText) {
            btnText.textContent = 'Gerar Jogos';
        }
        
        const tempoSpan = limiteContainer.querySelector('.limite-tempo');
        if (tempoSpan) {
            tempoSpan.textContent = `${restantes} geração(ões) restante(s)`;
        }
    }
}

// Função para parse de sorteio
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

// Função para exibir jogos
function exibirJogos(listaJogos) {
    jogosGerados.innerHTML = '';
    
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
            const texto = jogo.join(', ');
            try {
                await navigator.clipboard.writeText(texto);
                btnCopiar.innerHTML = '<span>✓</span> Copiado!';
                btnCopiar.classList.add('copiado');
                setTimeout(() => {
                    btnCopiar.innerHTML = '<span>📋</span> Copiar';
                    btnCopiar.classList.remove('copiado');
                }, 2000);
            } catch (err) {
                console.error('Erro ao copiar:', err);
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
    resultadoContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Função para exibir estatísticas
function exibirEstatisticas(estatisticas) {
    const { maisSorteados, menosSorteados, frequencias, distribuicaoDezenas, pares, impares, mediaSequencias, totalSequencias } = estatisticas;
    
    maisSorteadosDiv.innerHTML = '';
    menosSorteadosDiv.innerHTML = '';
    
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
    
    // Gráfico de frequência
    const container = document.getElementById('graficoFrequencia');
    if (container) {
        container.innerHTML = '';
        const maxFreq = Math.max(...frequencias);
        
        for (let i = 0; i < 25; i++) {
            const barContainer = document.createElement('div');
            barContainer.className = 'bar-container';
            
            const label = document.createElement('div');
            label.className = 'bar-label';
            label.textContent = i + 1;
            
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
    
    // Análises avançadas
    const distContainer = document.getElementById('distribuicaoDezenas');
    if (distContainer) {
        distContainer.innerHTML = Object.entries(distribuicaoDezenas)
            .map(([range, count]) => 
                `<div class="dist-item"><strong>${range}:</strong> ${(count / 3).toFixed(1)} por sorteio</div>`
            ).join('');
    }
    
    const paresContainer = document.getElementById('paresImpares');
    if (paresContainer) {
        paresContainer.innerHTML = `
            <div class="par-impar-item"><strong>Pares:</strong> ${pares} por sorteio</div>
            <div class="par-impar-item"><strong>Ímpares:</strong> ${impares} por sorteio</div>
        `;
    }
    
    const seqContainer = document.getElementById('sequenciasConsecutivas');
    if (seqContainer) {
        seqContainer.innerHTML = `
            <div class="seq-item"><strong>Total de sequências:</strong> ${totalSequencias}</div>
            <div class="seq-item"><strong>Média de tamanho:</strong> ${mediaSequencias}</div>
        `;
    }
    
    estatisticasContainer.classList.remove('hidden');
}

// Manipula envio do formulário
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Verifica se o botão está desabilitado (não deve processar se estiver)
    if (btnGerar.disabled) {
        console.warn('Tentativa de envio com botão desabilitado');
        return;
    }
    
    errorMessage.classList.add('hidden');
    resultadoContainer.classList.add('hidden');
    estatisticasContainer.classList.add('hidden');
    
    const btnText = btnGerar.querySelector('.btn-text');
    btnGerar.disabled = true;
    if (btnText) {
        btnText.textContent = 'Processando...';
    }
    
    try {
        console.log('=== INICIANDO GERAÇÃO DE JOGOS ===');
        
        // Valida e parseia os sorteios
        let sorteio1, sorteio2, sorteio3, resultadoAtual;
        try {
            const campo1 = document.getElementById('sorteio1');
            const campo2 = document.getElementById('sorteio2');
            const campo3 = document.getElementById('sorteio3');
            const campo4 = document.getElementById('resultadoAtual');
            
            if (!campo1 || !campo2 || !campo3 || !campo4) {
                throw new Error('Campos do formulário não encontrados. Recarregue a página.');
            }
            
            console.log('Validando campos...');
            sorteio1 = parseSorteio(campo1.value, 'Sorteio 1');
            sorteio2 = parseSorteio(campo2.value, 'Sorteio 2');
            sorteio3 = parseSorteio(campo3.value, 'Sorteio 3');
            resultadoAtual = parseSorteio(campo4.value, 'Resultado do Jogo Atual');
            
            console.log('✓ Campos validados:', {
                sorteio1: sorteio1.length,
                sorteio2: sorteio2.length,
                sorteio3: sorteio3.length,
                resultadoAtual: resultadoAtual.length
            });
        } catch (parseError) {
            console.error('Erro ao validar campos:', parseError);
            exibirErro(parseError.message || 'Erro ao validar os campos. Verifique se todos os campos estão preenchidos corretamente com 15 números cada.');
            throw parseError;
        }
        
        const modoGeracao = document.getElementById('modoGeracao')?.value || 'balanceado';
        const quantidadeJogos = parseInt(document.getElementById('quantidadeJogos')?.value || '1', 10);
        
        const dadosEnviar = {
            sorteio1,
            sorteio2,
            sorteio3,
            resultadoAtual,
            modoGeracao,
            quantidadeJogos,
            numerosExcluir: Array.from(numerosExcluir),
            numerosIncluir: Array.from(numerosIncluir)
        };
        
        console.log('Enviando requisição para /api/gerar...');
        console.log('Dados:', {
            ...dadosEnviar,
            sorteio1: `[${sorteio1.length} números]`,
            sorteio2: `[${sorteio2.length} números]`,
            sorteio3: `[${sorteio3.length} números]`,
            resultadoAtual: `[${resultadoAtual.length} números]`
        });
        
        const resultado = await apiRequest('/api/gerar', 'POST', dadosEnviar);
        
        console.log('✓ Resposta recebida:', resultado);
        
        if (resultado && resultado.sucesso) {
            console.log('✓ Jogos gerados com sucesso:', resultado.jogos?.length || 0, 'jogo(s)');
            if (resultado.jogos && resultado.jogos.length > 0) {
                exibirJogos(resultado.jogos);
                if (resultado.estatisticas) {
                    exibirEstatisticas(resultado.estatisticas);
                }
                atualizarExibicaoLimite({
                    contador: resultado.contador || 0,
                    maxGeracoes: resultado.maxGeracoes || 3,
                    codigoAtivo: resultado.codigoAtivo || false
                });
            } else {
                throw new Error('Nenhum jogo foi gerado. Tente novamente.');
            }
        } else {
            const mensagemErro = resultado?.mensagem || resultado?.erro || 'Erro desconhecido ao gerar jogos';
            console.error('✗ Resposta sem sucesso:', resultado);
            
            // Trata erros específicos de bloqueio
            if (resultado?.erro === 'LIMITE_ATINGIDO') {
                exibirErro(mensagemErro);
                // Atualiza a exibição do limite com os dados do erro
                atualizarExibicaoLimite({
                    contador: resultado.contador || 0,
                    maxGeracoes: resultado.maxGeracoes || 3,
                    codigoAtivo: false,
                    tempoRestante: resultado.tempoRestante || 0,
                    podeGerar: false
                });
            } else if (resultado?.erro === 'MODO_ANONIMO') {
                exibirErro(mensagemErro);
                bloquearAplicacao();
            } else {
                exibirErro(mensagemErro);
            }
        }
    } catch (error) {
        console.error('✗ ERRO AO GERAR JOGOS:', error);
        console.error('Tipo do erro:', error.constructor.name);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        
        let mensagemErro = 'Erro desconhecido ao gerar jogos';
        
        if (error.message) {
            mensagemErro = error.message;
        } else if (error.toString && error.toString() !== '[object Object]') {
            mensagemErro = error.toString();
        }
        
        // Trata erros específicos
        if (mensagemErro.includes('MODO_ANONIMO')) {
            bloquearAplicacao();
        } else if (mensagemErro.includes('fetch') || mensagemErro.includes('conexão') || mensagemErro.includes('conexao')) {
            mensagemErro = 'Erro de conexão com o servidor. Verifique se o servidor está rodando em http://localhost:3000. Execute "npm start" no terminal.';
        } else if (mensagemErro.includes('Tempo de espera')) {
            mensagemErro = 'O servidor está demorando muito para responder. Tente novamente.';
        }
        
        exibirErro(mensagemErro);
    } finally {
        // Sempre restaura o botão e verifica o status
        try {
            await verificarStatus();
        } catch (error) {
            console.error('Erro ao verificar status no finally:', error);
            // Em caso de erro, pelo menos restaura o botão
            if (btnText && btnText.textContent === 'Processando...') {
                btnText.textContent = 'Gerar Jogos';
            }
            btnGerar.disabled = false;
            btnGerar.classList.remove('btn-bloqueado');
        }
    }
});

// Função para atualizar contadores (deve estar antes de inicializarTecladosNumericos)
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
    
    const valores = input.value.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v) && v >= 1 && v <= 25);
    const count = valores.length;
    contador.textContent = `${count}/15`;
    
    const seletor = input.parentElement.querySelector('.seletor-numeros');
    if (seletor) {
        seletor.querySelectorAll('.btn-numero-seletor').forEach(btn => {
            const num = parseInt(btn.dataset.numero, 10);
            const isSelecionado = valores.includes(num);
            
            if (isSelecionado) {
                btn.classList.add('selecionado');
            } else {
                btn.classList.remove('selecionado');
            }
            
            if (count >= 15 && !isSelecionado) {
                btn.disabled = true;
            } else {
                btn.disabled = false;
            }
        });
    }
    
    if (count === 15) {
        contador.classList.add('completo');
    } else {
        contador.classList.remove('completo');
    }
}

// Inicialização dos teclados numéricos (função independente)
function inicializarTecladosNumericos() {
    document.querySelectorAll('.seletor-numeros').forEach(container => {
        // Limpa o container primeiro para evitar duplicatas
        container.innerHTML = '';
        
        const targetId = container.dataset.target;
        if (!targetId) return;
        
        // Cria título do teclado numérico
        const titulo = document.createElement('div');
        titulo.className = 'teclado-numerico-titulo';
        titulo.innerHTML = '<span>🔢 Clique nos números para selecionar</span>';
        container.appendChild(titulo);
        
        // Cria grid do teclado numérico
        const grid = document.createElement('div');
        grid.className = 'numeros-seletor-grid';
        
        // Cria 25 botões (números de 1 a 25)
        for (let i = 1; i <= 25; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-numero-seletor';
            btn.textContent = i.toString().padStart(2, '0');
            btn.setAttribute('data-numero', i);
            btn.setAttribute('aria-label', `Selecionar número ${i}`);
            btn.title = `Clique para ${container.dataset.target === 'resultadoAtual' ? 'adicionar' : 'selecionar'} o número ${i}`;
            
            btn.addEventListener('click', () => {
                const input = document.getElementById(targetId);
                if (!input) return;
                
                // Obtém valores atuais do campo
                let valores = input.value.split(',')
                    .map(v => parseInt(v.trim(), 10))
                    .filter(v => !isNaN(v) && v >= 1 && v <= 25);
                
                const numero = i;
                const index = valores.indexOf(numero);
                
                if (index !== -1) {
                    // Remove o número se já estiver selecionado
                    valores.splice(index, 1);
                } else {
                    // Adiciona o número se ainda não estiver selecionado e não tiver atingido o limite
                    if (valores.length < 15) {
                        valores.push(numero);
                        // Ordena os números numericamente
                        valores.sort((a, b) => a - b);
                    } else {
                        // Feedback quando o limite é atingido
                        btn.style.animation = 'pulse 0.3s ease';
                        setTimeout(() => {
                            btn.style.animation = '';
                        }, 300);
                        return;
                    }
                }
                
                // Atualiza o campo de entrada
                input.value = valores.join(', ');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                
                // Foca no campo para mostrar a atualização
                input.focus();
                
                // Atualiza o contador e estados visuais
                atualizarContador(targetId);
            });
            
            grid.appendChild(btn);
        }
        
        container.appendChild(grid);
    });
}

// Função para verificar se o servidor está acessível
async function verificarServidor() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos de timeout
        
        const url = API_BASE + '/api/status';
        console.log('[Verificação] Testando servidor em:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const isOk = response.ok;
        console.log('[Verificação] Servidor', isOk ? 'acessível ✓' : 'não acessível ✗');
        return isOk;
    } catch (error) {
        console.warn('[Verificação] Servidor não está acessível:', error.message);
        return false;
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    console.log('=== INICIALIZANDO APLICAÇÃO ===');
    
    // Verifica se o servidor está acessível
    const servidorOk = await verificarServidor();
    if (!servidorOk) {
        console.warn('⚠️ Servidor não está acessível. Certifique-se de que o servidor está rodando.');
        exibirErro('⚠️ Servidor não está acessível. Por favor, inicie o servidor executando "npm start" no terminal antes de usar a aplicação.');
        // Ainda permite usar a interface, mas o usuário verá o erro ao tentar gerar
    }
    
    // Inicializa teclados numéricos primeiro (sempre deve funcionar)
    inicializarTecladosNumericos();
    
    // Verifica status inicial
    const statusOk = await verificarStatus();
    if (!statusOk) {
        console.warn('Status não OK, mas continuando...');
        // Não retorna, permite que o usuário veja a interface
    }
    
    // Garante que o botão está habilitado após verificar status (se não estiver bloqueado)
    if (btnGerar && !btnGerar.classList.contains('btn-bloqueado')) {
        btnGerar.disabled = false;
        const btnText = btnGerar.querySelector('.btn-text');
        if (btnText && btnText.textContent !== 'Limite Atingido' && btnText.textContent !== 'Janela Anônima Não Suportada') {
            btnText.textContent = 'Gerar Jogos';
        }
    }
    
    console.log('✓ Aplicação inicializada');
    
    // Inicializa tema
    const temaSalvo = localStorage.getItem('lotoFacil_tema') || 'light';
    document.body.className = `theme-${temaSalvo}`;
    
    const toggleBtn = document.getElementById('toggleTheme');
    if (toggleBtn) {
        const icon = toggleBtn.querySelector('.theme-icon');
        icon.textContent = temaSalvo === 'light' ? '🌙' : '☀️';
        
        toggleBtn.addEventListener('click', () => {
            const temaAtual = document.body.classList.contains('theme-light') ? 'light' : 'dark';
            const novoTema = temaAtual === 'light' ? 'dark' : 'light';
            document.body.className = `theme-${novoTema}`;
            localStorage.setItem('lotoFacil_tema', novoTema);
            icon.textContent = novoTema === 'light' ? '🌙' : '☀️';
        });
    }
    
    // Garante que os teclados estão atualizados após carregar o tema
    inicializarTecladosNumericos();
    
    // Atualiza contadores inicialmente e adiciona listeners
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
    
    // Opções avançadas
    const toggleAvancado = document.getElementById('toggleAvancado');
    const opcoesAvancadas = document.getElementById('opcoesAvancadas');
    if (toggleAvancado && opcoesAvancadas) {
        toggleAvancado.addEventListener('click', () => {
            const isHidden = opcoesAvancadas.classList.contains('hidden');
            opcoesAvancadas.classList.toggle('hidden', !isHidden);
            toggleAvancado.querySelector('span:first-child').textContent = isHidden ? 'Ocultar' : 'Mostrar';
        });
    }
    
    // Inicializa filtros
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
                outroSet.delete(num);
                
                if (numerosSet.has(num)) {
                    numerosSet.delete(num);
                    btn.classList.remove('ativo');
                } else {
                    numerosSet.add(num);
                    btn.classList.add('ativo');
                }
            });
            
            container.appendChild(btn);
        }
    });
    
    const btnLimparFiltros = document.getElementById('limparFiltros');
    if (btnLimparFiltros) {
        btnLimparFiltros.addEventListener('click', () => {
            numerosExcluir.clear();
            numerosIncluir.clear();
            containerExcluir.querySelectorAll('.btn-numero-filtro').forEach(btn => btn.classList.remove('ativo'));
            containerIncluir.querySelectorAll('.btn-numero-filtro').forEach(btn => btn.classList.remove('ativo'));
        });
    }
    
    // Código de ativação
    const btnAtivar = document.getElementById('btnAtivar');
    const codigoInput = document.getElementById('codigoAtivacao');
    if (btnAtivar && codigoInput) {
        btnAtivar.addEventListener('click', async () => {
            const codigo = codigoInput.value;
            try {
                const resultado = await apiRequest('/api/ativar-codigo', 'POST', { codigo });
                if (resultado.sucesso) {
                    atualizarStatusCodigo(resultado);
                    await verificarStatus();
                    let mensagem = '';
                    if (resultado.ilimitado) {
                        mensagem = `✅ Código pessoal ativado com sucesso! Jogos ilimitados permanentemente.`;
                    } else {
                        mensagem = `✅ Código ativado com sucesso! Jogos ilimitados por ${resultado.dias} dia(s).`;
                    }
                    exibirErro(mensagem);
                    codigoInput.value = '';
                }
            } catch (error) {
                exibirErro(error.message || '❌ Erro ao ativar código.');
                codigoInput.value = '';
            }
        });
    }
    
    // Histórico
    const btnVerHistorico = document.getElementById('verHistorico');
    const historicoModal = document.getElementById('historicoModal');
    const fecharHistorico = document.getElementById('fecharHistorico');
    if (btnVerHistorico && historicoModal) {
        btnVerHistorico.addEventListener('click', async () => {
            try {
                const resultado = await apiRequest('/api/historico');
                exibirHistorico(resultado.historico || []);
                historicoModal.classList.remove('hidden');
            } catch (error) {
                exibirErro('Erro ao carregar histórico');
            }
        });
        if (fecharHistorico) {
            fecharHistorico.addEventListener('click', () => {
                historicoModal.classList.add('hidden');
            });
        }
    }
    
    const btnLimparHistorico = document.getElementById('limparHistorico');
    if (btnLimparHistorico) {
        btnLimparHistorico.addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja limpar todo o histórico?')) {
                try {
                    await apiRequest('/api/historico', 'DELETE');
                    exibirHistorico([]);
                    exibirErro('Histórico limpo com sucesso');
                } catch (error) {
                    exibirErro('Erro ao limpar histórico');
                }
            }
        });
    }
    
    function exibirHistorico(historico) {
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
        
        container.querySelectorAll('.btn-copiar-historico').forEach(btn => {
            btn.addEventListener('click', async () => {
                const numeros = btn.dataset.numeros.split(',').map(n => n.trim());
                try {
                    await navigator.clipboard.writeText(numeros.join(', '));
                    btn.textContent = '✓ Copiado!';
                    setTimeout(() => {
                        btn.textContent = '📋 Copiar';
                    }, 2000);
                } catch (err) {
                    console.error('Erro ao copiar:', err);
                }
            });
        });
    }
    
    function atualizarStatusCodigo(resultado) {
        const codigoStatus = document.getElementById('codigoStatus');
        const codigoInput = document.getElementById('codigoAtivacao');
        const btnAtivar = document.getElementById('btnAtivar');
        
        if (resultado && resultado.sucesso) {
            if (resultado.ilimitado) {
                codigoStatus.textContent = '✅ Código pessoal ativo - Jogos ilimitados permanentemente!';
            } else {
                codigoStatus.textContent = `✅ Código ativo - Jogos ilimitados por ${resultado.dias} dia(s)!`;
            }
            codigoStatus.className = 'codigo-status codigo-ativo';
            codigoStatus.classList.remove('hidden');
            codigoInput.style.display = 'none';
            btnAtivar.style.display = 'none';
        }
    }
    
    // Dashboard
    const btnDashboard = document.getElementById('btnDashboard');
    const dashboardModal = document.getElementById('dashboardModal');
    const fecharDashboard = document.getElementById('fecharDashboard');
    if (btnDashboard && dashboardModal) {
        btnDashboard.addEventListener('click', async () => {
            try {
                const status = await apiRequest('/api/status');
                const historicoResult = await apiRequest('/api/historico');
                const historicoList = historicoResult.historico || [];
                const totalJogos = historicoList.reduce((sum, item) => sum + item.jogos.length, 0);
                
                const container = document.getElementById('dashboardContent');
                if (container) {
                    container.innerHTML = `
                        <div class="dashboard-grid">
                            <div class="dashboard-card">
                                <h3>📊 Uso Hoje</h3>
                                <div class="dashboard-value">${status.contador} / ${status.maxGeracoes}</div>
                                <div class="dashboard-progress">
                                    <div class="dashboard-progress-bar" style="width: ${(status.contador / status.maxGeracoes) * 100}%"></div>
                                </div>
                                <p class="dashboard-info">✅ ${status.maxGeracoes - status.contador} gerações restantes hoje</p>
                            </div>
                            <div class="dashboard-card">
                                <h3>📋 Total de Jogos</h3>
                                <div class="dashboard-value">${totalJogos}</div>
                                <p class="dashboard-info">Jogos gerados no histórico</p>
                            </div>
                            <div class="dashboard-card">
                                <h3>📅 Histórico</h3>
                                <div class="dashboard-value">${historicoList.length}</div>
                                <p class="dashboard-info">Registros salvos</p>
                            </div>
                        </div>
                    `;
                }
                dashboardModal.classList.remove('hidden');
            } catch (error) {
                exibirErro('Erro ao carregar dashboard');
            }
        });
        if (fecharDashboard) {
            fecharDashboard.addEventListener('click', () => {
                dashboardModal.classList.add('hidden');
            });
        }
    }
    
    // Exportar PDF e Imagem (usando bibliotecas externas)
    const btnExportarPDF = document.getElementById('exportarPDF');
    if (btnExportarPDF) {
        btnExportarPDF.addEventListener('click', async () => {
            const elemento = document.getElementById('jogosGerados');
            if (!elemento || typeof html2pdf === 'undefined') return;
            
            const opt = {
                margin: 1,
                filename: `loto-facil-${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            
            await html2pdf().set(opt).from(elemento).save();
        });
    }
    
    const btnExportarImagem = document.getElementById('exportarImagem');
    if (btnExportarImagem) {
        btnExportarImagem.addEventListener('click', async () => {
            const elemento = document.getElementById('jogosGerados');
            if (!elemento || typeof html2canvas === 'undefined') return;
            
            const canvas = await html2canvas(elemento);
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `loto-facil-${new Date().toISOString().split('T')[0]}.png`;
            link.href = imgData;
            link.click();
        });
    }
    
    // Limpar dados
    const btnLimparDados = document.getElementById('btnLimparDados');
    if (btnLimparDados) {
        btnLimparDados.addEventListener('click', () => {
            if (confirm('Tem certeza que deseja limpar todos os campos preenchidos?')) {
                ['sorteio1', 'sorteio2', 'sorteio3', 'resultadoAtual'].forEach(campoId => {
                    const input = document.getElementById(campoId);
                    if (input) {
                        input.value = '';
                        atualizarContador(campoId);
                    }
                });
                numerosExcluir.clear();
                numerosIncluir.clear();
                containerExcluir.querySelectorAll('.btn-numero-filtro').forEach(btn => btn.classList.remove('ativo'));
                containerIncluir.querySelectorAll('.btn-numero-filtro').forEach(btn => btn.classList.remove('ativo'));
                resultadoContainer.classList.add('hidden');
                estatisticasContainer.classList.add('hidden');
            }
        });
    }
    
    // Atalhos de teclado
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.target.closest('.modal')) {
            e.preventDefault();
            if (!btnGerar.disabled) {
                form.dispatchEvent(new Event('submit'));
            }
        }
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                if (!modal.classList.contains('hidden')) {
                    modal.classList.add('hidden');
                }
            });
        }
    });
    
    // Atualiza status periodicamente
    setInterval(async () => {
        await verificarStatus();
    }, 60000); // A cada minuto
});
