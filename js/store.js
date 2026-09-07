/* =========================================================
   store.js — persistência
   localStorage: técnicas, planos, log de treino, preferências
   IndexedDB   : arquivos de vídeo (blobs, pesados)
   ========================================================= */

const LS = {
  tecnicas: 'judo.tecnicas.v1',
  videos:   'judo.videos.v1',
  planos:   'judo.planos.v1',
  sessoes:  'judo.sessoes.v1',
  settings: 'judo.settings.v1'
};

function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function readLS(key, fallback){
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e){ console.warn('LS read', key, e); return fallback; }
}
function writeLS(key, val){
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch(e){
    alert('Não consegui salvar: o armazenamento do navegador está cheio.\n' +
          'Exporte um backup e apague vídeos que você não usa mais.');
    return false;
  }
}

const DEFAULT_SETTINGS = {
  theme: 'light',
  rate: 1,             // velocidade padrão do loop
  keepAwake: true,
  ordenar: 'manual'    // manual | nome | recente | esquecidas
};

/* status de domínio, do mais cru pro mais maduro */
const STATUS = [
  { id: 'novo',     nome: 'Vi e anotei',    cor: 'var(--fg3)' },
  { id: 'drill',    nome: 'Estou drillando', cor: 'var(--warn)' },
  { id: 'randori',  nome: 'Uso no randori',  cor: 'var(--acc)' },
  { id: 'tokui',    nome: 'Tokui-waza',      cor: 'var(--acc2)' }
];
const STATUS_POR_ID = {};
STATUS.forEach(s => { STATUS_POR_ID[s.id] = s; });

const PEGADAS = [
  { id: '',            nome: 'qualquer pegada' },
  { id: 'ai-yotsu',    nome: 'Ai-yotsu (mesma pegada)' },
  { id: 'kenka-yotsu', nome: 'Kenka-yotsu (pegada oposta)' }
];

const LINK_TIPOS = [
  { id: 'encadeia', nome: 'Encadeia com',  seta: '→', desc: 'renraku-waza: se a primeira falha, entra a segunda' },
  { id: 'contra',   nome: 'Contra-ataque', seta: '⇄', desc: 'kaeshi-waza: o que fazer quando ele tenta essa' },
  { id: 'defesa',   nome: 'Defesa contra', seta: '⊘', desc: 'como me proteger dessa técnica' },
  { id: 'variacao', nome: 'Variação de',   seta: '≈', desc: 'mesma ideia, entrada diferente' }
];
const LINK_POR_ID = {};
LINK_TIPOS.forEach(t => { LINK_POR_ID[t.id] = t; });

const Store = {
  tecnicas(){ return readLS(LS.tecnicas, []); },
  saveTecnicas(list){ return writeLS(LS.tecnicas, list); },

  /* ---- biblioteca de vídeos ----
     Um vídeo é gravado uma vez só e pode ser apontado por quantos
     clipes você quiser, cada um com o seu recorte. É o que permite
     subir a aula inteira uma vez e tirar dez técnicas dela. */
  videos(){ return readLS(LS.videos, []); },
  saveVideos(list){ return writeLS(LS.videos, list); },
  getVideo(id){ return this.videos().find(v => v.id === id) || null; },

  upsertVideo(v){
    const list = this.videos();
    const i = list.findIndex(x => x.id === v.id);
    if(i >= 0) list[i] = v; else list.unshift(v);
    this.saveVideos(list);
    return v;
  },

  /* quem aponta pra este vídeo: [{tecnica, clipe}] */
  usosDoVideo(videoId){
    const usos = [];
    this.tecnicas().forEach(t => (t.clipes || []).forEach(c => {
      if(c.tipo === 'file' && c.videoId === videoId) usos.push({ tecnica: t, clipe: c });
    }));
    return usos;
  },

  videosSemUso(){ return this.videos().filter(v => !this.usosDoVideo(v.id).length); },

  /* apaga o vídeo de verdade; os clipes que apontavam pra ele ficam órfãos
     e passam a avisar que o arquivo não está mais aqui */
  async deleteVideo(id){
    this.saveVideos(this.videos().filter(v => v.id !== id));
    await Video_DB.del(id);
  },

  planos(){ return readLS(LS.planos, []); },
  savePlanos(list){ return writeLS(LS.planos, list); },

  sessoes(){ return readLS(LS.sessoes, []); },
  saveSessoes(list){ return writeLS(LS.sessoes, list); },

  settings(){ return Object.assign({}, DEFAULT_SETTINGS, readLS(LS.settings, {})); },
  saveSettings(s){ return writeLS(LS.settings, s); },

  getTecnica(id){ return this.tecnicas().find(t => t.id === id) || null; },

  upsertTecnica(tec){
    const list = this.tecnicas();
    tec.updatedAt = Date.now();
    const i = list.findIndex(t => t.id === tec.id);
    if(i >= 0) list[i] = tec;
    else {
      // entra no topo da ordem manual
      list.forEach(t => { t.ordem = (t.ordem || 0) + 1; });
      tec.ordem = 0;
      list.unshift(tec);
    }
    this.saveTecnicas(list);
    return tec;
  },

  /* não apaga vídeo nenhum: o mesmo arquivo pode estar servindo outras
     técnicas. O que sobrar sem uso aparece na biblioteca pra você decidir. */
  async deleteTecnica(id){
    this.saveTecnicas(this.tecnicas()
      .filter(t => t.id !== id)
      .map(t => ({ ...t, links: (t.links || []).filter(l => l.para !== id) })));

    this.savePlanos(this.planos().map(p => ({ ...p, tecnicas: (p.tecnicas || []).filter(x => x !== id) })));
    this.saveSessoes(this.sessoes().map(s => ({ ...s, tecnicas: (s.tecnicas || []).filter(x => x !== id) })));
  },

  getPlano(id){ return this.planos().find(p => p.id === id) || null; },

  upsertPlano(p){
    const list = this.planos();
    p.updatedAt = Date.now();
    const i = list.findIndex(x => x.id === p.id);
    if(i >= 0) list[i] = p; else list.unshift(p);
    this.savePlanos(list);
    return p;
  },

  deletePlano(id){ this.savePlanos(this.planos().filter(p => p.id !== id)); },

  upsertSessao(s){
    const list = this.sessoes();
    const i = list.findIndex(x => x.id === s.id);
    if(i >= 0) list[i] = s; else list.push(s);
    list.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    this.saveSessoes(list);
    return s;
  },

  deleteSessao(id){ this.saveSessoes(this.sessoes().filter(s => s.id !== id)); },

  /* quantas vezes cada técnica apareceu no log, e quando foi a última */
  estatisticas(){
    const m = {};
    for(const s of this.sessoes()){
      for(const id of (s.tecnicas || [])){
        if(!m[id]) m[id] = { vezes: 0, ultima: '' };
        m[id].vezes++;
        if((s.data || '') > m[id].ultima) m[id].ultima = s.data || '';
      }
    }
    return m;
  }
};

function newTecnica(partial){
  return Object.assign({
    id: uid(),
    nome: '',
    catalogoId: '',      // se veio do catálogo oficial
    cat: 'nage',         // nage | katame | outro
    sub: '',             // te | koshi | ashi | masutemi | yokosutemi | osaekomi | shime | kansetsu
    favorita: false,
    status: 'novo',
    pegada: '',
    lado: 'direita',     // direita | esquerda | ambos
    pontos: [],          // pontos-chave (checklist curta)
    erros: [],           // erros comuns
    obs: '',
    clipes: [],
    links: [],
    tags: [],
    ordem: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }, partial || {});
}

/* Um vídeo guardado uma vez, apontado por quantos clipes você quiser. */
function newVideo(partial){
  return Object.assign({
    id: uid(),
    nome: '',            // "Aula 12/03", "Campeonato estadual"...
    size: 0,
    mime: '',
    dur: 0,
    criadoEm: Date.now()
  }, partial || {});
}

/* Um clipe não contém vídeo: aponta pra um (videoId) ou pro YouTube (ytId),
   e por cima guarda o recorte, a velocidade e as notas que são dele. */
function newClipe(partial){
  return Object.assign({
    id: uid(),
    tipo: 'file',        // file | yt
    videoId: '',         // chave na biblioteca, quando tipo === 'file'
    rotulo: '',          // "lateral", "competição", "meu treino"...
    ytId: '',
    dur: 0,              // duração total conhecida
    in: 0,               // início do loop
    out: 0,              // fim do loop (0 = até o final)
    rate: 1,
    mirror: false,
    notas: []            // [{t: segundos, txt: '...'}]
  }, partial || {});
}

function newPlano(partial){
  return Object.assign({
    id: uid(),
    nome: '',
    obs: '',
    tecnicas: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }, partial || {});
}

function hoje(){
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function newSessao(partial){
  return Object.assign({
    id: uid(),
    data: hoje(),
    tecnicas: [],
    obs: '',
    createdAt: Date.now()
  }, partial || {});
}

/* ---------- IndexedDB para vídeo ---------- */
const Video_DB = (() => {
  const DB = 'judoDB', STORE = 'video';
  let dbp = null;

  function open(){
    if(dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode){
    const db = await open();
    return db.transaction(STORE, mode).objectStore(STORE);
  }
  return {
    async put(id, blob){
      const st = await tx('readwrite');
      return new Promise((res, rej) => {
        const r = st.put(blob, id);
        r.onsuccess = () => res(true); r.onerror = () => rej(r.error);
      });
    },
    async get(id){
      try{
        const st = await tx('readonly');
        return new Promise((res) => {
          const r = st.get(id);
          r.onsuccess = () => res(r.result || null); r.onerror = () => res(null);
        });
      }catch(e){ return null; }
    },
    async del(id){
      try{
        const st = await tx('readwrite');
        return new Promise((res) => { const r = st.delete(id); r.onsuccess = () => res(true); r.onerror = () => res(false); });
      }catch(e){ return false; }
    },
    async keys(){
      try{
        const st = await tx('readonly');
        return new Promise((res) => { const r = st.getAllKeys(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
      }catch(e){ return []; }
    },
    /* apaga blobs que nem constam na biblioteca — sobra de importação
       interrompida ou de versão antiga */
    async limpar(){
      const vivos = new Set(Store.videos().map(v => v.id));
      const todas = await this.keys();
      let n = 0;
      for(const k of todas) if(!vivos.has(k)){ await this.del(k); n++; }
      return n;
    }
  };
})();

/* ---------- migração ----------
   Antes o vídeo pertencia ao clipe: o blob era gravado com a chave do
   próprio clipe. Agora existe a biblioteca. Como a chave do blob não
   muda, basta criar a ficha do vídeo com o mesmo id e apontar o clipe
   pra ela — nenhum byte precisa ser reescrito. */
function migrar(){
  const tecs = Store.tecnicas();
  const vids = Store.videos();
  const porId = {};
  vids.forEach(v => { porId[v.id] = v; });
  let mudou = false;

  tecs.forEach(t => {
    if('jp' in t){ delete t.jp; mudou = true; }
    (t.clipes || []).forEach(c => {
      if(c.tipo !== 'file' || c.videoId) return;
      c.videoId = c.id;
      if(!porId[c.videoId]){
        const v = newVideo({
          id: c.videoId,
          nome: c.nome || c.rotulo || 'Vídeo',
          size: c.size || 0, mime: c.mime || '', dur: c.dur || 0
        });
        vids.push(v); porId[v.id] = v;
      }
      delete c.nome; delete c.size; delete c.mime;
      mudou = true;
    });
  });

  if(mudou){ Store.saveTecnicas(tecs); Store.saveVideos(vids); }
  return mudou;
}

/* quanto espaço o navegador deu e quanto já foi usado */
async function quota(){
  try{
    if(!navigator.storage || !navigator.storage.estimate) return null;
    const e = await navigator.storage.estimate();
    return { usado: e.usage || 0, total: e.quota || 0 };
  }catch(e){ return null; }
}

/* ---------- helpers de arquivo ---------- */
function downloadFile(name, data, mime){
  const blob = (data instanceof Blob) ? data : new Blob([data], { type: mime || 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}
function humanSize(b){
  if(!b) return '0 B';
  if(b < 1024) return b + ' B';
  if(b < 1048576) return (b / 1024).toFixed(0) + ' KB';
  if(b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
function mmss(s){
  if(!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = s - m * 60;
  return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
}
function dataBR(iso){
  if(!iso) return '';
  const p = iso.split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}
function diasDesde(iso){
  if(!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if(isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
