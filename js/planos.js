/* =========================================================
   planos.js — planos de treino (sequências ordenadas) e o
   log do que foi realmente treinado em cada dia.
   ========================================================= */

/* quando você entra numa técnica vindo de um plano, dá pra
   pular pra próxima sem voltar pra lista */
let PLANO_ATIVO = null;   // {planoId, nome, ids:[]}

/* =========================================================
   TELA: lista de planos
   ========================================================= */
function telaPlanos(){
  const planos = Store.planos();
  const wrap = document.createElement('div');

  if(!planos.length){
    wrap.appendChild(el('<div class="empty"><h3>Nenhum plano ainda</h3>' +
      '<p>Um plano é uma sequência de técnicas na ordem que você quer treinar: ' +
      'aquecimento, uchi-komi, o que está devendo. No dojo você segue de uma pra outra.</p></div>'));
  }

  planos.forEach(p => {
    const n = (p.tecnicas || []).length;
    const c = el('<div class="card"><div class="info"><b>' + esc(p.nome || 'Sem nome') + '</b>' +
      '<small>' + n + (n === 1 ? ' técnica' : ' técnicas') + (p.obs ? ' · ' + esc(p.obs) : '') + '</small></div>' +
      '<span class="dir">›</span></div>');
    c.onclick = () => go('/plano/' + p.id);
    wrap.appendChild(c);
  });

  const node = casca('Planos de treino', planos.length ? planos.length + ' planos' : '', [], wrap, 'planos');
  const fab = el('<button class="fab">+</button>');
  fab.onclick = async () => {
    const nome = await pedirTexto({ titulo: 'Novo plano', placeholder: 'Terça — pé de projeção', ok: 'Criar' });
    if(!nome) return;
    const p = newPlano({ nome });
    Store.upsertPlano(p);
    go('/plano/' + p.id);
  };
  node.appendChild(fab);
  return node;
}

/* =========================================================
   TELA: um plano
   ========================================================= */
function telaPlano(id){
  const p = Store.getPlano(id);
  if(!p) return el('<div class="content"><div class="empty"><h3>Plano não encontrado</h3></div></div>');

  const wrap = document.createElement('div');
  const lista = el('<div></div>');

  function pintar(){
    lista.innerHTML = '';
    const ids = p.tecnicas || [];
    if(!ids.length){
      lista.appendChild(el('<div class="empty"><h3>Plano vazio</h3>' +
        '<p>Junte as técnicas na ordem que você quer treinar hoje.</p></div>'));
    }
    ids.forEach((tid, i) => {
      const t = Store.getTecnica(tid);
      const c = el('<div class="card" data-id="' + tid + '">' +
        '<span class="grip" data-grip>≡</span>' +
        '<span class="badge num">' + (i + 1) + '</span>' +
        '<div class="info"><b>' + esc(t ? t.nome : '(apagada)') + '</b>' +
        '<small>' + esc(t ? (STATUS_POR_ID[t.status] || STATUS[0]).nome : '') + '</small></div>' +
        '<button class="x" style="color:var(--fg3);font-size:17px;padding:0 4px">×</button></div>');
      c.querySelector('.x').onclick = e => {
        e.stopPropagation();
        p.tecnicas = ids.filter(x => x !== tid);
        Store.upsertPlano(p); pintar();
      };
      c.addEventListener('click', e => {
        if(e.target.closest('[data-grip]') || e.target.closest('.x')) return;
        if(!t) return;
        PLANO_ATIVO = { planoId: p.id, nome: p.nome, ids: p.tecnicas.slice() };
        go('/t/' + tid);
      });
      lista.appendChild(c);
    });
    tornarOrdenavel(lista, novos => { p.tecnicas = novos; Store.upsertPlano(p); });
  }
  pintar();
  wrap.appendChild(lista);

  const bAdd = el('<button class="btn">+ adicionar técnica</button>');
  bAdd.onclick = () => {
    const dentro = new Set(p.tecnicas || []);
    const fora = Store.tecnicas().filter(t => !dentro.has(t.id));
    if(!fora.length) return toast('Todas as suas técnicas já estão neste plano');
    sheet({
      titulo: 'Adicionar ao plano',
      opcoes: fora.map(t => ({
        i: '🥋', txt: t.nome, sub: (STATUS_POR_ID[t.status] || STATUS[0]).nome,
        fn: () => { p.tecnicas = (p.tecnicas || []).concat([t.id]); Store.upsertPlano(p); pintar(); }
      }))
    });
  };
  wrap.appendChild(bAdd);

  if((p.tecnicas || []).length){
    wrap.appendChild(el('<div style="height:9px"></div>'));
    const bTreino = el('<button class="btn primary">Registrar este treino hoje</button>');
    bTreino.onclick = () => registrarTreinoHoje(p.tecnicas.slice(), p.nome);
    wrap.appendChild(bTreino);
  }

  return casca(p.nome, (p.tecnicas || []).length + ' técnicas', [
    { i: '⋯', title: 'Menu', fn: () => sheet({
      titulo: p.nome,
      opcoes: [
        { i: '✏️', txt: 'Renomear', fn: async () => {
            const n = await pedirTexto({ titulo: 'Nome do plano', valor: p.nome });
            if(n){ p.nome = n; Store.upsertPlano(p); render(); }
          } },
        { i: '📝', txt: 'Anotação do plano', sub: p.obs || 'vazia', fn: async () => {
            const n = await pedirTexto({ titulo: 'Anotação', valor: p.obs, multi: true,
              placeholder: 'foco da semana, o que o sensei pediu...' });
            if(n === null) return;
            p.obs = n; Store.upsertPlano(p); render();
          } },
        { sep: true },
        { i: '🗑', txt: 'Apagar plano', cls: 'danger', fn: async () => {
            const ok = await confirmar('Apagar o plano?', 'As técnicas continuam no seu judô.', 'Apagar');
            if(!ok) return;
            Store.deletePlano(p.id); go('/planos', true);
          } }
      ]
    }) }
  ], wrap, 'planos', () => go('/planos'));
}

/* =========================================================
   LOG DE TREINO
   ========================================================= */
function registrarTreinoHoje(ids, rotulo){
  const sess = Store.sessoes();
  const dehoje = sess.find(s => s.data === hoje());

  if(dehoje){
    const antes = new Set(dehoje.tecnicas || []);
    ids.forEach(i => antes.add(i));
    dehoje.tecnicas = Array.from(antes);
    Store.upsertSessao(dehoje);
    toast('Somado ao treino de hoje');
  } else {
    Store.upsertSessao(newSessao({ tecnicas: ids.slice(), obs: rotulo || '' }));
    toast('Treino de hoje registrado');
  }
}

function escolherPlano(tecId){
  const planos = Store.planos();
  const ops = planos.map(p => ({
    i: '📋', txt: p.nome, sub: (p.tecnicas || []).indexOf(tecId) >= 0 ? 'já está neste plano' : '',
    fn: () => {
      if((p.tecnicas || []).indexOf(tecId) >= 0) return toast('Já estava lá');
      p.tecnicas = (p.tecnicas || []).concat([tecId]);
      Store.upsertPlano(p);
      toast('Adicionada a ' + p.nome);
    }
  }));
  ops.push({ sep: true });
  ops.push({ i: '+', txt: 'Criar um plano novo', fn: async () => {
    const nome = await pedirTexto({ titulo: 'Novo plano', placeholder: 'Terça — pé de projeção', ok: 'Criar' });
    if(!nome) return;
    Store.upsertPlano(newPlano({ nome, tecnicas: [tecId] }));
    toast('Plano criado com esta técnica');
  } });
  sheet({ titulo: 'Pôr num plano', opcoes: ops });
}

function telaLog(){
  const sess = Store.sessoes();
  const tecs = Store.tecnicas();
  const stats = Store.estatisticas();
  const wrap = document.createElement('div');

  /* --- o que está sendo esquecido --- */
  if(tecs.length){
    const esquecidas = tecs.map(t => ({
      t, ultima: (stats[t.id] && stats[t.id].ultima) || '', vezes: (stats[t.id] && stats[t.id].vezes) || 0
    })).sort((a, b) => a.ultima.localeCompare(b.ultima)).slice(0, 3);

    wrap.appendChild(el('<div class="secao">Está devendo treino</div>'));
    esquecidas.forEach(e => {
      const d = e.ultima ? diasDesde(e.ultima) : null;
      const quando = d === null ? 'nunca registrada' : d === 0 ? 'treinou hoje' : d === 1 ? 'há 1 dia' : 'há ' + d + ' dias';
      const c = el('<div class="card"><div class="info"><b>' + esc(e.t.nome) + '</b>' +
        '<small>' + quando + ' · ' + e.vezes + (e.vezes === 1 ? ' registro' : ' registros') + '</small></div>' +
        '<span class="dir">›</span></div>');
      c.onclick = () => go('/t/' + e.t.id);
      wrap.appendChild(c);
    });
  }

  /* --- histórico --- */
  wrap.appendChild(el('<div class="secao">Histórico</div>'));
  if(!sess.length){
    wrap.appendChild(el('<div class="empty"><h3>Nada registrado</h3>' +
      '<p>Depois do treino, marque o que você drillou. Em duas semanas o app já mostra o que você abandonou.</p></div>'));
  }

  sess.forEach(s => {
    const d = el('<div class="dia"><div class="cab"><b>' + dataBR(s.data) + '</b>' +
      '<button class="x">⋯</button></div><div class="tags"></div></div>');
    const tags = d.querySelector('.tags');
    (s.tecnicas || []).forEach(tid => {
      const t = Store.getTecnica(tid);
      const b = el('<button class="minitag">' + esc(t ? t.nome : '(apagada)') + '</button>');
      if(t) b.onclick = () => go('/t/' + t.id);
      tags.appendChild(b);
    });
    if(!(s.tecnicas || []).length) tags.appendChild(el('<span class="minitag">sem técnicas marcadas</span>'));
    if(s.obs) d.appendChild(el('<p>' + esc(s.obs) + '</p>'));
    d.querySelector('.x').onclick = () => menuSessao(s);
    wrap.appendChild(d);
  });

  const node = casca('Treinos', sess.length ? sess.length + (sess.length === 1 ? ' registro' : ' registros') : '',
    [], wrap, 'log');
  const fab = el('<button class="fab">+</button>');
  fab.onclick = () => editarSessao(newSessao({}), true);
  node.appendChild(fab);
  return node;
}

function menuSessao(s){
  sheet({
    titulo: 'Treino de ' + dataBR(s.data),
    opcoes: [
      { i: '✏️', txt: 'Editar', fn: () => editarSessao(s, false) },
      { sep: true },
      { i: '🗑', txt: 'Apagar registro', cls: 'danger', fn: async () => {
          const ok = await confirmar('Apagar o registro?', 'Só some do log; as técnicas continuam.', 'Apagar');
          if(!ok) return;
          Store.deleteSessao(s.id); render();
        } }
    ]
  });
}

function editarSessao(s, nova){
  const corpo = el('<div></div>');

  const fData = el('<div class="field"><label>Data</label><input type="date"></div>');
  fData.querySelector('input').value = s.data || hoje();
  corpo.appendChild(fData);

  corpo.appendChild(el('<div class="field" style="margin-bottom:6px"><label>O que você treinou</label></div>'));
  const grade = el('<div class="tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px"></div>');
  const escolhidas = new Set(s.tecnicas || []);
  const tecs = Store.tecnicas();
  if(!tecs.length) grade.appendChild(el('<div class="hint">Cadastre uma técnica primeiro.</div>'));
  tecs.forEach(t => {
    const b = el('<button class="chip ' + (escolhidas.has(t.id) ? 'on' : '') + '">' + esc(t.nome) + '</button>');
    b.onclick = () => {
      if(escolhidas.has(t.id)) escolhidas.delete(t.id); else escolhidas.add(t.id);
      b.classList.toggle('on');
    };
    grade.appendChild(b);
  });
  corpo.appendChild(grade);

  const fObs = el('<div class="field"><label>Como foi</label>' +
    '<textarea placeholder="pegou bem contra o canhoto, ainda entro raso..."></textarea></div>');
  fObs.querySelector('textarea').value = s.obs || '';
  corpo.appendChild(fObs);

  const bts = el('<div class="row"></div>');
  const no = el('<button class="btn">Cancelar</button>');
  const ok = el('<button class="btn primary">Salvar</button>');
  bts.appendChild(no); bts.appendChild(ok);
  corpo.appendChild(bts);

  const sh = sheet({ titulo: nova ? 'Registrar treino' : 'Editar treino', corpo });
  no.onclick = () => sh.fechar();
  ok.onclick = () => {
    s.data = fData.querySelector('input').value || hoje();
    s.tecnicas = Array.from(escolhidas);
    s.obs = fObs.querySelector('textarea').value.trim();
    Store.upsertSessao(s);
    sh.fechar();
    render();
  };
}
