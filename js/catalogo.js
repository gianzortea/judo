/* =========================================================
   catalogo.js — nomenclatura oficial do judô (Kodokan)
   Só leitura. A aba "Meu judô" começa vazia; daqui você
   puxa uma técnica pra dentro dela quando quiser.
   ========================================================= */

const SUBS = {
  'te':        { nome: 'Te-waza',          desc: 'técnicas de braço e mão' },
  'koshi':     { nome: 'Koshi-waza',       desc: 'técnicas de quadril' },
  'ashi':      { nome: 'Ashi-waza',        desc: 'técnicas de perna e pé' },
  'masutemi':  { nome: 'Ma-sutemi-waza',   desc: 'sacrifício para trás' },
  'yokosutemi':{ nome: 'Yoko-sutemi-waza', desc: 'sacrifício de lado' },
  'osaekomi':  { nome: 'Osaekomi-waza',    desc: 'imobilizações' },
  'shime':     { nome: 'Shime-waza',       desc: 'estrangulamentos' },
  'kansetsu':  { nome: 'Kansetsu-waza',    desc: 'chaves articulares' }
};

const GOKYO = {
  '1': 'Dai-ikkyo — 1º grupo',
  '2': 'Dai-nikyo — 2º grupo',
  '3': 'Dai-sankyo — 3º grupo',
  '4': 'Dai-yonkyo — 4º grupo',
  '5': 'Dai-gokyo — 5º grupo',
  's': 'Shinmeisho-no-waza — reconhecidas depois do Gokyo'
};

/* id | nome | tradução literal | sub | grupo | observação */
const CATALOGO_RAW = [
  'de-ashi-barai|De-ashi-barai|varrer o pé que avança|ashi|1|',
  'hiza-guruma|Hiza-guruma|roda no joelho|ashi|1|',
  'sasae-tsurikomi-ashi|Sasae-tsurikomi-ashi|pé que apoia, puxando e levantando|ashi|1|',
  'uki-goshi|Uki-goshi|quadril flutuante|koshi|1|',
  'o-soto-gari|O-soto-gari|grande ceifada externa|ashi|1|',
  'o-goshi|O-goshi|grande quadril|koshi|1|',
  'o-uchi-gari|O-uchi-gari|grande ceifada interna|ashi|1|',
  'seoi-nage|Seoi-nage|projeção carregando nas costas|te|1|',
  'ko-soto-gari|Ko-soto-gari|pequena ceifada externa|ashi|2|',
  'ko-uchi-gari|Ko-uchi-gari|pequena ceifada interna|ashi|2|',
  'koshi-guruma|Koshi-guruma|roda de quadril|koshi|2|',
  'tsurikomi-goshi|Tsurikomi-goshi|quadril puxando e levantando|koshi|2|',
  'okuri-ashi-barai|Okuri-ashi-barai|varrer os dois pés|ashi|2|',
  'tai-otoshi|Tai-otoshi|queda do corpo|te|2|',
  'harai-goshi|Harai-goshi|quadril que varre|koshi|2|',
  'uchi-mata|Uchi-mata|coxa interna|ashi|2|',
  'ko-soto-gake|Ko-soto-gake|pequeno enganche externo|ashi|3|',
  'tsuri-goshi|Tsuri-goshi|quadril de levantar|koshi|3|',
  'yoko-otoshi|Yoko-otoshi|queda lateral|yokosutemi|3|',
  'ashi-guruma|Ashi-guruma|roda de perna|ashi|3|',
  'hane-goshi|Hane-goshi|quadril de mola|koshi|3|',
  'harai-tsurikomi-ashi|Harai-tsurikomi-ashi|varrer o pé puxando e levantando|ashi|3|',
  'tomoe-nage|Tomoe-nage|projeção em círculo|masutemi|3|',
  'kata-guruma|Kata-guruma|roda no ombro|te|3|na forma clássica pega a perna: restrita em competição',
  'sumi-gaeshi|Sumi-gaeshi|reversão de canto|masutemi|4|',
  'tani-otoshi|Tani-otoshi|queda no vale|yokosutemi|4|',
  'hane-makikomi|Hane-makikomi|mola com enrolamento|yokosutemi|4|',
  'sukui-nage|Sukui-nage|projeção de colher|te|4|na forma clássica pega a perna: restrita em competição',
  'utsuri-goshi|Utsuri-goshi|quadril de transferência|koshi|4|',
  'o-guruma|O-guruma|grande roda|ashi|4|',
  'soto-makikomi|Soto-makikomi|enrolamento externo|yokosutemi|4|',
  'uki-otoshi|Uki-otoshi|queda flutuante|te|4|',
  'o-soto-guruma|O-soto-guruma|grande roda externa|ashi|5|',
  'uki-waza|Uki-waza|técnica flutuante|yokosutemi|5|',
  'yoko-wakare|Yoko-wakare|separação lateral|yokosutemi|5|',
  'yoko-guruma|Yoko-guruma|roda lateral|yokosutemi|5|',
  'ushiro-goshi|Ushiro-goshi|quadril por trás|koshi|5|',
  'ura-nage|Ura-nage|projeção por trás|masutemi|5|',
  'sumi-otoshi|Sumi-otoshi|queda de canto|te|5|',
  'yoko-gake|Yoko-gake|enganche lateral|yokosutemi|5|',
  'ippon-seoi-nage|Ippon-seoi-nage|seoi-nage com um braço só|te|s|',
  'seoi-otoshi|Seoi-otoshi|queda carregando nas costas|te|s|',
  'sode-tsurikomi-goshi|Sode-tsurikomi-goshi|quadril puxando pela manga|koshi|s|',
  'morote-gari|Morote-gari|colheita com as duas mãos|te|s|pegada abaixo da faixa: proibida em competição',
  'kuchiki-taoshi|Kuchiki-taoshi|derrubar a árvore podre|te|s|pegada abaixo da faixa: proibida em competição',
  'kibisu-gaeshi|Kibisu-gaeshi|reversão pelo calcanhar|te|s|pegada abaixo da faixa: proibida em competição',
  'te-guruma|Te-guruma|roda com as mãos|te|s|pegada abaixo da faixa: proibida em competição',
  'obi-otoshi|Obi-otoshi|queda pela faixa|te|s|',
  'obi-tori-gaeshi|Obi-tori-gaeshi|reversão pegando a faixa|te|s|',
  'yama-arashi|Yama-arashi|tempestade da montanha|te|s|',
  'uchi-mata-sukashi|Uchi-mata-sukashi|esquiva do uchi-mata|te|s|contra ao uchi-mata',
  'o-soto-otoshi|O-soto-otoshi|grande queda externa|ashi|s|',
  'tsubame-gaeshi|Tsubame-gaeshi|reversão da andorinha|ashi|s|contra ao de-ashi-barai',
  'o-soto-gaeshi|O-soto-gaeshi|reversão do grande externo|ashi|s|contra ao o-soto-gari',
  'o-uchi-gaeshi|O-uchi-gaeshi|reversão do grande interno|ashi|s|contra ao o-uchi-gari',
  'ko-uchi-gaeshi|Ko-uchi-gaeshi|reversão do pequeno interno|ashi|s|contra ao ko-uchi-gari',
  'uchi-mata-gaeshi|Uchi-mata-gaeshi|reversão do uchi-mata|ashi|s|contra ao uchi-mata',
  'hane-goshi-gaeshi|Hane-goshi-gaeshi|reversão do hane-goshi|ashi|s|contra ao hane-goshi',
  'harai-goshi-gaeshi|Harai-goshi-gaeshi|reversão do harai-goshi|ashi|s|contra ao harai-goshi',
  'uchi-mata-makikomi|Uchi-mata-makikomi|uchi-mata com enrolamento|yokosutemi|s|',
  'harai-makikomi|Harai-makikomi|harai com enrolamento|yokosutemi|s|',
  'o-soto-makikomi|O-soto-makikomi|o-soto com enrolamento|yokosutemi|s|',
  'ko-uchi-makikomi|Ko-uchi-makikomi|ko-uchi com enrolamento|yokosutemi|s|',
  'daki-wakare|Daki-wakare|separação abraçando|yokosutemi|s|',
  'kani-basami|Kani-basami|tesoura de caranguejo|yokosutemi|s|proibida em competição',
  'kawazu-gake|Kawazu-gake|enganche do sapo|yokosutemi|s|proibida em competição',
  'hikikomi-gaeshi|Hikikomi-gaeshi|reversão puxando para dentro|masutemi|s|',
  'tawara-gaeshi|Tawara-gaeshi|reversão do saco de arroz|masutemi|s|',
  'kesa-gatame|Kesa-gatame|imobilização em echarpe|osaekomi||',
  'kuzure-kesa-gatame|Kuzure-kesa-gatame|kesa-gatame modificado|osaekomi||',
  'ushiro-kesa-gatame|Ushiro-kesa-gatame|kesa-gatame por trás|osaekomi||',
  'kata-gatame|Kata-gatame|imobilização de ombro|osaekomi||',
  'kami-shiho-gatame|Kami-shiho-gatame|quatro pontos pela cabeça|osaekomi||',
  'kuzure-kami-shiho-gatame|Kuzure-kami-shiho-gatame|kami-shiho modificado|osaekomi||',
  'yoko-shiho-gatame|Yoko-shiho-gatame|quatro pontos lateral|osaekomi||',
  'tate-shiho-gatame|Tate-shiho-gatame|quatro pontos montado|osaekomi||',
  'uki-gatame|Uki-gatame|imobilização flutuante|osaekomi||',
  'nami-juji-jime|Nami-juji-jime|cruzada normal|shime||',
  'gyaku-juji-jime|Gyaku-juji-jime|cruzada invertida|shime||',
  'kata-juji-jime|Kata-juji-jime|meia cruzada|shime||',
  'hadaka-jime|Hadaka-jime|estrangulamento sem gola|shime||',
  'okuri-eri-jime|Okuri-eri-jime|gola deslizante|shime||',
  'kataha-jime|Kataha-jime|uma asa|shime||',
  'kata-te-jime|Kata-te-jime|com uma mão|shime||',
  'ryo-te-jime|Ryo-te-jime|com as duas mãos|shime||',
  'sode-guruma-jime|Sode-guruma-jime|roda de manga|shime||',
  'tsukkomi-jime|Tsukkomi-jime|de impulso|shime||',
  'sankaku-jime|Sankaku-jime|triângulo|shime||',
  'do-jime|Do-jime|tesoura de tronco|shime||proibida em competição',
  'ude-garami|Ude-garami|braço entrelaçado|kansetsu||',
  'ude-hishigi-juji-gatame|Ude-hishigi-juji-gatame|chave de braço em cruz|kansetsu||',
  'ude-hishigi-ude-gatame|Ude-hishigi-ude-gatame|chave usando o braço|kansetsu||',
  'ude-hishigi-hiza-gatame|Ude-hishigi-hiza-gatame|chave usando o joelho|kansetsu||',
  'ude-hishigi-waki-gatame|Ude-hishigi-waki-gatame|chave usando a axila|kansetsu||',
  'ude-hishigi-hara-gatame|Ude-hishigi-hara-gatame|chave usando o abdome|kansetsu||',
  'ude-hishigi-ashi-gatame|Ude-hishigi-ashi-gatame|chave usando a perna|kansetsu||',
  'ude-hishigi-te-gatame|Ude-hishigi-te-gatame|chave usando a mão|kansetsu||',
  'ude-hishigi-sankaku-gatame|Ude-hishigi-sankaku-gatame|chave em triângulo|kansetsu||',
  'ashi-garami|Ashi-garami|perna entrelaçada|kansetsu||proibida em competição'
];

const CATALOGO = CATALOGO_RAW.map(l => {
  const p = l.split('|');
  const sub = p[3];
  return {
    id: p[0], nome: p[1], trad: p[2],
    sub: sub, grupo: p[4] || '', nota: p[5] || '',
    cat: (sub === 'osaekomi' || sub === 'shime' || sub === 'kansetsu') ? 'katame' : 'nage'
  };
});

const CAT_POR_ID = {};
CATALOGO.forEach(t => { CAT_POR_ID[t.id] = t; });

/* aviso que aparece no topo do catálogo */
const CATALOGO_AVISO =
  'Shime-waza e kansetsu-waza têm restrição por faixa etária, e as regras de ' +
  'competição mudam com o tempo. Confirme com seu sensei o que vale hoje na sua categoria.';
