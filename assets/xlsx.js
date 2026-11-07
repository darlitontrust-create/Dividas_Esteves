/*
 * Leitor mínimo de .xlsx direto no navegador (sem bibliotecas externas).
 * Usa DecompressionStream nativo para abrir o zip e DOMParser para o XML.
 * Uso: PLANILHA.carregarDividas('Dividas.xlsx') -> Promise<Array<item>>
 */
(function (global) {
  'use strict';

  // Classificação da planilha -> categoria exibida na página
  var CATEGORIAS = {
    'DESP CASA': 'Contas da Casa',
    'DESP OBRA': 'Obra da Garagem',
    'RECEITAS FINANCEIRAS': 'Empréstimos',
    'DESP EVENTUAL': 'Compras e Eventuais',
    'DESP ROLÊS/LAZER': 'Lazer e Ingressos',
    'DESP INVESTIMENTO': 'Livros e Assinaturas',
    'DESP INTERNET': 'Telefone e Streaming',
    'DESP STREAMING': 'Telefone e Streaming',
    'DESP MOTO': 'Moto',
    'DESP DOAÇÃO': 'Doações'
  };

  function u16(v, o) { return v.getUint16(o, true); }
  function u32(v, o) { return v.getUint32(o, true); }

  async function abrirZip(buf) {
    var v = new DataView(buf), fim = -1;
    for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (u32(v, i) === 0x06054b50) { fim = i; break; }
    }
    if (fim < 0) throw new Error('Arquivo não é um .xlsx válido');
    var total = u16(v, fim + 10), p = u32(v, fim + 16), arquivos = {};
    var dec = new TextDecoder();
    for (var n = 0; n < total; n++) {
      if (u32(v, p) !== 0x02014b50) break;
      var metodo = u16(v, p + 10), tam = u32(v, p + 20);
      var lNome = u16(v, p + 28), lExtra = u16(v, p + 30), lCom = u16(v, p + 32), local = u32(v, p + 42);
      var nome = dec.decode(new Uint8Array(buf, p + 46, lNome));
      arquivos[nome] = { metodo: metodo, tam: tam, local: local };
      p += 46 + lNome + lExtra + lCom;
    }
    return async function ler(nome) {
      var a = arquivos[nome];
      if (!a) return null;
      var ini = a.local + 30 + u16(v, a.local + 26) + u16(v, a.local + 28);
      var bytes = new Uint8Array(buf, ini, a.tam);
      if (a.metodo === 0) return dec.decode(bytes);
      var fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(fluxo).text();
    };
  }

  function xml(txt) { return new DOMParser().parseFromString(txt, 'application/xml'); }
  function tags(no, nome) { return Array.from(no.getElementsByTagNameNS('*', nome)); }
  function texto(no) { return tags(no, 't').map(function (t) { return t.textContent; }).join(''); }

  function colunaIdx(ref) {
    var letras = ref.replace(/[0-9]/g, ''), n = 0;
    for (var i = 0; i < letras.length; i++) n = n * 26 + (letras.charCodeAt(i) - 64);
    return n - 1;
  }

  async function lerPrimeiraAba(buf) {
    var ler = await abrirZip(buf);
    var shared = [];
    var ss = await ler('xl/sharedStrings.xml');
    if (ss) shared = tags(xml(ss), 'si').map(texto);

    var caminho = 'xl/worksheets/sheet1.xml';
    var wb = await ler('xl/workbook.xml'), rels = await ler('xl/_rels/workbook.xml.rels');
    if (wb && rels) {
      var aba = tags(xml(wb), 'sheet')[0];
      var rid = aba && (aba.getAttribute('r:id') || aba.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
      var rel = tags(xml(rels), 'Relationship').find(function (r) { return r.getAttribute('Id') === rid; });
      if (rel) {
        var alvo = rel.getAttribute('Target');
        caminho = alvo.charAt(0) === '/' ? alvo.slice(1) : 'xl/' + alvo.replace(/^\.\//, '');
      }
    }
    var folha = await ler(caminho);
    if (!folha) throw new Error('Aba não encontrada na planilha');

    return tags(xml(folha), 'row').map(function (row) {
      var linha = [];
      tags(row, 'c').forEach(function (c, i) {
        var ref = c.getAttribute('r'), idx = ref ? colunaIdx(ref) : i, t = c.getAttribute('t');
        var vEl = tags(c, 'v')[0], val = vEl ? vEl.textContent : null;
        if (t === 's') val = shared[+val];
        else if (t === 'inlineStr') val = texto(c);
        else if (t === 'b') val = val === '1';
        else if (t !== 'str' && t !== 'e' && t !== 'd' && val !== null && val !== '') val = Number(val);
        linha[idx] = val;
      });
      return linha;
    });
  }

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
  }
  function paraMes(d) {
    if (typeof d === 'number') {
      var dt = new Date(Date.UTC(1899, 11, 30) + Math.round(d * 86400000));
      return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0');
    }
    var s = String(d || '').trim(), m;
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return m[3] + '-' + m[2].padStart(2, '0');
    if ((m = s.match(/^(\d{4})-(\d{2})/))) return m[1] + '-' + m[2];
    return null;
  }
  function tituloCategoria(c) {
    return c.toLowerCase().replace(/^desp\s+/, '').replace(/(^|\s|\/)\S/g, function (x) { return x.toUpperCase(); });
  }

  async function carregarDividas(url) {
    var resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error('Planilha não encontrada (' + resp.status + ')');
    var linhas = await lerPrimeiraAba(await resp.arrayBuffer());
    var cab = (linhas[0] || []).map(norm), col = {};
    ['DATA', 'LOCAL', 'DESCRICAO', 'VALOR', 'CLASSIFICACAO', 'RESPONSAVEL'].forEach(function (k) { col[k] = cab.indexOf(k); });
    if (col.VALOR < 0 || col.RESPONSAVEL < 0 || col.DATA < 0) throw new Error('Cabeçalho da planilha fora do padrão');

    var itens = [];
    linhas.slice(1).forEach(function (r, i) {
      if (!r) return;
      var valor = Number(r[col.VALOR]), pessoa = r[col.RESPONSAVEL], mes = paraMes(r[col.DATA]);
      if (!pessoa || !isFinite(valor) || r[col.VALOR] === '' || r[col.VALOR] == null || !mes) return;
      var classif = String(r[col.CLASSIFICACAO] || '').trim().toUpperCase();
      itens.push({
        id: i + 1,
        mes: mes,
        pessoa: String(pessoa).trim().toUpperCase(),
        local: String(r[col.LOCAL] || '').trim(),
        descricao: String(r[col.DESCRICAO] || '').trim(),
        valor: Math.round(Math.abs(valor) * 100) / 100,
        categoria: CATEGORIAS[classif] || (classif ? tituloCategoria(classif) : 'Outros')
      });
    });
    return itens;
  }

  global.PLANILHA = { carregarDividas: carregarDividas, CATEGORIAS: CATEGORIAS };
})(window);
