"use strict";
/* ═══════════════════════════════════════════════════════════════════════════
   Modelo Ágil Assistivo — protótipo web, versão 2.0
   Organização em classes (ver diagrama de classes da monografia):
     Etapa, Tarefa ............ modelo de dados
     RepositorioTarefas ....... persistência no localStorage (com migração da v1)
     SistemaRecompensas ....... estrelas por tarefa concluída e prêmio combinado
     Preferencias ............. apoios visuais e auditivos ajustáveis pelo adulto
     LeitorVoz ................ leitura em voz alta (Web Speech API)
     GerenciadorRotina ........ regras de negócio (cadastrar, mover, duplicar...)
     Dialogo, Comemoracao ..... janelas acessíveis (foco preso, Esc, retorno do foco)
     QuadroKanban ............. Área da Criança
     PainelAdulto ............. Área do Adulto
     Aplicativo ............... composição e navegação entre telas
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const STATUS = { todo: "A Fazer", doing: "Fazendo", help: "Preciso de Ajuda", done: "Encerrada" };
const ORDEM_STATUS = ["todo", "doing", "help", "done"];
const PERIODOS = { morning: "Manhã", afternoon: "Tarde", night: "Noite" };
const PERIODO_ICONE = { morning: "i-nascer", afternoon: "i-sol", night: "i-lua", all: "i-brilho" };
const ORDEM_PERIODOS = ["morning", "afternoon", "night"];
const DIFICULDADES = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const MAX_ITENS = 6;
/** Figuras das tarefas: ícones SVG próprios (ver o sprite no index.html). [chave, nome acessível] */
const ICONES = [
  ["estrela", "estrela"], ["dente", "dente"], ["escova", "escova de dente"], ["banho", "banho"], ["roupa", "roupa"],
  ["tenis", "tênis"], ["refeicao", "refeição"], ["cafe", "café da manhã"], ["fruta", "fruta"], ["copo", "leite"],
  ["agua", "água"], ["mochila", "mochila"], ["livros", "livros"], ["leitura", "leitura"], ["lapis", "lápis"],
  ["quebracabeca", "quebra-cabeça"], ["pintura", "pintura"], ["musica", "música"], ["bola", "exercício"], ["planta", "planta"],
  ["vassoura", "arrumação"], ["brinquedos", "brinquedos"], ["remedio", "remédio"], ["dormir", "dormir"], ["jogo", "jogo"],
  ["meta", "meta"]
];
/** Emoji exibido para cada figura (no Windows, aparece no estilo 3D do sistema). */
const ICONE_EMOJI = {
  estrela: "⭐", dente: "🦷", escova: "🪥", banho: "🛁", roupa: "👕", tenis: "👟", refeicao: "🍽️", cafe: "🥣",
  fruta: "🍎", copo: "🥛", agua: "🥤", mochila: "🎒", livros: "📚", leitura: "📖", lapis: "✏️", quebracabeca: "🧩",
  pintura: "🎨", musica: "🎵", bola: "🏃", planta: "🌿", vassoura: "🧹", brinquedos: "🧸", remedio: "💊", dormir: "😴",
  jogo: "🎮", meta: "🎯"
};
/** Conversão das figuras em emoji usadas nas versões anteriores. */
const EMOJI_PARA_ICONE = {
  "⭐": "estrela", "🦷": "dente", "🪥": "escova", "🛁": "banho", "🧴": "banho", "👕": "roupa", "👟": "tenis",
  "🍽": "refeicao", "🥣": "cafe", "🍎": "fruta", "🍌": "fruta", "🥛": "copo", "🥤": "agua", "🎒": "mochila",
  "📚": "livros", "📖": "leitura", "✏": "lapis", "🖊": "lapis", "🧩": "quebracabeca", "🎨": "pintura", "🎵": "musica",
  "🏃": "bola", "🌿": "planta", "🧹": "vassoura", "🧺": "vassoura", "🧸": "brinquedos", "💊": "remedio", "😴": "dormir",
  "🌙": "dormir", "🌅": "estrela", "🎮": "jogo", "🎯": "meta"
};
const CELEBRACOES = [
  "Você conseguiu! Que orgulho!", "Incrível! Continue assim!", "Tarefa feita com sucesso!",
  "Parabéns! Mais uma conquista!", "Você mandou muito bem!"
];
const MODELOS = {
  dentes: {
    rotulo: "Escovar os dentes", nome: "Escovar os dentes", icone: "escova", periodo: "morning", dificuldade: "easy",
    dica: "Use pouca pasta e escove devagar.",
    etapas: ["Pegar a escova", "Colocar um pouco de pasta", "Escovar por 2 minutos", "Enxaguar a boca"]
  },
  mochila: {
    rotulo: "Organizar a mochila", nome: "Organizar a mochila", icone: "mochila", periodo: "morning", dificuldade: "medium",
    dica: "Confira a agenda antes de fechar a mochila.",
    etapas: ["Colocar o caderno", "Colocar o estojo", "Colocar a agenda", "Fechar a mochila"]
  },
  leitura: {
    rotulo: "Leitura antes de dormir", nome: "Leitura antes de dormir", icone: "leitura", periodo: "night", dificuldade: "easy",
    dica: "Guarde o celular e leia por 10 minutos com um adulto.",
    etapas: ["Guardar o celular", "Escolher um livro", "Ler por 10 minutos"],
    opcoes: ["O Menino Maluquinho (Ziraldo)", "Marcelo, Marmelo, Martelo (Ruth Rocha)", "Um gibi de que você gosta", "Livro emprestado da escola"]
  },
  banho: {
    rotulo: "Tomar banho", nome: "Tomar banho", icone: "banho", periodo: "night", dificuldade: "medium",
    dica: "Separe a toalha e a roupa antes de entrar no banho.",
    etapas: ["Separar toalha e roupa", "Tomar banho", "Secar o corpo", "Vestir o pijama"]
  },
  brinquedos: {
    rotulo: "Guardar os brinquedos", nome: "Guardar os brinquedos", icone: "brinquedos", periodo: "afternoon", dificuldade: "easy",
    dica: "Cada brinquedo volta para a sua caixa.", etapas: ["Juntar os brinquedos", "Colocar na caixa", "Guardar a caixa"]
  }
};

// ─── UTILITÁRIOS ─────────────────────────────────────────────────────────────
const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

/** Cria elementos com textContent (evita injeção de HTML). */
function el(tag, atributos = {}, ...filhos) {
  const elemento = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave === "class") elemento.className = valor;
    else if (chave === "text") elemento.textContent = valor;
    else if (chave.startsWith("data-")) elemento.setAttribute(chave, valor);
    else if (chave in elemento && typeof valor !== "string") elemento[chave] = valor;
    else elemento.setAttribute(chave, valor === true ? "" : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    elemento.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return elemento;
}

/** Cria um ícone do sprite SVG (decorativo, escondido de leitores de tela). */
function ico(id, classe = "ico") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", classe);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const uso = document.createElementNS("http://www.w3.org/2000/svg", "use");
  uso.setAttribute("href", `#${id}`);
  svg.appendChild(uso);
  return svg;
}

/** Figura da tarefa como emoji (decorativa; o nome da tarefa já está no texto). */
function figura(chave, classe = "emoji") {
  return el("span", { class: classe, "aria-hidden": "true", text: ICONE_EMOJI[chave] || "⭐" });
}

function estrelas(total, cheias, classe) {
  return el("span", { class: classe, "aria-hidden": "true" },
    Array.from({ length: total }, (_, i) => ico(i < cheias ? "i-estrela-cheia" : "i-estrela", i < cheias ? "star on" : "star")));
}

function anunciar(mensagem) {
  const regiao = $("#anuncio");
  if (!regiao) return;
  regiao.textContent = "";
  setTimeout(() => { regiao.textContent = mensagem; }, 30);
}

function linhas(texto) {
  return String(texto || "").split("\n").map(l => l.trim()).filter(Boolean).slice(0, MAX_ITENS);
}

function plural(n, singular, pluralTexto) { return `${n} ${n === 1 ? singular : pluralTexto}`; }

const Datas = {
  paraISO(data) {
    const a = data.getFullYear();
    const m = String(data.getMonth() + 1).padStart(2, "0");
    const d = String(data.getDate()).padStart(2, "0");
    return `${a}-${m}-${d}`;
  },
  /** Data local (corrige a v1, que usava toISOString e virava o dia às 21h no horário de Brasília). */
  hoje() { return Datas.paraISO(new Date()); },
  valida(iso) { return typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso); },
  somarDias(iso, dias) {
    const [a, m, d] = (Datas.valida(iso) ? iso : Datas.hoje()).split("-").map(Number);
    const data = new Date(a, m - 1, d);
    data.setDate(data.getDate() + dias);
    return Datas.paraISO(data);
  },
  formatar(iso) {
    if (!Datas.valida(iso)) return "Sem data";
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  },
  rotulo(iso) {
    const hoje = Datas.hoje();
    if (iso === hoje) return "Hoje";
    if (iso === Datas.somarDias(hoje, 1)) return "Amanhã";
    if (iso === Datas.somarDias(hoje, -1)) return "Ontem";
    const [a, m, d] = iso.split("-").map(Number);
    const semana = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][new Date(a, m - 1, d).getDay()];
    return `${semana}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  }
};

// ─── MODELO ──────────────────────────────────────────────────────────────────
class Etapa {
  constructor(texto, feita = false) {
    this.texto = String(texto || "").trim().slice(0, 60);
    this.feita = Boolean(feita);
  }
  alternar() { this.feita = !this.feita; }
}

class Tarefa {
  constructor(dados = {}) {
    this.id = dados.id || Tarefa.novoId();
    this.nome = String(dados.nome || "").trim().slice(0, 40);
    this.icone = Tarefa.normalizarIcone(dados.icone);
    this.data = Datas.valida(dados.data) ? dados.data : Datas.hoje();
    this.periodo = PERIODOS[dados.periodo] ? dados.periodo : "morning";
    this.dificuldade = DIFICULDADES[dados.dificuldade] ? dados.dificuldade : "easy";
    this.dica = String(dados.dica || "").trim().slice(0, 120);
    this.etapas = (Array.isArray(dados.etapas) ? dados.etapas : [])
      .map(e => (typeof e === "string" ? new Etapa(e) : new Etapa(e.texto, e.feita)))
      .filter(e => e.texto).slice(0, MAX_ITENS);
    this.opcoes = (Array.isArray(dados.opcoes) ? dados.opcoes : [])
      .map(o => String(o).trim().slice(0, 60)).filter(Boolean).slice(0, MAX_ITENS);
    this.opcaoEscolhida = Number.isInteger(dados.opcaoEscolhida) && dados.opcaoEscolhida >= 0 &&
      dados.opcaoEscolhida < this.opcoes.length ? dados.opcaoEscolhida : null;
    this.participaRecompensa = dados.participaRecompensa !== false;
    this.status = STATUS[dados.status] ? dados.status : "todo";
  }

  /** Aceita a chave de um ícone ou um emoji das versões anteriores. */
  static normalizarIcone(valor) {
    if (ICONES.some(([chave]) => chave === valor)) return valor;
    const emoji = String(valor || "").replace(/\uFE0F/g, "");
    return EMOJI_PARA_ICONE[emoji] || "estrela";
  }

  static novoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /** Regra de negócio: o nome é obrigatório. Retorna a mensagem de erro ou null. */
  static validarNome(nome) {
    return String(nome || "").trim() ? null : "Escreva o nome da tarefa para poder salvar.";
  }

  mudarStatus(novoStatus) {
    if (!STATUS[novoStatus]) throw new Error(`Status inválido: ${novoStatus}`);
    const anterior = this.status;
    this.status = novoStatus;
    return anterior;
  }

  alternarEtapa(indice) { if (this.etapas[indice]) this.etapas[indice].alternar(); }
  escolherOpcao(indice) { this.opcaoEscolhida = indice >= 0 && indice < this.opcoes.length ? indice : null; }
  etapasFeitas() { return this.etapas.filter(e => e.feita).length; }

  /** A pontuação vem das etapas marcadas pela criança, sem exigir conclusão. */
  avaliacao() {
    const total = this.etapas.length;
    const feitas = this.etapasFeitas();
    const restantes = total - feitas;
    const completa = total ? restantes === 0 : this.status === "done";
    const estrelas = completa ? 5 : total ? Math.min(4, Math.ceil(feitas / total * 5)) : 0;
    const estado = completa ? "feliz" : this.status === "doing" ? "serio" : "triste";
    return { total, feitas, restantes, completa, estrelas, estado };
  }

  /** Cria uma cópia para outro dia (repetição da rotina, como em um novo ciclo/sprint). */
  duplicar(dias) {
    return new Tarefa({
      nome: this.nome, icone: this.icone, periodo: this.periodo, dificuldade: this.dificuldade,
      dica: this.dica, opcoes: [...this.opcoes], participaRecompensa: this.participaRecompensa, data: Datas.somarDias(this.data, dias), status: "todo",
      etapas: this.etapas.map(e => ({ texto: e.texto, feita: false }))
    });
  }

  textoParaLeitura() {
    const partes = [this.nome + "."];
    if (this.dica) partes.push("Dica: " + this.dica);
    if (this.etapas.length) partes.push("Etapas: " + this.etapas.map((e, i) => `${i + 1}, ${e.texto}`).join(". ") + ".");
    if (this.opcoes.length) partes.push("Você pode escolher: " + this.opcoes.join(", ou ") + ".");
    return partes.join(" ");
  }
}

// ─── PERSISTÊNCIA ────────────────────────────────────────────────────────────
class RepositorioTarefas {
  constructor(armazenamento) {
    this.armazenamento = armazenamento;
    this.chave = "maa_v2_tarefas";
    this.chaveVersaoAnterior = "maa_tasks";
  }

  /** Usa o localStorage; se o navegador bloquear, guarda só na memória (os dados somem ao fechar). */
  static armazenamentoSeguro() {
    try {
      const teste = "__maa_teste__";
      window.localStorage.setItem(teste, teste);
      window.localStorage.removeItem(teste);
      return window.localStorage;
    } catch (erro) {
      const memoria = new Map();
      return {
        persistente: false,
        getItem: chave => (memoria.has(chave) ? memoria.get(chave) : null),
        setItem: (chave, valor) => memoria.set(chave, String(valor)),
        removeItem: chave => memoria.delete(chave)
      };
    }
  }

  lerJSON(chave) {
    try {
      const bruto = this.armazenamento.getItem(chave);
      return bruto ? JSON.parse(bruto) : null;
    } catch (erro) {
      return null;
    }
  }

  carregar() {
    const atuais = this.lerJSON(this.chave);
    if (Array.isArray(atuais)) return atuais.map(d => new Tarefa(d));
    const antigas = this.lerJSON(this.chaveVersaoAnterior);
    if (Array.isArray(antigas)) {
      const migradas = antigas.map(RepositorioTarefas.migrarDaVersao1);
      this.salvar(migradas);
      return migradas;
    }
    const exemplo = RepositorioTarefas.tarefasExemplo();
    this.salvar(exemplo);
    return exemplo;
  }

  salvar(tarefas) {
    try {
      this.armazenamento.setItem(this.chave, JSON.stringify(tarefas));
      return true;
    } catch (erro) {
      return false;
    }
  }

  static migrarDaVersao1(antiga) {
    return new Tarefa({
      id: antiga.id, nome: antiga.name, icone: antiga.icon, data: antiga.date, periodo: antiga.period,
      dificuldade: antiga.diff, dica: antiga.obs, status: antiga.status
    });
  }

  static tarefasExemplo() {
    const hoje = Datas.hoje();
    const m = MODELOS;
    return [
      new Tarefa({ ...m.dentes, data: hoje }),
      new Tarefa({ nome: "Vestir a roupa", icone: "roupa", periodo: "morning", dificuldade: "easy", dica: "Lembre de colocar as meias!", data: hoje }),
      new Tarefa({ nome: "Tomar o café", icone: "cafe", periodo: "morning", dificuldade: "easy", status: "done", data: hoje }),
      new Tarefa({ ...m.mochila, data: hoje }),
      new Tarefa({ nome: "Fazer o dever de casa", icone: "livros", periodo: "afternoon", dificuldade: "hard", dica: "Matemática: página 14.", data: hoje }),
      new Tarefa({ nome: "Hora do lanche", icone: "fruta", periodo: "afternoon", dificuldade: "easy", data: hoje }),
      new Tarefa({ ...m.banho, data: hoje }),
      new Tarefa({ ...m.leitura, data: hoje }),
      new Tarefa({ nome: "Hora de dormir", icone: "dormir", periodo: "night", dificuldade: "medium", dica: "Desligue a televisão e apague a luz.", data: hoje })
    ];
  }
}

// ─── RECOMPENSAS ─────────────────────────────────────────────────────────────
class SistemaRecompensas {
  constructor(armazenamento) {
    this.armazenamento = armazenamento;
    this.chave = "maa_v2_recompensas";
    let dados = {};
    try { dados = JSON.parse(armazenamento.getItem(this.chave) || "{}") || {}; } catch (erro) { dados = {}; }
    this.estrelasGanhas = Math.max(0, parseInt(dados.estrelasGanhas, 10) || 0);
    this.estrelasUsadas = Math.max(0, parseInt(dados.estrelasUsadas, 10) || 0);
    this.premiosEntregues = Math.max(0, parseInt(dados.premiosEntregues, 10) || 0);
    this.meta = SistemaRecompensas.metaValida(dados.meta) ? Number(dados.meta) : 5;
    this.premio = String(dados.premio || "15 minutos de brincadeira livre").slice(0, 60);
  }

  static metaValida(valor) { const n = Number(valor); return Number.isInteger(n) && n >= 1 && n <= 30; }

  saldo() { return Math.max(0, this.estrelasGanhas - this.estrelasUsadas); }
  faltam() { return Math.max(0, this.meta - this.saldo()); }
  metaAtingida() { return this.saldo() >= this.meta; }

  /** Cada tarefa que entra em "Feito" vale 1 estrela; se voltar, a estrela é retirada. */
  registrarMudanca(statusAnterior, novoStatus) {
    let delta = 0;
    if (novoStatus === "done" && statusAnterior !== "done") delta = 1;
    else if (statusAnterior === "done" && novoStatus !== "done") delta = -1;
    if (delta) {
      this.estrelasGanhas = Math.max(0, this.estrelasGanhas + delta);
      this.salvar();
    }
    return delta;
  }

  configurar(meta, premio) {
    if (!SistemaRecompensas.metaValida(meta)) return "A meta deve ser um número inteiro de 1 a 30.";
    const texto = String(premio || "").trim();
    if (!texto) return "Escreva qual é o prêmio combinado.";
    this.meta = Number(meta);
    this.premio = texto.slice(0, 60);
    this.salvar();
    return null;
  }

  podeEntregar() {
    return this.metaAtingida() && typeof this.rotinaCompleta === "function" && this.rotinaCompleta();
  }

  entregarPremio() {
    if (!this.podeEntregar()) return false;
    this.estrelasUsadas += this.meta;
    this.premiosEntregues += 1;
    this.salvar();
    return true;
  }

  salvar() {
    try {
      this.armazenamento.setItem(this.chave, JSON.stringify({
        estrelasGanhas: this.estrelasGanhas, estrelasUsadas: this.estrelasUsadas,
        premiosEntregues: this.premiosEntregues, meta: this.meta, premio: this.premio
      }));
    } catch (erro) { /* sem persistência disponível */ }
  }
}

// ─── PREFERÊNCIAS E VOZ ──────────────────────────────────────────────────────
class Preferencias {
  static PADRAO = { vozAtiva: true, umaPorVez: true, animacoesAtivas: false, mostrarDificuldade: false };

  constructor(armazenamento) {
    this.armazenamento = armazenamento;
    this.chave = "maa_v2_preferencias";
    let dados = {};
    try { dados = JSON.parse(armazenamento.getItem(this.chave) || "{}") || {}; } catch (erro) { dados = {}; }
    for (const [nome, padrao] of Object.entries(Preferencias.PADRAO)) {
      this[nome] = typeof dados[nome] === "boolean" ? dados[nome] : padrao;
    }
  }

  definir(nome, valor) {
    if (!(nome in Preferencias.PADRAO)) return;
    this[nome] = Boolean(valor);
    try {
      const dados = {};
      for (const chave of Object.keys(Preferencias.PADRAO)) dados[chave] = this[chave];
      this.armazenamento.setItem(this.chave, JSON.stringify(dados));
    } catch (erro) { /* sem persistência disponível */ }
  }
}

class LeitorVoz {
  constructor(sintese = window.speechSynthesis) { this.sintese = sintese || null; }
  disponivel() { return Boolean(this.sintese && typeof window.SpeechSynthesisUtterance === "function"); }
  falar(texto) {
    if (!this.disponivel() || !texto) return false;
    this.sintese.cancel();
    const fala = new window.SpeechSynthesisUtterance(texto);
    fala.lang = "pt-BR";
    fala.rate = 0.9;
    const voz = (this.sintese.getVoices() || []).find(v => (v.lang || "").toLowerCase().startsWith("pt"));
    if (voz) fala.voice = voz;
    this.sintese.speak(fala);
    return true;
  }
}

// ─── REGRAS DE NEGÓCIO ───────────────────────────────────────────────────────
class GerenciadorRotina {
  constructor(repositorio, recompensas) {
    this.repositorio = repositorio;
    this.recompensas = recompensas;
    this.tarefas = repositorio.carregar();
    this.recompensas.rotinaCompleta = () => this.progressoDoDia(Datas.hoje()).completa;

  }

  salvar() { return this.repositorio.salvar(this.tarefas); }
  buscar(id) { return this.tarefas.find(t => t.id === id) || null; }
  valeCredito(tarefa) { return tarefa.participaRecompensa && tarefa.status === "done" && tarefa.avaliacao().completa; }
  ajustarCredito(antes, depois) {
    return antes === depois ? 0 : this.recompensas.registrarMudanca(antes ? "done" : "todo", depois ? "done" : "todo");
  }

  adicionar(dados) {
    const erro = Tarefa.validarNome(dados.nome);
    if (erro) return { erro };
    const tarefa = new Tarefa({ ...dados, id: undefined, status: "todo" });
    this.tarefas.push(tarefa);
    this.salvar();
    return { tarefa };
  }

  atualizar(id, dados) {
    const tarefa = this.buscar(id);
    if (!tarefa) return { erro: "Tarefa não encontrada." };
    const erro = Tarefa.validarNome(dados.nome);
    if (erro) return { erro };
    const etapas = (dados.etapas || []).map((texto, i) => ({
      texto, feita: Boolean(tarefa.etapas[i] && tarefa.etapas[i].texto === texto && tarefa.etapas[i].feita)
    }));
    const mesmasOpcoes = JSON.stringify(dados.opcoes || []) === JSON.stringify(tarefa.opcoes);
    const creditadaAntes = this.valeCredito(tarefa);
    const atualizada = new Tarefa({
      ...dados, participaRecompensa: dados.participaRecompensa ?? tarefa.participaRecompensa, id: tarefa.id, status: tarefa.status, etapas,
      opcaoEscolhida: mesmasOpcoes ? tarefa.opcaoEscolhida : null
    });
    Object.assign(tarefa, atualizada);
    this.ajustarCredito(creditadaAntes, this.valeCredito(tarefa));
    this.salvar();
    return { tarefa };
  }

  remover(id) {
    const antes = this.tarefas.length;
    this.tarefas = this.tarefas.filter(t => t.id !== id);
    if (this.tarefas.length === antes) return false;
    this.salvar();
    return true;
  }

  mudarStatus(id, novoStatus) {
    const tarefa = this.buscar(id);
    if (!tarefa || !ORDEM_STATUS.includes(novoStatus)) return null;
    const creditadaAntes = this.valeCredito(tarefa);
    const anterior = tarefa.mudarStatus(novoStatus);
    const estrelas = this.ajustarCredito(creditadaAntes, this.valeCredito(tarefa));
    this.salvar();
    return { tarefa, anterior, estrelas, metaAtingida: estrelas > 0 && tarefa.data === Datas.hoje() && this.recompensas.podeEntregar() };
  }

  alternarEtapa(id, indice) {
    const tarefa = this.buscar(id);
    if (!tarefa) return null;
    const creditadaAntes = this.valeCredito(tarefa);
    tarefa.alternarEtapa(indice);
    this.ajustarCredito(creditadaAntes, this.valeCredito(tarefa));
    this.salvar();
    return tarefa;
  }

  escolherOpcao(id, indice) {
    const tarefa = this.buscar(id);
    if (!tarefa) return null;
    tarefa.escolherOpcao(indice);
    this.salvar();
    return tarefa;
  }

  duplicar(id, dias) {
    const tarefa = this.buscar(id);
    if (!tarefa) return null;
    const copia = tarefa.duplicar(dias);
    this.tarefas.push(copia);
    this.salvar();
    return copia;
  }

  duplicarVarias(lista, dias) {
    const copias = lista.map(t => t.duplicar(dias));
    this.tarefas.push(...copias);
    this.salvar();
    return copias;
  }

  removerConcluidas(lista) {
    const ids = new Set(lista.filter(t => t.status === "done" && t.avaliacao().completa).map(t => t.id));
    this.tarefas = this.tarefas.filter(t => !ids.has(t.id));
    this.salvar();
    return ids.size;
  }

  /** Filtra por período e dia e ordena manhã → tarde → noite, para a rotina seguir uma sequência previsível. */
  filtrar({ periodo = "all", data = null } = {}) {
    return this.tarefas
      .filter(t => (periodo === "all" || t.periodo === periodo) && (!data || t.data === data))
      .map((t, i) => [t, i])
      .sort((a, b) => (a[0].data || "").localeCompare(b[0].data || "") ||
        ORDEM_PERIODOS.indexOf(a[0].periodo) - ORDEM_PERIODOS.indexOf(b[0].periodo) || a[1] - b[1])
      .map(([t]) => t);
  }

  /** Limite de trabalho em andamento do Kanban: retorna a tarefa que já está em "Fazendo" no mesmo dia. */
  tarefaEmAndamento(data, ignorarId = null) {
    return this.tarefas.find(t => t.status === "doing" && t.data === data && t.id !== ignorarId) || null;
  }

  definirParticipacaoRecompensa(id, participa) {
    const tarefa = this.buscar(id);
    if (!tarefa) return false;
    const creditadaAntes = this.valeCredito(tarefa);
    tarefa.participaRecompensa = Boolean(participa);
    this.ajustarCredito(creditadaAntes, this.valeCredito(tarefa));
    this.salvar();
    return true;
  }

  progressoDoDia(data) {
    const lista = this.filtrar({ data }).filter(t => t.participaRecompensa);
    const total = lista.length;
    const done = lista.filter(t => t.status === "done" && t.etapas.every(e => e.feita)).length;
    const completa = total > 0 && done === total;
    const estrelas = completa ? 5 : done === 0 ? 0 : Math.min(4, Math.ceil(done / total * 5));
    const estado = !total ? "vazio" : completa ? "feliz" : done === 0 ? "triste" : "serio";
    return { total, done, estrelas, estado, completa };
  }

  resumo(lista) {
    const contagem = { total: lista.length, todo: 0, doing: 0, help: 0, done: 0 };
    lista.forEach(t => { contagem[t.status] += 1; });
    contagem.completas = lista.filter(t => t.avaliacao().completa).length;
    contagem.encerradasParciais = lista.filter(t => t.status === "done" && !t.avaliacao().completa).length;
    contagem.percentual = lista.length ? Math.round((contagem.completas / lista.length) * 100) : 0;
    return contagem;
  }
}

// ─── DIÁLOGOS ACESSÍVEIS ─────────────────────────────────────────────────────
class Dialogo {
  constructor(overlay) {
    this.overlay = overlay;
    this.origem = null;
    this.aoFechar = null;
    this.tratarTecla = this.tratarTecla.bind(this);
  }

  estaAberto() { return !this.overlay.hidden; }

  abrir(focoInicial = null, aoFechar = null) {
    this.origem = document.activeElement;
    this.aoFechar = aoFechar;
    this.overlay.hidden = false;
    document.addEventListener("keydown", this.tratarTecla);
    const alvo = focoInicial || this.focaveis()[0];
    if (alvo) alvo.focus();
  }

  fechar({ devolverFoco = true } = {}) {
    if (!this.estaAberto()) return;
    this.overlay.hidden = true;
    document.removeEventListener("keydown", this.tratarTecla);
    if (devolverFoco && this.origem && document.contains(this.origem)) this.origem.focus();
    const callback = this.aoFechar;
    this.aoFechar = null;
    if (callback) callback();
  }

  focaveis() {
    return $$("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex=\"0\"]", this.overlay)
      .filter(e => e.tabIndex >= 0 && !e.closest("[hidden]"));
  }

  /** Esc fecha; Tab e Shift+Tab ficam presos dentro da janela. */
  tratarTecla(evento) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      this.fechar();
      return;
    }
    if (evento.key !== "Tab") return;
    const lista = this.focaveis();
    if (!lista.length) return;
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    if (!this.overlay.contains(document.activeElement)) {
      evento.preventDefault();
      primeiro.focus();
    } else if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }
}

class Comemoracao {
  constructor(preferencias) {
    this.preferencias = preferencias;
    this.dialogo = new Dialogo($("#celebration"));
    this.tarefaConvite = null;
    $("#continuar-sim").addEventListener("click", () => this.responderConvite(true));
    $("#continuar-nao").addEventListener("click", () => this.responderConvite(false));
    $("#fechar-comemoracao").addEventListener("click", () => this.fechar());
    $("#celebration").addEventListener("click", e => { if (e.target.id === "celebration") this.fechar(); });
  }

  preparar(tarefa) {
    const avaliacao = tarefa.avaliacao();
    $("#cel-emoji use").setAttribute("href", `#mascote-${avaliacao.estado}`);
    const medidor = $("#cel-stars");
    medidor.setAttribute("aria-label", `${avaliacao.estrelas} de 5 estrelas nesta atividade. ${5 - avaliacao.estrelas} estrelas restantes.`);
    medidor.replaceChildren(estrelas(5, avaliacao.estrelas, "cel-stars-row"));
    $("#cel-reward").hidden = false;
    return avaliacao;
  }

  mostrarConvite(tarefa) {
    const avaliacao = this.preparar(tarefa);
    this.tarefaConvite = tarefa.id;
    $("#cel-emoji use").setAttribute("href", "#mascote-triste");
    $("#cel-title").textContent = tarefa.nome;
    const texto = `${avaliacao.restantes === 1 ? "Falta" : "Faltam"} ${plural(avaliacao.restantes, "etapa", "etapas")} para ficar com 5 estrelas nesta atividade. Vamos continuar?`;
    $("#cel-msg").textContent = texto;
    $("#cel-reward").textContent = `${avaliacao.estrelas} de 5 estrelas. Você escolhe se quer continuar agora.`;
    $("#escolha-continuar").hidden = false;
    $("#fechar-comemoracao").hidden = true;
    this.dialogo.abrir($("#continuar-sim"));
    if (this.preferencias.vozAtiva && this.leitor) this.leitor.falar(texto);
  }

  responderConvite(continuar) {
    const id = this.tarefaConvite;
    this.tarefaConvite = null;
    this.dialogo.fechar({ devolverFoco: false });
    if (id && this.aoResponder) this.aoResponder(id, continuar);
  }

  mostrar(tarefa, recompensas, metaAtingida) {
    const avaliacao = this.preparar(tarefa);
    this.tarefaConvite = null;
    $("#escolha-continuar").hidden = true;
    $("#fechar-comemoracao").hidden = false;
    $("#cel-title").textContent = avaliacao.completa ? "Você conseguiu!" : "Tudo bem por agora";
    $("#cel-msg").textContent = avaliacao.completa
      ? `Você ficou com 5 estrelas em ${tarefa.nome}!`
      : `Seu progresso em ${tarefa.nome} está guardado. Você pode continuar quando quiser.`;
    $("#cel-reward").textContent = metaAtingida
      ? `O prêmio combinado está disponível: ${recompensas.premio}.`
      : `${avaliacao.estrelas} de 5 estrelas nesta atividade.`;
    this.dialogo.abrir($("#fechar-comemoracao"));
    if (avaliacao.completa && this.preferencias.animacoesAtivas && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) this.lancarConfete();
  }

  fechar() { this.dialogo.fechar(); }

  lancarConfete() {
    const cores = ["#C7E2FA", "#FFD2B8", "#FBC9DD", "#BDEBD0", "#FFE59A", "#DCCFF7"];
    for (let i = 0; i < 24; i += 1) {
      const p = el("div", { class: "confetti-particle", "aria-hidden": "true" });
      p.style.left = `${Math.random() * 100}vw`;
      p.style.width = `${6 + Math.random() * 8}px`;
      p.style.height = `${6 + Math.random() * 8}px`;
      p.style.background = cores[Math.floor(Math.random() * cores.length)];
      p.style.animationDuration = `${1.5 + Math.random() * 2}s`;
      p.style.animationDelay = `${Math.random() * 0.6}s`;
      document.body.appendChild(p);
      p.addEventListener("animationend", () => p.remove());
      setTimeout(() => p.remove(), 4500); // garante a remoção mesmo se as animações forem desligadas
    }
  }
}

// ─── ÁREA DA CRIANÇA ─────────────────────────────────────────────────────────
class QuadroKanban {
  static VAZIO = {
    todo: "Tudo começado! Veja as outras colunas.",
    doing: "Escolha uma tarefa em A Fazer e aperte Começar.",
    help: "Ninguém está esperando ajuda.",
    done: "As tarefas terminadas aparecem aqui."
  };

  constructor(gerenciador, recompensas, preferencias, leitor, comemoracao) {
    this.gerenciador = gerenciador;
    this.recompensas = recompensas;
    this.preferencias = preferencias;
    this.leitor = leitor;
    this.comemoracao = comemoracao;
    this.periodo = "all";
    this.data = Datas.hoje();
    this.comemoracao.aoResponder = (id, continuar) => this.responderContinuidade(id, continuar);
    this.ligarEventos();
  }

  ligarEventos() {
    $$("#child-periods .period-tab").forEach(botao => botao.addEventListener("click", () => {
      this.periodo = botao.dataset.period;
      $$("#child-periods .period-tab").forEach(b => {
        b.classList.toggle("active", b === botao);
        b.setAttribute("aria-pressed", String(b === botao));
      });
      this.renderizar();
    }));
    $("#dia-anterior").addEventListener("click", () => this.mudarDia(-1));
    $("#dia-seguinte").addEventListener("click", () => this.mudarDia(1));
    $("#dia-hoje").addEventListener("click", () => { this.data = Datas.hoje(); this.renderizar(); });

    const quadro = $(".kanban-board");
    quadro.addEventListener("click", evento => {
      const botao = evento.target.closest("button[data-acao]");
      if (!botao) return;
      const id = botao.closest(".task-card").dataset.id;
      if (botao.dataset.acao === "status") this.mover(id, botao.dataset.status);
      if (botao.dataset.acao === "ouvir") this.ouvir(id);
    });
    quadro.addEventListener("change", evento => {
      const campo = evento.target;
      const cartao = campo.closest(".task-card");
      if (!cartao) return;
      if (campo.dataset.acao === "etapa") this.marcarEtapa(cartao, Number(campo.dataset.indice));
      if (campo.dataset.acao === "opcao") this.escolherOpcao(cartao, Number(campo.value));
    });
  }

  mudarDia(dias) {
    this.data = Datas.somarDias(this.data, dias);
    this.renderizar();
    anunciar(`Mostrando as tarefas de ${Datas.rotulo(this.data)}.`);
  }

  renderizar(focarId = null) {
    const lista = this.gerenciador.filtrar({ periodo: this.periodo, data: this.data });
    const proxima = lista.find(t => t.status === "todo");
    this.proximaId = proxima ? proxima.id : null;
    ORDEM_STATUS.forEach(status => {
      const coluna = $(`#col-${status}`);
      const corpo = $(".col-body", coluna);
      const itens = lista.filter(t => t.status === status);
      $(`#cnt-${status}`).textContent = itens.length;
      corpo.replaceChildren(...(itens.length
        ? itens.map(t => this.criarCartao(t))
        : [el("p", { class: "empty-state", text: QuadroKanban.VAZIO[status] })]));
    });
    this.renderizarResumo();
    if (focarId) {
      const cartao = $(`.task-card[data-id="${CSS.escape(focarId)}"]`);
      if (cartao) cartao.focus();
    }
  }

  renderizarResumo() {
    const [ano, mes, dia] = this.data.split("-").map(Number);
    const dataObj = new Date(ano, mes - 1, dia);
    $("#cal-semana").textContent = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][dataObj.getDay()];
    $("#cal-dia").textContent = String(dia);
    $("#cal-mes").textContent = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][mes - 1];
    $("#dia-rotulo").textContent = Datas.rotulo(this.data);
    $("#dia-hoje").hidden = this.data === Datas.hoje();
    const doDia = this.gerenciador.filtrar({ data: this.data });
    $("#mascote-fala").textContent = this.falaDaMascote(doDia);
    const r = this.gerenciador.resumo(doDia);
    $("#crianca-progresso-texto").textContent = r.total
      ? `${r.completas} de ${plural(r.total, "atividade completa", "atividades completas")}`
      : "Nenhuma tarefa neste dia";
    const trilha = $("#crianca-progresso");
    trilha.setAttribute("aria-label", `${r.completas} de ${r.total} atividades completas`);
    trilha.replaceChildren(...doDia.map(t => el("span", { class: `trail-dot ${t.status} ${t.status === "done" && !t.avaliacao().completa ? "partial" : ""}`, title: t.nome })));
    const ativa = doDia.find(t => t.status === "doing") || doDia.find(t => !t.avaliacao().completa) || doDia[0];
    const estado = ativa ? ativa.avaliacao().estado : "vazio";
    $("#crianca-estrelas").replaceChildren(el("span", { class: "pot-text" },
      el("strong", { text: "Até 5 estrelas em cada atividade" }),
      el("span", { class: "daily-hint", text: "Marque as etapas no seu ritmo. Você pode parar e continuar depois." })));
    $(".hello-mascot use").setAttribute("href", `#mascote-${estado}`);
    $(".hello-mascot").dataset.estado = estado;

  }

  /** A mascote orienta a criança sobre o que fazer agora (reforça a sequência previsível). */
  falaDaMascote(doDia) {
    if (!doDia.length) return "Hoje não tem tarefas. Que tal descansar?";
    const fazendo = doDia.find(t => t.status === "doing");
    if (fazendo) return `Você está fazendo: ${fazendo.nome}. Quando acabar, aperte Terminei!`;
    const ajuda = doDia.find(t => t.status === "help");
    if (ajuda) return `Um adulto já sabe que você precisa de ajuda com: ${ajuda.nome}.`;
    const proxima = doDia.find(t => t.status === "todo");
    if (proxima) return `Oi! A próxima tarefa é: ${proxima.nome}. Vamos começar?`;
    if (doDia.some(t => !t.avaliacao().completa)) return "Seu progresso está guardado. Você pode continuar quando quiser.";
    return "Você completou todas as etapas do dia. Muito bem!";
  }

  criarCartao(t) {
    const idNome = `nome-${t.id}`;
    const detalhado = t.status === "doing" || t.status === "help";
    const avaliacao = t.avaliacao();
    const cartao = el("article", {
      class: `task-card ${t.status} ${t.status === "done" && !avaliacao.completa ? "partial" : ""} ${detalhado ? "detail" : "compact"}`, tabindex: "-1", "data-id": t.id, "aria-labelledby": idNome
    });
    const chips = [];
    if (t.participaRecompensa) chips.push(el("span", { class: "chip reward-chip" }, ico("i-presente"), "Vale recompensa"));
    const ehProxima = t.id === this.proximaId;
    if (ehProxima) chips.push(el("span", { class: "chip next" }, ico("i-estrela-cheia"), "Próxima"));
    if (this.periodo === "all") chips.push(el("span", { class: "chip" }, ico(PERIODO_ICONE[t.periodo]), PERIODOS[t.periodo]));
    if (this.preferencias.mostrarDificuldade) chips.push(el("span", { class: `chip diff-${t.dificuldade}` }, ico("i-nivel"), DIFICULDADES[t.dificuldade]));
    if (t.etapas.length && !detalhado) chips.push(el("span", { class: "chip" }, ico("i-etapas"), `${t.etapasFeitas()} de ${t.etapas.length} etapas`));
    if (t.opcaoEscolhida !== null && !detalhado) chips.push(el("span", { class: "chip" }, ico("t-livros"), t.opcoes[t.opcaoEscolhida]));

    cartao.append(el("div", { class: "task-head" },
      el("span", { class: "task-icon", "aria-hidden": "true" }, figura(t.icone),
        t.status === "done" && avaliacao.completa ? el("span", { class: "done-badge" }, ico("i-check")) : null),
      el("div", { class: "task-title" },
        el("h3", { class: "task-name", id: idNome, text: t.nome }),
        chips.length ? el("div", { class: "task-meta" }, chips) : null)));

    cartao.append(this.criarPontuacao(t));

    if (detalhado && t.dica) cartao.append(el("p", { class: "task-tip" }, ico("i-dica"), el("span", { text: t.dica })));
    if (t.etapas.length && detalhado) cartao.append(this.criarEtapas(t));
    if (t.opcoes.length && detalhado) cartao.append(this.criarOpcoes(t));
    cartao.append(el("p", { class: "task-notice", role: "status", hidden: true }));

    const [principais, secundarios] = t.status === "done" && !avaliacao.completa
      ? [[["doing", "Continuar", "btn-doing", "i-play"]], []]
      : this.botoesDeStatus(t.status);
    const bloqueada = t.status === "todo" && this.preferencias.umaPorVez && this.gerenciador.tarefaEmAndamento(t.data, t.id);
    const acoes = el("div", { class: "task-actions" });
    principais.forEach(([status, rotulo, classe, icone]) => {
      const suave = t.status === "todo" && !ehProxima ? " btn-soft" : "";
      acoes.append(el("button", {
        type: "button", class: `act-btn ${classe}${suave}`, "data-acao": "status", "data-status": status, "aria-describedby": idNome,
        "aria-disabled": bloqueada && status === "doing" ? "true" : null
      }, ico(icone), rotulo));
    });
    secundarios.forEach(([status, rotulo, classe, icone]) => {
      acoes.append(el("button", { type: "button", class: `act-btn ${classe || "btn-obs"} small`, "data-acao": "status", "data-status": status, "aria-describedby": idNome }, ico(icone), rotulo));
    });
    if (t.status !== "done" && this.preferencias.vozAtiva && this.leitor.disponivel()) {
      acoes.append(el("button", { type: "button", class: "act-btn btn-obs small", "data-acao": "ouvir", "aria-describedby": idNome }, ico("i-som"), "Ouvir"));
    }
    cartao.append(acoes);
    return cartao;
  }

  /** Retorna [ação principal, ações de apoio]: uma ação em destaque por vez reduz a sobrecarga. */
  botoesDeStatus(status) {
    const ajuda = ["help", "Pedir ajuda", "btn-help", "i-mao"];
    const voltar = ["todo", "Voltar", "btn-obs", "i-voltar"];
    return {
      todo: [[["doing", "Começar", "btn-doing", "i-play"]], [ajuda]],
      doing: [[["done", "Terminei", "btn-done", "i-check"]], [ajuda, voltar]],
      help: [[["doing", "Voltar a fazer", "btn-doing", "i-play"]], [["done", "Terminei", "btn-help-done", "i-check"], voltar]],
      done: [[], [["todo", "Fazer de novo", "btn-obs", "i-voltar"]]]
    }[status];
  }

  criarPontuacao(t) {
    const avaliacao = t.avaliacao();
    const rosto = ico(`mascote-${avaliacao.estado}`, "activity-mascot");
    rosto.setAttribute("viewBox", "0 0 120 120");
    const texto = avaliacao.completa ? "Todas as etapas feitas!" : t.etapas.length
      ? `${avaliacao.restantes === 1 ? "Falta" : "Faltam"} ${plural(avaliacao.restantes, "etapa", "etapas")} para 5 estrelas.`
      : "Quando terminar, marque a atividade como concluída.";
    return el("div", { class: "activity-score", "data-pontuacao": t.id, "data-estado": avaliacao.estado }, rosto,
      el("div", {},
        el("span", { class: "activity-stars", role: "img", "aria-label": `${avaliacao.estrelas} de 5 estrelas. ${5 - avaliacao.estrelas} estrelas restantes.` }, estrelas(5, avaliacao.estrelas, "activity-stars-row")),
        el("strong", { class: "activity-score-value", text: `${avaliacao.estrelas}/5` }),
        el("p", { class: "activity-score-hint", text: texto })));
  }

  criarEtapas(t) {
    const legenda = el("legend", { text: `Etapas: ${t.etapasFeitas()} de ${t.etapas.length}` });
    const grupo = el("fieldset", { class: "task-steps" }, legenda);
    t.etapas.forEach((etapa, i) => {
      grupo.append(el("label", { class: etapa.feita ? "checked" : "" },
        el("input", { type: "checkbox", checked: etapa.feita, "data-acao": "etapa", "data-indice": String(i) }),
        el("span", { text: etapa.texto })));
    });
    return grupo;
  }

  criarOpcoes(t) {
    const grupo = el("fieldset", { class: "task-options" }, el("legend", { text: "Escolha uma opção" }));
    t.opcoes.forEach((opcao, i) => {
      grupo.append(el("label", {},
        el("input", { type: "radio", name: `opcao-${t.id}`, value: String(i), checked: t.opcaoEscolhida === i, "data-acao": "opcao" }),
        el("span", { text: opcao })));
    });
    return grupo;
  }

  mover(id, novoStatus) {
    const tarefa = this.gerenciador.buscar(id);
    if (!tarefa) return;
    if (novoStatus === "done" && tarefa.avaliacao().restantes > 0) {
      this.comemoracao.mostrarConvite(tarefa);
      return;
    }
    const emAndamento = novoStatus === "doing" && this.preferencias.umaPorVez && this.gerenciador.tarefaEmAndamento(tarefa.data, id);
    if (emAndamento) {
      const cartao = $(`.task-card[data-id="${CSS.escape(id)}"]`);
      const aviso = cartao && $(".task-notice", cartao);
      const texto = `Uma tarefa por vez: primeiro termine "${emAndamento.nome}" ou peça ajuda.`;
      if (aviso) { aviso.hidden = false; aviso.textContent = texto; }
      anunciar(texto);
      return;
    }
    const resultado = this.gerenciador.mudarStatus(id, novoStatus);
    if (!resultado) return;
    if (resultado.erro) {
      const cartao = $(`.task-card[data-id="${CSS.escape(id)}"]`);
      const aviso = cartao && $(".task-notice", cartao);
      if (aviso) { aviso.hidden = false; aviso.textContent = resultado.erro; }
      anunciar(resultado.erro);
      return;
    }
    this.renderizar(id);
    anunciar(`${resultado.tarefa.nome}: agora em ${STATUS[novoStatus]}.`);
    if (novoStatus === "done" && resultado.anterior !== "done") {
      this.comemoracao.mostrar(resultado.tarefa, this.recompensas, resultado.metaAtingida);
    }
  }

  responderContinuidade(id, continuar) {
    const resultado = this.gerenciador.mudarStatus(id, continuar ? "doing" : "done");
    if (!resultado) return;
    this.renderizar(id);
    const mensagem = continuar ? "Vamos nessa!" : "Tudo bem. Seu progresso está guardado. Você pode continuar quando quiser.";
    $("#mascote-fala").textContent = mensagem;
    $(".hello-mascot use").setAttribute("href", `#mascote-${continuar ? "serio" : "triste"}`);
    $(".hello-mascot").dataset.estado = continuar ? "serio" : "triste";
    if (continuar && resultado.tarefa.etapas.length) {
      const primeira = $(`.task-card[data-id="${CSS.escape(id)}"] .task-steps input:not(:checked)`);
      if (primeira) primeira.focus();
    }
    anunciar(mensagem);
    if (this.preferencias.vozAtiva) this.leitor.falar(mensagem);
  }

  marcarEtapa(cartao, indice) {
    const tarefa = this.gerenciador.alternarEtapa(cartao.dataset.id, indice);
    if (!tarefa) return;
    const rotulos = $$(".task-steps label", cartao);
    rotulos.forEach((rotulo, i) => rotulo.classList.toggle("checked", tarefa.etapas[i].feita));
    $(".task-steps legend", cartao).textContent = `Etapas: ${tarefa.etapasFeitas()} de ${tarefa.etapas.length}`;
    const indicador = $(".activity-score", cartao);
    if (indicador) indicador.replaceWith(this.criarPontuacao(tarefa));
    this.renderizarResumo();
    if (tarefa.etapasFeitas() === tarefa.etapas.length) anunciar("Todas as etapas feitas! Agora aperte Terminei.");
  }

  escolherOpcao(cartao, indice) {
    const tarefa = this.gerenciador.escolherOpcao(cartao.dataset.id, indice);
    if (tarefa) anunciar(`Você escolheu: ${tarefa.opcoes[indice]}.`);
  }

  ouvir(id) {
    const tarefa = this.gerenciador.buscar(id);
    if (tarefa) this.leitor.falar(tarefa.textoParaLeitura());
  }
}

// ─── ÁREA DO ADULTO ──────────────────────────────────────────────────────────
class PainelAdulto {
  constructor(gerenciador, recompensas, preferencias, leitor) {
    this.gerenciador = gerenciador;
    this.recompensas = recompensas;
    this.preferencias = preferencias;
    this.leitor = leitor;
    this.periodo = "all";
    this.data = Datas.hoje();
    this.editandoId = null;
    this.iconeSelecionado = "estrela";
    this.acaoConfirmada = null;
    this.dialogoFormulario = new Dialogo($("#modal-overlay"));
    this.dialogoConfirmacao = new Dialogo($("#confirm-overlay"));
    this.preencherModelos();
    this.ligarEventos();
  }

  ligarEventos() {
    $("#abrir-cadastro").addEventListener("click", () => this.abrirFormulario());
    $("#cancelar-cadastro").addEventListener("click", () => this.dialogoFormulario.fechar());
    $("#form-tarefa").addEventListener("submit", e => this.salvarFormulario(e));
    $("#f-modelo").addEventListener("change", e => this.aplicarModelo(e.target.value));
    $("#f-name").addEventListener("input", () => this.mostrarErroNome(null));

    $$("#admin-periods .period-tab").forEach(botao => botao.addEventListener("click", () => {
      this.periodo = botao.dataset.period;
      $$("#admin-periods .period-tab").forEach(b => {
        b.classList.toggle("active", b === botao);
        b.setAttribute("aria-pressed", String(b === botao));
      });
      this.renderizar();
    }));
    $("#filtro-data").addEventListener("change", e => { this.data = e.target.value || null; this.renderizar(); });
    $("#limpar-data").addEventListener("click", () => { this.data = null; this.renderizar(); anunciar("Mostrando todas as datas."); });

    $("#copiar-amanha").addEventListener("click", () => this.repetirMostradas(1));
    $("#copiar-semana").addEventListener("click", () => this.repetirMostradas(7));
    $("#limpar-feitas").addEventListener("click", () => {
      const feitas = this.listaAtual().filter(t => t.status === "done" && t.avaliacao().completa);
      if (!feitas.length) { anunciar("Não há atividades completas na lista mostrada."); return; }
      this.confirmar(`Apagar ${plural(feitas.length, "atividade completa", "atividades completas")} da lista mostrada? As atividades com etapas pendentes continuam guardadas. As estrelas já ganhas continuam valendo.`, () => {
        const n = this.gerenciador.removerConcluidas(this.listaAtual());
        this.renderizar();
        anunciar(`${plural(n, "tarefa apagada", "tarefas apagadas")}.`);
      });
    });

    $("#admin-task-list").addEventListener("click", evento => {
      const botao = evento.target.closest("button[data-acao]");
      if (!botao) return;
      const id = botao.dataset.id;
      const acao = botao.dataset.acao;
      if (acao === "editar") this.abrirFormulario(id);
      if (acao === "excluir") this.excluir(id);
      if (acao === "dup1") this.duplicar(id, 1, botao);
      if (acao === "dup7") this.duplicar(id, 7, botao);
    });

    $("#confirm-sim").addEventListener("click", () => {
      const acao = this.acaoConfirmada;
      this.acaoConfirmada = null;
      this.dialogoConfirmacao.fechar({ devolverFoco: false });
      if (acao) acao();
      $("#abrir-cadastro").focus();
    });
    $("#confirm-nao").addEventListener("click", () => { this.acaoConfirmada = null; this.dialogoConfirmacao.fechar(); });

    $("#atividades-recompensa").addEventListener("change", e => {
      if (!e.target.matches("input[data-recompensa]")) return;
      const id = e.target.dataset.recompensa;
      const metaEmEdicao = $("#meta-estrelas").value;
      const premioEmEdicao = $("#premio").value;
      this.gerenciador.definirParticipacaoRecompensa(id, e.target.checked);
      this.renderizarRecompensas();
      $("#meta-estrelas").value = metaEmEdicao;
      $("#premio").value = premioEmEdicao;
      const escolha = $(`#atividades-recompensa input[data-recompensa="${CSS.escape(id)}"]`);
      if (escolha) escolha.focus();
      anunciar("Atividades da recompensa atualizadas.");
    });

    $("#salvar-recompensa").addEventListener("click", () => {
      const erro = this.recompensas.configurar(Number($("#meta-estrelas").value), $("#premio").value);
      anunciar(erro || "Meta de recompensa salva.");
      this.renderizarRecompensas();
    });
    $("#entregar-recompensa").addEventListener("click", () => {
      if (this.recompensas.entregarPremio()) anunciar(`Prêmio entregue: ${this.recompensas.premio}.`);
      this.renderizarRecompensas();
    });

    [["#pref-voz", "vozAtiva"], ["#pref-umapor", "umaPorVez"], ["#pref-animacoes", "animacoesAtivas"], ["#pref-dificuldade", "mostrarDificuldade"]]
      .forEach(([seletor, nome]) => $(seletor).addEventListener("change", e => {
        this.preferencias.definir(nome, e.target.checked);
        document.body.classList.toggle("sem-animacoes", !this.preferencias.animacoesAtivas);
        if (!this.preferencias.animacoesAtivas) $$(".confetti-particle").forEach(p => p.remove());
        anunciar("Preferência salva.");
      }));
  }

  listaAtual() { return this.gerenciador.filtrar({ periodo: this.periodo, data: this.data }); }

  renderizar(focarSeletor = null) {
    const lista = this.listaAtual();
    this.renderizarResumo(lista);
    this.renderizarAlertaAjuda();
    this.renderizarRecompensas();
    this.renderizarPreferencias();
    this.renderizarLista(lista);
    if (focarSeletor) { const alvo = $(focarSeletor); if (alvo) alvo.focus(); }
  }

  renderizarResumo(lista) {
    const r = this.gerenciador.resumo(lista);
    const escopoData = this.data ? Datas.formatar(this.data) : "todas as datas";
    const escopoPeriodo = this.periodo === "all" ? "todos os períodos" : PERIODOS[this.periodo].toLowerCase();
    $("#resumo-escopo").textContent = `Mostrando ${escopoData}, ${escopoPeriodo}.`;
    $("#filtro-data").value = this.data || "";
    $("#percentual").textContent = `${r.percentual}%`;
    $("#percentual-rotulo").textContent = r.total ? `${r.completas} de ${plural(r.total, "atividade completa", "atividades completas")}` : "Nenhuma tarefa neste filtro";
    const faixa = $("#faixa-status");
    faixa.setAttribute("aria-label", ORDEM_STATUS.map(st => `${STATUS[st]}: ${r[st]}`).join("; "));
    faixa.replaceChildren(...ORDEM_STATUS.filter(st => r[st] > 0).map(st =>
      el("span", { class: `seg ${st}`, style: `flex-grow:${r[st]}` })));
    $("#stats-row").replaceChildren(...[["Total", r.total, "total"], ...ORDEM_STATUS.map(st => [STATUS[st], r[st], st])].map(([rotulo, valor, classe]) =>
      el("li", { class: `stat ${classe}`, "data-stat": rotulo }, el("span", { class: "stat-num", text: String(valor) }), el("span", { class: "stat-label", text: rotulo }))));
  }

  renderizarAlertaAjuda() {
    const pedidos = this.gerenciador.tarefas.filter(t => t.status === "help");
    const alerta = $("#alerta-ajuda");
    alerta.hidden = pedidos.length === 0;
    alerta.replaceChildren(...(pedidos.length
      ? [ico("i-mao"), `${plural(pedidos.length, "tarefa pede", "tarefas pedem")} ajuda: ${pedidos.map(t => `${t.nome} (${Datas.formatar(t.data)})`).join(", ")}.`]
      : []));
  }

  renderizarRecompensas() {
    const r = this.recompensas;
    $("#saldo-estrelas").textContent = `${plural(r.saldo(), "estrela", "estrelas")} de ${r.meta}. Prêmios entregues: ${r.premiosEntregues}.`;
    $("#meta-estrelas").value = r.meta;
    $("#premio").value = r.premio;
    $("#entregar-recompensa").disabled = !r.podeEntregar();
    const tarefasHoje = this.gerenciador.filtrar({ data: Datas.hoje() });
    $("#atividades-recompensa").replaceChildren(...(tarefasHoje.length ? tarefasHoje.map(t =>
      el("label", { class: "reward-task-choice" },
        el("input", { type: "checkbox", checked: t.participaRecompensa, "data-recompensa": t.id }),
        el("span", {}, el("strong", { text: t.nome }), el("small", { text: `${PERIODOS[t.periodo]} · ${STATUS[t.status]}` }))))
      : [el("p", { class: "panel-text", text: "Cadastre atividades para hoje na aba Rotina e tarefas." })]));
    const progresso = this.gerenciador.progressoDoDia(Datas.hoje());
    $("#regra-premio").textContent = !progresso.total
      ? "Escolha ao menos uma atividade de hoje para participar da recompensa."
      : !progresso.completa
        ? `Para liberar o prêmio, conclua todas as atividades escolhidas para hoje (${progresso.done}/${progresso.total}) e alcance a meta de estrelas acumuladas.`
        : !r.metaAtingida()
          ? `Recompensa de hoje completa! Faltam ${plural(r.faltam(), "estrela acumulada", "estrelas acumuladas")} para a meta.`
          : "Recompensa de hoje completa e meta alcançada. O adulto já pode entregar o prêmio.";
  }

  renderizarPreferencias() {
    $("#pref-voz").checked = this.preferencias.vozAtiva;
    $("#pref-animacoes").checked = this.preferencias.animacoesAtivas;
    $("#pref-dificuldade").checked = this.preferencias.mostrarDificuldade;
    $("#pref-umapor").checked = this.preferencias.umaPorVez;
    $("#aviso-voz").hidden = this.leitor.disponivel();
  }

  renderizarLista(lista) {
    const container = $("#admin-task-list");
    if (!lista.length) {
      container.replaceChildren(el("div", { class: "empty-state" },
        el("p", { text: "Nenhuma tarefa para este filtro. Use \"Adicionar tarefa\" ou mude a data." })));
      return;
    }
    const grupos = [];
    let periodoAtual = null;
    lista.forEach(t => {
      const chaveGrupo = `${t.data}|${t.periodo}`;
      if (chaveGrupo !== periodoAtual) {
        periodoAtual = chaveGrupo;
        grupos.push(el("h3", { class: "group-title" }, ico(PERIODO_ICONE[t.periodo]), `${PERIODOS[t.periodo]}${this.data ? "" : `, ${Datas.formatar(t.data)}`}`));
      }
      grupos.push(this.criarLinha(t));
    });
    container.replaceChildren(...grupos);
  }

  criarLinha(t) {
    const info = (icone, texto) => el("span", { class: "meta-text" }, ico(icone), texto);
    const detalhes = [info("i-calendario", Datas.formatar(t.data)), info("i-nivel", DIFICULDADES[t.dificuldade])];
    if (t.etapas.length) detalhes.push(info("i-etapas", `${t.etapasFeitas()} de ${t.etapas.length} etapas`));
    if (t.opcoes.length) detalhes.push(info("t-livros", `${plural(t.opcoes.length, "opção", "opções")}${t.opcaoEscolhida !== null ? `, escolhida: ${t.opcoes[t.opcaoEscolhida]}` : ""}`));
    if (t.dica) detalhes.push(info("i-dica", t.dica.length > 40 ? t.dica.slice(0, 40) + "…" : t.dica));
    const botaoIcone = (acao, icone, rotulo, classe) =>
      el("button", { type: "button", class: classe, "data-acao": acao, "data-id": t.id, "aria-label": `${rotulo}: ${t.nome}`, title: rotulo }, ico(icone));
    const botaoRepetir = (acao, texto, rotulo) =>
      el("button", { type: "button", class: "repeat-btn", "data-acao": acao, "data-id": t.id, "aria-label": `${rotulo}: ${t.nome}`, title: rotulo, text: texto });
    return el("div", { class: `admin-card ${t.status === "help" ? "help" : ""}`, "data-id": t.id },
      el("span", { class: `admin-card-icon ${t.status}`, "aria-hidden": "true" }, figura(t.icone)),
      el("div", { class: "admin-card-info" },
        el("div", { class: "admin-card-top" },
          el("span", { class: "admin-card-name", text: t.nome }),
          el("span", { class: `meta-badge meta-status-${t.status}`, text: STATUS[t.status] }),
          el("span", { class: "meta-badge meta-period" }, ico(PERIODO_ICONE[t.periodo]), PERIODOS[t.periodo])),
        el("div", { class: "admin-card-meta" },
          el("span", { class: "meta-badge reward-chip", text: t.participaRecompensa ? "Vale recompensa" : "Só rotina" }), detalhes)),
      el("div", { class: "admin-card-actions" },
        el("div", { class: "repeat-group", role: "group", "aria-label": `Repetir ${t.nome}` },
          ico("i-repetir", "ico repeat-ico"),
          botaoRepetir("dup1", "+1 dia", "Repetir amanhã"),
          botaoRepetir("dup7", "+7 dias", "Repetir na próxima semana")),
        botaoIcone("editar", "i-editar", "Editar", "icon-btn"),
        botaoIcone("excluir", "i-lixeira", "Apagar", "icon-btn del")));
  }

  preencherModelos() {
    const select = $("#f-modelo");
    select.replaceChildren(el("option", { value: "", text: "Nenhum (começar do zero)" }),
      ...Object.entries(MODELOS).map(([chave, m]) => el("option", { value: chave, text: m.rotulo })));
  }

  construirSeletorIcones() {
    const grupo = $("#icon-picker");
    grupo.replaceChildren(...ICONES.map(([icone, nome]) => {
      const marcado = icone === this.iconeSelecionado;
      return el("button", {
        type: "button", class: "icon-opt", role: "radio", "aria-checked": String(marcado),
        "aria-label": nome, title: nome, tabindex: marcado ? "0" : "-1", "data-icone": icone
      }, figura(icone));
    }));
    grupo.onclick = e => { const b = e.target.closest(".icon-opt"); if (b) this.selecionarIcone(b.dataset.icone, true); };
    grupo.onkeydown = e => {
      const teclas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(e.key in teclas)) return;
      e.preventDefault();
      const i = ICONES.findIndex(([icone]) => icone === this.iconeSelecionado);
      const proximo = ICONES[(i + teclas[e.key] + ICONES.length) % ICONES.length][0];
      this.selecionarIcone(proximo, true);
    };
  }

  selecionarIcone(icone, focar = false) {
    this.iconeSelecionado = icone;
    $$("#icon-picker .icon-opt").forEach(b => {
      const marcado = b.dataset.icone === icone;
      b.setAttribute("aria-checked", String(marcado));
      b.tabIndex = marcado ? 0 : -1;
      if (marcado && focar) b.focus();
    });
  }

  abrirFormulario(id = null) {
    this.editandoId = id;
    const t = id ? this.gerenciador.buscar(id) : null;
    $("#modal-title").textContent = t ? "✏️ Editar tarefa" : "➕ Nova tarefa";
    $("#f-modelo").value = "";
    $("#f-modelo").closest(".form-group").hidden = Boolean(t);
    $("#f-name").value = t ? t.nome : "";
    $("#f-date").value = t ? t.data : (this.data || Datas.hoje());
    $("#f-period").value = t ? t.periodo : (this.periodo !== "all" ? this.periodo : "morning");
    $("#f-diff").value = t ? t.dificuldade : "easy";
    $("#f-obs").value = t ? t.dica : "";
    $("#f-steps").value = t ? t.etapas.map(e => e.texto).join("\n") : "";
    $("#f-options").value = t ? t.opcoes.join("\n") : "";
    $("#f-recompensa").checked = t ? t.participaRecompensa : true;
    this.iconeSelecionado = t ? t.icone : "estrela";
    this.construirSeletorIcones();
    this.mostrarErroNome(null);
    this.dialogoFormulario.abrir(t ? $("#f-name") : $("#f-modelo"));
  }

  aplicarModelo(chave) {
    const m = MODELOS[chave];
    if (!m) return;
    $("#f-name").value = m.nome;
    $("#f-period").value = m.periodo;
    $("#f-diff").value = m.dificuldade;
    $("#f-obs").value = m.dica || "";
    $("#f-steps").value = (m.etapas || []).join("\n");
    $("#f-options").value = (m.opcoes || []).join("\n");
    this.selecionarIcone(m.icone);
    this.mostrarErroNome(null);
    anunciar(`Modelo ${m.rotulo} aplicado. Revise os campos e salve.`);
  }

  mostrarErroNome(mensagem) {
    const campo = $("#f-name");
    const erro = $("#erro-nome");
    erro.hidden = !mensagem;
    erro.textContent = mensagem || "";
    if (mensagem) campo.setAttribute("aria-invalid", "true"); else campo.removeAttribute("aria-invalid");
  }

  lerFormulario() {
    return {
      nome: $("#f-name").value, icone: this.iconeSelecionado, data: $("#f-date").value || Datas.hoje(),
      periodo: $("#f-period").value, dificuldade: $("#f-diff").value, dica: $("#f-obs").value,
      etapas: linhas($("#f-steps").value), opcoes: linhas($("#f-options").value), participaRecompensa: $("#f-recompensa").checked
    };
  }

  salvarFormulario(evento) {
    evento.preventDefault();
    const dados = this.lerFormulario();
    const resultado = this.editandoId ? this.gerenciador.atualizar(this.editandoId, dados) : this.gerenciador.adicionar(dados);
    if (resultado.erro) {
      this.mostrarErroNome(resultado.erro);
      $("#f-name").focus();
      anunciar(resultado.erro);
      return;
    }
    const editou = Boolean(this.editandoId);
    this.editandoId = null;
    this.dialogoFormulario.fechar({ devolverFoco: false });
    this.renderizar();
    $("#abrir-cadastro").focus();
    anunciar(editou ? `Tarefa "${resultado.tarefa.nome}" atualizada.` : `Tarefa "${resultado.tarefa.nome}" criada em A Fazer para ${Datas.formatar(resultado.tarefa.data)}.`);
  }

  confirmar(mensagem, acao) {
    $("#confirm-msg").textContent = mensagem;
    this.acaoConfirmada = acao;
    this.dialogoConfirmacao.abrir($("#confirm-nao"));
  }

  excluir(id) {
    const t = this.gerenciador.buscar(id);
    if (!t) return;
    this.confirmar(`Apagar a tarefa "${t.nome}" de ${Datas.formatar(t.data)}?`, () => {
      this.gerenciador.remover(id);
      this.renderizar();
      anunciar(`Tarefa "${t.nome}" apagada.`);
    });
  }

  duplicar(id, dias, botao) {
    const copia = this.gerenciador.duplicar(id, dias);
    if (!copia) return;
    this.renderizar(`#admin-task-list button[data-acao="${botao.dataset.acao}"][data-id="${CSS.escape(id)}"]`);
    anunciar(`Cópia de "${copia.nome}" criada para ${Datas.formatar(copia.data)}.`);
  }

  repetirMostradas(dias) {
    const lista = this.listaAtual();
    if (!lista.length) { anunciar("Não há tarefas na lista mostrada."); return; }
    const copias = this.gerenciador.duplicarVarias(lista, dias);
    this.renderizar();
    anunciar(`${plural(copias.length, "tarefa copiada", "tarefas copiadas")} para ${dias === 1 ? "o dia seguinte" : "a semana seguinte"}.`);
  }
}

// ─── APLICATIVO ──────────────────────────────────────────────────────────────
class Aplicativo {
  constructor() {
    const armazenamento = RepositorioTarefas.armazenamentoSeguro();
    this.recompensas = new SistemaRecompensas(armazenamento);
    this.preferencias = new Preferencias(armazenamento);
    this.leitor = new LeitorVoz();
    this.gerenciador = new GerenciadorRotina(new RepositorioTarefas(armazenamento), this.recompensas);
    this.comemoracao = new Comemoracao(this.preferencias);
    this.comemoracao.gerenciador = this.gerenciador;
    this.comemoracao.leitor = this.leitor;
    this.quadro = new QuadroKanban(this.gerenciador, this.recompensas, this.preferencias, this.leitor, this.comemoracao);
    this.painel = new PainelAdulto(this.gerenciador, this.recompensas, this.preferencias, this.leitor);
    document.body.classList.toggle("sem-animacoes", !this.preferencias.animacoesAtivas);
    $$("[data-ir]").forEach(botao => botao.addEventListener("click", () => this.irPara(botao.dataset.ir)));
    $$(".screen h1").forEach(titulo => titulo.setAttribute("tabindex", "-1"));
  }

  irPara(tela) {
    $$(".screen").forEach(s => s.classList.toggle("active", s.id === tela));
    if (tela === "child") this.quadro.renderizar();
    if (tela === "adult") this.painel.renderizar();
    window.scrollTo(0, 0);
    const titulo = $(`#${tela} h1`);
    if (titulo) titulo.focus();
  }
}

document.addEventListener("DOMContentLoaded", () => { window.app = new Aplicativo(); });
