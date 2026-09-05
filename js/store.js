/* =========================================================
   store.js — persistência
   localStorage: técnicas, planos, log de treino, preferências
   IndexedDB   : arquivos de vídeo (blobs, pesados)
   ========================================================= */

const LS = {
  tecnicas: 'judo.tecnicas.v1',
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
  mostrarJp: true,     // mostrar o nome em japonês
  ordenar: 'manual'    // manual | nome | recente | status
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

  async deleteTecnica(id){
    const tec = this.getTecnica(id);
    if(tec) for(const c of (tec.clipes || [])) await Video_DB.del(c.id);

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
    jp: '',
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

function newClipe(partial){
  return Object.assign({
    id: uid(),
    tipo: 'file',        // file | yt
    nome: '',
    rotulo: '',          // "lateral", "competição", "meu treino"...
    ytId: '',
    dur: 0,              // duração total conhecida
    in: 0,               // início do loop
    out: 0,              // fim do loop (0 = até o final)
    rate: 1,
    mirror: false,
    notas: [],           // [{t: segundos, txt: '...'}]
    size: 0,
    mime: ''
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
    /* apaga blobs órfãos: ficaram de clipes que já não existem */
    async limpar(){
      const vivos = new Set();
      Store.tecnicas().forEach(t => (t.clipes || []).forEach(c => vivos.add(c.id)));
      const todas = await this.keys();
      let n = 0;
      for(const k of todas) if(!vivos.has(k)){ await this.del(k); n++; }
      return n;
    }
  };
})();

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
