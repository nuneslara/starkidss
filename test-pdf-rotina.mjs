import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = process.argv[2] ? path.resolve(process.argv[2])
  : fs.existsSync(path.join(here, 'script.js')) ? here
    : path.resolve(here, '../outputs/Minha Rotina - atualizado');
const artifacts = process.argv[3] ? path.resolve(process.argv[3])
  : fs.existsSync(path.join(here, 'script.js')) ? path.resolve(here, '../../work/pdfs')
    : path.join(here, 'pdfs');
fs.mkdirSync(artifacts, { recursive: true });

const context = vm.createContext({ console, setTimeout, clearTimeout,
  TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, Blob,
  document: { addEventListener() {} }, window: {} });
for (const file of ['script.js', 'vendor/pdf-lib.min.js', 'pdf-rotina.js']) {
  if (!fs.existsSync(path.join(project, file))) throw new Error('Arquivo necessário ausente: ' + file);
  vm.runInContext(fs.readFileSync(path.join(project, file), 'utf8'), context, { filename: file });
}

const results = [];
async function caso(nome, verificar) {
  try { await verificar(); results.push({ nome, status: 'aprovado' }); }
  catch (erro) { results.push({ nome, status: 'reprovado', erro: erro.message, pilha: erro.stack }); }
}
function parser(programa, args) {
  const result = spawnSync(programa, args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.error) throw new Error('Leitor PDF necessário indisponível: ' + programa + ': ' + result.error.message);
  assert.equal(result.status, 0, programa + ' rejeitou o PDF: ' + result.stderr);
  return result.stdout;
}
const siblingPython = path.resolve(path.dirname(process.execPath), '../../python/python.exe');
const pdfPython = process.env.PDF_TEST_PYTHON || (fs.existsSync(siblingPython) ? siblingPython : 'python');
const pdfCache = new Map();
function lerPdf(file) {
  if (!pdfCache.has(file)) {
    const data = JSON.parse(parser(pdfPython, ['-c', [
      'import json,sys',
      'from pypdf import PdfReader',
      'r=PdfReader(sys.argv[1],strict=True)',
      "print(json.dumps({'pages':len(r.pages),'text':'\\n'.join(p.extract_text() or '' for p in r.pages),'dimensions':[[float(p.mediabox.width),float(p.mediabox.height)] for p in r.pages]}))"
    ].join('\n'), file]));
    pdfCache.set(file, data);
  }
  return pdfCache.get(file);
}
function extrair(file) { return lerPdf(file).text.replace(/\s+/g, ' ').trim(); }
function paginaInfo(file) {
  const data = lerPdf(file);
  return { pages: data.pages, dimensions: data.dimensions };
}
async function gerar(tarefas, nome, opcoes = {}) {
  context.dadosPdf = tarefas;
  context.opcoesPdf = { data: '2026-11-25', periodo: 'all', geradoEm: new Date('2026-11-25T12:00:00-03:00'), ...opcoes };
  const raw = await vm.runInContext('gerarPdfRotina(dadosPdf, opcoesPdf)', context);
  assert.ok(raw instanceof Uint8Array || Object.prototype.toString.call(raw) === '[object Uint8Array]', 'O gerador deve devolver bytes Uint8Array');
  const bytes = Buffer.from(raw);
  assert.ok(bytes.subarray(0, 8).toString('latin1').startsWith('%PDF-'), 'Cabeçalho PDF ausente');
  assert.ok(bytes.subarray(-128).toString('latin1').includes('%%EOF'), 'Fim do PDF ausente');
  const file = path.join(artifacts, nome);
  fs.writeFileSync(file, bytes);
  return { file, bytes };
}
const tarefa = (id, nome, periodo, extra = {}) => ({
  id, nome, data: '2026-11-25', periodo, status: 'todo', dificuldade: 'easy',
  etapas: [], opcoes: [], participaRecompensa: true, ...extra
});
const exemplo = [
  tarefa('3', 'Leitura antes de dormir', 'night', { dica: 'Escolha um livro e leia no seu ritmo.',
    etapas: [{ texto: 'Escolher uma história', feita: false }, { texto: 'Ler com atenção', feita: false }],
    opcoes: ['Histórias da avó', 'Livro da escola'] }),
  tarefa('1', 'Escovar os dentes', 'morning', { dica: 'Use pouca pasta e enxágue a boca.',
    etapas: [{ texto: 'Pegar a escova', feita: true }, { texto: 'Colocar a pasta', feita: true },
      { texto: 'Escovar os dentes', feita: false }, { texto: 'Enxaguar a boca', feita: false }] }),
  tarefa('2', 'Preparar o lanche', 'afternoon', { dica: 'Você pode pedir ajuda para cortar a fruta.',
    etapas: [{ texto: 'Lavar as mãos', feita: false }, { texto: 'Escolher uma fruta', feita: false },
      { texto: 'Guardar os utensílios', feita: false }] })
];
let sample;
let sampleText;

await caso('PDF de rotina válido, em A4 e com texto selecionável', async () => {
  sample = await gerar(exemplo, 'rotina-exemplo.pdf');
  const info = paginaInfo(sample.file);
  assert.ok(info.pages >= 1);
  for (const [width, height] of info.dimensions) {
    assert.ok(width > 595 && width < 596 && height > 841 && height < 843, 'O documento deve usar papel A4');
  }
  sampleText = extrair(sample.file);
  assert.ok(sampleText.length > 120, 'PDF sem conteúdo textual suficiente');
});
await caso('Atividades organizadas em manhã, tarde e noite', () => {
  assert.ok(sampleText.indexOf('Escovar os dentes') < sampleText.indexOf('Preparar o lanche'));
  assert.ok(sampleText.indexOf('Preparar o lanche') < sampleText.indexOf('Leitura antes de dormir'));
  assert.ok(sampleText.includes('Manhã') && sampleText.includes('Tarde') && sampleText.includes('Noite'));
});
await caso('Etapas, dicas e opções reais aparecem no PDF', () => {
  for (const texto of ['Pegar a escova', 'Colocar a pasta', 'Enxaguar a boca', 'Lavar as mãos',
    'Guardar os utensílios', 'Use pouca pasta e enxágue a boca.', 'Histórias da avó', 'Livro da escola']) {
    assert.ok(sampleText.includes(texto), 'Texto ausente: ' + texto);
  }
});
await caso('Acentos em português são preservados na leitura do documento', () => {
  for (const texto of ['Manhã', 'mãos', 'enxágue', 'Você', 'atenção', 'Histórias', 'avó']) {
    assert.ok(sampleText.includes(texto), 'Acento perdido: ' + texto);
  }
  assert.ok(!sampleText.includes('\uFFFD'), 'Caractere de substituição no PDF');
});
await caso('Gerar a rotina não altera estados ou marcações da criança', async () => {
  const before = JSON.stringify(exemplo);
  await gerar(exemplo, 'rotina-sem-mutacao.pdf');
  assert.equal(JSON.stringify(exemplo), before);
});
await caso('Rotina vazia produz PDF válido e explicativo', async () => {
  const empty = await gerar([], 'rotina-vazia.pdf');
  assert.equal(paginaInfo(empty.file).pages, 1);
  const text = extrair(empty.file);
  assert.match(text, /nenhuma|sem atividades|sem tarefas/i);
});
await caso('Atividade sem etapas continua legível no PDF', async () => {
  const pdf = await gerar([tarefa('livre', 'Brincar no quintal', 'afternoon')], 'rotina-sem-etapas.pdf');
  assert.ok(extrair(pdf.file).includes('Brincar no quintal'));
  assert.ok(paginaInfo(pdf.file).pages >= 1);
});
await caso('Parênteses, barra e caracteres de texto não invalidam o PDF', async () => {
  const nome = 'Dentes (pasta) \\ água';
  const pdf = await gerar([tarefa('escape', nome, 'morning', { dica: 'Escova: (macia) \\ enxágue.' })], 'rotina-caracteres.pdf');
  const text = extrair(pdf.file);
  assert.ok(text.includes(nome), 'Parênteses ou barra foram corrompidos');
  assert.ok(text.includes('Escova: (macia) \\ enxágue.'));
});
await caso('Datas distintas são mantidas na rotina exportada e ordenadas', async () => {
  const pdf = await gerar([
    tarefa('amanha', 'ATIVIDADE AMANHÃ', 'morning', { data: '2026-11-26' }),
    tarefa('hoje', 'ATIVIDADE HOJE', 'night')
  ], 'rotina-datas.pdf', { data: null });
  const text = extrair(pdf.file);
  assert.ok(text.includes('25/11/2026') && text.includes('26/11/2026'));
  assert.ok(text.indexOf('ATIVIDADE HOJE') < text.indexOf('ATIVIDADE AMANHÃ'));
});
await caso('Rotina longa pagina sem perder a primeira ou a última atividade', async () => {
  const longas = Array.from({ length: 18 }, (_, i) => tarefa(String(i), `Atividade longa ${String(i + 1).padStart(2, '0')}`, ['morning', 'afternoon', 'night'][Math.floor(i / 6)], {
    dica: 'Organize os materiais com calma. Você pode escolher quando continuar e pedir ajuda sempre que precisar.',
    etapas: Array.from({ length: 6 }, (_, j) => ({ texto: `Etapa ${j + 1}: atenção à organização dos materiais da atividade`, feita: j < 2 })),
    opcoes: ['Escolher o material azul', 'Escolher o material amarelo']
  }));
  const pdf = await gerar(longas, 'rotina-longa.pdf');
  assert.ok(paginaInfo(pdf.file).pages > 1, 'Rotina longa deveria ter várias páginas');
  const text = extrair(pdf.file);
  for (let i = 1; i <= 18; i++) assert.ok(text.includes(`Atividade longa ${String(i).padStart(2, '0')}`), 'Atividade perdida: ' + i);
  assert.equal((text.match(/Etapa 6: atenção à organização/g) || []).length, 18, 'Algumas etapas foram perdidas na paginação');
});
await caso('Textos extensos e palavras sem espaços não quebram a estrutura do PDF', async () => {
  const pdf = await gerar([tarefa('texto', 'Uma atividade com descrição longa para conferir a quebra de linhas e o ajuste ao papel', 'morning', {
    dica: 'ORGANIZAÇÃO'.repeat(35), etapas: [{ texto: 'Atenção e concentração: ' + 'água '.repeat(80), feita: false }]
  })], 'rotina-texto-longo.pdf');
  assert.ok(paginaInfo(pdf.file).pages >= 1);
  const text = extrair(pdf.file);
  assert.ok(text.includes('Uma atividade com'));
  assert.ok(text.includes('Atenção e concentração'));
});
await caso('Emojis decorativos não interrompem a exportação ou o texto em português', async () => {
  const pdf = await gerar([tarefa('emoji', 'Ler com atenção ⭐', 'night', {
    dica: 'Você pode escolher uma história 📖.', etapas: [{ texto: 'Abrir o livro 😊', feita: false }]
  })], 'rotina-emojis.pdf');
  const text = extrair(pdf.file);
  assert.ok(text.includes('Ler com atenção'));
  assert.ok(text.includes('Você pode escolher uma história'));
  assert.ok(text.includes('Abrir o livro'));
});
await caso('Nome de download termina em PDF e identifica os filtros selecionados', () => {
  context.nomePdfOptions = { data: '2026-11-25', periodo: 'morning', geradoEm: new Date('2026-11-25T12:00:00-03:00') };
  const name = vm.runInContext('nomeArquivoPdfRotina(nomePdfOptions)', context);
  assert.equal(typeof name, 'string');
  assert.ok(name.endsWith('.pdf'));
  assert.ok(name.includes('2026-11-25'));
  assert.ok(!/[<>:"/\\|?*]/.test(name), 'Nome de arquivo incompatível com Windows');
});
await caso('Filtro por data e período exporta somente as atividades selecionadas', async () => {
  const pdf = await gerar([
    tarefa('entra', 'ATIVIDADE ESCOLHIDA', 'morning'),
    tarefa('outro-periodo', 'ATIVIDADE DA NOITE', 'night'),
    tarefa('outro-dia', 'ATIVIDADE DE AMANHÃ', 'morning', { data: '2026-11-26' })
  ], 'rotina-filtrada.pdf', { data: '2026-11-25', periodo: 'morning' });
  const text = extrair(pdf.file);
  assert.ok(text.includes('ATIVIDADE ESCOLHIDA'));
  assert.ok(!text.includes('ATIVIDADE DA NOITE'));
  assert.ok(!text.includes('ATIVIDADE DE AMANHÃ'));
});

async function comDownload(verificar) {
  const original = { document: context.document, URL: context.URL, setTimeout: context.setTimeout,
    anunciar: context.anunciar, gerarPdfRotina: context.gerarPdfRotina };
  const registro = { blobs: [], links: [], anexos: 0, cliques: 0, removidos: 0, timers: [], falas: [] };
  const botao = { disabled: false, textContent: 'Exportar rotina (PDF)' };
  context.document = {
    querySelector: selector => selector === '#export-backup' ? botao : null,
    createElement(tag) {
      const link = { tag, setAttribute(key, value) { this[key] = value; },
        click() { registro.cliques++; }, remove() { registro.removidos++; } };
      registro.links.push(link);
      return link;
    },
    body: { append() { registro.anexos++; } }
  };
  context.URL = { createObjectURL(blob) { registro.blobs.push(blob); return 'blob:pdf-teste'; }, revokeObjectURL() {} };
  context.setTimeout = (callback, delay) => { registro.timers.push({ callback, delay }); return registro.timers.length; };
  context.anunciar = value => registro.falas.push(value);
  try { await verificar(registro, botao); }
  finally { Object.assign(context, original); }
}
await caso('Exportar rotina inicia download PDF com nome correto e restaura o botão', async () => {
  await comDownload(async (registro, botao) => {
    context.appExportacao = { painel: { data: '2026-11-25', periodo: 'morning', listaAtual: () => exemplo } };
    await vm.runInContext('exportarRotinaPdf(appExportacao)', context);
    assert.equal(registro.blobs.length, 1);
    assert.equal(registro.blobs[0].type, 'application/pdf');
    const bytes = Buffer.from(await registro.blobs[0].arrayBuffer());
    assert.ok(bytes.subarray(0, 8).toString('latin1').startsWith('%PDF-'));
    assert.equal(registro.cliques, 1);
    assert.equal(registro.anexos, 1);
    assert.equal(registro.removidos, 1);
    assert.equal(registro.links[0].download, 'minha-rotina-2026-11-25-manha.pdf');
    assert.equal(botao.disabled, false);
    assert.equal(botao.textContent, 'Exportar rotina (PDF)');
    assert.ok(registro.falas.some(text => /PDF.*baixar/i.test(text)));
    assert.ok(registro.timers.some(timer => timer.delay >= 1000), 'URL deve durar tempo suficiente para iniciar o download');
  });
});
await caso('Falha de geração informa o problema e permite tentar o download novamente', async () => {
  await comDownload(async (registro, botao) => {
    context.gerarPdfRotina = async () => { throw new Error('Falha controlada do teste'); };
    context.appExportacao = { painel: { data: '2026-11-25', periodo: 'all', listaAtual: () => exemplo } };
    await vm.runInContext('exportarRotinaPdf(appExportacao)', context);
    assert.equal(registro.blobs.length, 0);
    assert.equal(registro.cliques, 0);
    assert.equal(botao.disabled, false);
    assert.equal(botao.textContent, 'Exportar rotina (PDF)');
    assert.ok(registro.falas.some(text => /Não foi possível gerar o PDF/.test(text)));
  });
});

for (const result of results) console.log(`${result.status === 'aprovado' ? 'PASS' : 'FAIL'} — ${result.nome}${result.erro ? '\n' + result.erro : ''}`);
const report = { total: results.length, aprovados: results.filter(r => r.status === 'aprovado').length,
  reprovados: results.filter(r => r.status === 'reprovado').length };
console.log(JSON.stringify(report, null, 2));
if (report.reprovados) process.exitCode = 1;
