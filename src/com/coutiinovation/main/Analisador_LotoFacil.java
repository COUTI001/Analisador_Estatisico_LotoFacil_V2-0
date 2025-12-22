/***
 * Desenvolvido por: André Luiz Coutinho(COUTIINOVATTION)
 */


package com.coutiinovation.main;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

public class Analisador_LotoFacil extends JFrame {

    private JTextArea resultadoTextArea;
    private JTextField sorteio1Field;
    private JTextField sorteio2Field;
    private JTextField sorteio3Field;
    private JTextField resultadoAtualField;

    public Analisador_LotoFacil() {
        setTitle("LOTO FÁCIL");
        // Aumenta o tamanho da janela para acomodar bem os campos com fonte 14
        setSize(800, 400);
        setLocationRelativeTo(null);
        this.setResizable(false);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);

        // Define uma fonte padrão tamanho 14 para os componentes
        Font fontePadrao = new Font("SansSerif", Font.ITALIC, 20);

        JPanel mainPanel = new JPanel(new BorderLayout());

        // Painel superior: entrada dos 3 últimos sorteios + resultado atual
        JPanel inputPanel = new JPanel(new GridLayout(4, 1));

        sorteio1Field = new JTextField();
        sorteio1Field.setFont(fontePadrao);
        sorteio2Field = new JTextField();
        sorteio2Field.setFont(fontePadrao);
        sorteio3Field = new JTextField();
        sorteio3Field.setFont(fontePadrao);
        resultadoAtualField = new JTextField();
        resultadoAtualField.setFont(fontePadrao);

        JPanel linha1 = new JPanel(new BorderLayout());
        JLabel label1 = new JLabel("Sorteio 1 (15 números, separados por vírgula): ");
        label1.setFont(fontePadrao);
        linha1.add(label1, BorderLayout.WEST);
        linha1.add(sorteio1Field, BorderLayout.CENTER);

        JPanel linha2 = new JPanel(new BorderLayout());
        JLabel label2 = new JLabel("Sorteio 2 (15 números, separados por vírgula): ");
        label2.setFont(fontePadrao);
        linha2.add(label2, BorderLayout.WEST);
        linha2.add(sorteio2Field, BorderLayout.CENTER);

        JPanel linha3 = new JPanel(new BorderLayout());
        JLabel label3 = new JLabel("Sorteio 3 (15 números, separados por vírgula): ");
        label3.setFont(fontePadrao);
        linha3.add(label3, BorderLayout.WEST);
        linha3.add(sorteio3Field, BorderLayout.CENTER);

        JPanel linha4 = new JPanel(new BorderLayout());
        JLabel label4 = new JLabel("Resultado do Jogo Atual (15 números, separados por vírgula): ");
        label4.setFont(fontePadrao);
        linha4.add(label4, BorderLayout.WEST);
        linha4.add(resultadoAtualField, BorderLayout.CENTER);

        inputPanel.add(linha1);
        inputPanel.add(linha2);
        inputPanel.add(linha3);
        inputPanel.add(linha4);

        mainPanel.add(inputPanel, BorderLayout.NORTH);

        // Área de resultado com scroll
        resultadoTextArea = new JTextArea();
        resultadoTextArea.setFont(fontePadrao);
        resultadoTextArea.setEditable(false);
        JScrollPane scrollPane = new JScrollPane(resultadoTextArea);
        mainPanel.add(scrollPane, BorderLayout.CENTER);

        // Botão de sorteio
        JButton sorteioButton = new JButton("Gera Jogos");
        sorteioButton.setFont(fontePadrao);
        sorteioButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                try {
                    List<List<Integer>> tresSorteios = lerTresSorteios();
                    List<Integer> resultadoAtual = parseSorteio(resultadoAtualField.getText(), "Resultado do Jogo Atual");
                    List<Integer> numerosSorteados = realizarSorteioComBaseNosTresSorteios(tresSorteios, resultadoAtual);
                    resultadoTextArea.setText("Números sugeridos: " + numerosSorteados.toString());
                } catch (IllegalArgumentException ex) {
                    JOptionPane.showMessageDialog(Analisador_LotoFacil.this, ex.getMessage(), "Entrada inválida", JOptionPane.ERROR_MESSAGE);
                }
            }
        });
        mainPanel.add(sorteioButton, BorderLayout.SOUTH);

        add(mainPanel);
    }

    /**
     * Lê e valida os 3 últimos sorteios informados pelo usuário.
     */
    private List<List<Integer>> lerTresSorteios() {
        List<List<Integer>> tresSorteios = new ArrayList<>();
        tresSorteios.add(parseSorteio(sorteio1Field.getText(), "Sorteio 1"));
        tresSorteios.add(parseSorteio(sorteio2Field.getText(), "Sorteio 2"));
        tresSorteios.add(parseSorteio(sorteio3Field.getText(), "Sorteio 3"));
        return tresSorteios;
    }

    /**
     * Converte uma linha de texto em uma lista de 15 inteiros (1 a 25, sem repetição).
     */
    private List<Integer> parseSorteio(String texto, String nomeCampo) {
        if (texto == null || texto.trim().isEmpty()) {
            throw new IllegalArgumentException(nomeCampo + ": digite 15 números separados por vírgula.");
        }

        String[] partes = texto.split(",");
        if (partes.length != 15) {
            throw new IllegalArgumentException(nomeCampo + ": você deve informar exatamente 15 números.");
        }

        List<Integer> numeros = new ArrayList<>();
        try {
            for (String parte : partes) {
                int valor = Integer.parseInt(parte.trim());
                if (valor < 1 || valor > 25) {
                    throw new IllegalArgumentException(nomeCampo + ": todos os números devem estar entre 1 e 25.");
                }
                if (numeros.contains(valor)) {
                    throw new IllegalArgumentException(nomeCampo + ": os 15 números não devem conter repetições.");
                }
                numeros.add(valor);
            }
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(nomeCampo + ": certifique-se de digitar apenas números inteiros separados por vírgula.");
        }

        return numeros;
    }

    /**
     * Gera 15 números combinando:
     * - Números que NÃO foram sorteados no resultado atual
     * - Média dos números que mais saíram nos 3 últimos sorteios
     */
    public static List<Integer> realizarSorteioComBaseNosTresSorteios(List<List<Integer>> tresSorteios, List<Integer> resultadoAtual) {
        List<Integer> numerosSorteados = new ArrayList<>();

        // Identifica os números que NÃO foram sorteados no resultado atual
        List<Integer> numerosNaoSorteados = new ArrayList<>();
        for (int i = 1; i <= 25; i++) {
            if (!resultadoAtual.contains(i)) {
                numerosNaoSorteados.add(i);
            }
        }

        // Conta a frequência de cada número (1..25) nos três sorteios
        int[] frequencias = new int[26]; // índice 0 não usado
        for (List<Integer> sorteio : tresSorteios) {
            for (int num : sorteio) {
                if (num >= 1 && num <= 25) {
                    frequencias[num]++;
                }
            }
        }

        // Calcula a média de frequência (soma das frequências / 3)
        double mediaFrequencia = 0.0;
        for (int i = 1; i <= 25; i++) {
            mediaFrequencia += frequencias[i];
        }
        mediaFrequencia = mediaFrequencia / 3.0;

        // Cria lista de números possíveis e seus "pesos" combinando:
        // - Prioridade para números NÃO sorteados no resultado atual
        // - Peso baseado na frequência acima da média nos três últimos sorteios
        List<Integer> numerosDisponiveis = new ArrayList<>();
        List<Integer> pesos = new ArrayList<>();
        
        for (int i = 1; i <= 25; i++) {
            numerosDisponiveis.add(i);
            int peso = 1; // peso base mínimo
            
            // Bônus se o número NÃO foi sorteado no resultado atual
            if (numerosNaoSorteados.contains(i)) {
                peso += 5; // peso significativo para números não sorteados
            }
            
            // Bônus se a frequência está acima da média nos três últimos sorteios
            if (frequencias[i] > mediaFrequencia) {
                peso += (int)(frequencias[i] - mediaFrequencia) * 2; // peso proporcional à diferença
            }
            
            pesos.add(peso);
        }

        Random random = new Random();

        // Sorteia 15 números sem repetição, usando pesos (probabilidade proporcional ao peso)
        for (int i = 0; i < 15 && !numerosDisponiveis.isEmpty(); i++) {
            // Soma total dos pesos atuais
            int somaPesos = 0;
            for (int p : pesos) {
                somaPesos += p;
            }

            int r = random.nextInt(somaPesos) + 1; // valor entre 1 e somaPesos
            int acumulado = 0;
            int indiceEscolhido = 0;

            for (int j = 0; j < pesos.size(); j++) {
                acumulado += pesos.get(j);
                if (r <= acumulado) {
                    indiceEscolhido = j;
                    break;
                }
            }

            int numeroSorteado = numerosDisponiveis.get(indiceEscolhido);
            numerosSorteados.add(numeroSorteado);

            // Remove o número e seu peso para não repetir
            numerosDisponiveis.remove(indiceEscolhido);
            pesos.remove(indiceEscolhido);
        }

        // Ordena os números sorteados antes de retornar
        Collections.sort(numerosSorteados);

        return numerosSorteados;
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(new Runnable() {
            @Override
            public void run() {
                Analisador_LotoFacil lt = new Analisador_LotoFacil();
                lt.setVisible(true);
            }
        });
    }
}
