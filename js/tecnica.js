/* =========================================================
   tecnica.js — a tela de estudo de uma técnica e o editor
   da ficha. Aqui mora o loop, o recorte e as notas presas
   a um instante do clipe.
   ========================================================= */

/* handler temporário do input de vídeo escondido */
let aoEscolherVideo = null;
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('fileVideo');
  if(inp) inp.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if(f && aoEscolherVideo) aoEscolherVideo(f);
    aoEscolherVideo = null;
  });
});

async function telaTecnica(id){
  const tec = Store.getTecnica(id);
  if(!tec) return el('<div class="content"><div class="empty"><h3>Técnica não encontrada</h3></div></div>');

  const st = Store.settings();
  let iClipe = 0;
  let player = null;
  let tAtual = 0;

  const raiz = el('<div class="viewer"></div>');

  /* ---------- topo ---------- */
  /* veio de um plano? então dá pra andar pela sequência sem voltar */
  const noPlano = PLANO_ATIVO && PLANO_ATIVO.ids.indexOf(tec.id) >= 0 ? PLANO_ATIVO : null;
  const iPlano = noPlano ? noPlano.ids.indexOf(tec.id) : -1;

  const top = el('<div class="topbar"></div>');
  const btVoltar = el('<button class="iconbtn">‹</button>');
  btVoltar.onclick = () => go(noPlano ? '/plano/' + noPlano.planoId : '/');
  const titulo = el('<div class="ttl"><b></b><small></small></div>');
  const btFav = el('<button class="iconbtn fav">★</button>');
  const btMenu = el('<button class="iconbtn">⋯</button>');
  top.appendChild(btVoltar); top.appendChild(titulo);

  if(noPlano){
    const ant = el('<button class="iconbtn">‹</button>');
    const pro = el('<button class="iconbtn">›</button>');
    ant.disabled = iPlano <= 0;
    pro.disabled = iPlano >= noPlano.ids.length - 1;
    ant.style.opacity = ant.disabled ? '.35' : '';
    pro.style.opacity = pro.disabled ? '.35' : '';
    ant.onclick = () => { if(!ant.disabled) go('/t/' + noPlano.ids[iPlano - 1]); };
    pro.onclick = () => { if(!pro.disabled) go('/t/' + noPlano.ids[iPlano + 1]); };
    top.appendChild(ant); top.appendChild(pro);
  }

  top.appendChild(btFav); top.appendChild(btMenu);
  raiz.appendChild(top);

  function pintarTopo(){
    titulo.querySelector('b').textContent = tec.nome || 'Sem nome';
    const sd = STATUS_POR_ID[tec.status] || STATUS[0];
    const bits = [sd.nome];
    if(tec.lado && tec.lado !== 'ambos') bits.push(tec.lado);
    if(tec.pegada) bits.push((PEGADAS.find(p => p.id === tec.pegada) || {}).nome || '');
    titulo.querySelector('small').textContent = bits.filter(Boolean).join(' · ');
    btFav.classList.toggle('on', !!tec.favorita);
  }
  btFav.onclick = () => {
    tec.favorita = !tec.favorita;
    Store.upsertTecnica(tec);
    pintarTopo();
    toast(tec.favorita ? 'Favoritada' : 'Tirada dos favoritos');
  };

  /* ---------- abas de clipe ---------- */
  const abas = el('<div class="clipetabs"></div>');
  raiz.appendChild(abas);

  function pintarAbas(){
    abas.innerHTML = '';

    /* dois recortes do mesmo vídeo herdariam o mesmo nome; nesse caso
       numera, senão as abas ficam indistinguíveis */
    const nomes = (tec.clipes || []).map((c, i) => {
      const vid = c.tipo === 'file' ? Store.getVideo(c.videoId) : null;
      return c.rotulo || (c.tipo === 'yt' ? 'YouTube' : (vid && vid.nome) || 'Clipe ' + (i + 1));
    });
    const repetidos = {};
    nomes.forEach(n => { repetidos[n] = (repetidos[n] || 0) + 1; });
    const vistos = {};

    (tec.clipes || []).forEach((c, i) => {
      const falta = c.tipo === 'file' && !ARQUIVOS.has(c.videoId || c.id);
      let nome = nomes[i];
      if(repetidos[nome] > 1){
        vistos[nome] = (vistos[nome] || 0) + 1;
        nome = nome + ' ' + vistos[nome];
      }
      const b = el('<button class="chip ' + (i === iClipe ? 'on' : '') + '">' +
        (falta ? '⚠ ' : c.tipo === 'yt' ? '▶ ' : '') + esc(nome) + '</button>');
      b.onclick = () => { if(i === iClipe) menuClipe(); else trocarClipe(i); };
      abas.appendChild(b);
    });
    const mais = el('<button class="chip">+ clipe</button>');
    mais.onclick = menuAddClipe;
    abas.appendChild(mais);
  }

  /* ---------- player ---------- */
  const caixa = el('<div></div>');
  raiz.appendChild(caixa);

  /* ---------- barra do tempo ---------- */
  const scrub = el('<div class="scrub">' +
    '<div class="trilho"><div class="faixa"></div><div class="prog"></div>' +
    '<input type="range" min="0" max="1000" value="0"></div></div>');
  const trilho = scrub.querySelector('.trilho');
  const faixa = scrub.querySelector('.faixa');
  const prog = scrub.querySelector('.prog');
  const rangeT = scrub.querySelector('input');
  raiz.appendChild(scrub);

  rangeT.oninput = () => {
    const c = tec.clipes[iClipe];
    const d = (player && player.duracao()) || c.dur || 0;
    if(player && d) player.seek(rangeT.value / 1000 * d);
  };

  /* ---------- controles ---------- */
  const ctrl = el('<div class="vctrl"></div>');
  const btPlay  = el('<button class="iconbtn">▶</button>');
  const btPrev  = el('<button class="iconbtn" title="um quadro atrás">◀|</button>');
  const btNext  = el('<button class="iconbtn" title="um quadro à frente">|▶</button>');
  const btIn    = el('<button class="iconbtn" title="começar o loop aqui">[</button>');
  const btOut   = el('<button class="iconbtn" title="terminar o loop aqui">]</button>');
  const btEsp   = el('<button class="iconbtn" title="espelhar">⇋</button>');
  const relogio = el('<span class="t">0:00.0</span>');
  const segRate = el('<div class="rateseg"></div>');
  RATES.forEach(r => {
    const b = el('<button>' + r + '×</button>');
    b.onclick = () => {
      const c = tec.clipes[iClipe]; if(!c) return;
      c.rate = r; Store.upsertTecnica(tec);
      if(player) player.setRate(r);
      pintarRate();
    };
    b.dataset.r = r;
    segRate.appendChild(b);
  });
  ctrl.appendChild(btPlay); ctrl.appendChild(btPrev); ctrl.appendChild(btNext);
  ctrl.appendChild(relogio);
  ctrl.appendChild(el('<span class="esp"></span>'));
  ctrl.appendChild(btIn); ctrl.appendChild(btOut); ctrl.appendChild(btEsp);
  raiz.appendChild(ctrl);
  const ctrl2 = el('<div class="vctrl" style="padding-top:0;border-bottom:1px solid var(--line)"></div>');
  const btNota = el('<button class="btn sm" style="flex:1">+ nota neste instante</button>');
  ctrl2.appendChild(btNota);
  ctrl2.appendChild(segRate);
  raiz.appendChild(ctrl2);

  function pintarRate(){
    const c = tec.clipes[iClipe];
    segRate.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', c && Number(b.dataset.r) === (c.rate || 1));
    });
  }

  btPlay.onclick = () => { if(player) player.alterna(); };
  btPrev.onclick = () => { if(player) player.passo(-1); };
  btNext.onclick = () => { if(player) player.passo(1); };
  btEsp.onclick = () => {
    const c = tec.clipes[iClipe]; if(!c) return;
    c.mirror = !c.mirror; Store.upsertTecnica(tec);
    if(player) player.setEspelho(c.mirror);
    btEsp.classList.toggle('on', c.mirror);
    toast(c.mirror ? 'Espelhado: é a versão do outro lado' : 'Voltou ao normal');
  };
  btIn.onclick = () => {
    const c = tec.clipes[iClipe]; if(!c || !player) return;
    c.in = Math.max(0, player.tempo());
    if(c.out && c.out <= c.in) c.out = 0;
    Store.upsertTecnica(tec); pintarScrub();
    toast('O loop agora começa em ' + mmss(c.in));
  };
  btOut.onclick = () => {
    const c = tec.clipes[iClipe]; if(!c || !player) return;
    const t = player.tempo();
    if(t <= (c.in || 0) + 0.2) return toast('O fim precisa vir depois do início');
    c.out = t;
    Store.upsertTecnica(tec); pintarScrub();
    toast('O loop agora termina em ' + mmss(c.out));
  };
  btNota.onclick = async () => {
    const c = tec.clipes[iClipe];
    if(!c) return toast('Adicione um clipe primeiro');
    if(player && player.tocando()) player.pause();
    const t = player ? player.tempo() : 0;
    const txt = await pedirTexto({
      titulo: 'Nota em ' + mmss(t),
      sub: 'O que exatamente acontece neste instante?',
      placeholder: 'ex.: o cotovelo sobe antes do quadril entrar',
      multi: true
    });
    if(!txt) return;
    c.notas = (c.notas || []).concat([{ t, txt }]);
    c.notas.sort((a, b) => a.t - b.t);
    Store.upsertTecnica(tec);
    pintarNotas(); pintarScrub();
  };

  /* ---------- corpo rolável ---------- */
  const scroll = el('<div class="vscroll"><div class="content" style="padding-bottom:40px"></div></div>');
  const corpo = scroll.firstElementChild;
  raiz.appendChild(scroll);

  const secNotas = el('<div></div>');
  const secPontos = el('<div></div>');
  const secErros = el('<div></div>');
  const secLinks = el('<div></div>');
  const secObs = el('<div></div>');
  corpo.appendChild(secNotas);
  corpo.appendChild(secPontos);
  corpo.appendChild(secErros);
  corpo.appendChild(secLinks);
  corpo.appendChild(secObs);

  /* ---------- notas ---------- */
  function pintarNotas(){
    secNotas.innerHTML = '';
    const c = tec.clipes[iClipe];
    const notas = (c && c.notas) || [];
    secNotas.appendChild(el('<div class="secao">Notas no tempo' + (notas.length ? ' · ' + notas.length : '') + '</div>'));
    if(!notas.length){
      secNotas.appendChild(el('<div class="hint">Pause no instante que importa e toque em <b>+ nota neste instante</b>. ' +
        'Enquanto o loop roda, a nota daquele momento acende sozinha.</div>'));
      return;
    }
    notas.forEach((n, i) => {
      const d = el('<div class="nota" data-i="' + i + '">' +
        '<span class="ts">' + mmss(n.t) + '</span><p>' + esc(n.txt) + '</p>' +
        '<button class="x">⋯</button></div>');
      d.querySelector('p').onclick = () => { if(player) player.seek(n.t); };
      d.querySelector('.ts').onclick = () => { if(player) player.seek(n.t); };
      d.querySelector('.x').onclick = () => menuNota(i);
      secNotas.appendChild(d);
    });
  }

  function menuNota(i){
    const c = tec.clipes[iClipe];
    const n = c.notas[i];
    sheet({
      titulo: 'Nota em ' + mmss(n.t),
      opcoes: [
        { i: '⏱', txt: 'Ir para este instante', fn: () => { if(player) player.seek(n.t); } },
        { i: '✏️', txt: 'Editar texto', fn: async () => {
            const txt = await pedirTexto({ titulo: 'Editar nota', valor: n.txt, multi: true });
            if(txt){ n.txt = txt; Store.upsertTecnica(tec); pintarNotas(); }
          } },
        { i: '📍', txt: 'Mover para o tempo atual', sub: player ? mmss(player.tempo()) : '',
          fn: () => {
            n.t = player ? player.tempo() : n.t;
            c.notas.sort((a, b) => a.t - b.t);
            Store.upsertTecnica(tec); pintarNotas(); pintarScrub();
          } },
        { sep: true },
        { i: '🗑', txt: 'Apagar nota', cls: 'danger', fn: () => {
            c.notas.splice(i, 1);
            Store.upsertTecnica(tec); pintarNotas(); pintarScrub();
          } }
      ]
    });
  }

  /* ---------- listas de texto (pontos-chave / erros) ---------- */
  function pintarListaTxt(alvo, chave, rotulo, marca, cls, dica){
    alvo.innerHTML = '';
    const arr = tec[chave] || [];
    const cab = el('<div class="secao" style="display:flex;align-items:center;gap:8px">' +
      '<span style="flex:1">' + rotulo + '</span></div>');
    const add = el('<button style="color:var(--acc);font-weight:700;font-size:12px">+ adicionar</button>');
    add.onclick = async () => {
      const txt = await pedirTexto({ titulo: rotulo, placeholder: dica });
      if(!txt) return;
      tec[chave] = arr.concat([txt]);
      Store.upsertTecnica(tec);
      pintarListaTxt(alvo, chave, rotulo, marca, cls, dica);
    };
    cab.appendChild(add);
    alvo.appendChild(cab);

    if(!arr.length){ alvo.appendChild(el('<div class="hint">' + esc(dica) + '</div>')); return; }
    const ul = el('<ul class="lista-txt ' + cls + '"></ul>');
    arr.forEach((tx, i) => {
      const li = el('<li><span class="mk">' + marca + '</span><span class="tx">' + esc(tx) + '</span>' +
        '<button class="x">×</button></li>');
      li.querySelector('.x').onclick = () => {
        arr.splice(i, 1); tec[chave] = arr; Store.upsertTecnica(tec);
        pintarListaTxt(alvo, chave, rotulo, marca, cls, dica);
      };
      li.querySelector('.tx').onclick = async () => {
        const novo = await pedirTexto({ titulo: 'Editar', valor: tx });
        if(novo){ arr[i] = novo; tec[chave] = arr; Store.upsertTecnica(tec);
          pintarListaTxt(alvo, chave, rotulo, marca, cls, dica); }
      };
      ul.appendChild(li);
    });
    alvo.appendChild(ul);
  }

  /* ---------- ligações entre técnicas ---------- */
  function pintarLinks(){
    secLinks.innerHTML = '';
    const cab = el('<div class="secao" style="display:flex;align-items:center;gap:8px"><span style="flex:1">Encadeamentos e contras</span></div>');
    const add = el('<button style="color:var(--acc);font-weight:700;font-size:12px">+ ligar</button>');
    add.onclick = menuAddLink;
    cab.appendChild(add);
    secLinks.appendChild(cab);

    const links = tec.links || [];
    if(!links.length){
      secLinks.appendChild(el('<div class="hint">Ligue esta técnica às outras: o que entra quando ela falha, ' +
        'o que ele tenta em cima dela, como você se defende. É esse mapa que vira jogo no randori.</div>'));
      return;
    }
    links.forEach((l, i) => {
      const outro = Store.getTecnica(l.para);
      const tipo = LINK_POR_ID[l.tipo] || LINK_TIPOS[0];
      const d = el('<div class="link"><span class="seta">' + tipo.seta + '</span>' +
        '<div class="info"><b>' + esc(outro ? outro.nome : '(técnica apagada)') + '</b>' +
        '<small>' + esc(tipo.nome + (l.quando ? ' · ' + l.quando : '')) + '</small></div>' +
        '<button class="x">×</button></div>');
      d.querySelector('.info').onclick = () => { if(outro) go('/t/' + outro.id); };
      d.querySelector('.x').onclick = () => {
        tec.links.splice(i, 1); Store.upsertTecnica(tec); pintarLinks();
      };
      secLinks.appendChild(d);
    });
  }

  function menuAddLink(){
    const outras = Store.tecnicas().filter(t => t.id !== tec.id);
    if(!outras.length) return toast('Cadastre outra técnica antes de ligar as duas');

    sheet({
      titulo: 'Que tipo de ligação?',
      opcoes: LINK_TIPOS.map(t => ({
        i: t.seta, txt: t.nome, sub: t.desc,
        fn: () => escolherAlvo(t.id)
      }))
    });

    function escolherAlvo(tipo){
      sheet({
        titulo: 'Ligar com qual técnica?',
        opcoes: outras.map(o => ({
          i: '🥋', txt: o.nome, sub: STATUS_POR_ID[o.status] ? STATUS_POR_ID[o.status].nome : '',
          fn: async () => {
            const quando = await pedirTexto({
              titulo: 'Quando?',
              sub: 'Opcional, mas é o que faz a ligação valer alguma coisa.',
              placeholder: 'ex.: quando ele recua a perna direita',
              ok: 'Ligar'
            });
            tec.links = (tec.links || []).concat([{ para: o.id, tipo, quando: quando || '' }]);
            Store.upsertTecnica(tec);
            pintarLinks();
            toast('Ligado a ' + o.nome);
          }
        }))
      });
    }
  }

  /* ---------- observação livre ---------- */
  function pintarObs(){
    secObs.innerHTML = '';
    const cab = el('<div class="secao" style="display:flex;align-items:center;gap:8px"><span style="flex:1">Observações</span></div>');
    const ed = el('<button style="color:var(--acc);font-weight:700;font-size:12px">editar</button>');
    ed.onclick = async () => {
      const txt = await pedirTexto({ titulo: 'Observações', valor: tec.obs, multi: true,
        placeholder: 'o que o sensei falou, contra quem funciona, o que ainda não fecha...' });
      if(txt === null) return;
      tec.obs = txt; Store.upsertTecnica(tec); pintarObs();
    };
    cab.appendChild(ed);
    secObs.appendChild(cab);
    secObs.appendChild(tec.obs
      ? el('<div class="nota"><p>' + esc(tec.obs).replace(/\n/g, '<br>') + '</p></div>')
      : el('<div class="hint">Nada anotado ainda.</div>'));
  }

  /* ---------- barra do tempo ---------- */
  function pintarScrub(){
    const c = tec.clipes[iClipe];
    trilho.querySelectorAll('.pin').forEach(p => p.remove());
    if(!c){ faixa.style.width = '0'; prog.style.width = '0'; return; }
    const dur = (player && player.duracao()) || c.dur || 0;
    if(!dur){ faixa.style.left = '0'; faixa.style.width = '100%'; return; }

    const ini = c.in || 0, fim = c.out > 0 ? c.out : dur;
    faixa.style.left = (ini / dur * 100) + '%';
    faixa.style.width = ((fim - ini) / dur * 100) + '%';
    faixa.style.background = 'var(--acc)';
    faixa.style.opacity = '.28';

    (c.notas || []).forEach(n => {
      const p = el('<div class="pin"></div>');
      p.style.left = (n.t / dur * 100) + '%';
      trilho.appendChild(p);
    });
  }

  function tick(t){
    tAtual = t;
    const c = tec.clipes[iClipe];
    const dur = (player && player.duracao()) || (c && c.dur) || 0;
    relogio.textContent = mmss(t);
    if(dur){
      prog.style.width = (t / dur * 100) + '%';
      rangeT.value = Math.round(t / dur * 1000);
    }
    // acende a nota do instante
    secNotas.querySelectorAll('.nota').forEach(d => {
      const n = c && c.notas && c.notas[Number(d.dataset.i)];
      d.classList.toggle('acesa', !!n && Math.abs(n.t - t) < 0.7);
    });
    btPlay.textContent = (player && player.tocando()) ? '❚❚' : '▶';
  }

  /* ---------- montar / trocar clipe ---------- */
  async function montarClipe(){
    if(player){ try{ player.destruir(); }catch(e){} player = null; }
    const c = tec.clipes[iClipe];
    if(!c){
      caixa.innerHTML = '';
      caixa.appendChild(el('<div class="vbox"><div class="vfalta">Nenhum clipe ainda.' +
        '<br><small>Toque em “+ clipe” lá em cima.</small></div></div>'));
      pintarScrub(); pintarNotas();
      return;
    }
    btEsp.classList.toggle('on', !!c.mirror);
    pintarRate();

    player = await Player.montar(caixa, c, {
      onTempo: tick,
      onPronto: dur => {
        if(dur && !c.dur){ c.dur = dur; Store.upsertTecnica(tec); }
        /* a duração é do arquivo, não do clipe: guarda na biblioteca também,
           pra outra técnica que use o mesmo vídeo já saber sem abrir */
        if(dur && c.tipo === 'file'){
          const v = Store.getVideo(c.videoId);
          if(v && !v.dur){ v.dur = dur; Store.upsertVideo(v); }
        }
        pintarScrub();
      },
      onTocando: () => { btPlay.textContent = (player && player.tocando()) ? '❚❚' : '▶'; },
      onErro: () => {}
    });
    pintarScrub(); pintarNotas();
  }

  function trocarClipe(i){
    iClipe = i;
    pintarAbas();
    montarClipe();
  }

  /* ---------- clipes: adicionar e gerenciar ---------- */
  function menuAddClipe(){
    const biblio = Store.videos();
    const ops = [];

    if(biblio.length){
      ops.push({ i: '📚', txt: 'Escolher da biblioteca',
        sub: biblio.length + (biblio.length === 1 ? ' vídeo já neste aparelho' : ' vídeos já neste aparelho'),
        fn: escolherDaBiblioteca });
    }
    ops.push({ i: '⬆', txt: 'Subir um vídeo novo', sub: 'fica offline; ocupa espaço',
      fn: () => { aoEscolherVideo = addArquivo; document.getElementById('fileVideo').click(); } });
    ops.push({ i: '▶', txt: 'Trecho do YouTube', sub: 'não ocupa espaço; precisa de internet',
      fn: addYouTube });

    sheet({
      titulo: 'Adicionar clipe',
      sub: 'Vários clipes na mesma técnica: ângulo de frente, de lado, competição, o seu treino.',
      opcoes: ops
    });
  }

  /* o ponto da biblioteca: uma aula inteira sobe uma vez e vira dez
     técnicas, cada uma com o seu recorte, sem duplicar um byte */
  function escolherDaBiblioteca(){
    const biblio = Store.videos();
    sheet({
      titulo: 'Qual vídeo?',
      sub: 'O mesmo arquivo pode servir várias técnicas, cada uma com o seu recorte. Nada é gravado de novo.',
      opcoes: biblio.map(v => {
        const usos = Store.usosDoVideo(v.id).length;
        return {
          i: '🎬', txt: v.nome || 'Vídeo',
          sub: humanSize(v.size) + (v.dur ? ' · ' + mmss(v.dur) : '') +
               ' · ' + (usos ? 'em ' + usos + (usos === 1 ? ' clipe' : ' clipes') : 'sem uso'),
          fn: () => usarVideo(v)
        };
      })
    });
  }

  function usarVideo(v){
    const c = newClipe({ tipo: 'file', videoId: v.id, dur: v.dur, rate: Store.settings().rate });
    tec.clipes = (tec.clipes || []).concat([c]);
    Store.upsertTecnica(tec);
    trocarClipe(tec.clipes.length - 1);
    toast('Marque o trecho com os botões [ e ]');
  }

  async function addArquivo(file){
    const v = newVideo({
      nome: file.name.replace(/\.\w+$/, ''),
      size: file.size, mime: file.type
    });
    try{
      await Video_DB.put(v.id, file);
      ARQUIVOS.add(v.id);
    }catch(e){
      return sheet({ titulo: 'Não consegui guardar', sub: 'O armazenamento do navegador recusou o arquivo (' +
        humanSize(file.size) + '). Corte o vídeo antes de subir.', opcoes: [{ i: '✓', txt: 'Entendi' }] });
    }
    Store.upsertVideo(v);

    const c = newClipe({ tipo: 'file', videoId: v.id, rate: Store.settings().rate });
    tec.clipes = (tec.clipes || []).concat([c]);
    Store.upsertTecnica(tec);
    toast('Vídeo de ' + humanSize(file.size) + ' guardado');
    trocarClipe(tec.clipes.length - 1);
  }

  /* mesmo arquivo, outro recorte, em outra técnica: é o caminho pra
     quebrar um vídeo de aula longa em várias técnicas */
  function usarEmOutraTecnica(){
    const c = tec.clipes[iClipe];
    if(!c || c.tipo !== 'file') return;
    const t0 = player ? player.tempo() : 0;

    const anexar = (alvoId, ir) => {
      const alvo = Store.getTecnica(alvoId);
      if(!alvo) return;
      alvo.clipes = (alvo.clipes || []).concat([
        newClipe({ tipo: 'file', videoId: c.videoId, dur: c.dur, in: t0, rate: Store.settings().rate })
      ]);
      Store.upsertTecnica(alvo);
      toast('Clipe criado em ' + alvo.nome);
      if(ir) go('/t/' + alvo.id);
    };

    const ops = Store.tecnicas().filter(t => t.id !== tec.id).map(o => ({
      i: '🥋', txt: o.nome, sub: (STATUS_POR_ID[o.status] || STATUS[0]).nome,
      fn: () => anexar(o.id, false)
    }));
    ops.push({ sep: true });
    ops.push({ i: '+', txt: 'Criar uma técnica nova', fn: async () => {
      const nome = await pedirTexto({ titulo: 'Nome da técnica', placeholder: 'Uchi-mata', ok: 'Criar' });
      if(!nome) return;
      const nova = newTecnica({ nome });
      Store.upsertTecnica(nova);
      anexar(nova.id, true);
    } });

    sheet({
      titulo: 'Usar este vídeo em...',
      sub: 'O mesmo arquivo, começando em ' + mmss(t0) + '. Não ocupa espaço a mais.',
      opcoes: ops
    });
  }

  async function addYouTube(){
    const url = await pedirTexto({
      titulo: 'Link do YouTube',
      sub: 'Cole o endereço do vídeo. Se o link já vier com um tempo, o loop começa ali.',
      placeholder: 'https://youtu.be/...',
      ok: 'Adicionar'
    });
    if(!url) return;
    const p = parseYouTube(url);
    if(!p) return sheet({ titulo: 'Link não reconhecido',
      sub: 'Esperava algo como youtube.com/watch?v=… ou youtu.be/…', opcoes: [{ i: '✓', txt: 'Entendi' }] });

    const c = newClipe({ tipo: 'yt', ytId: p.id, in: p.t, rotulo: 'YouTube', rate: Store.settings().rate });
    tec.clipes = (tec.clipes || []).concat([c]);
    Store.upsertTecnica(tec);
    trocarClipe(tec.clipes.length - 1);
    toast('Marque o trecho com os botões [ e ]');
  }

  function menuClipe(){
    const c = tec.clipes[iClipe];
    if(!c) return;
    const dur = (player && player.duracao()) || c.dur || 0;
    const trecho = (c.in || c.out)
      ? mmss(c.in || 0) + ' → ' + mmss(c.out > 0 ? c.out : dur)
      : 'clipe inteiro';

    const vid = c.tipo === 'file' ? Store.getVideo(c.videoId) : null;
    const usos = vid ? Store.usosDoVideo(vid.id).length : 0;
    const origem = c.tipo === 'yt'
      ? 'YouTube'
      : vid
        ? vid.nome + ' · ' + humanSize(vid.size) + (usos > 1 ? ' · usado em ' + usos + ' clipes' : '')
        : 'vídeo que não está mais aqui';

    const ops = [
      { i: '🏷', txt: 'Renomear o clipe', sub: 'ex.: “de lado”, “competição”, “meu treino”', fn: async () => {
          const n = await pedirTexto({ titulo: 'Nome do clipe', valor: c.rotulo, placeholder: 'de lado' });
          if(n === null) return;
          c.rotulo = n; Store.upsertTecnica(tec); pintarAbas();
        } },
      { i: '↺', txt: 'Limpar o recorte', sub: 'volta a rodar o vídeo inteiro', fn: () => {
          c.in = 0; c.out = 0; Store.upsertTecnica(tec); pintarScrub();
          if(player) player.seek(0);
          toast('Recorte limpo');
        } }
    ];

    if(c.tipo === 'file' && vid){
      ops.push({ i: '📎', txt: 'Usar este vídeo em outra técnica',
        sub: 'mesmo arquivo, outro recorte', fn: usarEmOutraTecnica });
      ops.push({ i: '🎬', txt: 'Renomear o vídeo', sub: vid.nome, fn: async () => {
          const n = await pedirTexto({ titulo: 'Nome do vídeo', valor: vid.nome,
            sub: 'Vale pra todas as técnicas que usam este arquivo.', placeholder: 'Aula 12/03' });
          if(!n) return;
          vid.nome = n; Store.upsertVideo(vid); pintarAbas();
        } });
    }

    ops.push({ sep: true });
    ops.push({ i: '🗑', txt: 'Apagar este clipe', cls: 'danger', fn: async () => {
        const ok = await confirmar('Apagar o clipe?',
          'Vão junto as ' + ((c.notas || []).length) + ' notas dele. ' +
          (usos > 1
            ? 'O vídeo fica: outros ' + (usos - 1) + (usos - 1 === 1 ? ' clipe usa' : ' clipes usam') + ' ele.'
            : 'O vídeo continua na biblioteca.'),
          'Apagar');
        if(!ok) return;
        tec.clipes.splice(iClipe, 1);
        Store.upsertTecnica(tec);
        iClipe = Math.max(0, iClipe - 1);
        pintarAbas(); montarClipe();
      } });

    sheet({
      titulo: c.rotulo || (vid && vid.nome) || 'Clipe ' + (iClipe + 1),
      sub: origem + '\nLoop: ' + trecho,
      opcoes: ops
    });
  }

  /* ---------- menu da técnica ---------- */
  btMenu.onclick = () => {
    sheet({
      titulo: tec.nome,
      opcoes: [
        { i: '✏️', txt: 'Editar ficha', sub: 'nome, status, pegada, lado, tags', fn: () => go('/t/' + tec.id + '/edit') },
        { i: '📈', txt: 'Mudar status', sub: (STATUS_POR_ID[tec.status] || STATUS[0]).nome, fn: menuStatus },
        { i: '📅', txt: 'Registrar que treinei hoje', fn: () => {
            registrarTreinoHoje([tec.id]);
          } },
        { i: '📋', txt: 'Pôr num plano de treino', fn: () => escolherPlano(tec.id) },
        { sep: true },
        { i: '🗑', txt: 'Apagar técnica', cls: 'danger', fn: async () => {
            const ok = await confirmar('Apagar ' + tec.nome + '?',
              'Vão junto os clipes, as notas e as ligações. Não dá pra desfazer.', 'Apagar');
            if(!ok) return;
            if(player){ try{ player.destruir(); }catch(e){} player = null; }
            await Store.deleteTecnica(tec.id);
            ARQUIVOS = new Set(await Video_DB.keys());
            toast('Apagada');
            go('/', true);
          } }
      ]
    });
  };

  function menuStatus(){
    sheet({
      titulo: 'Onde está esta técnica?',
      opcoes: STATUS.map(s => ({
        i: tec.status === s.id ? '●' : '○', txt: s.nome,
        cls: tec.status === s.id ? 'on' : '',
        fn: () => { tec.status = s.id; Store.upsertTecnica(tec); pintarTopo(); }
      }))
    });
  }

  /* ---------- primeira pintura ---------- */
  pintarTopo();
  pintarAbas();
  pintarNotas();
  pintarListaTxt(secPontos, 'pontos', 'Pontos-chave', '✓', 'pontos',
    'O que você precisa lembrar na hora. Uma linha por coisa.');
  pintarListaTxt(secErros, 'erros', 'Erros comuns', '✗', 'erros',
    'O que costuma dar errado quando você erra essa.');
  pintarLinks();
  pintarObs();
  await montarClipe();

  App.tela = { sair(){ if(player){ try{ player.destruir(); }catch(e){} player = null; } } };
  return raiz;
}

/* =========================================================
   EDITOR DA FICHA
   ========================================================= */
function telaEditor(id){
  const nova = !id;
  const tec = nova ? newTecnica({}) : Store.getTecnica(id);
  if(!tec) return el('<div class="content"><div class="empty"><h3>Técnica não encontrada</h3></div></div>');

  const wrap = document.createElement('div');

  const campo = (label, valor, ph, hint) => {
    const f = el('<div class="field"><label>' + esc(label) + '</label>' +
      '<input type="text" placeholder="' + esc(ph || '') + '">' +
      (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') + '</div>');
    f.querySelector('input').value = valor || '';
    return f;
  };

  const fNome = campo('Nome', tec.nome, 'Uchi-mata');
  const fTags = campo('Tags', (tec.tags || []).join(', '), 'competição, kenka-yotsu, favorita do sensei',
    'Separadas por vírgula. Aparecem na busca.');

  const sel = (label, valor, ops, hint) => {
    const f = el('<div class="field"><label>' + esc(label) + '</label><select></select>' +
      (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') + '</div>');
    const s = f.querySelector('select');
    ops.forEach(o => {
      const op = document.createElement('option');
      op.value = o.id; op.textContent = o.nome;
      if(o.id === valor) op.selected = true;
      s.appendChild(op);
    });
    return f;
  };

  const fCat = sel('Grupo', tec.cat, [
    { id: 'nage',   nome: 'Nage-waza — projeção' },
    { id: 'katame', nome: 'Katame-waza — solo' },
    { id: 'outro',  nome: 'Outro' }
  ]);
  const fSub = sel('Classificação', tec.sub,
    [{ id: '', nome: '— nenhuma —' }].concat(Object.keys(SUBS).map(k => ({ id: k, nome: SUBS[k].nome + ' — ' + SUBS[k].desc }))));
  const fStatus = sel('Status', tec.status, STATUS.map(s => ({ id: s.id, nome: s.nome })),
    'Filtra a lista e mostra o que você está devendo treinar.');
  const fPegada = sel('Pegada', tec.pegada, PEGADAS,
    'Ai-yotsu: os dois pegam do mesmo lado. Kenka-yotsu: lados opostos.');
  const fLado = sel('Lado que você faz', tec.lado, [
    { id: 'direita',  nome: 'Direita' },
    { id: 'esquerda', nome: 'Esquerda' },
    { id: 'ambos',    nome: 'Os dois' }
  ], 'Dá pra ver a versão do outro lado espelhando o clipe, sem gravar de novo.');

  [fNome, fCat, fSub, fStatus, fPegada, fLado, fTags].forEach(f => wrap.appendChild(f));

  const salvar = el('<button class="btn primary">' + (nova ? 'Criar técnica' : 'Salvar') + '</button>');
  salvar.onclick = () => {
    const nome = fNome.querySelector('input').value.trim();
    if(!nome){ toast('Falta o nome'); return; }
    tec.nome = nome;
    tec.cat = fCat.querySelector('select').value;
    tec.sub = fSub.querySelector('select').value;
    tec.status = fStatus.querySelector('select').value;
    tec.pegada = fPegada.querySelector('select').value;
    tec.lado = fLado.querySelector('select').value;
    tec.tags = fTags.querySelector('input').value.split(',').map(s => s.trim()).filter(Boolean);
    Store.upsertTecnica(tec);
    go('/t/' + tec.id, true);
  };
  wrap.appendChild(salvar);

  if(nova){
    wrap.appendChild(el('<div class="hint" style="text-align:center;margin-top:12px">' +
      'Os clipes, as notas e as ligações você põe na tela seguinte.</div>'));
  }

  return casca(nova ? 'Nova técnica' : 'Editar ficha', nova ? '' : tec.nome,
    [], wrap, null,
    () => nova ? go('/') : go('/t/' + tec.id));
}
