# Judo

Caderno de técnicas de judô. Clipes curtos rodando em loop, anotações presas ao
instante exato do movimento, e o mapa de encadeamentos entre uma técnica e outra.
HTML + CSS + JS puros, sem dependências, sem build.

**No ar em: https://gianzortea.github.io/judo/**

Abra esse endereço no celular e use "Adicionar à tela de início" — a partir daí
ele abre como app, em tela cheia, e os clipes que estão no aparelho funcionam no
modo avião.

## Como usar

**No computador (testar):**

```bash
python -m http.server 8791
```

**No celular:** abra https://gianzortea.github.io/judo/ e use "Adicionar à tela
de início".

## As duas listas

**Meu judô** começa vazia de propósito. Só entra ali o que você está de fato
aprendendo, na ordem que você quiser, com favoritos e status.

**Catálogo** é a nomenclatura oficial do Kodokan em modo consulta: as 40 técnicas
do Gokyo divididas nos 5 grupos, as shinmeisho-no-waza reconhecidas depois, e as
imobilizações, estrangulamentos e chaves. Cada nome vem com a tradução
literal do que o movimento faz. Tocar no `+` traz a técnica pro seu judô com o nome já
preenchido — daí em diante ela é sua.

> As restrições de competição marcadas com ⚠ mudam com o tempo, e shime-waza e
> kansetsu-waza dependem da faixa etária. Confirme com seu sensei.

## O que dá pra fazer

| | |
|---|---|
| **Clipes em loop** | Vários por técnica: ângulo de frente, de lado, competição, o seu treino. Dá play e fica rodando. |
| **Recortar o trecho** | Os botões **[** e **]** marcam início e fim no instante em que você está. O loop passa a ser só aquele pedaço. |
| **Câmera lenta** | 0,25× / 0,5× / 0,75× / 1×, guardado por clipe. |
| **Quadro a quadro** | **◀|** e **|▶** andam 1/30 de segundo. É o que deixa ver o kuzushi. |
| **Espelhar** | O botão **⇋** inverte na horizontal: você grava do lado direito e vê a versão canhota sem gravar de novo. |
| **Notas no tempo** | Uma anotação presa ao segundo 2,4 do clipe. Enquanto o loop roda, a nota daquele instante acende sozinha. Na barra do tempo cada nota vira uma marca. |
| **Pontos-chave e erros** | Duas listas curtas: o que lembrar na hora, e o que costuma dar errado. |
| **Encadeamentos e contras** | Liga uma técnica na outra com o motivo: *renraku-waza* (se falhar, entra essa), *kaeshi-waza* (o que ele tenta em cima), defesa e variação. Dá pra navegar de uma pra outra. |
| **Planos de treino** | Sequências ordenadas, reordenáveis arrastando pela alça ≡. Dentro da técnica aparecem ‹ › pra andar pela sequência. |
| **Log de treino** | Marca o que você drillou em cada dia. A tela mostra o que você está **devendo treino** e a lista sabe ordenar pelas mais esquecidas. |
| **Um vídeo, várias técnicas** | Subiu a aula inteira uma vez? Cada técnica aponta pro mesmo arquivo com o seu próprio recorte. O arquivo é guardado **uma vez só** — não pesa mais no aparelho nem no backup. |
| **Backup** | Ficha `.json` (poucos KB, dá pra mandar por mensagem) ou `.zip` com os vídeos dentro. |

Tema **claro** por padrão; o escuro fica em Ajustes.

## As duas origens de vídeo

| | arquivo do aparelho | trecho do YouTube |
|---|---|---|
| funciona offline | sim | não |
| ocupa espaço | sim, o tamanho do arquivo | nada |
| vai no backup `.json` | não, só o nome | sim, inteiro |
| quadro a quadro | 1/30 s, de verdade | 0,1 s (é o mais fino que a API entrega) |
| some se o vídeo sair do ar | não | sim |

A mesma técnica pode ter os dois. A regra prática: **referência de fora fica no
YouTube, o que é seu fica no aparelho.**

## A biblioteca de vídeos

Um vídeo **não pertence a uma técnica**. Ele mora numa biblioteca, e cada clipe
é só um ponteiro pra ele mais um recorte:

```
Aula 12/03.mp4  (180 MB, guardado uma vez)
   ├── O-soto-gari    0:00 → 0:03
   ├── Ko-uchi-gari   0:03 → 0:06
   ├── Tai-otoshi     0:06 → 0:10
   └── Uchi-mata      0:12 → 0:18
```

É pra isso que serve: você grava a aula inteira, sobe **uma vez**, e vai
recortando técnica por técnica. Quatro técnicas do mesmo arquivo ocupam o
espaço de um arquivo, não de quatro — no aparelho e no `.zip` de backup.

Dois caminhos chegam lá:

- Ao adicionar um clipe, **Escolher da biblioteca** em vez de subir de novo.
- Estudando um clipe, **Usar este vídeo em outra técnica** no menu `⋯` da aba.
  O novo clipe já começa no instante em que você estava — que é exatamente o
  momento em que você percebe que ali tem outra técnica.

Apagar um clipe ou uma técnica **não apaga o vídeo**: outro clipe pode estar
usando. O arquivo só sai pela biblioteca, em *Ajustes → Biblioteca de vídeos*,
que mostra o tamanho de cada um, quantos clipes o usam, e tem um botão pra
varrer de uma vez o que ficou sem uso nenhum.

## Por que o backup grande é `.zip` e não `.json`

O jeito óbvio seria embutir os vídeos no JSON em base64, como o projeto de
cifras faz com os MP3. Não escala aqui: base64 infla ~34%, e um repertório de
vídeo passa de 1 GB fácil — o navegador não consegue nem montar essa string.

`js/zip.js` escreve um ZIP pelo método *store*, sem compressão. Vídeo já é
comprimido, comprimir de novo só gastaria tempo. Sem compressão o formato é
simples o bastante pra caber em ~200 linhas sem nenhuma dependência, e o
resultado é montado como um `Blob` feito dos `Blob`s originais — então um backup
de 1 GB **não precisa de 1 GB de RAM**.

O custo real medido: 300.000 bytes de vídeo viram um `.zip` de 301.850 bytes.
1.850 bytes de cabeçalho, contra os ~102.000 que o base64 cobraria.

## Quanto isso ocupa

Vale saber antes de encher o aparelho:

- Um clipe de 10 s gravado no celular em 1080p tem **15 a 25 MB**. Cortado e em
  720p, 3 a 5 MB.
- 100 técnicas com 2 clipes cada passam de **1 GB** sem esforço.
- No **iOS o sistema pode apagar** o armazenamento de um PWA por inatividade. No
  Android é mais seguro, mas não é garantia.

Em Ajustes tem a barra de quanto o navegador liberou e quanto já foi usado, e a
biblioteca mostra o peso de cada arquivo e quantos clipes dependem dele.

**Corte o vídeo antes de subir.** Dez segundos bem escolhidos valem mais que dois
minutos de aula, e é a diferença entre 4 MB e 200 MB.

## Estrutura

```
index.html          casca do app
css/style.css       tema (claro/escuro), layout mobile
js/catalogo.js      nomenclatura oficial (Gokyo, katame-waza, shinmeisho)
js/store.js         localStorage (fichas) + IndexedDB (vídeos)
js/zip.js           ZIP sem compressão, pra backup com vídeo
js/player.js        um controle só pra <video> local e pro YouTube
js/tecnica.js       a tela de estudo e o editor da ficha
js/planos.js        planos de treino e log
js/app.js           rotas, lista, catálogo, ajustes e backup
sw.js               cache offline
manifest.json       instalação como app
```

## Onde os dados ficam

- **localStorage** — técnicas, notas, ligações, planos, log e a ficha de cada
  vídeo (nome, tamanho, duração). Leve, ~5 MB.
- **IndexedDB** — os arquivos de vídeo em si, pesados demais pro localStorage,
  guardados pela chave do vídeo na biblioteca.

Tudo fica **só no aparelho**. Nada sai daqui: não há servidor, conta nem sincronia.
Trocou de celular ou limpou os dados do navegador, os dados vão junto — por isso
exporte um backup de vez em quando.

## Modelo de dados

Uma técnica guarda os clipes. Um clipe **não contém vídeo**: ele aponta pra um
(`videoId`) e por cima guarda o que é só dele — o recorte, a velocidade e as
notas, porque o instante "2,0 s" só faz sentido dentro de um recorte específico:

```js
{ nome: 'Uchi-mata', status: 'drill', lado: 'direita',
  clipes: [ { tipo: 'file', videoId: '<id na biblioteca>',
              in: 1.5, out: 4.25, rate: 0.5, mirror: false,
              notas: [ {t: 2.0, txt: 'o cotovelo sobe antes do quadril'} ] } ],
  links:  [ { para: '<id>', tipo: 'contra', quando: 'quando ele varre meu pé' } ],
  pontos: ['puxar a manga pra cima'], erros: ['entro raso'] }
```

O vídeo em si não está aí: fica no IndexedDB com a chave do **vídeo**, não a do
clipe. É isso que permite dez técnicas dividirem um arquivo, e que a ficha
inteira caiba em poucos KB.

## Como a atualização chega no celular

Automática, sem reinstalar nada. Ao abrir o app com internet, o navegador baixa o
`sw.js`; se mudou, o service worker novo instala e assume no lugar do antigo.

A página que já está na tela continua com o código velho na memória — por isso o
app **avisa** em vez de trocar embaixo do seu pé: aparece uma barra "Nova versão
disponível". O aviso **nunca aparece com uma técnica aberta**: se a atualização
chega enquanto você está estudando um clipe, ela espera você voltar pra lista.

### Publicando uma nova versão

```bash
python bump-version.py
```

Sobe o número em `sw.js` (`const CACHE`) e nas URLs dos scripts em `index.html`
(`app.js?v=2`) de uma vez — depois é `git push` e o Pages reconstrói em 1 a 2
minutos.

Os dois lugares importam: o `CACHE` faz o service worker se ver como novo, e a
query nas URLs impede o navegador de servir um `app.js` velho do próprio cache
HTTP. Sem a query, dá pra passar horas caçando um bug já corrigido no disco.
