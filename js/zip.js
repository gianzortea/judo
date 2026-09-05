/* =========================================================
   zip.js — ZIP mínimo, método "store" (sem compressão)
   Vídeo já é comprimido: comprimir de novo só gastaria tempo
   e não economizaria nada. Sem compressão, escrever e ler o
   arquivo é trivial e cabe em ~200 linhas sem dependência.

   Nunca junta tudo num ArrayBuffer: o resultado é um Blob
   montado a partir dos Blobs originais, então um backup de
   1 GB não precisa de 1 GB de RAM.
   ========================================================= */

const Zip = (() => {

  /* ---------- CRC32 ---------- */
  const TAB = (() => {
    const t = new Uint32Array(256);
    for(let n = 0; n < 256; n++){
      let c = n;
      for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crcUpdate(crc, bytes){
    let c = crc ^ 0xFFFFFFFF;
    for(let i = 0; i < bytes.length; i++) c = TAB[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* percorre o blob em pedaços de 4 MB só pra calcular o CRC */
  async function crcBlob(blob){
    const PEDACO = 4 * 1024 * 1024;
    let crc = 0;
    for(let p = 0; p < blob.size; p += PEDACO){
      const buf = await blob.slice(p, Math.min(p + PEDACO, blob.size)).arrayBuffer();
      crc = crcUpdate(crc, new Uint8Array(buf));
    }
    return crc;
  }

  /* ---------- escrita de campos ---------- */
  function W(n){
    const b = new Uint8Array(n); let o = 0;
    return {
      u16(v){ b[o++] = v & 255; b[o++] = (v >>> 8) & 255; return this; },
      u32(v){ b[o++] = v & 255; b[o++] = (v >>> 8) & 255; b[o++] = (v >>> 16) & 255; b[o++] = (v >>> 24) & 255; return this; },
      raw(a){ b.set(a, o); o += a.length; return this; },
      out(){ return b; }
    };
  }
  const enc = new TextEncoder();

  function dosData(d){
    const data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    return { data: data & 0xFFFF, hora: hora & 0xFFFF };
  }

  /* ---------- criar ---------- */
  /* arquivos: [{nome, blob}] -> Blob do .zip */
  async function criar(arquivos, aoProgredir){
    const partes = [], central = [];
    const dt = dosData(new Date());
    let offset = 0, i = 0;

    for(const arq of arquivos){
      const blob = (arq.blob instanceof Blob) ? arq.blob : new Blob([arq.blob]);
      const nome = enc.encode(arq.nome);
      const tam = blob.size;
      if(tam > 0xFFFFFFFF) throw new Error('Arquivo maior que 4 GB não cabe neste formato: ' + arq.nome);
      const crc = await crcBlob(blob);

      const local = W(30 + nome.length)
        .u32(0x04034b50).u16(20).u16(0x0800).u16(0)
        .u16(dt.hora).u16(dt.data)
        .u32(crc).u32(tam).u32(tam)
        .u16(nome.length).u16(0).raw(nome).out();

      partes.push(local, blob);

      central.push(W(46 + nome.length)
        .u32(0x02014b50).u16(20).u16(20).u16(0x0800).u16(0)
        .u16(dt.hora).u16(dt.data)
        .u32(crc).u32(tam).u32(tam)
        .u16(nome.length).u16(0).u16(0)
        .u16(0).u16(0).u32(0).u32(offset).raw(nome).out());

      offset += local.length + tam;
      if(offset > 0xFFFFFFFF) throw new Error('Backup passou de 4 GB. Exporte em partes.');
      i++;
      if(aoProgredir) aoProgredir(i, arquivos.length);
    }

    const cdTam = central.reduce((s, c) => s + c.length, 0);
    const eocd = W(22)
      .u32(0x06054b50).u16(0).u16(0)
      .u16(central.length).u16(central.length)
      .u32(cdTam).u32(offset).u16(0).out();

    return new Blob(partes.concat(central, [eocd]), { type: 'application/zip' });
  }

  /* ---------- ler ---------- */
  function R(dv){
    let o = 0;
    return {
      pos(p){ o = p; return this; },
      u16(){ const v = dv.getUint16(o, true); o += 2; return v; },
      u32(){ const v = dv.getUint32(o, true); o += 4; return v; },
      pula(n){ o += n; return this; },
      onde(){ return o; }
    };
  }

  /* Blob do .zip -> [{nome, blob}] */
  async function ler(zipBlob){
    // o EOCD fica no fim; 64 KB cobrem qualquer comentário razoável
    const cauda = zipBlob.slice(Math.max(0, zipBlob.size - 65558));
    const buf = new Uint8Array(await cauda.arrayBuffer());
    let eocd = -1;
    for(let i = buf.length - 22; i >= 0; i--){
      if(buf[i] === 0x50 && buf[i+1] === 0x4b && buf[i+2] === 0x05 && buf[i+3] === 0x06){ eocd = i; break; }
    }
    if(eocd < 0) throw new Error('Não parece um arquivo .zip válido.');

    const dvEocd = new DataView(buf.buffer, buf.byteOffset + eocd);
    const total  = dvEocd.getUint16(10, true);
    const cdTam  = dvEocd.getUint32(12, true);
    const cdOff  = dvEocd.getUint32(16, true);

    const cd = new DataView(await zipBlob.slice(cdOff, cdOff + cdTam).arrayBuffer());
    const r = R(cd);
    const dec = new TextDecoder();
    const itens = [];

    for(let n = 0; n < total; n++){
      if(r.u32() !== 0x02014b50) break;
      r.pula(4);                       // versões
      const flags = r.u16();
      const comp  = r.u16();
      r.pula(4);                       // hora + data
      r.pula(4);                       // crc
      const tamComp = r.u32();
      const tamReal = r.u32();
      const nLen = r.u16(), eLen = r.u16(), cLen = r.u16();
      r.pula(8);                       // disco, atributos
      const lOff = r.u32();
      const nomeBytes = new Uint8Array(cd.buffer, cd.byteOffset + r.onde(), nLen);
      const nome = dec.decode(nomeBytes);
      r.pula(nLen + eLen + cLen);

      if(comp !== 0) throw new Error('Entrada comprimida não suportada: ' + nome);
      if(nome.endsWith('/')) continue;
      itens.push({ nome, lOff, tam: tamComp || tamReal, flags });
    }

    // o cabeçalho local repete nome e extra com tamanhos possivelmente diferentes
    const saida = [];
    for(const it of itens){
      const h = new DataView(await zipBlob.slice(it.lOff, it.lOff + 30).arrayBuffer());
      if(h.getUint32(0, true) !== 0x04034b50) throw new Error('Cabeçalho corrompido em ' + it.nome);
      const ini = it.lOff + 30 + h.getUint16(26, true) + h.getUint16(28, true);
      saida.push({ nome: it.nome, blob: zipBlob.slice(ini, ini + it.tam) });
    }
    return saida;
  }

  return { criar, ler };
})();
