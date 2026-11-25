import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const context = vm.createContext({
  console, setTimeout, clearTimeout,
  document: { addEventListener() {} }, window: {}
});
for (const file of ['script.js', 'integracao.js']) vm.runInContext(fs.readFileSync(new URL(`${file}`, import.meta.url), 'utf8'), context);
context.assert = assert;
vm.runInContext(`
function memoria(valores = {}) { const mapa = new Map(Object.entries(valores)); return {getItem: k => mapa.get(k) ?? null, setItem: (k,v) => mapa.set(k,v), removeItem: k => mapa.delete(k)}; }
function gerenciador(tarefas = []) { const a = memoria({'maa_v2_tarefas': JSON.stringify(tarefas)}); return new GerenciadorRotina(new RepositorioTarefas(a), new SistemaRecompensas(a)); }
const legado = new RepositorioTarefas(memoria({maa_tasks: JSON.stringify([{id:'1',name:'Ler',icon:'📖',period:'night',diff:'easy',obs:'Meu livro',status:'help'}])})).carregar();
assert.equal(legado[0].nome, 'Ler'); assert.equal(legado[0].icone, 'leitura'); assert.equal(legado[0].status, 'help'); assert.equal(legado[0].data, Datas.hoje());
assert.equal(Datas.valida('2026-02-30'), false); assert.equal(Datas.valida('2028-02-29'), true); assert.equal(Datas.somarDias('2026-12-31',1), '2027-01-01');
const g = gerenciador();
assert.ok(g.adicionar({nome:'  '}).erro);
const t = g.adicionar({nome:'Ler',data:Datas.hoje(),periodo:'night',etapas:['Escolher','Ler'],opcoes:['A','B']}).tarefa;
g.alternarEtapa(t.id,0); g.escolherOpcao(t.id,1); g.mudarStatus(t.id,'doing');
g.atualizar(t.id,{...t, nome:'Meu livro', etapas:['Escolher','Ler']});
assert.equal(t.etapas[0].feita,true); assert.equal(t.opcaoEscolhida,1); assert.equal(t.status,'doing');
assert.ok(g.mudarStatus(t.id,'done').tarefa); assert.equal(g.recompensas.saldo(),0); assert.equal(t.status,'done'); assert.equal(t.etapas[0].feita,true);
g.alternarEtapa(t.id,1); g.mudarStatus(t.id,'done'); assert.equal(g.recompensas.saldo(),1);
g.mudarStatus(t.id,'done'); assert.equal(g.recompensas.saldo(),1);
g.mudarStatus(t.id,'todo'); assert.equal(g.recompensas.saldo(),0); assert.equal(t.etapas[0].feita,false); assert.equal(t.opcaoEscolhida,null);
g.alternarEtapa(t.id,0); g.alternarEtapa(t.id,1); g.escolherOpcao(t.id,0); g.mudarStatus(t.id,'done');
const copia = g.duplicar(t.id,7); assert.notEqual(copia.id,t.id); assert.equal(copia.data,Datas.somarDias(Datas.hoje(),7)); assert.equal(copia.status,'todo'); assert.equal(copia.etapas[0].feita,false); assert.equal(copia.opcaoEscolhida,null);
const r = g.recompensas; assert.equal(r.configurar(1,'Brincar'),null); assert.equal(r.entregarPremio(),true); assert.equal(r.saldo(),0); assert.equal(r.entregarPremio(),false); assert.equal(r.premiosEntregues,1);
const recarregado = new RepositorioTarefas(g.repositorio.armazenamento).carregar(); assert.equal(recarregado.length,2); assert.equal(recarregado[0].etapas[0].feita,true);
const importadas = validarImportacao({tarefas:[{name:'V1',icon:'🦷',period:'morning'}, {nome:'V2',status:'__proto__',periodo:'__proto__',etapas:[null,{texto:'Etapa',feita:true}],opcoes:[null,'A']} ]});
assert.equal(importadas.length,2); assert.equal(importadas[0].icone,'dente'); assert.equal(importadas[1].status,'todo'); assert.equal(importadas[1].periodo,'morning'); assert.equal(importadas[1].etapas.length,1); assert.notEqual(importadas[0].id,importadas[1].id);
assert.throws(()=>validarImportacao({tarefas:[{}]})); assert.throws(()=>validarImportacao({tarefas:'inválido'}));
assert.equal(g.removerConcluidas(g.tarefas),1); assert.equal(g.tarefas.length,1); assert.equal(g.recompensas.premiosEntregues,1);
console.log('OK — migração v1, calendário, cadastro, edição, etapas, escolhas, estrelas, repetição, persistência, importação e exclusão.');
`, context);
