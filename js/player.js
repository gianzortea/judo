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
    const antigo = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if(antigo) antigo(); res(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => rej(new Error('sem internet'));
    document.head.appendChild(s);
    setTimeout(() => rej(new Error('YouTube demorou demais')), 12000);
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

    /* ---------------- arquivo local ---------------- */
    if(clipe.tipo === 'file'){
      const blob = await Video_DB.get(clipe.videoId || clipe.id);
      if(!blob){
        box.innerHTML = '<div class="vfalta">O vídeo deste clipe não está neste aparelho.' +
                        '<br><small>Importe um backup .zip ou escolha outro vídeo.</small></div>';
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

      /* fecha o loop e avisa o tempo. A margem é proporcional à
         granularidade de quem chamou: o rAF acerta fino, o timeupdate
         vem a cada ~250 ms e precisa de folga pra não passar do ponto. */
      const conferir = (margem) => {
        if(!vivo) return;
        const fim = clipe.out > 0 ? clipe.out : (v.duration || 0);
        if(fim > 0 && v.currentTime >= fim - margem){
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
        if(clipe.in > 0) v.currentTime = clipe.in;
        v.playbackRate = clipe.rate || 1;
        if(cb.onPronto) cb.onPronto(v.duration || 0);
      });
      v.addEventListener('play',  () => { if(cb.onTocando) cb.onTocando(true);  WakeLock.ligar(); });
      v.addEventListener('pause', () => { if(cb.onTocando) cb.onTocando(false); });
      v.addEventListener('error', () => { if(cb.onErro) cb.onErro('não consegui abrir o vídeo'); });
      raf = requestAnimationFrame(laco);

      return {
        tipo: 'file',
        el: v,
        play(){ v.play().catch(() => {}); },
        pause(){ v.pause(); },
        alterna(){ v.paused ? this.play() : this.pause(); },
        tocando(){ return !v.paused; },
        tempo(){ return v.currentTime || 0; },
        duracao(){ return v.duration || 0; },
        seek(t){ v.currentTime = Math.max(0, t); },
        /* passo de quadro: 1/30 s é o suficiente pra ver o kuzushi */
        passo(d){ v.pause(); v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d * (1 / 30))); },
        setRate(r){ v.playbackRate = r; },
        setEspelho(on){ aplicaEspelho(v, on); },
        destruir(){
          vivo = false; cancelAnimationFrame(raf);
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
      box.innerHTML = '<div class="vfalta">Este clipe é do YouTube e precisa de internet.' +
                      '<br><small>Sem conexão agora.</small></div>';
      if(cb.onErro) cb.onErro('sem internet');
      return null;
    }

    return await new Promise((resolve) => {
      let timer = 0, p = null, tocando = false, resolvido = false;
      const entregar = (v) => { if(!resolvido){ resolvido = true; resolve(v); } };

      /* se o onReady nunca vier (rede caindo, embed bloqueado), a montagem
         ficaria pendurada pra sempre e a tela travava calada */
      setTimeout(() => {
        if(resolvido) return;
        box.innerHTML = '<div class="vfalta">O YouTube não respondeu.' +
                        '<br><small>Verifique a conexão e tente de novo.</small></div>';
        if(cb.onErro) cb.onErro('YouTube não respondeu');
        entregar(null);
      }, 12000);

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
              if(fim > 0 && t >= fim - 0.08){ try{ p.seekTo(clipe.in || 0, true); }catch(e){} }
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
        play(){ try{ p.playVideo(); }catch(e){} },
        pause(){ try{ p.pauseVideo(); }catch(e){} },
        alterna(){ tocando ? this.pause() : this.play(); },
        tocando(){ return tocando; },
        tempo(){ try{ return p.getCurrentTime() || 0; }catch(e){ return 0; } },
        duracao(){ try{ return p.getDuration() || 0; }catch(e){ return 0; } },
        seek(t){ try{ p.seekTo(Math.max(0, t), true); }catch(e){} },
        /* o YouTube não entrega quadro a quadro de verdade; 0,1 s é o mais fino que ele aceita */
        passo(d){ try{ p.pauseVideo(); p.seekTo(Math.max(0, this.tempo() + d * 0.1), true); }catch(e){} },
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
