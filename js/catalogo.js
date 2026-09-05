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

/* id | nome | japonês | tradução literal | sub | grupo | observação */
const CATALOGO_RAW = [
  'de-ashi-barai|De-ashi-barai|出足払|varrer o pé que avança|ashi|1|',
  'hiza-guruma|Hiza-guruma|膝車|roda no joelho|ashi|1|',
  'sasae-tsurikomi-ashi|Sasae-tsurikomi-ashi|支釣込足|pé que apoia, puxando e levantando|ashi|1|',
  'uki-goshi|Uki-goshi|浮腰|quadril flutuante|koshi|1|',
  'o-soto-gari|O-soto-gari|大外刈|grande ceifada externa|ashi|1|',
  'o-goshi|O-goshi|大腰|grande quadril|koshi|1|',
  'o-uchi-gari|O-uchi-gari|大内刈|grande ceifada interna|ashi|1|',
  'seoi-nage|Seoi-nage|背負投|projeção carregando nas costas|te|1|',
  'ko-soto-gari|Ko-soto-gari|小外刈|pequena ceifada externa|ashi|2|',
  'ko-uchi-gari|Ko-uchi-gari|小内刈|pequena ceifada interna|ashi|2|',
  'koshi-guruma|Koshi-guruma|腰車|roda de quadril|koshi|2|',
  'tsurikomi-goshi|Tsurikomi-goshi|釣込腰|quadril puxando e levantando|koshi|2|',
  'okuri-ashi-barai|Okuri-ashi-barai|送足払|varrer os dois pés|ashi|2|',
  'tai-otoshi|Tai-otoshi|体落|queda do corpo|te|2|',
  'harai-goshi|Harai-goshi|払腰|quadril que varre|koshi|2|',
  'uchi-mata|Uchi-mata|内股|coxa interna|ashi|2|',
  'ko-soto-gake|Ko-soto-gake|小外掛|pequeno enganche externo|ashi|3|',
  'tsuri-goshi|Tsuri-goshi|釣腰|quadril de levantar|koshi|3|',
  'yoko-otoshi|Yoko-otoshi|横落|queda lateral|yokosutemi|3|',
  'ashi-guruma|Ashi-guruma|足車|roda de perna|ashi|3|',
  'hane-goshi|Hane-goshi|跳腰|quadril de mola|koshi|3|',
  'harai-tsurikomi-ashi|Harai-tsurikomi-ashi|払釣込足|varrer o pé puxando e levantando|ashi|3|',
  'tomoe-nage|Tomoe-nage|巴投|projeção em círculo|masutemi|3|',
  'kata-guruma|Kata-guruma|肩車|roda no ombro|te|3|na forma clássica pega a perna: restrita em competição',
  'sumi-gaeshi|Sumi-gaeshi|隅返|reversão de canto|masutemi|4|',
  'tani-otoshi|Tani-otoshi|谷落|queda no vale|yokosutemi|4|',
  'hane-makikomi|Hane-makikomi|跳巻込|mola com enrolamento|yokosutemi|4|',
  'sukui-nage|Sukui-nage|掬投|projeção de colher|te|4|na forma clássica pega a perna: restrita em competição',
  'utsuri-goshi|Utsuri-goshi|移腰|quadril de transferência|koshi|4|',
  'o-guruma|O-guruma|大車|grande roda|ashi|4|',
  'soto-makikomi|Soto-makikomi|外巻込|enrolamento externo|yokosutemi|4|',
  'uki-otoshi|Uki-otoshi|浮落|queda flutuante|te|4|',
  'o-soto-guruma|O-soto-guruma|大外車|grande roda externa|ashi|5|',
  'uki-waza|Uki-waza|浮技|técnica flutuante|yokosutemi|5|',
  'yoko-wakare|Yoko-wakare|横分|separação lateral|yokosutemi|5|',
  'yoko-guruma|Yoko-guruma|横車|roda lateral|yokosutemi|5|',
  'ushiro-goshi|Ushiro-goshi|後腰|quadril por trás|koshi|5|',
  'ura-nage|Ura-nage|裏投|projeção por trás|masutemi|5|',
  'sumi-otoshi|Sumi-otoshi|隅落|queda de canto|te|5|',
  'yoko-gake|Yoko-gake|横掛|enganche lateral|yokosutemi|5|',
  'ippon-seoi-nage|Ippon-seoi-nage|一本背負投|seoi-nage com um braço só|te|s|',
  'seoi-otoshi|Seoi-otoshi|背負落|queda carregando nas costas|te|s|',
  'sode-tsurikomi-goshi|Sode-tsurikomi-goshi|袖釣込腰|quadril puxando pela manga|koshi|s|',
  'morote-gari|Morote-gari|双手刈|colheita com as duas mãos|te|s|pegada abaixo da faixa: proibida em competição',
  'kuchiki-taoshi|Kuchiki-taoshi|朽木倒|derrubar a árvore podre|te|s|pegada abaixo da faixa: proibida em competição',
  'kibisu-gaeshi|Kibisu-gaeshi|踵返|reversão pelo calcanhar|te|s|pegada abaixo da faixa: proibida em competição',
  'te-guruma|Te-guruma|手車|roda com as mãos|te|s|pegada abaixo da faixa: proibida em competição',
  'obi-otoshi|Obi-otoshi|帯落|queda pela faixa|te|s|',
  'obi-tori-gaeshi|Obi-tori-gaeshi|帯取返|reversão pegando a faixa|te|s|',
  'yama-arashi|Yama-arashi|山嵐|tempestade da montanha|te|s|',
  'uchi-mata-sukashi|Uchi-mata-sukashi|内股透|esquiva do uchi-mata|te|s|contra ao uchi-mata',
  'o-soto-otoshi|O-soto-otoshi|大外落|grande queda externa|ashi|s|',
  'tsubame-gaeshi|Tsubame-gaeshi|燕返|reversão da andorinha|ashi|s|contra ao de-ashi-barai',
  'o-soto-gaeshi|O-soto-gaeshi|大外返|reversão do grande externo|ashi|s|contra ao o-soto-gari',
  'o-uchi-gaeshi|O-uchi-gaeshi|大内返|reversão do grande interno|ashi|s|contra ao o-uchi-gari',
  'ko-uchi-gaeshi|Ko-uchi-gaeshi|小内返|reversão do pequeno interno|ashi|s|contra ao ko-uchi-gari',
  'uchi-mata-gaeshi|Uchi-mata-gaeshi|内股返|reversão do uchi-mata|ashi|s|contra ao uchi-mata',
  'hane-goshi-gaeshi|Hane-goshi-gaeshi|跳腰返|reversão do hane-goshi|ashi|s|contra ao hane-goshi',
  'harai-goshi-gaeshi|Harai-goshi-gaeshi|払腰返|reversão do harai-goshi|ashi|s|contra ao harai-goshi',
  'uchi-mata-makikomi|Uchi-mata-makikomi|内股巻込|uchi-mata com enrolamento|yokosutemi|s|',
  'harai-makikomi|Harai-makikomi|払巻込|harai com enrolamento|yokosutemi|s|',
  'o-soto-makikomi|O-soto-makikomi|大外巻込|o-soto com enrolamento|yokosutemi|s|',
  'ko-uchi-makikomi|Ko-uchi-makikomi|小内巻込|ko-uchi com enrolamento|yokosutemi|s|',
  'daki-wakare|Daki-wakare|抱分|separação abraçando|yokosutemi|s|',
  'kani-basami|Kani-basami|蟹挟|tesoura de caranguejo|yokosutemi|s|proibida em competição',
  'kawazu-gake|Kawazu-gake|河津掛|enganche do sapo|yokosutemi|s|proibida em competição',
  'hikikomi-gaeshi|Hikikomi-gaeshi|引込返|reversão puxando para dentro|masutemi|s|',
  'tawara-gaeshi|Tawara-gaeshi|俵返|reversão do saco de arroz|masutemi|s|',
  'kesa-gatame|Kesa-gatame|袈裟固|imobilização em echarpe|osaekomi||',
  'kuzure-kesa-gatame|Kuzure-kesa-gatame|崩袈裟固|kesa-gatame modificado|osaekomi||',
  'ushiro-kesa-gatame|Ushiro-kesa-gatame|後袈裟固|kesa-gatame por trás|osaekomi||',
  'kata-gatame|Kata-gatame|肩固|imobilização de ombro|osaekomi||',
  'kami-shiho-gatame|Kami-shiho-gatame|上四方固|quatro pontos pela cabeça|osaekomi||',
  'kuzure-kami-shiho-gatame|Kuzure-kami-shiho-gatame|崩上四方固|kami-shiho modificado|osaekomi||',
  'yoko-shiho-gatame|Yoko-shiho-gatame|横四方固|quatro pontos lateral|osaekomi||',
  'tate-shiho-gatame|Tate-shiho-gatame|縦四方固|quatro pontos montado|osaekomi||',
  'uki-gatame|Uki-gatame|浮固|imobilização flutuante|osaekomi||',
  'nami-juji-jime|Nami-juji-jime|並十字絞|cruzada normal|shime||',
  'gyaku-juji-jime|Gyaku-juji-jime|逆十字絞|cruzada invertida|shime||',
  'kata-juji-jime|Kata-juji-jime|片十字絞|meia cruzada|shime||',
  'hadaka-jime|Hadaka-jime|裸絞|estrangulamento sem gola|shime||',
  'okuri-eri-jime|Okuri-eri-jime|送襟絞|gola deslizante|shime||',
  'kataha-jime|Kataha-jime|片羽絞|uma asa|shime||',
  'kata-te-jime|Kata-te-jime|片手絞|com uma mão|shime||',
  'ryo-te-jime|Ryo-te-jime|両手絞|com as duas mãos|shime||',
  'sode-guruma-jime|Sode-guruma-jime|袖車絞|roda de manga|shime||',
  'tsukkomi-jime|Tsukkomi-jime|突込絞|de impulso|shime||',
  'sankaku-jime|Sankaku-jime|三角絞|triângulo|shime||',
  'do-jime|Do-jime|胴絞|tesoura de tronco|shime||proibida em competição',
  'ude-garami|Ude-garami|腕緘|braço entrelaçado|kansetsu||',
  'ude-hishigi-juji-gatame|Ude-hishigi-juji-gatame|腕挫十字固|chave de braço em cruz|kansetsu||',
  'ude-hishigi-ude-gatame|Ude-hishigi-ude-gatame|腕挫腕固|chave usando o braço|kansetsu||',
  'ude-hishigi-hiza-gatame|Ude-hishigi-hiza-gatame|腕挫膝固|chave usando o joelho|kansetsu||',
  'ude-hishigi-waki-gatame|Ude-hishigi-waki-gatame|腕挫脇固|chave usando a axila|kansetsu||',
  'ude-hishigi-hara-gatame|Ude-hishigi-hara-gatame|腕挫腹固|chave usando o abdome|kansetsu||',
  'ude-hishigi-ashi-gatame|Ude-hishigi-ashi-gatame|腕挫脚固|chave usando a perna|kansetsu||',
  'ude-hishigi-te-gatame|Ude-hishigi-te-gatame|腕挫手固|chave usando a mão|kansetsu||',
  'ude-hishigi-sankaku-gatame|Ude-hishigi-sankaku-gatame|腕挫三角固|chave em triângulo|kansetsu||',
  'ashi-garami|Ashi-garami|足緘|perna entrelaçada|kansetsu||proibida em competição'
];

const CATALOGO = CATALOGO_RAW.map(l => {
  const p = l.split('|');
  const sub = p[4];
  return {
    id: p[0], nome: p[1], jp: p[2], trad: p[3],
    sub: sub, grupo: p[5] || '', nota: p[6] || '',
    cat: (sub === 'osaekomi' || sub === 'shime' || sub === 'kansetsu') ? 'katame' : 'nage'
  };
});

const CAT_POR_ID = {};
CATALOGO.forEach(t => { CAT_POR_ID[t.id] = t; });

/* aviso que aparece no topo do catálogo */
const CATALOGO_AVISO =
  'Shime-waza e kansetsu-waza têm restrição por faixa etária, e as regras de ' +
  'competição mudam com o tempo. Confirme com seu sensei o que vale hoje na sua categoria.';
