import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = process.argv[2]
  ? path.resolve(process.argv[2])
  : fs.existsSync(path.join(here, 'script.js')) ? here : path.resolve(here, '../outputs/Minha Rotina - atualizado');
const context = vm.createContext({ console, setTimeout, clearTimeout, assert,
  document: { addEventListener() {} }, window: {} });
for (const file of ['script.js', 'integracao.js', 'desempenho.js']) {
  if (!fs.existsSync(path.join(project, file))) throw new Error('Arquivo necessário ausente: ' + file);
  vm.runInContext(fs.readFileSync(path.join(project, file), 'utf8'), context, { filename: file });
}
const results = vm.runInContext(String.raw`
(() => {
  const results = [];
  function caso(nome, verificar) {
    try { verificar(); results.push({ nome, status: 'aprovado' }); }
    catch (erro) { results.push({ nome, status: 'reprovado', erro: erro.message, pilha: erro.stack }); }
  }
  function memoria(valores = {}) {
    const mapa = new Map(Object.entries(valores));
    return { getItem: k => mapa.get(k) ?? null, setItem: (k, v) => mapa.set(k, String(v)), removeItem: k => mapa.delete(k) };
  }
  function gerenciador(tarefas = [], recompensa = {}) {
    const armazenamento = memoria({ maa_v2_tarefas: JSON.stringify(tarefas), maa_v2_recompensas: JSON.stringify(recompensa) });
    return new GerenciadorRotina(new RepositorioTarefas(armazenamento), new SistemaRecompensas(armazenamento));
  }
  const hoje = Datas.hoje();
  const amanha = Datas.somarDias(hoje, 1);
  const etapas = (feitas, total = 5) => Array.from({ length: total }, (_, i) => ({ texto: 'Etapa ' + (i + 1), feita: i < feitas }));
  const tarefa = (id = '1', status = 'todo', feitas = 0, total = 5, extra = {}) => ({ id, nome: 'Atividade ' + id, data: hoje, status, etapas: etapas(feitas, total), ...extra });
  function comControles(verificar) {
    const original = document.querySelector;
    const cssAnterior = globalThis.CSS;
    const campos = new Map();
    function campo(seletor) {
      if (!campos.has(seletor)) campos.set(seletor, {
        textContent: '', hidden: false, atributos: {}, dataset: {}, foco: 0,
        setAttribute(k, v) { this.atributos[k] = v; },
        focus() { this.foco++; }
      });
      return campos.get(seletor);
    }
    document.querySelector = seletor => ['#anuncio', '#toast'].includes(seletor) ? null : campo(seletor);
    globalThis.CSS = { escape: valor => String(valor) };
    try { verificar(campo); }
    finally { document.querySelector = original; globalThis.CSS = cssAnterior; }
  }

  caso('Avaliação inicial por atividade: zero de cinco estrelas e cinco etapas restantes', () => {
    const p = new Tarefa(tarefa()).avaliacao();
    assert.equal(p.estrelas, 0); assert.equal(p.total, 5); assert.equal(p.feitas, 0); assert.equal(p.restantes, 5);
    assert.equal(p.completa, false); assert.equal(p.estado, 'triste');
  });
  caso('Cada etapa de uma atividade com cinco etapas altera uma estrela', () => {
    for (let i = 0; i <= 5; i++) {
      const p = new Tarefa(tarefa('1', 'doing', i)).avaliacao();
      assert.equal(p.estrelas, i); assert.equal(p.feitas, i); assert.equal(p.restantes, 5 - i);
      assert.equal(p.completa, i === 5);
    }
  });
  caso('A quinta estrela exige todas as etapas em atividades de um a seis passos', () => {
    for (let total = 1; total <= 6; total++) {
      for (let feitas = 0; feitas <= total; feitas++) {
        const p = new Tarefa(tarefa('1', 'doing', feitas, total)).avaliacao();
        const expected = feitas === total ? 5 : feitas === 0 ? 0 : Math.min(4, Math.ceil(feitas / total * 5));
        assert.equal(p.estrelas, expected); assert.equal(p.restantes, total - feitas);
        assert.equal(p.completa, feitas === total);
      }
    }
  });
  caso('Sem etapas cadastradas: zero antes de finalizar, cinco depois', () => {
    for (const status of ['todo', 'doing', 'help', 'done']) {
      const p = new Tarefa(tarefa('1', status, 0, 0)).avaliacao();
      assert.equal(p.estrelas, status === 'done' ? 5 : 0);
      assert.equal(p.completa, status === 'done'); assert.equal(p.restantes, 0);
    }
  });
  caso('Rosto triste em encerramento parcial, sério ao continuar e muito feliz com tudo marcado', () => {
    assert.equal(new Tarefa(tarefa('1', 'done', 2)).avaliacao().estado, 'triste');
    assert.equal(new Tarefa(tarefa('1', 'doing', 2)).avaliacao().estado, 'serio');
    assert.equal(new Tarefa(tarefa('1', 'doing', 5)).avaliacao().estado, 'feliz');
  });
  caso('Todas as etapas marcadas dão cinco estrelas mesmo antes do botão Terminei', () => {
    const p = new Tarefa(tarefa('1', 'doing', 5)).avaliacao();
    assert.equal(p.estrelas, 5); assert.equal(p.completa, true); assert.equal(p.estado, 'feliz');
  });
  caso('Encerrar com etapas pendentes é permitido, conserva marcações e não dá crédito completo', () => {
    const g = gerenciador([tarefa('1', 'doing', 2)]);
    const r = g.mudarStatus('1', 'done');
    assert.ok(r && !r.erro); assert.equal(g.buscar('1').status, 'done');
    assert.equal(g.buscar('1').etapasFeitas(), 2); assert.equal(g.buscar('1').avaliacao().estrelas, 2);
    assert.equal(g.buscar('1').avaliacao().estado, 'triste'); assert.equal(g.recompensas.saldo(), 0);
  });
  caso('Encerramento parcial repetido não força etapas nem duplica crédito', () => {
    const g = gerenciador([tarefa('1', 'doing', 2)]);
    g.mudarStatus('1', 'done'); g.mudarStatus('1', 'done');
    assert.equal(g.buscar('1').etapasFeitas(), 2); assert.equal(g.recompensas.saldo(), 0);
  });
  caso('Continuar uma atividade encerrada mantém as etapas que a criança já marcou', () => {
    const g = gerenciador([tarefa('1', 'done', 2)]);
    const r = g.mudarStatus('1', 'doing');
    assert.ok(r && !r.erro); assert.equal(g.buscar('1').status, 'doing');
    assert.equal(g.buscar('1').etapasFeitas(), 2); assert.equal(g.buscar('1').avaliacao().estado, 'serio');
  });
  caso('Crédito acumulado só entra depois da conclusão integral da atividade escolhida', () => {
    const g = gerenciador([tarefa('1', 'doing', 4)]);
    g.mudarStatus('1', 'done'); assert.equal(g.recompensas.saldo(), 0);
    g.mudarStatus('1', 'doing'); g.alternarEtapa('1', 4); assert.equal(g.recompensas.saldo(), 0);
    g.mudarStatus('1', 'done'); assert.equal(g.recompensas.saldo(), 1);
    g.mudarStatus('1', 'done'); assert.equal(g.recompensas.saldo(), 1);
  });
  caso('Desmarcar etapa mantém atividade encerrada e retira somente o crédito integral', () => {
    const g = gerenciador([tarefa('1', 'doing', 5)]);
    g.mudarStatus('1', 'done'); assert.equal(g.recompensas.saldo(), 1);
    g.alternarEtapa('1', 4);
    assert.equal(g.buscar('1').status, 'done'); assert.equal(g.buscar('1').avaliacao().estado, 'triste');
    assert.equal(g.buscar('1').avaliacao().estrelas, 4); assert.equal(g.recompensas.saldo(), 0);
  });
  caso('Marcar a etapa restante de atividade encerrada atualiza pontuação e crédito sem duplicar', () => {
    const g = gerenciador([tarefa('1', 'done', 4)]);
    g.alternarEtapa('1', 4);
    assert.equal(g.buscar('1').status, 'done'); assert.equal(g.buscar('1').avaliacao().estrelas, 5);
    assert.equal(g.recompensas.saldo(), 1);
    g.mudarStatus('1', 'done'); assert.equal(g.recompensas.saldo(), 1);
  });
  caso('Adicionar nova etapa a atividade encerrada mantém a escolha e reduz pontuação/crédito', () => {
    const g = gerenciador([tarefa('1', 'doing', 4, 4)]);
    g.mudarStatus('1', 'done');
    const t = g.buscar('1');
    const r = g.atualizar('1', { ...t, etapas: [...t.etapas.map(e => e.texto), 'Etapa nova'] });
    assert.ok(!r.erro); assert.equal(t.status, 'done'); assert.equal(t.etapasFeitas(), 4);
    assert.equal(t.avaliacao().estrelas, 4); assert.equal(t.avaliacao().estado, 'triste');
    assert.equal(g.recompensas.saldo(), 0);
  });
  caso('Editar apenas nome preserva avaliação integral e saldo', () => {
    const g = gerenciador([tarefa('1', 'doing', 5)]); g.mudarStatus('1', 'done');
    const t = g.buscar('1'); g.atualizar('1', { ...t, nome: 'Novo nome', etapas: t.etapas.map(e => e.texto) });
    assert.equal(t.status, 'done'); assert.equal(t.avaliacao().estrelas, 5); assert.equal(g.recompensas.saldo(), 1);
  });
  caso('Atividade não escolhida tem estrelas por etapas mas não altera saldo da recompensa', () => {
    const g = gerenciador([tarefa('1', 'doing', 5, 5, { participaRecompensa: false })]);
    g.mudarStatus('1', 'done'); assert.equal(g.buscar('1').avaliacao().estrelas, 5);
    assert.equal(g.recompensas.saldo(), 0); g.alternarEtapa('1', 4); assert.equal(g.recompensas.saldo(), 0);
  });
  caso('Selecionar atividade encerrada parcial não concede crédito e não reabre à força', () => {
    const g = gerenciador([tarefa('1', 'done', 2, 5, { participaRecompensa: false })]);
    g.definirParticipacaoRecompensa('1', true);
    assert.equal(g.buscar('1').status, 'done'); assert.equal(g.buscar('1').etapasFeitas(), 2);
    assert.equal(g.recompensas.saldo(), 0);
  });
  caso('Selecionar/deselecionar atividade integral corrige um crédito, de forma idempotente', () => {
    const g = gerenciador([tarefa('1', 'done', 5, 5, { participaRecompensa: false })]);
    g.definirParticipacaoRecompensa('1', true); assert.equal(g.recompensas.saldo(), 1);
    g.definirParticipacaoRecompensa('1', true); assert.equal(g.recompensas.saldo(), 1);
    g.definirParticipacaoRecompensa('1', false); assert.equal(g.recompensas.saldo(), 0);
    g.definirParticipacaoRecompensa('1', false); assert.equal(g.recompensas.saldo(), 0);
  });
  caso('Saldo suficiente não transforma encerramento parcial em conclusão integral', () => {
    const g = gerenciador([tarefa('1', 'done', 2)], { estrelasGanhas: 10, meta: 5 });
    assert.equal(g.recompensas.podeEntregar(), false); assert.equal(g.recompensas.entregarPremio(), false);
    assert.equal(g.recompensas.saldo(), 10); assert.equal(g.progressoDoDia(hoje).completa, false);
  });
  caso('Prêmio exige atividades escolhidas de hoje completas e meta acumulada', () => {
    const g = gerenciador([tarefa('1', 'doing', 5), tarefa('2', 'done', 0, 5, { participaRecompensa: false })], { meta: 1 });
    assert.equal(g.recompensas.podeEntregar(), false);
    g.mudarStatus('1', 'done'); assert.equal(g.recompensas.podeEntregar(), true);
    assert.equal(g.recompensas.entregarPremio(), true); assert.equal(g.recompensas.entregarPremio(), false);
  });
  caso('Dia vazio e dia sem atividades escolhidas continuam sem liberar prêmio', () => {
    for (const list of [[], [tarefa('1', 'done', 5, 5, { participaRecompensa: false })], [tarefa('1', 'done', 5, 5, { data: amanha })]]) {
      const g = gerenciador(list, { estrelasGanhas: 10, meta: 1 });
      assert.equal(g.recompensas.podeEntregar(), false);
    }
  });
  caso('Recarga mantém encerramento parcial, pontuação e saldo sem reabrir automaticamente', () => {
    const g = gerenciador([tarefa('1', 'doing', 2)], { estrelasGanhas: 8 });
    g.mudarStatus('1', 'done');
    const a = g.repositorio.armazenamento;
    const r = new GerenciadorRotina(new RepositorioTarefas(a), new SistemaRecompensas(a));
    assert.equal(r.buscar('1').status, 'done'); assert.equal(r.buscar('1').etapasFeitas(), 2);
    assert.equal(r.buscar('1').avaliacao().estrelas, 2); assert.equal(r.recompensas.saldo(), 8);
  });
  caso('Importação preserva encerramento parcial, sem crédito ou reabertura forçada', () => {
    const imported = validarImportacao({ tarefas: [tarefa('1', 'done', 2), tarefa('2', 'done', 5, 5, { participaRecompensa: false })] });
    assert.equal(imported[0].status, 'done'); assert.equal(imported[0].etapasFeitas(), 2);
    assert.equal(imported[0].avaliacao().estrelas, 2); assert.equal(imported[1].participaRecompensa, false);
    const g = gerenciador(imported); assert.equal(g.recompensas.saldo(), 0);
    assert.equal(g.buscar(imported[0].id).status, 'done');
  });
  caso('Repetição começa nova atividade sem pontuação e preserva opção do adulto', () => {
    const g = gerenciador([tarefa('1', 'done', 2, 5, { participaRecompensa: false })]);
    const c = g.duplicar('1', 1);
    assert.notEqual(c.id, '1'); assert.equal(c.data, amanha); assert.equal(c.participaRecompensa, false);
    assert.equal(c.status, 'todo'); assert.equal(c.etapasFeitas(), 0); assert.equal(c.avaliacao().estrelas, 0);
    assert.equal(g.buscar('1').etapasFeitas(), 2);
  });
  caso('Pontuação de uma atividade é independente da seleção, outras atividades e outros dias', () => {
    const g = gerenciador([tarefa('1', 'done', 2), tarefa('2', 'done', 5), tarefa('3', 'done', 0, 5, { data: amanha, participaRecompensa: false })]);
    assert.equal(g.buscar('1').avaliacao().estrelas, 2); assert.equal(g.buscar('2').avaliacao().estrelas, 5);
    assert.equal(g.buscar('3').avaliacao().estrelas, 0);
  });
  caso('Desempenho vazio é zero, sem divisão por zero', () => {
    const d = desempenhoDasAtividades([]);
    assert.equal(d.total, 0); assert.equal(d.media, 0); assert.equal(d.concluidas, 0); assert.equal(d.encerradasParciais, 0);
  });
  caso('Desempenho considera todas atividades, inclusive zero e fora da recompensa', () => {
    const list = [new Tarefa(tarefa('1', 'done', 5)), new Tarefa(tarefa('2', 'done', 2)), new Tarefa(tarefa('3', 'todo', 0, 5, { participaRecompensa: false }))];
    const d = desempenhoDasAtividades(list);
    assert.equal(d.total, 3); assert.ok(Math.abs(d.media - 7 / 3) < 1e-9);
    assert.equal(d.concluidas, 1); assert.equal(d.encerradasParciais, 1);
  });
  caso('Desempenho integral mantém limite de cinco pontos', () => {
    const d = desempenhoDasAtividades([new Tarefa(tarefa('1', 'done', 5)), new Tarefa(tarefa('2', 'doing', 5))]);
    assert.equal(d.media, 5); assert.equal(d.concluidas, 2); assert.equal(d.encerradasParciais, 0);
  });
  caso('Desempenho segue filtros por data e período da rotina', () => {
    const g = gerenciador([tarefa('1', 'done', 5, 5, { periodo: 'morning' }), tarefa('2', 'done', 2, 5, { periodo: 'night' }), tarefa('3', 'todo', 0, 5, { data: amanha })]);
    assert.equal(desempenhoDasAtividades(g.filtrar({ data: hoje, periodo: 'morning' })).media, 5);
    assert.equal(desempenhoDasAtividades(g.filtrar({ data: hoje })).media, 3.5);
    assert.equal(desempenhoDasAtividades(g.filtrar({ data: amanha })).media, 0);
  });
  caso('Controlador infantil pergunta antes de encerrar atividade parcial, sem decidir pela criança', () => {
    const g = gerenciador([tarefa('1', 'doing', 2)]);
    let convites = 0;
    const quadro = Object.create(QuadroKanban.prototype);
    quadro.gerenciador = g;
    quadro.comemoracao = { mostrarConvite(t) { convites++; assert.equal(t.id, '1'); } };
    quadro.mover('1', 'done');
    assert.equal(convites, 1); assert.equal(g.buscar('1').status, 'doing');
    assert.equal(g.buscar('1').etapasFeitas(), 2); assert.equal(g.recompensas.saldo(), 0);
  });
  caso('Convite informa etapas restantes, usa estrela triste e oferece escolha sem crédito automático', () => {
    comControles(campo => {
      const t = new Tarefa(tarefa('1', 'doing', 2));
      const falas = [];
      const convite = Object.create(Comemoracao.prototype);
      convite.preparar = atividade => atividade.avaliacao();
      convite.preferencias = { vozAtiva: true };
      convite.leitor = { falar(texto) { falas.push(texto); } };
      convite.dialogo = { abrir(alvo) { assert.equal(alvo, campo('#continuar-sim')); } };
      convite.mostrarConvite(t);
      assert.equal(convite.tarefaConvite, '1');
      assert.equal(campo('#cel-emoji use').atributos.href, '#mascote-triste');
      assert.equal(campo('#cel-msg').textContent, 'Faltam 3 etapas para ficar com 5 estrelas nesta atividade. Vamos continuar?');
      assert.ok(campo('#cel-reward').textContent.includes('2 de 5 estrelas'));
      assert.equal(campo('#escolha-continuar').hidden, false); assert.equal(campo('#fechar-comemoracao').hidden, true);
      assert.equal(falas[0], campo('#cel-msg').textContent);
      assert.equal(t.etapasFeitas(), 2); assert.equal(t.status, 'doing');
    });
  });
  caso('Resposta Sim diz Vamos nessa e deixa a criança marcar, mesmo com outra atividade em andamento', () => {
    comControles(campo => {
      const g = gerenciador([tarefa('1', 'done', 2), tarefa('2', 'doing', 0)]);
      const falas = [], renderizados = [];
      const quadro = Object.create(QuadroKanban.prototype);
      quadro.gerenciador = g; quadro.preferencias = { vozAtiva: true, umaPorVez: true };
      quadro.leitor = { falar(texto) { falas.push(texto); } };
      quadro.renderizar = id => renderizados.push(id);
      quadro.responderContinuidade('1', true);
      assert.equal(g.buscar('1').status, 'doing'); assert.equal(g.buscar('1').etapasFeitas(), 2);
      assert.equal(g.buscar('2').status, 'doing'); assert.equal(g.recompensas.saldo(), 0);
      assert.equal(campo('#mascote-fala').textContent, 'Vamos nessa!'); assert.equal(falas[0], 'Vamos nessa!');
      assert.equal(campo('.hello-mascot use').atributos.href, '#mascote-serio');
      assert.equal(campo('.hello-mascot').dataset.estado, 'serio');
      assert.equal(renderizados[0], '1');
    });
  });
  caso('Resposta Não guarda encerramento parcial, estrela triste e liberdade para continuar depois', () => {
    comControles(campo => {
      const g = gerenciador([tarefa('1', 'doing', 2)]);
      let falas = 0;
      const quadro = Object.create(QuadroKanban.prototype);
      quadro.gerenciador = g; quadro.preferencias = { vozAtiva: false };
      quadro.leitor = { falar() { falas++; } }; quadro.renderizar = () => {};
      quadro.responderContinuidade('1', false);
      assert.equal(g.buscar('1').status, 'done'); assert.equal(g.buscar('1').etapasFeitas(), 2);
      assert.equal(g.buscar('1').avaliacao().estado, 'triste'); assert.equal(g.recompensas.saldo(), 0);
      assert.equal(campo('.hello-mascot use').atributos.href, '#mascote-triste');
      assert.equal(campo('.hello-mascot').dataset.estado, 'triste');
      assert.ok(campo('#mascote-fala').textContent.includes('Você pode continuar quando quiser'));
      assert.equal(falas, 0);
    });
  });
  caso('Escolha do convite é encaminhada apenas uma vez e fecha a pergunta', () => {
    const encaminhadas = [];
    let fechados = 0;
    const convite = Object.create(Comemoracao.prototype);
    convite.tarefaConvite = '1';
    convite.dialogo = { fechar() { fechados++; } };
    convite.aoResponder = (id, continuar) => encaminhadas.push({ id, continuar });
    convite.responderConvite(false); convite.responderConvite(true);
    assert.equal(encaminhadas.length, 1); assert.equal(encaminhadas[0].id, '1');
    assert.equal(encaminhadas[0].continuar, false); assert.equal(convite.tarefaConvite, null); assert.equal(fechados, 2);
  });
  caso('Limpar atividades completas preserva encerramentos parciais e suas marcações', () => {
    const g = gerenciador([tarefa('1', 'done', 2), tarefa('2', 'done', 5), tarefa('3', 'doing', 5)]);
    const removidas = g.removerConcluidas(g.tarefas);
    assert.equal(removidas, 1); assert.equal(g.buscar('2'), null);
    assert.equal(g.buscar('1').status, 'done'); assert.equal(g.buscar('1').etapasFeitas(), 2);
    assert.equal(g.buscar('1').avaliacao().estrelas, 2); assert.equal(g.buscar('3').status, 'doing');
    const recarregado = new RepositorioTarefas(g.repositorio.armazenamento).carregar();
    assert.equal(recarregado.length, 2); assert.equal(recarregado.find(t => t.id === '1').etapasFeitas(), 2);
  });
  return results;
})()
`, context);
for (const r of results) console.log(`${r.status === 'aprovado' ? 'PASS' : 'FAIL'} — ${r.nome}${r.erro ? '\n' + r.erro : ''}`);
const summary = { total: results.length, aprovados: results.filter(r => r.status === 'aprovado').length, reprovados: results.filter(r => r.status === 'reprovado').length };
console.log(JSON.stringify(summary, null, 2));
if (summary.reprovados) process.exitCode = 1;
