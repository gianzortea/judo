/* =========================================================
   player.js — um só controle para dois tipos de clipe
   'file' : <video> com blob vindo do IndexedDB (offline)
   'yt'   : iframe do YouTube (precisa de internet)

   Os dois expõem a mesma interface, então a tela da técnica
   não precisa saber de onde o vídeo veio.
   ========================================================= */

/* ---------- URL do YouTube -> id + segundo inicial ---------- */
function parseYouTube(url){
  if(!url) return null;
  const s = String(url).trim();

  // já é um id cru
  if(/^[\w-]{11}$/.test(s)) return { id: s, t: 0 };

  let m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if(!m) return null;

  let t = 0;
  const mt = s.match(/[?&#](?:t|start)=(\d+h)?(\d+m)?(\d+)s?/) || s.match(/[?&#](?:t|start)=(\d+)/);
  if(mt){
    if(mt.length === 4){
      t = (parseInt(mt[1]) || 0) * 3600 + (parseInt(mt[2]) || 0) * 60 + (parseInt(mt[3]) || 0);
    } else {
      t = parseInt(mt[1]) || 0;
    }
  }
  return { id: m[1], t };
}

/* ---------- API do YouTube, carregada só quando precisa ---------- */
let ytPronto = null;
function carregarYT(){
  if(ytPronto) return ytPronto;

  ytPronto = new Promise((res, rej) => {
    if(window.YT && window.YT.Player) return res(window.YT);

    let fechado = false, prazo = 0;

    const ok = () => {
      if(fechado) return;
      fechado = true; clearTimeout(prazo);
      res(window.YT);
    };

    const falhou = (msg) => {
      if(fechado) return;
      fechado = true; clearTimeout(prazo);
      /* NÃO guarda a falha. Guardar a promessa rejeitada envenenava a
         sessão inteira: um sinal ruim de agora condenava todo clipe do
         YouTube até o app ser fechado e reaberto, mesmo com a rede boa
         de volta. A próxima tentativa recomeça do zero. */
      ytPronto = null;
      const velho = document.getElementById('yt-api');
      if(velho) velho.remove();
      rej(new Error(msg));
    };

    const antigo = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if(antigo) antigo(); ok(); };

    /* o script pode ter ficado de uma tentativa anterior */
    if(!document.getElementById('yt-api')){
      const s = document.createElement('script');
      s.id = 'yt-api';
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => falhou('não consegui carregar o YouTube');
      document.head.appendChild(s);
    }

    /* 4G ruim de dojo demora. 20 s antes de desistir — e desistir aqui
       não é definitivo. */
    prazo = setTimeout(() => {
      if(window.YT && window.YT.Player) return ok();
      falhou('o YouTube demorou demais');
    }, 20000);
  });

  return ytPronto;
}

/* ---------- tela acesa ---------- */
const WakeLock = (() => {
  let lock = null;
  return {
    async ligar(){
      try{
        if(!Store.settings().keepAwake) return;
        if('wakeLock' in navigator && !lock){
          lock = await navigator.wakeLock.request('screen');
          lock.addEventListener('release', () => { lock = null; });
        }
      }catch(e){ /* negado ou sem suporte: sem drama */ }
    },
    desligar(){ try{ if(lock){ lock.release(); lock = null; } }catch(e){} }
  };
})();
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible' && document.querySelector('.viewer')) WakeLock.ligar();
});

/* ---------- o player ---------- */
const Player = {
  /* container: elemento vazio onde o vídeo entra
     clipe: objeto do modelo
     cb: {onTempo(t), onPronto(dur), onErro(msg), onTocando(bool)} */
  async montar(container, clipe, cb){
    cb = cb || {};
    container.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'vbox';
    container.appendChild(box);

    const aplicaEspelho = (el, on) => {
      el.style.transform = on ? 'scaleX(-1)' : '';
    };

    /* toda falha aqui é recuperável: mostra o motivo e oferece a saída,
       em vez de deixar uma caixa preta muda na tela */
    const falha = (titulo, detalhe) => {
      box.innerHTML = '';
      const d = document.createElement('div');
      d.className = 'vfalta';
      d.innerHTML = titulo + (detalhe ? '<br><small>' + detalhe + '</small>' : '');
      if(cb.onTentarDeNovo){
        const b = document.createElement('button');
        b.className = 'btn sm';
        b.style.cssText = 'margin:14px auto 0;max-width:190px;display:flex';
        b.textContent = 'Tentar de novo';
        b.onclick = () => cb.onTentarDeNovo();
        d.appendChild(b);
      }
      box.appendChild(d);
    };

    /* ---------------- arquivo local ---------------- */
    if(clipe.tipo === 'file'){
      const blob = await Video_DB.get(clipe.videoId || clipe.id);
      if(!blob){
        falha('O vídeo deste clipe não está neste aparelho.',
              'Importe um backup .zip ou escolha outro vídeo.');
        if(cb.onErro) cb.onErro('sem arquivo');
        return null;
      }
      const url = URL.createObjectURL(blob);
      const v = document.createElement('video');
      v.src = url;
      v.playsInline = true; v.setAttribute('playsinline', '');
      v.preload = 'auto';
      v.controls = false;
      v.loop = false;
      aplicaEspelho(v, clipe.mirror);
      box.appendChild(v);

      let raf = 0, vivo = true;

      /* Seek pra trás é caro: o decodificador precisa voltar ao keyframe
         anterior e decodificar até o ponto pedido. Num arquivo de celular
         isso leva centenas de ms. Se outro seek chega antes, o navegador
         ABORTA o que estava fazendo — e com toques rápidos ele aborta
         sempre, nunca termina um decode e não pinta quadro nenhum: a tela
         fica preta. Então vai um seek de cada vez, e o último pedido
         espera a vez dele. Nenhum toque se perde: a conta é feita na
         posição lógica, não na do elemento. */
      let posLogica = null;   // onde o usuário está, mesmo com seek em voo
      let pendente = null;    // seek pedido enquanto outro corria

      const buscar = (t) => {
        const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : Infinity;
        t = Math.max(0, Math.min(dur, t));
        posLogica = t;
        if(v.seeking){ pendente = t; return; }
        pendente = null;
        v.currentTime = t;
      };

      const escoar = () => {
        if(pendente === null || v.seeking) return;
        const t = pendente; pendente = null;
        v.currentTime = t;
      };

      v.addEventListener('seeked', () => {
        if(pendente !== null) escoar();
        else posLogica = null;          // elemento e usuário de novo juntos
      });

      /* Se o usuário mandou tocar. Parado é ele navegando o clipe na mão
         (quadro a quadro, arrastando a barra), e aí o loop tem que ficar
         quieto: senão o passo pro quadro seguinte cruza o fim do recorte,
         é puxado de volta pro início e o vídeo nunca passa dali. */
      let querTocar = false;

      /* fecha o loop e avisa o tempo. A margem é proporcional à
         granularidade de quem chamou: o rAF acerta fino, o timeupdate
         vem a cada ~250 ms e precisa de folga pra não passar do ponto. */
      const conferir = (margem) => {
        if(!vivo) return;
        escoar();   // rede de segurança, caso um 'seeked' se perca
        const fim = clipe.out > 0 ? clipe.out : (v.duration || 0);
        /* v.seeking: não empilha um seek em cima de outro que ainda não
           terminou — é o que fazia o vídeo engasgar no passo rápido */
        if(querTocar && !v.seeking && fim > 0 && v.currentTime >= fim - margem){
          v.currentTime = clipe.in || 0;
          if(v.paused) v.play().catch(() => {});
        }
        if(cb.onTempo) cb.onTempo(v.currentTime);
      };

      const laco = () => {
        if(!vivo) return;
        conferir(0.03);
        raf = requestAnimationFrame(laco);
      };
      /* o rAF congela quando a aba sai da frente, mas o vídeo continua
         correndo: sem isto o loop escaparia do recorte de vez. */
      v.addEventListener('timeupdate', () => conferir(0.12));

      v.addEventListener('loadedmetadata', () => {
        /* a caixa assume a proporção do arquivo: vídeo de celular na
           vertical não fica mais espremido dentro de um 16:9 */
        if(v.videoWidth > 0 && v.videoHeight > 0){
          box.style.setProperty('--prop', (v.videoWidth / v.videoHeight).toFixed(4));
        }
        if(clipe.in > 0) v.currentTime = clipe.in;
        v.playbackRate = clipe.rate || 1;
        if(cb.onPronto) cb.onPronto(v.duration || 0);
      });
      v.addEventListener('play',  () => { if(cb.onTocando) cb.onTocando(true);  WakeLock.ligar(); });
      v.addEventListener('pause', () => { if(cb.onTocando) cb.onTocando(false); });
      v.addEventListener('error', () => {
        const c = v.error ? v.error.code : 0;
        falha('Não consegui abrir este vídeo.',
              'O arquivo pode estar corrompido ou num formato que este navegador não decodifica. (erro ' + c + ')');
        if(cb.onErro) cb.onErro('erro ' + c);
      });

      /* Um <video> pode ficar carregando pra sempre sem nunca disparar
         'error': readyState fica em 0 e a tela mostra um retângulo preto
         mudo. Em vez de deixar o usuário no escuro, avisa e diz o estado. */
      const vigia = setTimeout(() => {
        if(!vivo || v.readyState > 0) return;
        falha('O vídeo não abriu.',
              'Ficou carregando sem responder (readyState ' + v.readyState +
              ', rede ' + v.networkState + '). Arquivo de ' + humanSize(blob.size) +
              (blob.type ? ', ' + blob.type : '') + '.');
        if(cb.onErro) cb.onErro('não ficou pronto');
      }, 15000);
      v.addEventListener('loadeddata', () => clearTimeout(vigia));

      raf = requestAnimationFrame(laco);

      return {
        tipo: 'file',
        el: v,
        play(){
          querTocar = true;
          /* voltou pro início se estava parado no fim do recorte, senão
             o play não teria pra onde ir */
          const fim = clipe.out > 0 ? clipe.out : (v.duration || 0);
          if(fim > 0 && v.currentTime >= fim - 0.05) v.currentTime = clipe.in || 0;
          v.play().catch(() => {});
        },
        pause(){ querTocar = false; v.pause(); },
        alterna(){ v.paused ? this.play() : this.pause(); },
        tocando(){ return !v.paused; },
        /* durante um seek o elemento ainda mostra o tempo antigo; quem
           vale é onde o usuário pediu pra estar */
        tempo(){ return (posLogica !== null) ? posLogica : (v.currentTime || 0); },
        duracao(){ return v.duration || 0; },
        seek(t){ buscar(t); },
        /* passo de quadro: 1/30 s é o suficiente pra ver o kuzushi.
           Anda livre pelo vídeo inteiro, inclusive fora do recorte — é
           assim que dá pra esticar o [ ou o ] pra além de onde estão. */
        passo(d){
          querTocar = false;
          v.pause();
          /* conta a partir de onde o usuário pediu pra estar, não de onde
             o elemento ainda está: senão, com seek em voo, os toques
             rápidos se anulam e o vídeo parece não sair do lugar */
          const base = (posLogica !== null) ? posLogica : v.currentTime;
          buscar(base + d * (1 / 30));
        },
        setRate(r){ v.playbackRate = r; },
        setEspelho(on){ aplicaEspelho(v, on); },
        destruir(){
          vivo = false; cancelAnimationFrame(raf); clearTimeout(vigia);
          v.pause(); v.removeAttribute('src'); v.load();
          URL.revokeObjectURL(url);
          WakeLock.desligar();
        }
      };
    }

    /* ---------------- YouTube ---------------- */
    const alvo = document.createElement('div');
    alvo.id = 'yt-' + clipe.id;
    const wrap = document.createElement('div');
    wrap.className = 'ytwrap';
    aplicaEspelho(wrap, clipe.mirror);
    wrap.appendChild(alvo);
    box.appendChild(wrap);

    let YT_;
    try { YT_ = await carregarYT(); }
    catch(e){
      falha('Não consegui falar com o YouTube.',
            'Este clipe precisa de internet. Confira a conexão e tente de novo.');
      if(cb.onErro) cb.onErro('sem internet');
      return null;
    }

    return await new Promise((resolve) => {
      let timer = 0, p = null, tocando = false, resolvido = false;
      /* mesma regra do vídeo local: parado é o usuário navegando na mão,
         e aí o loop não pode puxar ele de volta pro início */
      let querTocar = false;
      const entregar = (v) => { if(!resolvido){ resolvido = true; resolve(v); } };

      /* se o onReady nunca vier (rede caindo, embed bloqueado), a montagem
         ficaria pendurada pra sempre e a tela travava calada */
      setTimeout(() => {
        if(resolvido) return;
        falha('O YouTube não respondeu.', 'Confira a conexão e tente de novo.');
        if(cb.onErro) cb.onErro('YouTube não respondeu');
        entregar(null);
      }, 20000);

      p = new YT_.Player(alvo.id, {
        videoId: clipe.ytId,
        playerVars: {
          controls: 0, rel: 0, modestbranding: 1, playsinline: 1,
          iv_load_policy: 3, fs: 0, disablekb: 1,
          start: Math.floor(clipe.in || 0)
        },
        events: {
          onReady(){
            try{ p.setPlaybackRate(clipe.rate || 1); }catch(e){}
            const dur = (p.getDuration && p.getDuration()) || 0;
            if(cb.onPronto) cb.onPronto(dur);

            timer = setInterval(() => {
              let t = 0;
              try{ t = p.getCurrentTime() || 0; }catch(e){ return; }
              const fim = clipe.out > 0 ? clipe.out : (p.getDuration ? p.getDuration() : 0);
              if(querTocar && fim > 0 && t >= fim - 0.08){ try{ p.seekTo(clipe.in || 0, true); }catch(e){} }
              if(cb.onTempo) cb.onTempo(t);
            }, 60);

            entregar(api);
          },
          onStateChange(e){
            const novo = (e.data === YT_.PlayerState.PLAYING);
            if(novo !== tocando){
              tocando = novo;
              if(cb.onTocando) cb.onTocando(novo);
              novo ? WakeLock.ligar() : WakeLock.desligar();
            }
          },
          onError(){ if(cb.onErro) cb.onErro('o vídeo não está disponível'); }
        }
      });

      const api = {
        tipo: 'yt',
        el: wrap,
        play(){
          querTocar = true;
          try{
            const fim = clipe.out > 0 ? clipe.out : p.getDuration();
            if(fim > 0 && this.tempo() >= fim - 0.1) p.seekTo(clipe.in || 0, true);
            p.playVideo();
          }catch(e){}
        },
        pause(){ querTocar = false; try{ p.pauseVideo(); }catch(e){} },
        alterna(){ tocando ? this.pause() : this.play(); },
        tocando(){ return tocando; },
        tempo(){ try{ return p.getCurrentTime() || 0; }catch(e){ return 0; } },
        duracao(){ try{ return p.getDuration() || 0; }catch(e){ return 0; } },
        seek(t){ try{ p.seekTo(Math.max(0, t), true); }catch(e){} },
        /* o YouTube não entrega quadro a quadro de verdade; 0,1 s é o mais fino que ele aceita */
        passo(d){ querTocar = false; try{ p.pauseVideo(); p.seekTo(Math.max(0, this.tempo() + d * 0.1), true); }catch(e){} },
        setRate(r){ try{ p.setPlaybackRate(r); }catch(e){} },
        setEspelho(on){ aplicaEspelho(wrap, on); },
        destruir(){
          clearInterval(timer);
          try{ p.destroy(); }catch(e){}
          WakeLock.desligar();
        }
      };
    });
  }
};

/* velocidades oferecidas (o YouTube só aceita esta lista) */
const RATES = [0.25, 0.5, 0.75, 1];
