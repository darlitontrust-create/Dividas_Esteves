/*
 * Gera o "PIX Copia e Cola" (BR Code estático, padrão EMV do Banco Central).
 * Uso: PIX.payload({ chave, nome, cidade, valor, txid, descricao })
 */
(function (global) {
  'use strict';

  function semAcento(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 .\-@+]/g, '').trim();
  }
  function campo(id, valor) {
    var v = String(valor);
    return id + (v.length < 10 ? '0' : '') + v.length + v;
  }
  function crc16(str) {
    var crc = 0xffff;
    for (var i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  function payload(o) {
    var conta = campo('00', 'br.gov.bcb.pix') + campo('01', o.chave);
    if (o.descricao) {
      var desc = semAcento(o.descricao).slice(0, Math.max(0, 99 - conta.length - 4));
      if (desc) conta += campo('02', desc);
    }
    var txid = semAcento(o.txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
    var s = campo('00', '01') +
      campo('26', conta) +
      campo('52', '0000') +
      campo('53', '986') +
      (o.valor > 0 ? campo('54', Number(o.valor).toFixed(2)) : '') +
      campo('58', 'BR') +
      campo('59', semAcento(o.nome).toUpperCase().slice(0, 25) || 'RECEBEDOR') +
      campo('60', semAcento(o.cidade).toUpperCase().slice(0, 15) || 'BRASIL') +
      campo('62', campo('05', txid)) +
      '6304';
    return s + crc16(s);
  }

  global.PIX = { payload: payload, crc16: crc16 };
})(typeof window !== 'undefined' ? window : globalThis);
