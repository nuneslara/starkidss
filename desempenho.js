"use strict";

/** O acompanhamento inclui todas as atividades do filtro, inclusive as sem estrelas. */
function desempenhoDasAtividades(lista) {
  const atividades = Array.isArray(lista) ? lista : [];
  const avaliacoes = atividades.map(tarefa => tarefa.avaliacao());
  const total = atividades.length;
  const soma = avaliacoes.reduce((valor, avaliacao) => valor + avaliacao.estrelas, 0);
  return {
    total,
    media: total ? soma / total : 0,
    concluidas: avaliacoes.filter(avaliacao => avaliacao.completa).length,
    encerradasParciais: atividades.filter((tarefa, i) => tarefa.status === "done" && !avaliacoes[i].completa).length
  };
}

PainelAdulto.prototype.renderizarDesempenho = function () {
  const painel = document.querySelector("#desempenho-conteudo");
  if (!painel) return;
  const lista = this.listaAtual();
  const desempenho = desempenhoDasAtividades(lista);
  const data = this.data ? Datas.formatar(this.data) : "todas as datas";
  const periodo = this.periodo === "all" ? "todos os períodos" : PERIODOS[this.periodo].toLowerCase();
  const escopo = el("p", { class: "section-hint desempenho-scope", text: `${data} · ${periodo}. Acompanha os filtros da rotina.` });

  if (!desempenho.total) {
    painel.replaceChildren(escopo,
      el("p", { class: "desempenho-empty", text: "Nenhuma atividade neste filtro. Escolha outro dia ou período para acompanhar o desempenho." }));
    return;
  }

  const numero = desempenho.media.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const resumo = el("div", { class: "desempenho-summary" },
    el("div", { class: "desempenho-result" },
      el("span", { class: "desempenho-value", text: numero }),
      el("span", { class: "desempenho-scale", text: "de 5" })),
    el("div", { class: "desempenho-explanation" },
      el("p", { text: `Resultado de ${plural(desempenho.total, "atividade", "atividades")} neste filtro.` }),
      el("p", { class: "desempenho-detail", text: `${plural(desempenho.concluidas, "atividade com 5 estrelas", "atividades com 5 estrelas")} · ${plural(desempenho.encerradasParciais, "encerrada com etapas pendentes", "encerradas com etapas pendentes")}.` })));
  const faixa = el("div", {
    class: "desempenho-meter", role: "meter", "aria-label": "Desempenho das atividades deste filtro",
    "aria-valuemin": "0", "aria-valuemax": "5", "aria-valuenow": String(desempenho.media),
    "aria-valuetext": `${numero} de 5`
  }, el("span", { style: `width:${desempenho.media / 5 * 100}%` }));
  const atividades = el("ul", { class: "desempenho-list", "aria-label": "Estrelas de cada atividade" });

  lista.forEach(tarefa => {
    const avaliacao = tarefa.avaliacao();
    const rosto = ico(`mascote-${avaliacao.estado}`, "desempenho-face");
    rosto.setAttribute("viewBox", "0 0 120 120");
    const andamento = avaliacao.total
      ? `${avaliacao.feitas} de ${plural(avaliacao.total, "etapa marcada", "etapas marcadas")}`
      : tarefa.status === "done" ? "Atividade concluída" : "Atividade sem etapas cadastradas";
    const situacao = tarefa.status === "done" && !avaliacao.completa
      ? "Encerrada com etapas pendentes"
      : avaliacao.completa ? "5 estrelas alcançadas" : STATUS[tarefa.status];
    const pontuacao = el("div", { class: "desempenho-task-score", role: "img", "aria-label": `${avaliacao.estrelas} de 5 estrelas` },
      estrelas(5, avaliacao.estrelas, "desempenho-stars"),
      el("strong", { text: `${avaliacao.estrelas}/5` }));
    atividades.append(el("li", { class: "desempenho-task" },
      rosto,
      el("div", { class: "desempenho-task-copy" },
        el("h3", { text: tarefa.nome }),
        el("p", { text: `${Datas.formatar(tarefa.data)} · ${PERIODOS[tarefa.periodo]} · ${andamento}` }),
        el("p", { class: "desempenho-task-status", text: situacao })),
      pontuacao));
  });

  painel.replaceChildren(escopo, resumo, faixa, atividades);
};

const renderizarAdultoComDesempenho = PainelAdulto.prototype.renderizar;
PainelAdulto.prototype.renderizar = function (...args) {
  const resultado = renderizarAdultoComDesempenho.apply(this, args);
  this.renderizarDesempenho();
  return resultado;
};
