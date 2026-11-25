"use strict";

/** Cria o arquivo no próprio navegador, inclusive quando o app está sem internet. */
async function gerarPdfRotina(tarefas, opcoes = {}) {
  if (typeof PDFLib === "undefined") throw new Error("O recurso de PDF não foi carregado. Reabra o aplicativo.");
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const forte = await pdf.embedFont(StandardFonts.HelveticaBold);
  const caracteres = new Set(fonte.getCharacterSet());
  const geradoEm = opcoes.geradoEm instanceof Date && !Number.isNaN(opcoes.geradoEm.getTime()) ? opcoes.geradoEm : new Date();
  pdf.setTitle("Minha rotina - atividades da criança");
  pdf.setAuthor("Minha Rotina");
  pdf.setSubject("Rotina da criança, organizada por dia e período, com etapas para acompanhar.");
  pdf.setCreationDate(geradoEm);
  pdf.setModificationDate(geradoEm);
  pdf.setLanguage("pt-BR");

  // As fontes padrão do PDF preservam os acentos do português. Figuras decorativas
  // fora desse alfabeto são omitidas para evitar quadrados e erros na exportação.
  function texto(valor) {
    return Array.from(String(valor ?? "").normalize("NFC"))
      .map(c => /\s/u.test(c) ? " " : caracteres.has(c.codePointAt(0)) ? c : "")
      .join("").replace(/\s+/g, " ").trim();
  }
  function quebrar(valor, tamanho, largura, font = fonte) {
    const palavras = texto(valor).split(" ").filter(Boolean);
    const linhas = [];
    let linha = "";
    for (const palavra of palavras) {
      const partes = [];
      let parte = "";
      for (const c of palavra) {
        if (parte && font.widthOfTextAtSize(parte + c, tamanho) > largura) { partes.push(parte); parte = ""; }
        parte += c;
      }
      if (parte) partes.push(parte);
      for (const item of partes) {
        const candidata = linha ? `${linha} ${item}` : item;
        if (linha && font.widthOfTextAtSize(candidata, tamanho) > largura) { linhas.push(linha); linha = item; }
        else linha = candidata;
      }
    }
    if (linha) linhas.push(linha);
    return linhas.length ? linhas : [""];
  }

  const cores = {
    tinta: rgb(.28, .20, .15), apoio: rgb(.43, .35, .29), laranja: rgb(.73, .32, .08),
    linha: rgb(.87, .81, .73), papel: rgb(.99, .97, .93), ouro: rgb(.91, .66, .12),
    morning: rgb(1, .94, .78), afternoon: rgb(.88, .95, .96), night: rgb(.92, .90, .98)
  };
  const largura = 595.28, altura = 841.89, margem = 44, limite = 58;
  const utilizavel = largura - margem * 2;
  const periodoValido = ORDEM_PERIODOS.includes(opcoes.periodo) ? opcoes.periodo : "all";
  const dataValida = Datas.valida(opcoes.data) ? opcoes.data : null;
  const lista = (Array.isArray(tarefas) ? tarefas : []).filter(t => t && typeof t === "object")
    .filter(t => (!dataValida || t.data === dataValida) && (periodoValido === "all" || t.periodo === periodoValido))
    .map((t, indice) => ({ t, indice }))
    .sort((a, b) => String(a.t.data || "").localeCompare(String(b.t.data || "")) ||
      ORDEM_PERIODOS.indexOf(a.t.periodo) - ORDEM_PERIODOS.indexOf(b.t.periodo) || a.indice - b.indice)
    .map(item => item.t);
  const escopo = `${dataValida ? Datas.formatar(dataValida) : "Todas as datas"} | ${periodoValido === "all" ? "Todos os períodos" : PERIODOS[periodoValido]}`;
  let pagina, y, grupoNaPagina = null, tarefaEmCurso = null;
  function escrever(valor, x, posicao, tamanho = 12, negrito = false, cor = cores.tinta) {
    pagina.drawText(texto(valor), { x, y: posicao, size: tamanho, font: negrito ? forte : fonte, color: cor });
  }
  function novaPagina() {
    pagina = pdf.addPage([largura, altura]);
    grupoNaPagina = null;
    pagina.drawRectangle({ x: 0, y: altura - 11, width: largura, height: 11, color: cores.laranja });
    escrever("MINHA ROTINA", margem, altura - 51, 10, true, cores.laranja);
    escrever("Minha rotina", margem, altura - 85, 27, true);
    escrever("Um passo de cada vez, no meu ritmo.", margem, altura - 108, 12, false, cores.apoio);
    escrever(escopo, margem, altura - 134, 10, false, cores.apoio);
    pagina.drawLine({ start: { x: margem, y: altura - 146 }, end: { x: largura - margem, y: altura - 146 }, thickness: 1, color: cores.linha });
    y = altura - 173;
  }
  function garantir(espaco, continuacao = null) {
    if (y - espaco >= limite) return;
    novaPagina();
    if (continuacao) {
      if (tarefaEmCurso) desenharGrupo(tarefaEmCurso);
      const tituloCurto = continuacao.length > 80 ? continuacao.slice(0, 77) + "..." : continuacao;
      const linhas = quebrar(`${tituloCurto} (continuação)`, 12, utilizavel, forte);
      for (const linha of linhas) { escrever(linha, margem, y, 12, true); y -= 17; }
      y -= 5;
    }
  }
  function caixa(x, posicao, marcada, tamanho = 11) {
    pagina.drawRectangle({ x, y: posicao - 1, width: tamanho, height: tamanho, borderWidth: 1, borderColor: cores.apoio });
    if (marcada) {
      pagina.drawLine({ start: { x: x + 2, y: posicao + 4 }, end: { x: x + 4.5, y: posicao + 1.5 }, thickness: 1.5, color: cores.laranja });
      pagina.drawLine({ start: { x: x + 4.5, y: posicao + 1.5 }, end: { x: x + tamanho - 1.5, y: posicao + tamanho - 2 }, thickness: 1.5, color: cores.laranja });
    }
  }
  function estrela(x, posicao, cheia) {
    const pontos = [];
    for (let i = 0; i < 10; i++) {
      const angulo = -Math.PI / 2 + i * Math.PI / 5;
      const raio = i % 2 ? 3.2 : 7;
      pontos.push(`${(7 + Math.cos(angulo) * raio).toFixed(2)} ${(7 + Math.sin(angulo) * raio).toFixed(2)}`);
    }
    pagina.drawSvgPath(`M ${pontos.join(" L ")} Z`, {
      x, y: posicao + 12, borderColor: cores.apoio, borderWidth: .7,
      color: cheia ? cores.ouro : rgb(1, 1, 1)
    });
  }
  function avaliacao(t) {
    if (typeof t.avaliacao === "function") return t.avaliacao();
    const etapas = Array.isArray(t.etapas) ? t.etapas : [];
    const feitas = etapas.filter(e => e && e.feita).length;
    const completa = etapas.length ? feitas === etapas.length : t.status === "done";
    return { completa, estrelas: completa ? 5 : etapas.length ? Math.min(4, Math.ceil(feitas / etapas.length * 5)) : 0 };
  }
  function linhasDaAtividade(t) {
    const linhas = [];
    if (texto(t.dica)) quebrar(`Dica: ${t.dica}`, 11, utilizavel - 25).forEach(linha => linhas.push({ texto: linha, tipo: "dica" }));
    const etapas = Array.isArray(t.etapas) ? t.etapas : [];
    etapas.forEach(e => {
      const etapa = typeof e === "string" ? { texto: e, feita: false } : e || {};
      quebrar(etapa.texto, 12, utilizavel - 44).forEach((linha, indice) => linhas.push({ texto: linha, tipo: "etapa", caixa: indice === 0, marcada: Boolean(etapa.feita) }));
    });
    if (!etapas.length) linhas.push({ texto: "Atividade concluída", tipo: "etapa", caixa: true, marcada: t.status === "done" });
    if (Array.isArray(t.opcoes) && t.opcoes.length) {
      linhas.push({ texto: "Posso escolher:", tipo: "dica" });
      t.opcoes.forEach((opcao, i) => quebrar(opcao, 11, utilizavel - 44).forEach((linha, indice) =>
        linhas.push({ texto: linha, tipo: "opcao", caixa: indice === 0, marcada: t.opcaoEscolhida === i })));
    }
    return linhas;
  }
  function desenharGrupo(t) {
    const grupo = `${t.data}|${t.periodo}`;
    if (grupoNaPagina === grupo) return;
    const periodo = ORDEM_PERIODOS.includes(t.periodo) ? PERIODOS[t.periodo] : "Rotina";
    const data = Datas.valida(t.data) ? Datas.formatar(t.data) : "Sem data";
    pagina.drawRectangle({ x: margem, y: y - 8, width: utilizavel, height: 28, color: ORDEM_PERIODOS.includes(t.periodo) ? cores[t.periodo] : cores.papel });
    escrever(`${data}  |  ${periodo}`, margem + 10, y + 1, 12, true);
    y -= 33;
    grupoNaPagina = grupo;
  }
  novaPagina();
  if (!lista.length) {
    escrever("Nenhuma atividade neste filtro.", margem, y, 16, true);
    y -= 26;
    escrever("Um adulto pode preparar novas atividades para a rotina.", margem, y, 12, false, cores.apoio);
  }
  lista.forEach((t, indice) => {
    tarefaEmCurso = t;
    const titulo = texto(t.nome) || "Atividade";
    const tituloLinhas = quebrar(titulo, 15, utilizavel - 126, forte);
    const linhas = linhasDaAtividade(t);
    const alturaBloco = tituloLinhas.length * 20 + linhas.length * 18 + 46;
    garantir(Math.min(alturaBloco + 39, 596));
    desenharGrupo(t);
    const resultado = avaliacao(t);
    garantir(55);
    caixa(margem + 2, y - 1, resultado.completa, 13);
    // A pontuação pertence à atividade, exatamente como nos cartões do aplicativo.
    const topoEstrelas = y - 1;
    for (let i = 0; i < 5; i++) estrela(largura - margem - 85 + i * 17, topoEstrelas, i < resultado.estrelas);
    escrever(`${resultado.estrelas}/5`, largura - margem - 28, topoEstrelas - 18, 9, true, cores.apoio);
    tituloLinhas.forEach(linha => { garantir(21, titulo); escrever(linha, margem + 25, y, 15, true); y -= 20; });
    y -= 10;
    for (const linha of linhas) {
      garantir(20, titulo);
      if (linha.caixa) caixa(margem + 25, y, linha.marcada);
      escrever(linha.texto, margem + (linha.tipo === "dica" ? 25 : 44), y, linha.tipo === "etapa" ? 12 : 11, false, cores.apoio);
      y -= 18;
    }
    y -= 8;
    if (y >= limite) pagina.drawLine({ start: { x: margem, y }, end: { x: largura - margem, y }, thickness: .6, color: cores.linha });
    y -= 23;
  });
  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    p.drawText(`Minha Rotina | Gerado em ${Datas.paraISO(geradoEm).split("-").reverse().join("/")}`, { x: margem, y: 27, size: 8, font: fonte, color: cores.apoio });
    const numero = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(numero, { x: largura - margem - fonte.widthOfTextAtSize(numero, 8), y: 27, size: 8, font: fonte, color: cores.apoio });
  });
  return pdf.save();
}

function nomeArquivoPdfRotina(opcoes = {}) {
  const data = Datas.valida(opcoes.data) ? opcoes.data : "todas-as-datas";
  const periodo = ORDEM_PERIODOS.includes(opcoes.periodo) ? { morning: "-manha", afternoon: "-tarde", night: "-noite" }[opcoes.periodo] : "";
  return `minha-rotina-${data}${periodo}.pdf`;
}

async function exportarRotinaPdf(app) {
  const botao = document.querySelector("#export-backup");
  if (botao && botao.disabled) return;
  const rotulo = botao ? botao.textContent : "";
  if (botao) { botao.disabled = true; botao.textContent = "Preparando PDF..."; }
  try {
    const opcoes = { data: app.painel.data, periodo: app.painel.periodo };
    const arquivo = await gerarPdfRotina(app.painel.listaAtual(), opcoes);
    const url = URL.createObjectURL(new Blob([arquivo], { type: "application/pdf" }));
    const link = el("a", { href: url, download: nomeArquivoPdfRotina(opcoes) });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    anunciar("PDF da rotina pronto para baixar.");
  } catch (erro) {
    anunciar("Não foi possível gerar o PDF. Tente novamente ou reabra o aplicativo.");
  } finally {
    if (botao) { botao.disabled = false; botao.textContent = rotulo; }
  }
}
