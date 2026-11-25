# Star — Minha Rotina

Protótipo web de um quadro de rotina (Kanban) para apoiar a organização do dia e a autonomia de crianças de 6 a 12 anos com TEA nível 1 e/ou TDAH. Desenvolvido como Trabalho de Conclusão de Curso em Ciência da Computação, adaptando práticas de Scrum e Kanban ao contexto infantil.

**Acesse o aplicativo:** _(cole aqui o link do GitHub Pages, por exemplo `https://SEU-USUARIO.github.io/star/`)_

> Protótipo acadêmico. Não substitui acompanhamento profissional e não foi validado com crianças.

## Funcionalidades (v3.3)

**Área da criança**
- Quadro com as colunas A Fazer, Fazendo agora, Preciso de Ajuda e Encerradas, filtros por período (manhã, tarde, noite) e navegação por dia.
- Cada atividade mostra de 0 a 5 estrelas, que acompanham as etapas marcadas.
- A Estrelinha, mascote do app, muda de expressão: triste, séria e muito feliz.
- Ao encerrar com etapas pendentes, a Estrelinha pergunta se a criança quer continuar (Sim/Não); o progresso é preservado.
- Dicas, etapas, opções de escolha e leitura em voz alta, quando o navegador oferece.

**Área do adulto**
- Cadastro, edição, modelos e repetição de atividades (amanhã ou próxima semana).
- Escolha das atividades que participam da recompensa e prêmio combinado.
- Painel Desempenho com o resultado de 0 a 5 por dia e período.
- **Exportar rotina (PDF):** baixa um PDF A4 da rotina da criança, para imprimir.
- Cópia de segurança em JSON e importação de tarefas.
- Preferências de apoio: voz, uma tarefa por vez, animações e nível de dificuldade.

## Como usar

- **Pela internet:** abra o link do GitHub Pages acima.
- **No computador:** baixe o repositório (botão verde **Code → Download ZIP**), extraia e abra `index.html` no Chrome, Edge ou Firefox. Não é preciso instalar nada.

## Privacidade

Não há servidor, conta ou cadastro. As tarefas ficam guardadas apenas no navegador de quem usa (armazenamento local); nada é enviado para o GitHub nem para outro serviço. Por isso, os dados de um navegador não aparecem em outro. Para levá-los, use **Salvar cópia de segurança** e **Importar tarefas**.

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Telas, ilustrações e expressões da Estrelinha (SVG) |
| `script.js` | Regras das atividades, estrelas, recompensa e quadro |
| `integracao.js` | Navegação, importação e cópia de segurança |
| `desempenho.js`, `desempenho.css` | Painel Desempenho do responsável |
| `pdf-rotina.js` | Geração da rotina em PDF no navegador |
| `base.css`, `design.css`, `kids.css`, `progresso.css` | Estilos |
| `vendor/pdf-lib.min.js` | Biblioteca [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17.1 (licença MIT, em `vendor/LICENSE.pdf-lib.txt`) |
| `test*.mjs`, `TESTES.txt` | Testes automatizados e registro dos resultados |
| `LEIA-ME.txt` | Descrição detalhada das regras |

## Testes

Com o [Node.js](https://nodejs.org) instalado, na pasta do projeto:

```bash
node test-atividade-livre.mjs
node test.mjs
node test-pdf-rotina.mjs   # requer Python com pypdf para ler os PDFs gerados
```

Resultados e limitações estão em `TESTES.txt`.

## Tecnologias

HTML, CSS e JavaScript puros, sem framework e sem etapa de compilação. Fontes Nunito e Fredoka One (Google Fonts, opcionais; sem internet, o navegador usa fontes do computador).
