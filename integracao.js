"use strict";
/* Une os fluxos dos protótipos e conserva o modelo de dados da versão 2. */
let toastTimer;
const anunciarBase = anunciar;
anunciar = function (mensagem) {
  anunciarBase(mensagem);
  const toast = document.querySelector('#toast');
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = mensagem;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 6500);
};

function atualizarInicio(app) {
  const hoje = app.gerenciador.filtrar({ data: Datas.hoje() });
  const feitas = hoje.filter(t => t.avaliacao().completa).length;
  document.querySelector('#home-summary').textContent = hoje.length
    ? `${feitas} de ${hoje.length} atividades concluídas hoje. Cada passo conta!`
    : 'Seu dia está livre. Um adulto pode preparar novas atividades.';
  const proximas = [...hoje.filter(t => t.status === 'doing'), ...hoje.filter(t => t.status === 'todo'), ...hoje.filter(t => t.status === 'help'), ...hoje.filter(t => t.status === 'done')].slice(0, 3);
  document.querySelector('#home-tasks').replaceChildren(...(proximas.length ? proximas.map(t =>
    el('div', { class: 'preview-item' }, el('span', { class: 'preview-emoji emoji', 'aria-hidden': 'true', text: ICONE_EMOJI[t.icone] }),
      el('div', {}, el('strong', { text: t.nome }), el('small', {}, el('span', { class: `preview-status ${t.status}` }), `${PERIODOS[t.periodo]} · ${STATUS[t.status]}`))))
    : [el('p', { class: 'section-hint', text: 'Uma nova rotina começa com uma atividade simples.' })]));
}

const irParaBase = Aplicativo.prototype.irPara;
Aplicativo.prototype.irPara = function (tela) {
  if (!['home', 'child', 'adult'].includes(tela)) tela = 'home';
  irParaBase.call(this, tela);
  window.scrollTo(0, 0);
  document.querySelectorAll('.sidebar [data-ir]').forEach(b => {
    const ativo = b.dataset.ir === tela;
    b.classList.toggle('active', ativo);
    if (ativo) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.querySelector('#current-section').textContent = `Meu espaço / ${{ home: 'Início', child: 'Minhas tarefas', adult: 'Área do adulto' }[tela]}`;
  atualizarInicio(this);
  try { history.replaceState(null, '', `#${tela}`); } catch (_) { /* abertura local */ }
};

// O pedido fica no quadro compartilhado deste navegador; não há notificação remota.
const falaBase = QuadroKanban.prototype.falaDaMascote;
QuadroKanban.prototype.falaDaMascote = function (tarefas) {
  const ajuda = tarefas.find(t => t.status === 'help');
  if (ajuda && !tarefas.some(t => t.status === 'doing')) return `Seu pedido de ajuda com ${ajuda.nome} ficou marcado. Chame um adulto para fazer com você.`;
  return falaBase.call(this, tarefas);
};

Datas.valida = function (iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [a, m, d] = iso.split('-').map(Number);
  if (a < 1000 || a > 9999) return false;
  const data = new Date(a, m - 1, d);
  return data.getFullYear() === a && data.getMonth() === m - 1 && data.getDate() === d;
};

const mudarStatusBase = GerenciadorRotina.prototype.mudarStatus;
GerenciadorRotina.prototype.mudarStatus = function (id, status) {
  if (!ORDEM_STATUS.includes(status)) return null;
  const resultado = mudarStatusBase.call(this, id, status);
  if (resultado && !resultado.erro && resultado.anterior === 'done' && status === 'todo') {
    resultado.tarefa.etapas.forEach(e => { e.feita = false; });
    resultado.tarefa.opcaoEscolhida = null;
    this.salvar();
  }
  return resultado;
};

// A dica do APP KIDS pode ser consultada antes de iniciar a tarefa.
const criarCartaoBase = QuadroKanban.prototype.criarCartao;
QuadroKanban.prototype.criarCartao = function (t) {
  const cartao = criarCartaoBase.call(this, t);
  if (t.status === 'todo' && (t.dica || t.etapas.length || t.opcoes.length)) {
    const detalhes = el('div', { class: 'details-wrap', id: `detalhes-${t.id}`, hidden: true });
    if (t.dica) detalhes.append(el('p', { class: 'task-tip' }, ico('i-dica'), el('span', { text: t.dica })));
    if (t.etapas.length) detalhes.append(this.criarEtapas(t));
    if (t.opcoes.length) detalhes.append(this.criarOpcoes(t));
    const acoes = cartao.querySelector('.task-actions');
    cartao.insertBefore(detalhes, acoes);
    acoes.append(el('button', { type: 'button', class: 'act-btn btn-details small', 'data-acao': 'detalhes', 'aria-expanded': 'false', 'aria-controls': detalhes.id, 'aria-describedby': `nome-${t.id}` }, ico('i-dica'), 'Ver detalhes'));
  }
  return cartao;
};

const salvarBase = GerenciadorRotina.prototype.salvar;
GerenciadorRotina.prototype.salvar = function () {
  const salvo = salvarBase.call(this);
  if (!salvo) anunciar('Não foi possível salvar neste navegador. Salve uma cópia de segurança das tarefas para guardar suas alterações.');
  return salvo;
};

function validarImportacao(conteudo) {
  const lista = Array.isArray(conteudo) ? conteudo : conteudo && conteudo.tarefas;
  if (!Array.isArray(lista) || !lista.length || lista.length > 2000) throw new Error('O arquivo deve conter uma lista com 1 a 2.000 tarefas.');
  return lista.map(dados => {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('Há uma tarefa inválida no arquivo.');
    const nome = dados.nome ?? dados.name;
    if (typeof nome !== 'string' || !nome.trim()) throw new Error('Todas as tarefas precisam ter um nome.');
    const modelo = 'nome' in dados ? dados : {
      nome: dados.name, icone: dados.icon, periodo: dados.period,
      dificuldade: dados.diff, dica: dados.obs, status: dados.status, data: dados.date
    };
    const normalizada = {
      ...modelo, id: Tarefa.novoId(), nome: nome.trim().slice(0, 40),
      status: ORDEM_STATUS.includes(modelo.status) ? modelo.status : 'todo',
      periodo: ORDEM_PERIODOS.includes(modelo.periodo) ? modelo.periodo : 'morning',
      dificuldade: ['easy', 'medium', 'hard'].includes(modelo.dificuldade) ? modelo.dificuldade : 'easy',
      etapas: Array.isArray(modelo.etapas) ? modelo.etapas.filter(e => typeof e === 'string' || (e && typeof e.texto === 'string')).slice(0, 6) : [],
      opcoes: Array.isArray(modelo.opcoes) ? modelo.opcoes.filter(o => typeof o === 'string').slice(0, 6) : []
    };
    const tarefa = new Tarefa(normalizada);
    // Preserva o encerramento parcial escolhido pela criança. Importar não credita estrelas.
    return tarefa;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const app = window.app;
  document.querySelector('#today-date').textContent = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  document.querySelector('.brand').addEventListener('click', e => e.preventDefault());
  document.querySelectorAll('.nav-item').forEach(b => b.setAttribute('aria-label', b.textContent.trim()));
  document.querySelectorAll('[data-panel]').forEach(b => b.addEventListener('click', () => {
    document.querySelector('.adult-content').dataset.activePanel = b.dataset.panel;
    document.querySelectorAll('[data-panel]').forEach(outro => {
      outro.classList.toggle('active', outro === b);
      outro.setAttribute('aria-pressed', String(outro === b));
    });
  }));
  document.querySelector('.kanban-board').addEventListener('click', e => {
    const botao = e.target.closest('[data-acao="detalhes"]');
    if (!botao) return;
    const detalhes = document.getElementById(botao.getAttribute('aria-controls'));
    detalhes.hidden = !detalhes.hidden;
    botao.setAttribute('aria-expanded', String(!detalhes.hidden));
    botao.replaceChildren(ico('i-dica'), detalhes.hidden ? 'Ver detalhes' : 'Fechar detalhes');
  });
  // Escape, aprisionamento e retorno de foco são conservados nos diálogos.
  const abrir = Dialogo.prototype.abrir;
  Dialogo.prototype.abrir = function (...args) {
    document.querySelector('#conteudo').inert = true;
    document.querySelector('.sidebar').inert = true;
    document.body.classList.add('modal-open');
    return abrir.apply(this, args);
  };
  const fechar = Dialogo.prototype.fechar;
  Dialogo.prototype.fechar = function (...args) {
    document.querySelector('#conteudo').inert = false;
    document.querySelector('.sidebar').inert = false;
    document.body.classList.remove('modal-open');
    return fechar.apply(this, args);
  };

  document.querySelector('#export-backup').addEventListener('click', () => exportarRotinaPdf(app));
  document.querySelector('#backup-json').addEventListener('click', () => {
    const dados = { versao: 3, exportadoEm: new Date().toISOString(), tarefas: app.gerenciador.tarefas };
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
    const link = el('a', { href: url, download: `minha-rotina-${Datas.hoje()}.json` });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    anunciar('Cópia de segurança salva. Use esse arquivo para importar as tarefas.');
  });
  document.querySelector('#import-backup').addEventListener('click', () => document.querySelector('#backup-file').click());
  document.querySelector('#backup-file').addEventListener('change', async e => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    try {
      if (arquivo.size > 3 * 1024 * 1024) throw new Error('Use um arquivo JSON de até 3 MB.');
      const tarefas = validarImportacao(JSON.parse(await arquivo.text()));
      app.painel.confirmar(`Adicionar ${plural(tarefas.length, 'tarefa', 'tarefas')} à rotina? As tarefas existentes serão mantidas. A importação não altera o saldo de estrelas.`, () => {
        app.gerenciador.tarefas.push(...tarefas);
        app.gerenciador.salvar();
        app.painel.data = null;
        app.painel.renderizar();
        atualizarInicio(app);
        anunciar(`${plural(tarefas.length, 'tarefa importada', 'tarefas importadas')} com sucesso.`);
      });
      document.querySelector('#confirm-title').textContent = 'Importar tarefas';
      document.querySelector('#confirm-sim').textContent = 'Importar tarefas';
    } catch (erro) {
      anunciar(erro instanceof SyntaxError ? 'Este arquivo não é um JSON válido. Escolha uma exportação da rotina.' : erro.message);
    } finally { e.target.value = ''; }
  });
  const confirmarBase = app.painel.confirmar.bind(app.painel);
  app.painel.confirmar = function (...args) {
    document.querySelector('#confirm-title').textContent = 'Confirmar alteração';
    document.querySelector('#confirm-sim').textContent = 'Sim, apagar';
    return confirmarBase(...args);
  };

  const armazenamento = app.gerenciador.repositorio.armazenamento;
  if (armazenamento.persistente === false) anunciar('O navegador está bloqueando o armazenamento. Salve uma cópia de segurança antes de fechar para guardar suas tarefas.');
  const tela = location.hash.slice(1);
  app.irPara(['home', 'child', 'adult'].includes(tela) ? tela : 'home');
});
