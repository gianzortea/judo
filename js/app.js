/* =========================================================
   app.js — rotas, casca, lista, catálogo, ajustes e backup
   ========================================================= */

const APP_VER = (() => {
  const s = document.querySelector('script[src*="app.js"]');
  const m = s && s.src.match(/[?&]v=(\d+)/);
  return m ? m[1] : '?';
})();

/* ids da biblioteca cujo arquivo está mesmo gravado neste aparelho */
let ARQUIVOS = new Set();

/* ---------- utilidades de DOM ---------- */
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function el(html){
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild;
}
function toast(msg, ms){
  const t = document.getElementById('toast');
  const d = document.createElement('div');
  d.textContent = msg;
  t.appendChild(d);
  setTimeout(() => d.remove(), ms || 2600);
}

/* folha de opções */
function sheet(cfg){
  const root = document.getElementById('modal-root');
  const ov = el('<div class="overlay"><div class="sheet"></div></div>');
  const sh = ov.firstElementChild;
  if(cfg.titulo) sh.appendChild(el('<h3>' + esc(cfg.titulo) + '</h3>'));
  if(cfg.sub)    sh.appendChild(el('<p class="sub">' + esc(cfg.sub) + '</p>'));

  (cfg.opcoes || []).forEach(o => {
    if(o.sep){ sh.appendChild(el('<div class="sep"></div>')); return; }
    const b = el('<button class="opt ' + (o.cls || '') + '">' +
      '<i>' + (o.i || '') + '</i><span class="txt">' + esc(o.txt) +
      (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</span></button>');
    b.onclick = () => { fechar(); if(o.fn) o.fn(); };
    sh.appendChild(b);
  });
  if(cfg.corpo) sh.appendChild(cfg.corpo);

  /* O teclado do celular cobre a parte de baixo da tela, que é justamente
     onde a folha fica. Sem isto o campo e os botões somem embaixo dele: o
     usuário digita às cegas, toca fora pra sair e a folha fecha em silêncio.
     visualViewport diz a área que sobrou; a folha se encaixa nela. */
  const vv = window.visualViewport;
  function encaixar(){
    if(!vv) return;
    ov.style.top = vv.offsetTop + 'px';
    ov.style.height = vv.height + 'px';
    ov.style.bottom = 'auto';
  }
  if(vv){
    encaixar();
    vv.addEventListener('resize', encaixar);
    vv.addEventListener('scroll', encaixar);
  }

  function fechar(){
    if(vv){
      vv.removeEventListener('resize', encaixar);
      vv.removeEventListener('scroll', encaixar);
    }
    ov.remove();
  }
  ov.onclick = e => { if(e.target === ov) fechar(); };
  root.appendChild(ov);
  return { fechar, sh };
}

function confirmar(titulo, texto, rotulo){
  return new Promise(res => {
    let escolheu = false;
    const s = sheet({
      titulo, sub: texto,
      opcoes: [
        { i: '✓', txt: rotulo || 'Confirmar', cls: 'danger', fn: () => { escolheu = true; res(true); } },
        { i: '×', txt: 'Cancelar', fn: () => { escolheu = true; res(false); } }
      ]
    });
    const ov = s.sh.parentElement;
    ov.addEventListener('click', e => { if(e.target === ov && !escolheu) res(false); });
  });
}

/* caixa de texto de uma pergunta só */
function pedirTexto(cfg){
  return new Promise(res => {
    const corpo = el('<div></div>');
    const campo = el('<div class="field">' +
      (cfg.label ? '<label>' + esc(cfg.label) + '</label>' : '') +
      (cfg.multi
        ? '<textarea placeholder="' + esc(cfg.placeholder || '') + '"></textarea>'
        : '<input type="' + (cfg.tipo || 'text') + '" placeholder="' + esc(cfg.placeholder || '') + '">') +
      (cfg.hint ? '<div class="hint">' + esc(cfg.hint) + '</div>' : '') +
      '</div>');
    const inp = campo.querySelector('input,textarea');
    inp.value = cfg.valor || '';
    corpo.appendChild(campo);
    const bts = el('<div class="row"></div>');
    const ok = el('<button class="btn primary">' + esc(cfg.ok || 'Salvar') + '</button>');
    const no = el('<button class="btn">Cancelar</button>');
    bts.appendChild(no); bts.appendChild(ok);
    corpo.appendChild(bts);

    const s = sheet({ titulo: cfg.titulo, sub: cfg.sub, corpo });
    ok.onclick = () => { s.fechar(); res(inp.value.trim()); };
    no.onclick = () => { s.fechar(); res(null); };
    if(!cfg.multi) inp.onkeydown = e => { if(e.key === 'Enter'){ s.fechar(); res(inp.value.trim()); } };
    setTimeout(() => {
      inp.focus();
      /* o teclado só sobe depois do foco; aí a folha reencaixa e o campo
         precisa ser trazido de volta pra vista */
      setTimeout(() => { try{ inp.scrollIntoView({ block: 'center' }); }catch(e){} }, 320);
    }, 90);
  });
}

/* ---------- reordenar arrastando ---------- */
function tornarOrdenavel(cont, onFim){
  let alvo = null, y0 = 0;

  cont.querySelectorAll('[data-grip]').forEach(g => {
    g.addEventListener('pointerdown', e => {
      const item = g.closest('[data-id]');
      if(!item) return;
      e.preventDefault();
      alvo = item; y0 = e.clientY;
      g.setPointerCapture(e.pointerId);
      alvo.classList.add('dragging');
    });

    g.addEventListener('pointermove', e => {
      if(!alvo) return;
      const dy = e.clientY - y0;
      alvo.style.transform = 'translateY(' + dy + 'px)';

      const kids = Array.prototype.slice.call(cont.children);
      const iA = kids.indexOf(alvo);
      const r = alvo.getBoundingClientRect();
      const meio = r.top + r.height / 2;

      for(let i = 0; i < kids.length; i++){
        const s = kids[i];
        if(s === alvo) continue;
        const sr = s.getBoundingClientRect();
        const sm = sr.top + sr.height / 2;
        if(dy < 0 && i < iA && meio < sm){ cont.insertBefore(alvo, s); break; }
        if(dy > 0 && i > iA && meio > sm){ cont.insertBefore(alvo, s.nextSibling); break; }
      }
      // depois de mover no DOM o elemento já está no lugar certo: zera o deslocamento
      const nr = alvo.getBoundingClientRect();
      if(Math.abs(nr.top - r.top) > 1){ y0 = e.clientY; alvo.style.transform = ''; }
    });

    const fim = () => {
      if(!alvo) return;
      alvo.style.transform = '';
      alvo.classList.remove('dragging');
      alvo = null;
      const ids = Array.prototype.slice.call(cont.children)
        .map(x => x.dataset.id).filter(Boolean);
      if(onFim) onFim(ids);
    };
    g.addEventListener('pointerup', fim);
    g.addEventListener('pointercancel', fim);
  });
}

/* ---------- navegação ---------- */
function go(rota, trocar){
  if(trocar) location.replace('#' + rota);
  else location.hash = rota;
}
function voltar(){
  if(history.length > 1) history.back(); else go('/', true);
}

const App = { rota: '', tela: null };

function casca(titulo, sub, acoes, conteudo, aba, voltarFn){
  const div = document.createElement('div');
  const top = el('<div class="topbar"><div class="ttl"><b>' + esc(titulo) + '</b>' +
    (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div></div>');
  if(voltarFn){
    const v = el('<button class="iconbtn">‹</button>');
    v.onclick = voltarFn;
    top.insertBefore(v, top.firstElementChild);
  }
  (acoes || []).forEach(a => {
    const b = el('<button class="iconbtn ' + (a.cls || '') + '" title="' + esc(a.title || '') + '">' + a.i + '</button>');
    b.onclick = a.fn;
    top.appendChild(b);
  });
  div.appendChild(top);
  const c = el('<div class="content"></div>');
  c.appendChild(conteudo);
  div.appendChild(c);
  if(aba) div.appendChild(tabbar(aba));
  return div;
}

function tabbar(atual){
  const abas = [
    { id: 'meu',      i: '🥋', n: 'Meu judô',  r: '/' },
    { id: 'catalogo', i: '📖', n: 'Catálogo',  r: '/catalogo' },
    { id: 'planos',   i: '📋', n: 'Planos',    r: '/planos' },
    { id: 'log',      i: '📅', n: 'Treinos',   r: '/log' },
    { id: 'ajustes',  i: '⚙️', n: 'Ajustes',   r: '/ajustes' }
  ];
  const t = el('<div class="tabbar"></div>');
  abas.forEach(a => {
    const b = el('<button class="' + (a.id === atual ? 'on' : '') + '"><i>' + a.i + '</i>' + a.n + '</button>');
    b.onclick = () => go(a.r);
    t.appendChild(b);
  });
  return t;
}

/* ---------- roteador ---------- */
async function render(){
  const h = location.hash.slice(1) || '/';
  App.rota = h;
  if(App.tela && App.tela.sair) App.tela.sair();
  App.tela = null;

  const root = document.getElementById('app');
  const p = h.split('/').filter(Boolean);
  let node;

  try{
    if(h === '/')                     node = telaLista();
    else if(p[0] === 'catalogo')      node = telaCatalogo();
    else if(p[0] === 'planos')        node = telaPlanos();
    else if(p[0] === 'plano')         node = telaPlano(p[1]);
    else if(p[0] === 'log')           node = telaLog();
    else if(p[0] === 'videos')        node = telaVideos();
    else if(p[0] === 'ajustes')       node = telaAjustes();
    else if(p[0] === 'nova')          node = telaEditor(null);
    else if(p[0] === 't' && p[2] === 'edit') node = telaEditor(p[1]);
    else if(p[0] === 't')             node = await telaTecnica(p[1]);
    else { go('/', true); return; }
  }catch(e){
    console.error(e);
    node = el('<div class="content"><div class="empty"><h3>Algo quebrou</h3><p>' + esc(e.message) + '</p></div></div>');
  }

  root.innerHTML = '';
  root.appendChild(node);
  window.scrollTo(0, 0);
  if(!/^\/t\//.test(h)) mostrarAvisoSePendente();
}

/* =========================================================
   TELA: minhas técnicas
   ========================================================= */
let filtroLista = { q: '', status: '', cat: '' };

function ordenar(list, modo, stats){
  const c = list.slice();
  if(modo === 'nome')    c.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  else if(modo === 'recente') c.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  else if(modo === 'esquecidas'){
    c.sort((a, b) => {
      const ua = (stats[a.id] && stats[a.id].ultima) || '';
      const ub = (stats[b.id] && stats[b.id].ultima) || '';
      return ua.localeCompare(ub);
    });
  }
  else c.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  return c;
}

function telaLista(){
  const st = Store.settings();
  const stats = Store.estatisticas();
  const todas = Store.tecnicas();

  const wrap = document.createElement('div');

  const busca = el('<div class="searchbar">' +
    '<input type="search" placeholder="Buscar técnica, tag, nota..." value="' + esc(filtroLista.q) + '">' +
    '</div>');
  wrap.appendChild(busca);

  const chips = el('<div class="filtros"></div>');
  const opcoesFiltro = [{ id: '', n: 'Todas' }, { id: 'fav', n: '★ Favoritas' }]
    .concat(STATUS.map(s => ({ id: s.id, n: s.nome })));
  opcoesFiltro.forEach(o => {
    const b = el('<button class="chip ' + (filtroLista.status === o.id ? 'on' : '') + '">' + esc(o.n) + '</button>');
    b.onclick = () => { filtroLista.status = o.id; render(); };
    chips.appendChild(b);
  });
  wrap.appendChild(chips);

  const lista = el('<div id="listaTec"></div>');
  wrap.appendChild(lista);

  const q = filtroLista.q.toLowerCase();
  let vis = todas.filter(t => {
    if(filtroLista.status === 'fav'){ if(!t.favorita) return false; }
    else if(filtroLista.status && t.status !== filtroLista.status) return false;
    if(!q) return true;
    const alvo = [t.nome, t.obs, (t.tags || []).join(' '),
                  (t.pontos || []).join(' '), (t.erros || []).join(' '),
                  (t.clipes || []).map(c => (c.notas || []).map(n => n.txt).join(' ')).join(' ')
                 ].join(' ').toLowerCase();
    return alvo.indexOf(q) >= 0;
  });
  vis = ordenar(vis, st.ordenar, stats);

  if(!todas.length){
    lista.appendChild(el('<div class="empty">' +
      '<h3>Sua estante está vazia</h3>' +
      '<p>Aqui ficam só as técnicas que você está aprendendo, na ordem que você quiser. ' +
      'Comece do zero ou puxe um nome do catálogo oficial.</p></div>'));
    const caixa = el('<div style="max-width:300px;margin:0 auto;display:grid;gap:9px"></div>');
    const b1 = el('<button class="btn primary">Criar técnica</button>');
    b1.onclick = () => go('/nova');
    const b2 = el('<button class="btn">Escolher no catálogo</button>');
    b2.onclick = () => go('/catalogo');
    caixa.appendChild(b1); caixa.appendChild(b2);
    lista.appendChild(caixa);
  } else if(!vis.length){
    lista.appendChild(el('<div class="empty"><h3>Nada aqui</h3><p>Nenhuma técnica bate com esse filtro.</p></div>'));
  } else {
    vis.forEach(t => lista.appendChild(cardTecnica(t, st, stats)));
    if(st.ordenar === 'manual' && !q && !filtroLista.status){
      tornarOrdenavel(lista, ids => {
        const map = {}; ids.forEach((id, i) => { map[id] = i; });
        Store.saveTecnicas(Store.tecnicas().map(t => ({ ...t, ordem: (map[t.id] != null ? map[t.id] : 999) })));
      });
    }
  }

  const inp = busca.querySelector('input');
  let deb;
  inp.oninput = () => {
    clearTimeout(deb);
    deb = setTimeout(() => { filtroLista.q = inp.value; render(); setTimeout(() => {
      const i2 = document.querySelector('.searchbar input');
      if(i2){ i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); }
    }, 0); }, 260);
  };

  const node = casca('Meu judô',
    todas.length ? todas.length + (todas.length === 1 ? ' técnica' : ' técnicas') : 'nada ainda',
    [{ i: '⇅', title: 'Ordenar', fn: menuOrdenar }],
    wrap, 'meu');

  const fab = el('<button class="fab">+</button>');
  fab.onclick = () => sheet({
    titulo: 'Adicionar técnica',
    opcoes: [
      { i: '✏️', txt: 'Criar do zero', sub: 'nome livre, do seu jeito', fn: () => go('/nova') },
      { i: '📖', txt: 'Escolher no catálogo', sub: 'nome oficial já preenchido', fn: () => go('/catalogo') }
    ]
  });
  node.appendChild(fab);
  return node;
}

function cardTecnica(t, st, stats){
  const sd = STATUS_POR_ID[t.status] || STATUS[0];
  const nclip = (t.clipes || []).length;
  const nnota = (t.clipes || []).reduce((s, c) => s + (c.notas || []).length, 0);
  const info = [];
  if(nclip) info.push(nclip + (nclip === 1 ? ' clipe' : ' clipes'));
  if(nnota) info.push(nnota + (nnota === 1 ? ' nota' : ' notas'));
  if((t.links || []).length) info.push((t.links || []).length + ' ligações');
  const ult = stats[t.id] && stats[t.id].ultima;
  if(ult){
    const d = diasDesde(ult);
    info.push(d === 0 ? 'treinei hoje' : d === 1 ? 'treinei ontem' : 'há ' + d + ' dias');
  }

  if(!info.length) info.push(sd.nome);   // sem clipe nem nota: ao menos diz onde está

  const c = el('<div class="card" data-id="' + t.id + '">' +
    (st.ordenar === 'manual' ? '<span class="grip" data-grip>≡</span>' : '') +
    '<span class="dot" style="background:' + sd.cor + '"></span>' +
    '<div class="info"><b>' + esc(t.nome || 'Sem nome') + '</b>' +
    '<small>' + esc(info.join(' · ')) + '</small></div>' +
    (t.favorita ? '<span class="star">★</span>' : '') +
    '<span class="dir">›</span></div>');

  c.addEventListener('click', e => {
    if(e.target.closest('[data-grip]')) return;
    go('/t/' + t.id);
  });
  return c;
}

function menuOrdenar(){
  const st = Store.settings();
  const ops = [
    { id: 'manual',     n: 'Minha ordem',        s: 'arraste pela alça ≡' },
    { id: 'nome',       n: 'Nome',               s: 'A a Z' },
    { id: 'recente',    n: 'Mexi recentemente',  s: 'a última que editei primeiro' },
    { id: 'esquecidas', n: 'Mais esquecidas',    s: 'a que não treino há mais tempo primeiro' }
  ];
  sheet({
    titulo: 'Ordenar por',
    opcoes: ops.map(o => ({
      i: st.ordenar === o.id ? '●' : '○', txt: o.n, sub: o.s,
      cls: st.ordenar === o.id ? 'on' : '',
      fn: () => { st.ordenar = o.id; Store.saveSettings(st); render(); }
    }))
  });
}

/* =========================================================
   TELA: catálogo oficial
   ========================================================= */
let filtroCat = { q: '', cat: 'nage' };

function telaCatalogo(){
  const st = Store.settings();
  const minhas = Store.tecnicas();
  const usados = {};
  minhas.forEach(t => { if(t.catalogoId) usados[t.catalogoId] = t.id; });

  const wrap = document.createElement('div');
  wrap.appendChild(el('<div class="catnota">' + esc(CATALOGO_AVISO) + '</div>'));

  const busca = el('<div class="searchbar"><input type="search" placeholder="Buscar no catálogo..." value="' + esc(filtroCat.q) + '"></div>');
  wrap.appendChild(busca);

  const chips = el('<div class="filtros"></div>');
  [{ id: 'nage', n: 'Nage-waza' }, { id: 'katame', n: 'Katame-waza' }].forEach(o => {
    const b = el('<button class="chip ' + (filtroCat.cat === o.id ? 'on' : '') + '">' + o.n + '</button>');
    b.onclick = () => { filtroCat.cat = o.id; render(); };
    chips.appendChild(b);
  });
  wrap.appendChild(chips);

  const q = filtroCat.q.toLowerCase().replace(/[- ]/g, '');
  const vis = CATALOGO.filter(t => {
    if(!q && t.cat !== filtroCat.cat) return false;
    if(!q) return true;
    const alvo = (t.nome + t.trad + t.id).toLowerCase().replace(/[- ]/g, '');
    return alvo.indexOf(q) >= 0;
  });

  /* agrupado: nage por grupo do gokyo, katame por sub */
  const grupos = [];
  const chave = t => (filtroCat.cat === 'katame' || t.cat === 'katame') ? ('sub:' + t.sub) : ('gk:' + t.grupo);
  const rotulo = k => k.indexOf('sub:') === 0
    ? (SUBS[k.slice(4)] ? SUBS[k.slice(4)].nome + ' — ' + SUBS[k.slice(4)].desc : k)
    : (GOKYO[k.slice(3)] || 'Outras');

  vis.forEach(t => {
    const k = chave(t);
    let g = grupos.find(x => x.k === k);
    if(!g){ g = { k, itens: [] }; grupos.push(g); }
    g.itens.push(t);
  });

  if(!vis.length){
    wrap.appendChild(el('<div class="empty"><h3>Nada encontrado</h3><p>Tente parte do nome, como "uchi" ou "gari".</p></div>'));
  }

  grupos.forEach(g => {
    wrap.appendChild(el('<div class="secao">' + esc(rotulo(g.k)) + '</div>'));
    const box = el('<div style="background:var(--bg2);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden"></div>');
    g.itens.forEach(t => {
      const jaId = usados[t.id];
      const sub = SUBS[t.sub] ? SUBS[t.sub].nome : '';
      const linha = el('<div class="catlin ' + (jaId ? 'ja' : '') + '">' +
        '<div class="info"><b>' + esc(t.nome) + '</b>' +
        '<small>' + esc(t.trad + (sub ? ' · ' + sub : '')) + '</small>' +
        (t.nota ? '<em>⚠ ' + esc(t.nota) + '</em>' : '') +
        '</div>' +
        '<button class="add">' + (jaId ? '✓' : '+') + '</button></div>');

      linha.querySelector('.add').onclick = e => {
        e.stopPropagation();
        if(jaId) return go('/t/' + jaId);
        adicionarDoCatalogo(t);
      };
      linha.onclick = () => {
        sheet({
          titulo: t.nome,
          sub: t.trad + (t.nota ? '\n⚠ ' + t.nota : ''),
          opcoes: [
            jaId
              ? { i: '🥋', txt: 'Abrir no meu judô', fn: () => go('/t/' + jaId) }
              : { i: '+', txt: 'Adicionar ao meu judô', sub: 'com o nome já preenchido', fn: () => adicionarDoCatalogo(t) }
          ]
        });
      };
      box.appendChild(linha);
    });
    wrap.appendChild(box);
  });

  const inp = busca.querySelector('input');
  let deb;
  inp.oninput = () => {
    clearTimeout(deb);
    deb = setTimeout(() => { filtroCat.q = inp.value; render(); setTimeout(() => {
      const i2 = document.querySelector('.searchbar input');
      if(i2){ i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); }
    }, 0); }, 260);
  };

  return casca('Catálogo', CATALOGO.length + ' técnicas oficiais', [], wrap, 'catalogo');
}

function adicionarDoCatalogo(t){
  const nova = newTecnica({
    nome: t.nome, catalogoId: t.id,
    cat: t.cat, sub: t.sub
  });
  Store.upsertTecnica(nova);
  toast(t.nome + ' entrou no seu judô');
  go('/t/' + nova.id);
}

/* =========================================================
   TELA: biblioteca de vídeos
   Um arquivo, vários clipes. Aqui você vê quem usa o quê e
   o que está ocupando espaço à toa.
   ========================================================= */
function telaVideos(){
  const vids = Store.videos();
  const wrap = document.createElement('div');

  if(!vids.length){
    wrap.appendChild(el('<div class="empty"><h3>Nenhum vídeo ainda</h3>' +
      '<p>Quando você subir um vídeo numa técnica, ele passa a morar aqui — e daí em diante ' +
      'outras técnicas podem apontar pro mesmo arquivo, cada uma com o seu recorte.</p></div>'));
    return casca('Biblioteca', '', [], wrap, null, () => go('/ajustes'));
  }

  const total = vids.reduce((s, v) => s + (v.size || 0), 0);

  vids.forEach(v => {
    const usos = Store.usosDoVideo(v.id);
    const falta = !ARQUIVOS.has(v.id);
    const info = [humanSize(v.size)];
    if(v.dur) info.push(mmss(v.dur));
    info.push(usos.length ? 'em ' + usos.length + (usos.length === 1 ? ' clipe' : ' clipes') : 'sem uso');

    const c = el('<div class="card">' +
      '<span class="dot" style="background:' + (falta ? 'var(--danger)' : usos.length ? 'var(--acc2)' : 'var(--fg3)') + '"></span>' +
      '<div class="info"><b>' + esc(v.nome || 'Vídeo') + '</b>' +
      '<small>' + esc(info.join(' · ')) + (falta ? ' · arquivo ausente' : '') + '</small></div>' +
      '<span class="dir">›</span></div>');
    c.onclick = () => menuVideo(v, usos);
    wrap.appendChild(c);
  });

  const semUso = Store.videosSemUso();
  if(semUso.length){
    const bytes = semUso.reduce((s, v) => s + (v.size || 0), 0);
    wrap.appendChild(el('<div style="height:10px"></div>'));
    const b = el('<button class="btn danger">Apagar os ' + semUso.length +
      ' sem uso · libera ' + humanSize(bytes) + '</button>');
    b.onclick = async () => {
      const ok = await confirmar('Apagar ' + semUso.length + (semUso.length === 1 ? ' vídeo?' : ' vídeos?'),
        'Nenhuma técnica aponta pra eles. Libera ' + humanSize(bytes) + '. Não dá pra desfazer.', 'Apagar');
      if(!ok) return;
      for(const v of semUso){ await Store.deleteVideo(v.id); ARQUIVOS.delete(v.id); }
      toast(humanSize(bytes) + ' liberados');
      render();
    };
    wrap.appendChild(b);
  }

  return casca('Biblioteca',
    vids.length + (vids.length === 1 ? ' vídeo · ' : ' vídeos · ') + humanSize(total),
    [], wrap, null, () => go('/ajustes'));
}

function menuVideo(v, usos){
  const falta = !ARQUIVOS.has(v.id);

  const ops = [
    /* reanexa o arquivo a uma ficha que ficou sem ele — depois de um
       backup .json (que não leva vídeo), de uma limpeza do navegador, ou
       de o sistema ter descartado o armazenamento. Os clipes continuam
       apontando pra este id, então os recortes e as notas ficam de pé. */
    { i: falta ? '📎' : '🔄', txt: falta ? 'Anexar o arquivo' : 'Substituir o arquivo',
      sub: usos.length
        ? 'mantém os recortes e as notas dos ' + usos.length + (usos.length === 1 ? ' clipe' : ' clipes')
        : 'escolher o arquivo deste vídeo',
      fn: () => {
        aoEscolherVideo = async (file) => {
          try{
            await Video_DB.put(v.id, file);
            ARQUIVOS.add(v.id);
          }catch(e){
            return sheet({ titulo: 'Não consegui guardar',
              sub: 'O armazenamento do navegador recusou o arquivo (' + humanSize(file.size) + ').',
              opcoes: [{ i: '✓', txt: 'Entendi' }] });
          }
          v.size = file.size;
          v.mime = file.type;
          Store.upsertVideo(v);
          toast('Arquivo anexado — ' + usos.length + (usos.length === 1 ? ' clipe voltou' : ' clipes voltaram'));
          render();
        };
        document.getElementById('fileVideo').click();
      } },
    { i: '🏷', txt: 'Renomear', sub: v.nome || 'sem nome', fn: async () => {
        const n = await pedirTexto({ titulo: 'Nome do vídeo', valor: v.nome,
          sub: 'Vale pra todas as técnicas que usam este arquivo.', placeholder: 'Aula 12/03' });
        if(!n) return;
        v.nome = n; Store.upsertVideo(v); render();
      } }
  ];

  if(usos.length){
    ops.push({ sep: true });
    usos.forEach(u => ops.push({
      i: '🥋', txt: u.tecnica.nome,
      sub: (u.clipe.in || u.clipe.out)
        ? mmss(u.clipe.in || 0) + ' → ' + mmss(u.clipe.out > 0 ? u.clipe.out : (v.dur || 0))
        : 'vídeo inteiro',
      fn: () => go('/t/' + u.tecnica.id)
    }));
  }

  ops.push({ sep: true });
  ops.push({ i: '🗑', txt: 'Apagar o vídeo', cls: 'danger',
    sub: usos.length ? usos.length + (usos.length === 1 ? ' clipe fica sem arquivo' : ' clipes ficam sem arquivo') : 'nada aponta pra ele',
    fn: async () => {
      const ok = await confirmar('Apagar ' + (v.nome || 'o vídeo') + '?',
        (usos.length
          ? usos.length + (usos.length === 1 ? ' clipe passa' : ' clipes passam') + ' a avisar que o arquivo sumiu, mas os recortes e as notas ficam. '
          : '') + 'Libera ' + humanSize(v.size) + '. Não dá pra desfazer.',
        'Apagar');
      if(!ok) return;
      await Store.deleteVideo(v.id);
      ARQUIVOS.delete(v.id);
      toast(humanSize(v.size) + ' liberados');
      render();
    } });

  sheet({
    titulo: v.nome || 'Vídeo',
    sub: humanSize(v.size) + (v.dur ? ' · ' + mmss(v.dur) : '') +
         (usos.length ? '' : '\nNenhuma técnica usa este vídeo.'),
    opcoes: ops
  });
}

/* =========================================================
   TELA: ajustes
   ========================================================= */
function telaAjustes(){
  const st = Store.settings();
  const wrap = document.createElement('div');

  /* interruptor genérico: lê e escreve através de duas funções */
  const troca = (rotulo, sub, ler, escrever) => {
    const s = el('<label class="switch"><span>' + esc(rotulo) +
      (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
      '<input type="checkbox" ' + (ler() ? 'checked' : '') + '></label>');
    s.querySelector('input').onchange = e => { escrever(e.target.checked); Store.saveSettings(st); };
    return s;
  };
  const bool = (chave, aoMudar) => [
    () => !!st[chave],
    v => { st[chave] = v; if(aoMudar) aoMudar(v); }
  ];

  wrap.appendChild(el('<div class="secao">Aparência</div>'));
  wrap.appendChild(troca('Tema escuro', 'melhor no dojo com pouca luz',
    () => st.theme === 'dark',
    v => { st.theme = v ? 'dark' : 'light'; aplicarTema(st.theme); }));
  wrap.appendChild(troca('Manter a tela acesa', 'enquanto um clipe está rodando',
    ...bool('keepAwake')));

  wrap.appendChild(el('<div class="secao">Loop</div>'));
  const rateBox = el('<div class="field"><label>Velocidade padrão de um clipe novo</label></div>');
  const seg = el('<div class="rateseg" style="width:100%"></div>');
  RATES.forEach(r => {
    const b = el('<button style="flex:1" class="' + (st.rate === r ? 'on' : '') + '">' + r + '×</button>');
    b.onclick = () => { st.rate = r; Store.saveSettings(st); render(); };
    seg.appendChild(b);
  });
  rateBox.appendChild(seg);
  rateBox.appendChild(el('<div class="hint">Cada clipe guarda a própria velocidade; isto é só o valor inicial.</div>'));
  wrap.appendChild(rateBox);

  wrap.appendChild(el('<div class="secao">Backup</div>'));
  const bJson = el('<button class="btn">Exportar ficha (.json)</button>');
  bJson.onclick = exportarJson;
  const bZip = el('<button class="btn">Exportar tudo com vídeos (.zip)</button>');
  bZip.onclick = exportarZip;
  const bImp = el('<button class="btn">Importar backup</button>');
  bImp.onclick = () => document.getElementById('fileJson').click();
  wrap.appendChild(bJson);
  wrap.appendChild(el('<div style="height:8px"></div>'));
  wrap.appendChild(bZip);
  wrap.appendChild(el('<div style="height:8px"></div>'));
  wrap.appendChild(bImp);
  wrap.appendChild(el('<div class="hint">A ficha .json leva técnicas, notas, ligações, planos e o log — poucos KB, dá pra mandar por mensagem. ' +
    'Os vídeos só vão no .zip, que tem o tamanho real deles.</div>'));

  wrap.appendChild(el('<div class="secao">Armazenamento</div>'));

  const vids = Store.videos();
  const semUso = Store.videosSemUso().length;
  const bBiblio = el('<div class="card"><div class="info"><b>Biblioteca de vídeos</b>' +
    '<small>' + (vids.length ? vids.length + (vids.length === 1 ? ' vídeo' : ' vídeos') +
      ' · ' + humanSize(vids.reduce((s, v) => s + (v.size || 0), 0)) +
      (semUso ? ' · ' + semUso + ' sem uso' : '') : 'nenhum vídeo ainda') +
    '</small></div><span class="dir">›</span></div>');
  bBiblio.onclick = () => go('/videos');
  wrap.appendChild(bBiblio);
  wrap.appendChild(el('<div class="hint">Cada arquivo é guardado uma vez só, por mais técnicas que apontem pra ele.</div>'));

  const quotaBox = el('<div class="field"><label>Calculando...</label><div class="barra"><i style="width:0"></i></div></div>');
  wrap.appendChild(quotaBox);
  quota().then(q => {
    if(!q || !q.total){ quotaBox.querySelector('label').textContent = 'O navegador não informa o espaço disponível.'; return; }
    const pct = Math.min(100, q.usado / q.total * 100);
    quotaBox.querySelector('label').textContent = humanSize(q.usado) + ' usados de ' + humanSize(q.total) + ' disponíveis';
    quotaBox.querySelector('.barra i').style.width = pct.toFixed(1) + '%';
  });
  const bLimpar = el('<button class="btn">Apagar vídeos órfãos</button>');
  bLimpar.onclick = async () => {
    const n = await Video_DB.limpar();
    ARQUIVOS = new Set(await Video_DB.keys());
    toast(n ? n + (n === 1 ? ' vídeo solto apagado' : ' vídeos soltos apagados') : 'Nada solto por aqui');
    render();
  };
  wrap.appendChild(bLimpar);
  wrap.appendChild(el('<div class="hint">Vídeos que sobraram de clipes já apagados. Não mexe em nada que esteja em uso.</div>'));

  wrap.appendChild(el('<div class="secao">Zona de risco</div>'));
  const bZerar = el('<button class="btn danger">Apagar tudo deste aparelho</button>');
  bZerar.onclick = async () => {
    const ok = await confirmar('Apagar tudo?',
      'Some tudo: técnicas, notas, vídeos, planos e o log. Não dá pra desfazer. Exporte um backup antes.',
      'Apagar tudo');
    if(!ok) return;
    for(const k of await Video_DB.keys()) await Video_DB.del(k);
    [LS.tecnicas, LS.planos, LS.sessoes].forEach(k => localStorage.removeItem(k));
    ARQUIVOS = new Set();
    toast('Tudo apagado');
    go('/', true); render();
  };
  wrap.appendChild(bZerar);

  wrap.appendChild(el('<div class="secao">Sobre</div>'));
  const bUpd = el('<button class="btn">Procurar atualização</button>');
  bUpd.onclick = procurarAtualizacao;
  wrap.appendChild(bUpd);
  wrap.appendChild(el('<div class="hint" style="text-align:center;margin-top:14px">Judo v' + APP_VER +
    '<br>Tudo fica só neste aparelho. Exporte um backup de vez em quando.</div>'));

  return casca('Ajustes', '', [], wrap, 'ajustes');
}

function aplicarTema(t){
  document.documentElement.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name=theme-color]');
  if(m) m.setAttribute('content', t === 'dark' ? '#0f1115' : '#fbfbfd');
}

/* =========================================================
   BACKUP
   ========================================================= */
function pacote(){
  return {
    app: 'judo', versao: 2,
    exportadoEm: new Date().toISOString(),
    tecnicas: Store.tecnicas(),
    videos: Store.videos(),
    planos: Store.planos(),
    sessoes: Store.sessoes(),
    settings: Store.settings()
  };
}

function exportarJson(){
  const nome = 'judo-backup-' + hoje() + '.json';
  downloadFile(nome, JSON.stringify(pacote(), null, 1), 'application/json');
  toast('Ficha exportada');
}

function extensao(mime, nome){
  const m = (nome || '').match(/\.(\w{2,5})$/);
  if(m) return m[1].toLowerCase();
  if(/mp4/.test(mime)) return 'mp4';
  if(/webm/.test(mime)) return 'webm';
  if(/quicktime|mov/.test(mime)) return 'mov';
  return 'bin';
}

async function exportarZip(){
  const dados = pacote();
  const arquivos = [{ nome: 'judo.json', blob: new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' }) }];

  /* percorre a biblioteca, não os clipes: um vídeo usado por dez
     técnicas entra no .zip uma vez só */
  let bytes = 0;
  for(const v of dados.videos){
    const b = await Video_DB.get(v.id);
    if(!b) continue;
    arquivos.push({ nome: 'videos/' + v.id + '.' + extensao(v.mime, v.nome), blob: b });
    bytes += b.size;
  }

  if(arquivos.length === 1){
    toast('Nenhum vídeo guardado aqui: use a ficha .json');
    return;
  }

  const corpo = el('<div class="prog-modal"><b>Montando o .zip</b>' +
    '<div class="barra"><i style="width:0"></i></div>' +
    '<small>' + arquivos.length + ' arquivos · ' + humanSize(bytes) + '</small></div>');
  const s = sheet({ corpo });
  const barra = corpo.querySelector('.barra i');

  try{
    const zip = await Zip.criar(arquivos, (i, n) => { barra.style.width = (i / n * 100).toFixed(0) + '%'; });
    s.fechar();
    downloadFile('judo-backup-' + hoje() + '.zip', zip);
    toast('Backup de ' + humanSize(zip.size) + ' exportado');
  }catch(e){
    s.fechar();
    sheet({ titulo: 'Não deu', sub: e.message, opcoes: [{ i: '✓', txt: 'Entendi' }] });
  }
}

async function importarArquivo(file){
  let dados = null, videos = [];

  try{
    if(/\.zip$/i.test(file.name) || file.type === 'application/zip'){
      const itens = await Zip.ler(file);
      const j = itens.find(x => x.nome === 'judo.json' || /judo.*\.json$/.test(x.nome));
      if(!j) throw new Error('O .zip não tem o judo.json dentro.');
      dados = JSON.parse(await j.blob.text());
      videos = itens.filter(x => x.nome.indexOf('videos/') === 0);
    } else {
      dados = JSON.parse(await file.text());
    }
  }catch(e){
    return sheet({ titulo: 'Arquivo inválido', sub: e.message, opcoes: [{ i: '✓', txt: 'Entendi' }] });
  }

  if(!dados || dados.app !== 'judo' || !Array.isArray(dados.tecnicas)){
    return sheet({ titulo: 'Arquivo inválido', sub: 'Isso não parece um backup do Judo.', opcoes: [{ i: '✓', txt: 'Entendi' }] });
  }

  const resumo = dados.tecnicas.length + ' técnicas' +
    (videos.length ? ', ' + videos.length + ' vídeos' : ', sem vídeos') +
    (dados.planos ? ', ' + dados.planos.length + ' planos' : '') +
    (dados.sessoes ? ', ' + dados.sessoes.length + ' treinos no log' : '');

  sheet({
    titulo: 'Importar backup',
    sub: resumo + '.\nExportado em ' + (dados.exportadoEm || '?').slice(0, 10) + '.',
    opcoes: [
      { i: '＋', txt: 'Mesclar', sub: 'mantém o que já existe e acrescenta o que falta',
        fn: () => aplicarImport(dados, videos, false) },
      { i: '⟳', txt: 'Substituir tudo', sub: 'apaga o que está aqui e põe o do backup', cls: 'danger',
        fn: async () => {
          const ok = await confirmar('Substituir tudo?', 'O que está neste aparelho some. Não dá pra desfazer.', 'Substituir');
          if(ok) aplicarImport(dados, videos, true);
        } }
    ]
  });
}

async function aplicarImport(dados, videos, substituir){
  const corpo = el('<div class="prog-modal"><b>Importando</b>' +
    '<div class="barra"><i style="width:0"></i></div><small>gravando os vídeos...</small></div>');
  const s = sheet({ corpo });
  const barra = corpo.querySelector('.barra i');

  try{
    if(substituir){
      for(const k of await Video_DB.keys()) await Video_DB.del(k);
    }

    for(let i = 0; i < videos.length; i++){
      const id = videos[i].nome.replace(/^videos\//, '').replace(/\.\w+$/, '');
      await Video_DB.put(id, videos[i].blob);
      barra.style.width = ((i + 1) / videos.length * 100).toFixed(0) + '%';
    }
    ARQUIVOS = new Set(await Video_DB.keys());

    const juntar = (atual, novo, chave) => {
      if(substituir) return novo || [];
      const vistos = new Set(atual.map(x => x.id));
      return atual.concat((novo || []).filter(x => !vistos.has(x.id)));
    };

    Store.saveTecnicas(juntar(substituir ? [] : Store.tecnicas(), dados.tecnicas));
    Store.saveVideos(juntar(substituir ? [] : Store.videos(), dados.videos));
    Store.savePlanos(juntar(substituir ? [] : Store.planos(), dados.planos));
    Store.saveSessoes(juntar(substituir ? [] : Store.sessoes(), dados.sessoes));
    if(substituir && dados.settings) Store.saveSettings(dados.settings);

    /* backup da versão 1 não tinha biblioteca: o blob estava gravado com a
       chave do clipe, então a migração monta a biblioteca a partir dele */
    migrar();

    s.fechar();
    aplicarTema(Store.settings().theme);
    toast('Backup importado');
    go('/', true); render();
  }catch(e){
    s.fechar();
    sheet({ titulo: 'Não deu', sub: e.message, opcoes: [{ i: '✓', txt: 'Entendi' }] });
  }
}

/* =========================================================
   ATUALIZAÇÃO (service worker)
   ========================================================= */
let temAtualizacao = false;

function mostrarAvisoSePendente(){
  if(!temAtualizacao) return;
  if(document.getElementById('updBar')) return;
  const bar = el('<div id="updBar"><span>Nova versão disponível</span>' +
    '<button class="upd-yes">Atualizar</button><button class="upd-no">Depois</button></div>');
  bar.querySelector('.upd-yes').onclick = () => location.reload();
  bar.querySelector('.upd-no').onclick = () => { temAtualizacao = false; bar.remove(); };
  document.body.appendChild(bar);
}

function procurarAtualizacao(){
  if(!navigator.serviceWorker){ toast('Sem service worker aqui'); return; }
  navigator.serviceWorker.getRegistration().then(r => {
    if(!r) return toast('Rode pelo endereço do app pra ter atualização');
    toast('Procurando...');
    r.update().then(() => setTimeout(() => {
      if(temAtualizacao) mostrarAvisoSePendente();
      else toast('Você já está na última versão');
    }, 1400));
  });
}

function registrarSW(){
  if(!('serviceWorker' in navigator)) return;
  if(location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    if(reg.waiting) { temAtualizacao = true; mostrarAvisoSePendente(); }
    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      if(!novo) return;
      novo.addEventListener('statechange', () => {
        if(novo.state === 'installed' && navigator.serviceWorker.controller){
          temAtualizacao = true;
          // nunca interrompe quem está estudando um clipe
          if(!document.querySelector('.viewer')) mostrarAvisoSePendente();
        }
      });
    });
  }).catch(() => {});
}

/* =========================================================
   BOOT
   ========================================================= */
(async function boot(){
  aplicarTema(Store.settings().theme);
  migrar();
  try{ ARQUIVOS = new Set(await Video_DB.keys()); }catch(e){}

  document.getElementById('fileJson').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if(f) importarArquivo(f);
  });

  window.addEventListener('hashchange', render);
  await render();
  registrarSW();
})();
