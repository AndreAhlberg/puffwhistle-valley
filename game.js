'use strict';
// Puffwhistle Valley — a cosy train-building game for kids.
// World coordinates are in tiles; one tile = view.s CSS pixels on screen.
(() => {
// ---------- constants ----------
let W = 40, H = 24; // set per map by newGame / load
const MAX_S = 72; // most zoomed-in: CSS pixels per tile
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0]; // N E S W
const OPP = d => (d + 2) & 3;
const GRASS = 0, WATER = 1, TREE = 2, HILL = 3;
const COST = { track: 2, bridge: 8, tunnel: 6, station: 15, wagon: 10, signal: 12 };
const CATCH = 2, WAGON_CAP = 8, MAX_WAGONS = 6, GAP = 0.58, ENG_LEN = 0.62, STN_CAP = 60, PROD_EVERY = 5;
const SEASON_LEN = 150, DAY_LEN = 120, NIGHT_DARK = 0.5, UNDO_MAX = 30;
const SAVE_KEY = 'puffwhistle-save-v1', MUSIC_KEY = 'puffwhistle-music';
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const UI_FONT = '"Baloo 2","Trebuchet MS","Segoe UI",sans-serif';

const CARGO = {
  people: { e: '🧒', name: 'Passengers', rate: 3 },
  apples: { e: '🍎', name: 'Apples', rate: 2 },
  wheat:  { e: '🌾', name: 'Wheat', rate: 2 },
  milk:   { e: '🥛', name: 'Milk', rate: 3 },
  logs:   { e: '🪵', name: 'Logs', rate: 2 },
  cakes:  { e: '🧁', name: 'Cupcakes', rate: 5 },
  toys:   { e: '🧸', name: 'Toys', rate: 6 },
  fish:   { e: '🐟', name: 'Fish', rate: 3 },
  sticks: { e: '🍤', name: 'Fish fingers', rate: 6 },
  stone:  { e: '🪨', name: 'Stone', rate: 2 },
  bricks: { e: '🧱', name: 'Bricks', rate: 5 },
};
const KINDS = {
  town:    { e: '🏘️', label: 'Town', produces: ['people'], accepts: ['people', 'apples', 'milk', 'cakes', 'toys', 'sticks', 'bricks'] },
  orchard: { e: '🍎', label: 'Apple Orchard', produces: ['apples'], accepts: [], rate: 4, names: ['Rosy Orchard', 'Appleby Orchard', 'Crunchy Orchard'] },
  farm:    { e: '🐄', label: 'Farm', produces: ['wheat', 'milk'], accepts: [], rate: 3, names: ['Sunny Farm', 'Clover Farm', 'Haystack Farm'] },
  lumber:  { e: '🌲', label: 'Lumber Camp', produces: ['logs'], accepts: [], rate: 4, names: ['Pinewood Camp', 'Oak Hollow Camp', 'Timber Top Camp'] },
  bakery:  { e: '🧁', label: 'Bakery', produces: [], accepts: ['wheat', 'milk'], makes: 'cakes', names: ['Sprinkles Bakery', 'Crumb Corner Bakery'] },
  toyshop: { e: '🧸', label: 'Toy Workshop', produces: [], accepts: ['logs'], makes: 'toys', names: ['Tinker Toy Workshop', 'Wobble Toy Workshop'] },
  harbour: { e: '⚓', label: 'Harbour', produces: ['fish'], accepts: [], rate: 4, names: ['Seagull Harbour', 'Bobbing Boat Harbour'] },
  fishfac: { e: '🍤', label: 'Fish Finger Factory', produces: [], accepts: ['fish'], makes: 'sticks', names: ['Crispy Fish Factory', 'Goldfin Fish Factory'] },
  quarry:  { e: '⛏️', label: 'Quarry', produces: ['stone'], accepts: [], rate: 4, names: ['Rumble Rock Quarry', 'Pebblestone Quarry'] },
  bricks:  { e: '🧱', label: 'Brickworks', produces: [], accepts: ['stone'], makes: 'bricks', names: ['Red Brick Works', 'Busy Bee Brickworks'] },
};
// Paint shop. Fancier choices unlock with stars.
const PAINT_COLORS = [...['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#e84393', '#16a085', '#e67e22', '#2d98da', '#20bf6b'].map(c => ({ c, stars: 0 })),
  { c: '#2d3436', stars: 1 }, { c: '#d4a017', stars: 2 }, { c: '#ff9ff3', stars: 3 }, { c: 'rainbow', stars: 5 }];
const PATTERNS = [{ id: 'plain', name: 'Plain', stars: 0 }, { id: 'stripes', name: 'Stripes', stars: 1 }, { id: 'spots', name: 'Spots', stars: 2 }, { id: 'stars', name: 'Stars', stars: 4 }];
const FACES = [{ id: 'none', e: '—', stars: 0 }, { id: 'smile', e: '🙂', stars: 0 }, { id: 'wow', e: '😮', stars: 1 }, { id: 'cool', e: '😎', stars: 3 }];
const COST_BUS = 40, BUS_CAP = 10, BUS_SPEED = 1.5;
// Maps. Free play has no goal; scenarios have one, rated ⭐⭐⭐/⭐⭐/⭐ by game time (par = 3-star and 2-star limits).
// ind = how many of each industry; extra = more industries; season = locked season.
const SCENARIOS = {
  free:      { e: '🗺️', name: 'Free play', desc: 'A random valley. Build whatever you like!', w: 72, h: 44, towns: 7, ind: 2, hills: 7, rivers: 2, ponds: 3 },
  islands:   { e: '🏝️', name: 'Island Hop', desc: 'Towns on little islands. Build bridges to join them up!', w: 64, h: 40, islands: 13, towns: 6, ind: 1, hills: 2, coins: 450,
    goal: { kind: 'grow', n: 12 }, par: [900, 1500] },
  mountains: { e: '⛰️', name: 'Mountain Railway', desc: 'Big hills everywhere. Dig tunnels and make bricks!', w: 64, h: 40, towns: 5, ind: 1, hills: 15, hillR: 1.7, rivers: 1, coins: 400,
    extra: ['quarry', 'bricks'], goal: { kind: 'deliver', type: 'bricks', n: 60 }, par: [900, 1500] },
  snowy:     { e: '❄️', name: 'Snowy Valley', desc: 'It is always winter. Towns need lots of milk for hot cocoa!', w: 56, h: 36, towns: 5, ind: 1, hills: 4, rivers: 1, ponds: 2, season: 3, coins: 350,
    extra: ['farm', 'farm'], goal: { kind: 'deliver', type: 'milk', n: 120 }, par: [900, 1500] },
  busy:      { e: '🏙️', name: 'Busy Towns', desc: 'Lots of towns and roads. Carry passengers by train and bus!', w: 72, h: 44, towns: 9, ind: 1, hills: 4, rivers: 1, ponds: 2, coins: 400,
    goal: { kind: 'deliver', type: 'people', n: 200 }, par: [700, 1200] },
};
// Map sizes stretch a valley's width and height; towns, industries, hills and delivery goals scale with its area.
const SIZES = {
  small:  { e: '🐣', name: 'Small', k: 0.6 },
  medium: { e: '🐥', name: 'Medium', k: 0.8 },
  big:    { e: '🐔', name: 'Big', k: 1 },
  huge:   { e: '🦚', name: 'Huge', k: 1.35 },
};
const SIZE_KEY = 'puffwhistle-size';
// Difficulty: pay and cost multiply coins earned and building prices (not decorations); run is running costs;
// start multiplies the starting coins, reward the quest coins, and par the time allowed for ⭐⭐⭐.
const DIFFS = {
  easy:   { e: '🌼', name: 'Easy', desc: 'Lots of coins and nothing to pay for running trains. Just have fun!', pay: 1, cost: 1, run: 0, start: 1, reward: 1, par: 1 },
  normal: { e: '🚂', name: 'Normal', desc: 'Things cost more, and trains and buses cost coins to run. Plan good routes!', pay: 0.35, cost: 1.5, run: 1.5, start: 1.3, reward: 0.6, par: 1.5 },
  tycoon: { e: '🎩', name: 'Tycoon', desc: 'For big kids and grown-ups: tight money and high running costs. Long, full trains pay best!', pay: 0.18, cost: 2, run: 3, start: 1.5, reward: 0.4, par: 2.2 },
};
const DIFF_KEY = 'puffwhistle-diff';
const D = () => DIFFS[G && G.diff] || DIFFS.easy;
const price = n => Math.round(n * D().cost);
// running cost in coins per minute
const trainRun = tr => D().run ? Math.round((ENG[tr.eng].cost * 0.12 + tr.wagons) * D().run) : 0;
const busRun = () => D().run ? Math.round(COST_BUS * 0.12 * D().run) : 0;
const RUN_EVERY = 5; // charge running costs every few game seconds
function sized(S, size) {
  const k = (SIZES[size] || SIZES.big).k, a = k * k, n = (v, min) => v === undefined ? v : Math.max(min, Math.round(v * a));
  const towns = n(S.towns || 4, 3);
  return { ...S, w: Math.round(S.w * k), h: Math.round(S.h * k), towns, ind: n(S.ind || 1, 1), hills: n(S.hills ?? 3, 1),
    rivers: n(S.rivers, 1), ponds: n(S.ponds, 1), islands: S.islands && Math.max(towns + 2, Math.round(S.islands * a)),
    goal: S.goal && (S.goal.kind === 'deliver' ? { ...S.goal, n: Math.max(20, Math.round(S.goal.n * a / 10) * 10) } : S.goal) };
}
const BEST_KEY = 'puffwhistle-best';
const scnMemo = {};
const scn = () => {
  const id = SCENARIOS[G && G.scn && G.scn.id] ? G.scn.id : 'free', size = (G && G.scn && G.scn.size) || 'big', df = DIFFS[G && G.diff] ? G.diff : 'easy', k = id + ':' + size + ':' + df;
  if (!scnMemo[k]) { const S = sized(SCENARIOS[id], size); scnMemo[k] = { ...S, par: S.par && S.par.map(v => Math.round(v * DIFFS[df].par / 30) * 30) }; }
  return scnMemo[k];
};
const bestKey = (id, size, diff) => id + (size && size !== 'big' ? ':' + size : '') + (diff && diff !== 'easy' ? '@' + diff : '');
const ENGINES = [
  { id: 'puffer', name: 'Puffer', speed: 2.2, cost: 50, stars: 0, wagons: 2, stripe: null },
  { id: 'dasher', name: 'Dasher', speed: 3.2, cost: 110, stars: 3, wagons: 3, stripe: '#ffffff' },
  { id: 'comet', name: 'Comet', speed: 4.4, cost: 200, stars: 7, wagons: 4, stripe: '#ffd23f' },
];
const ENG = Object.fromEntries(ENGINES.map(e => [e.id, e]));
const TRAIN_NAMES = ['Puffy', 'Zippy', 'Biscuit', 'Pip', 'Bramble', 'Sunny', 'Clover', 'Pepper', 'Jellybean', 'Tumble', 'Rosie', 'Button', 'Noodle', 'Waffles', 'Pickle', 'Marble', 'Toffee', 'Dot'];
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#e84393', '#16a085', '#e67e22', '#2d98da', '#20bf6b'];
const ROOFS = ['#e8584f', '#f39c3d', '#5b8def', '#9b6bd6', '#e86fa8', '#3fb38f', '#d9534f'];
const TOWN_NAMES = ['Maple Town', 'Puddleby', 'Honeyhill', 'Pebble Cove', 'Sunnyvale', 'Bramble End', 'Little Wick', 'Cloverdale', 'Button Bay', 'Muffin Hill', 'Duckford', 'Teacup Green'];
const TIPS = [
  'Bakeries turn 🌾 wheat and 🥛 milk into 🧁 cupcakes. Cupcakes are worth lots of coins!',
  'Toy Workshops turn 🪵 logs into 🧸 toys. Towns love toys!',
  'Towns grow bigger when trains bring them goods. 🏠',
  'Longer trips pay more coins! 🪙',
  'Click a train with 👆 Look to give it more wagons.',
  'A station collects from everything inside its yellow square.',
  'Finish quests to win ⭐ stars and unlock faster engines!',
  'Trains can cross rivers on bridges 🌉. They cost a bit more.',
  'A train can stop at lots of stations. Click them all before you press Go!',
  'Tunnels ⛰️ let trains go through hills. They cost a bit more.',
  'Each season one kind of goods pays double. Look at the top bar!',
  'Lamp posts 💡 light up the valley at night!',
  'Cars wait at the crossing when a train comes. 🚗',
  'Fish Finger Factories turn 🐟 fish into 🍤 fish fingers!',
  'Brickworks turn 🪨 stone into 🧱 bricks. Bricks make towns grow super fast!',
  'Buses 🚌 carry passengers along the roads between towns.',
  'Click a train to make it toot! Paint it 🎨 in its panel.',
  'Scroll or pinch to zoom. Drag the map with 👆 Look, or with two fingers.',
  'The minimap in the corner shows the whole valley. Click it to jump there!',
];
// Each season one cargo pays double. The palette repaints the valley.
const SEASONS = [
  { e: '🌸', name: 'Spring', bonus: 'cakes', msg: 'Spring is here! Towns are having parties: 🧁 cupcakes pay double!' },
  { e: '☀️', name: 'Summer', bonus: 'people', msg: 'Summer holidays! Everyone wants to travel: 🧒 passengers pay double!' },
  { e: '🍂', name: 'Autumn', bonus: 'apples', msg: 'Autumn harvest! 🍎 Apples pay double!' },
  { e: '❄️', name: 'Winter', bonus: 'milk', msg: 'Brr, winter! Towns want hot cocoa: 🥛 milk pays double!' },
];
const PAL = [
  { g: ['#93d36b', '#8bcc64'], hill: '#6aae4c', water: '#4fb4ea', sand: '#f3dfa2', leaf: ['#3d9a4c', '#5cbd5f'], dots: ['#ffffff', '#ffe066', '#ff9ecb'], dotP: 0.78 },
  { g: ['#8fd166', '#86c95e'], hill: '#64a847', water: '#45ade6', sand: '#f3dfa2', leaf: ['#2f8f45', '#4fb556'], dots: ['#ffffff', '#ffe066', '#ff9ecb'], dotP: 0.88 },
  { g: ['#b9c96e', '#b0c166'], hill: '#949f4f', water: '#4aa7d8', sand: '#e9d39a', leaf: null, dots: ['#e0672b', '#f0a830', '#c9452e'], dotP: 0.72 },
  { g: ['#eef3f8', '#e6edf4'], hill: '#cbd9e8', water: '#bfe2f4', sand: '#ffffff', leaf: ['#2f7d55', '#ffffff'], dots: null, dotP: 1 },
];
const AUTUMN_LEAVES = [['#d9672b', '#f29a45'], ['#e8a530', '#f7c95c'], ['#c4442e', '#e2704f']];
// Decorations are stored per tile as index + 1. Keep this order: saves depend on it. 'tree' plants a TREE tile instead.
const DECOS = [
  { id: 'flowers', name: 'Flowers', cost: 3 },
  { id: 'tree', name: 'Tree', cost: 4 },
  { id: 'fence', name: 'Fence', cost: 2 },
  { id: 'bench', name: 'Bench', cost: 4 },
  { id: 'lamp', name: 'Lamp post', cost: 5 },
  { id: 'pond', name: 'Duck pond', cost: 12 },
  { id: 'windmill', name: 'Windmill', cost: 20 },
  { id: 'snowman', name: 'Snowman', cost: 3 },
];
const DECO = Object.fromEntries(DECOS.map((d, k) => [d.id, k + 1]));
const CAR_COLS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#b197fc', '#ffa94d'];

// ---------- language ----------
// English text is the key; SV holds the Swedish version. Names are stored in English and translated for display.
const LANG_KEY = 'puffwhistle-lang';
let lang = 'en';
try { lang = localStorage.getItem(LANG_KEY) || ((navigator.language || '').toLowerCase().startsWith('sv') ? 'sv' : 'en'); } catch (e) { /* keep English */ }
const SV = {
  'Puffwhistle Valley': 'Puffvisseldalen',
  'Look': 'Titta', 'Track': 'Spår', 'Station': 'Station', 'Train': 'Tåg', 'Remove': 'Ta bort',
  'Pause': 'Pausa', 'Normal speed': 'Normal fart', 'Fast': 'Snabbt', 'Sound on/off': 'Ljud på/av', 'Start a new valley': 'Börja en ny dal',
  'Switch language': 'Byt språk',
  'Towns that get lots of deliveries grow bigger! 🏠': 'Städer som får många leveranser växer sig större! 🏠',
  "Let's go!": 'Kör igång!',
  'Passengers': 'Passagerare', 'Apples': 'Äpplen', 'Wheat': 'Vete', 'Milk': 'Mjölk', 'Logs': 'Timmer', 'Cupcakes': 'Muffins', 'Toys': 'Leksaker',
  'Town': 'Stad', 'Apple Orchard': 'Äppelodling', 'Farm': 'Bondgård', 'Lumber Camp': 'Timmerläger', 'Bakery': 'Bageri', 'Toy Workshop': 'Leksaksverkstad',
  "Trains can't go through buildings!": 'Tåg kan inte åka genom hus!',
  'Track can only go straight through a station.': 'Spåret måste gå rakt genom en station.',
  'Not enough coins 🪙': 'Inte tillräckligt med mynt 🪙',
  'Put stations on a straight piece of track! 🛤️': 'Sätt stationer på en rak bit spår! 🛤️',
  "Stations can't float! Pick a spot on land.": 'Stationer kan inte flyta! Välj en plats på land.',
  'Nothing is near this station. Try inside the yellow square!': 'Det finns inget nära den här stationen. Prova inne i den gula rutan!',
  '{name} went back to the depot.': '{name} åkte tillbaka till depån.',
  'A train needs at least two stations!': 'Ett tåg behöver minst två stationer!',
  'You need {n} ⭐ for the {name}.': 'Du behöver {n} ⭐ för {name}.',
  'Hooray! {name} is ready to go! 🚂': 'Hurra! {name} är redo att åka! 🚂',
  '🏠 {name} grew!': '🏠 {name} växte!',
  'Build {n} stations 🚉': 'Bygg {n} stationer 🚉',
  'Have {n} train 🚂': 'Ha {n} tåg 🚂', 'Have {n} trains 🚂': 'Ha {n} tåg 🚂',
  'Deliver {n} {e} {name}': 'Leverera {n} {e} {lname}',
  'Earn {n} 🪙 from deliveries': 'Tjäna {n} 🪙 på leveranser',
  'Grow a town to {n} houses 🏠': 'Låt en stad växa till {n} hus 🏠',
  '⭐ Quest done! +{n}🪙': '⭐ Uppdrag klart! +{n}🪙',
  '🔓 New engine: the {name}!': '🔓 Nytt lok: {name}!',
  'You need two stations first! 🚉🚉': 'Du behöver två stationer först! 🚉🚉',
  'Click the station where your train should start.': 'Klicka på stationen där tåget ska börja.',
  'Now click another station for your train to visit!': 'Klicka nu på en till station som tåget ska åka till!',
  'Add more stops if you like, then press Go! 🚂': 'Lägg till fler stopp om du vill och tryck sedan på Kör! 🚂',
  'Click a straight piece of track. The station picks up from everything in the yellow square.': 'Klicka på en rak bit spår. Stationen hämtar från allt i den gula rutan.',
  'Click things to tidy them away. You get some coins back!': 'Klicka på saker för att städa bort dem. Du får tillbaka lite mynt!',
  "Hi! I'm Conductor Bea. Pick 🛤️ Track and drag on the map to lay rails from a town to somewhere else!":
    'Hej! Jag är konduktör Bea. Välj 🛤️ Spår och dra på kartan för att lägga räls från en stad till något annat ställe!',
  'Lovely rails! Now pick 🚉 Station and put a station on the track near each end.': 'Vilka fina räls! Välj nu 🚉 Station och sätt en station på spåret nära varje ände.',
  'Choo choo! Pick 🚂 Train, click your stations, then press Go!': 'Tut tut! Välj 🚂 Tåg, klicka på dina stationer och tryck sedan på Kör!',
  "A train with ❓ can't find a way. Check that the track joins up!": 'Ett tåg med ❓ hittar ingen väg. Kolla att spåret hänger ihop!',
  'Bakeries turn 🌾 wheat and 🥛 milk into 🧁 cupcakes. Cupcakes are worth lots of coins!': 'Bagerier gör 🧁 muffins av 🌾 vete och 🥛 mjölk. Muffins är värda massor av mynt!',
  'Toy Workshops turn 🪵 logs into 🧸 toys. Towns love toys!': 'Leksaksverkstäder gör 🧸 leksaker av 🪵 timmer. Städer älskar leksaker!',
  'Towns grow bigger when trains bring them goods. 🏠': 'Städer växer när tågen kommer med varor till dem. 🏠',
  'Longer trips pay more coins! 🪙': 'Längre resor ger mer mynt! 🪙',
  'Click a train with 👆 Look to give it more wagons.': 'Klicka på ett tåg med 👆 Titta för att ge det fler vagnar.',
  'A station collects from everything inside its yellow square.': 'En station hämtar från allt inuti sin gula ruta.',
  'Finish quests to win ⭐ stars and unlock faster engines!': 'Klara uppdrag för att vinna ⭐ stjärnor och låsa upp snabbare lok!',
  'Trains can cross rivers on bridges 🌉. They cost a bit more.': 'Tåg kan åka över floder på broar 🌉. De kostar lite mer.',
  'A train can stop at lots of stations. Click them all before you press Go!': 'Ett tåg kan stanna vid många stationer. Klicka på alla innan du trycker på Kör!',
  '❓ Looking for a way…': '❓ Letar efter en väg…', '🚂 Chugging along': '🚂 Tuffar på', '⏳ Loading at the station': '⏳ Lastar på stationen',
  'Route:': 'Rutt:', 'Carrying:': 'Last:', 'nothing yet': 'inget än', 'Wagons:': 'Vagnar:', 'Earned:': 'Tjänat:',
  '➕ Wagon': '➕ Vagn', '➖ Wagon': '➖ Vagn', 'Sure? 💰': 'Säker? 💰', '💰 Sell': '💰 Sälj',
  'Waiting:': 'Väntar:', 'nothing': 'inget', 'Sends:': 'Skickar:', 'Wants:': 'Vill ha:', 'Near:': 'Nära:', 'nothing nearby': 'inget i närheten',
  'Trains:': 'Tåg:', 'no trains yet': 'inga tåg än', 'Makes:': 'Gör:',
  '<b>Turns</b> {a} <b>into</b> {b}': '<b>Gör om</b> {a} <b>till</b> {b}',
  'Houses:': 'Hus:', 'Growing…': 'Växer…', '💡 Build a station nearby to connect it!': '💡 Bygg en station i närheten för att koppla in den!',
  'Click stations on the map…': 'Klicka på stationer på kartan…', 'needs {n} ⭐': 'kräver {n} ⭐', '{n} wagons': '{n} vagnar',
  'Go! 🚂': 'Kör! 🚂', 'Undo last stop': 'Ångra senaste stoppet', 'Cancel': 'Avbryt',
  '{p} / {n} · reward ⭐ + {r}🪙': '{p} / {n} · belöning ⭐ + {r}🪙',
  "{name} can't pull any more wagons!": '{name} orkar inte dra fler vagnar!',
  'Every train needs at least one wagon!': 'Varje tåg behöver minst en vagn!',
  'Click on a station! 🚉': 'Klicka på en station! 🚉', 'That station is already on the route.': 'Den stationen finns redan på rutten.',
  'A brand new valley! 🌄': 'En helt ny dal! 🌄', '🗺️ Sure?': '🗺️ Säker?', '🗺️ New map': '🗺️ Ny karta',
  '🐷 Oink! Your piggy bank found {n} coins!': '🐷 Nöff! Din spargris hittade {n} mynt!',
  'Decorate': 'Pynta', 'Undo': 'Ångra', 'Music on/off': 'Musik på/av', 'Undo (Z)': 'Ångra (Z)',
  'Spring': 'Vår', 'Summer': 'Sommar', 'Autumn': 'Höst', 'Winter': 'Vinter',
  'Spring is here! Towns are having parties: 🧁 cupcakes pay double!': 'Våren är här! Städerna har kalas: 🧁 muffins ger dubbelt betalt!',
  'Summer holidays! Everyone wants to travel: 🧒 passengers pay double!': 'Sommarlov! Alla vill ut och resa: 🧒 passagerare ger dubbelt betalt!',
  'Autumn harvest! 🍎 Apples pay double!': 'Skördetid! 🍎 Äpplen ger dubbelt betalt!',
  'Brr, winter! Towns want hot cocoa: 🥛 milk pays double!': 'Brr, vinter! Städerna vill ha varm choklad: 🥛 mjölk ger dubbelt betalt!',
  'Rails can only cross a straight road, straight across! 🚗': 'Räls kan bara korsa en rak väg, rakt över! 🚗',
  'Something pretty is in the way! Tidy it with 🧹 first.': 'Något fint står i vägen! Städa bort det med 🧹 först.',
  'Stations need flat ground, not a hill! ⛰️': 'Stationer behöver platt mark, inte en kulle! ⛰️',
  "Stations can't go on a road! 🚗": 'Stationer kan inte stå på en väg! 🚗',
  'Decorations go on empty grass. 🌱': 'Pynt ska stå på tomt gräs. 🌱',
  'Snowmen can only be built in winter! ❄️': 'Snögubbar kan bara byggas på vintern! ❄️',
  'Nothing to undo.': 'Det finns inget att ångra.', '↩️ Undone!': '↩️ Ångrat!',
  'Not enough coins to undo that.': 'Inte tillräckligt med mynt för att ångra det.',
  'Flowers': 'Blommor', 'Tree': 'Träd', 'Fence': 'Staket', 'Bench': 'Bänk', 'Lamp post': 'Lyktstolpe',
  'Duck pond': 'Ankdamm', 'Windmill': 'Väderkvarn', 'Snowman': 'Snögubbe',
  'Drag to draw rails, then let go to build them. Rails can cross roads 🚗 and go through hills ⛰️ in tunnels.':
    'Dra för att rita räls och släpp för att bygga. Räls kan korsa vägar 🚗 och gå genom kullar ⛰️ i tunnlar.',
  'Pick something pretty, then click on the grass. Drag to plant lots! 🌷': 'Välj något fint och klicka på gräset. Dra för att plantera massor! 🌷',
  'Tunnels ⛰️ let trains go through hills. They cost a bit more.': 'Tunnlar ⛰️ låter tågen åka genom kullar. De kostar lite mer.',
  'Each season one kind of goods pays double. Look at the top bar!': 'Varje årstid ger en sorts varor dubbelt betalt. Titta i listen högst upp!',
  'Lamp posts 💡 light up the valley at night!': 'Lyktstolpar 💡 lyser upp dalen på natten!',
  'Cars wait at the crossing when a train comes. 🚗': 'Bilarna väntar vid övergången när ett tåg kommer. 🚗',
  '{s} · {e} pays double': '{s} · {e} ger dubbelt',
  'Fish': 'Fisk', 'Fish fingers': 'Fiskpinnar', 'Stone': 'Sten', 'Bricks': 'Tegel',
  'Harbour': 'Hamn', 'Fish Finger Factory': 'Fiskpinnefabrik', 'Quarry': 'Stenbrott', 'Brickworks': 'Tegelbruk',
  'Lay train tracks, build stations and carry people, apples, milk, fish, stone, cupcakes and toys around the valley.':
    'Lägg tågspår, bygg stationer och kör passagerare, äpplen, mjölk, fisk, sten, muffins och leksaker runt i dalen.',
  'Fish Finger Factories turn 🐟 fish into 🍤 fish fingers!': 'Fiskpinnefabriker gör 🍤 fiskpinnar av 🐟 fisk!',
  'Brickworks turn 🪨 stone into 🧱 bricks. Bricks make towns grow super fast!': 'Tegelbruk gör 🧱 tegel av 🪨 sten. Tegel får städer att växa jättefort!',
  'Buses 🚌 carry passengers along the roads between towns.': 'Bussar 🚌 kör passagerare längs vägarna mellan städerna.',
  'Click a train to make it toot! Paint it 🎨 in its panel.': 'Klicka på ett tåg så tutar det! Måla det 🎨 i dess panel.',
  'Toot toot!': 'Tut tut!', 'Beep beep!': 'Pip pip!', 'Quack!': 'Kvack!',
  '🎨 Paint': '🎨 Måla', 'Rename': 'Byt namn', 'Train name': 'Tågets namn', 'Save name': 'Spara namnet', 'Colour': 'Färg', 'Pattern': 'Mönster', 'Face': 'Ansikte',
  'Plain': 'Enfärgad', 'Stripes': 'Ränder', 'Spots': 'Prickar', 'Stars': 'Stjärnor', 'Unlocks at {n} ⭐': 'Låses upp vid {n} ⭐',
  'Bus': 'Buss', 'Bus {n}': 'Buss {n}',
  'Click a town to start a bus route. Buses drive on the roads 🚌': 'Klicka på en stad för att börja en busslinje. Bussar kör på vägarna 🚌',
  'Now click another town joined to it by a road!': 'Klicka nu på en annan stad som har väg dit!',
  "Those towns aren't joined by a road. 🚌": 'De städerna har ingen väg mellan sig. 🚌',
  'Click on a town! 🏘️': 'Klicka på en stad! 🏘️',
  'There are no roads here. Try a 🗺️ New map!': 'Det finns inga vägar här. Prova en 🗺️ Ny karta!',
  'Beep beep! {name} is on its way! 🚌': 'Pip pip! {name} är på väg! 🚌',
  '🚌 Driving': '🚌 Kör', '🧒 At the bus stop': '🧒 Vid hållplatsen',
  'Pick a valley': 'Välj en dal', 'Free play': 'Fritt spel', 'A random valley. Build whatever you like!': 'En slumpad dal. Bygg vad du vill!',
  'Island Hop': 'Öhoppet', 'Towns on little islands. Build bridges to join them up!': 'Städer på små öar. Bygg broar och koppla ihop dem!',
  'Mountain Railway': 'Bergsbanan', 'Big hills everywhere. Dig tunnels and make bricks!': 'Stora kullar överallt. Gräv tunnlar och gör tegel!',
  'Snowy Valley': 'Snödalen', 'It is always winter. Towns need lots of milk for hot cocoa!': 'Det är alltid vinter. Städerna behöver massor av mjölk till varm choklad!',
  'Busy Towns': 'Myllrande städer', 'Lots of towns and roads. Carry passengers by train and bus!': 'Massor av städer och vägar. Kör passagerare med tåg och buss!',
  'Goal:': 'Mål:', 'Best:': 'Bästa:', 'Cancel': 'Avbryt',
  'Easy': 'Lätt', 'Normal': 'Normal', 'Tycoon': 'Tågmagnat', 'Difficulty': 'Svårighet',
  'Lots of coins and nothing to pay for running trains. Just have fun!': 'Massor av mynt och inget att betala för att köra tåg. Bara ha kul!',
  'Things cost more, and trains and buses cost coins to run. Plan good routes!': 'Allt kostar mer, och tåg och bussar kostar mynt att köra. Planera bra linjer!',
  'For big kids and grown-ups: tight money and high running costs. Long, full trains pay best!': 'För stora barn och vuxna: ont om pengar och dyrt att köra. Långa, fulla tåg lönar sig bäst!',
  'costs {n}🪙 a minute to run': 'kostar {n}🪙 i minuten att köra', 'Running costs: {n}🪙 a minute': 'Driftkostnad: {n}🪙 i minuten',
  'Signal': 'Signal', 'Advanced': 'Avancerat', 'On': 'På', 'Off': 'Av', '🚦 Signals & crashes': '🚦 Signaler och krockar',
  'Trains can crash into each other! Build 🚦 signals so only one train uses a piece of track at a time.': 'Tåg kan krocka med varandra! Bygg 🚦 signaler så att bara ett tåg i taget kör på en bit spår.',
  '💥 Crash! {a} and {b} bumped into each other. Use 🚦 signals to keep trains apart!': '💥 Krock! {a} och {b} körde ihop. Använd 🚦 signaler för att hålla isär tågen!',
  'Put signals on the track! 🛤️': 'Sätt signaler på spåret! 🛤️', 'Signals need a straight piece of track. 🚦': 'Signaler behöver en rak bit spår. 🚦',
  "Signals can't go on a station. Put one just before it! 🚦": 'Signaler kan inte stå på en station. Sätt en precis före! 🚦',
  "Signals can't go on a road crossing! 🚗": 'Signaler kan inte stå på en vägkorsning! 🚗', 'Signals need to be outside the tunnel! ⛰️': 'Signaler måste stå utanför tunneln! ⛰️',
  'Signals need straight track. Take the signal away first! 🚦': 'Signaler behöver rakt spår. Ta bort signalen först! 🚦',
  'Another train is in the way at that station! Wait until it leaves. 🚂': 'Ett annat tåg står i vägen vid stationen! Vänta tills det åker. 🚂',
  'Click a straight piece of track for a 🚦 signal. Trains wait at a red signal until the track ahead is clear. Click it again to take it away.': 'Klicka på en rak bit spår för en 🚦 signal. Tåg väntar vid rött tills spåret framför är fritt. Klicka igen för att ta bort den.',
  '🚦 Some trains are stuck waiting. Try a passing loop, or click the train and press ✨ Rescue.': '🚦 Några tåg har fastnat. Prova ett mötesspår, eller klicka på tåget och tryck ✨ Rädda.',
  '🚦 Waiting at a signal': '🚦 Väntar vid en signal', '✨ Rescue': '✨ Rädda',
  'Small': 'Liten', 'Medium': 'Mellan', 'Big': 'Stor', 'Huge': 'Jättestor', 'Map size': 'Kartans storlek',
  '⭐⭐⭐ if done by {t}': '⭐⭐⭐ om du klarar det före {t}', 'Done in {t}!': 'Klart på {t}!',
  'Valley complete! 🏆': 'Dalen är klar! 🏆', 'You did it in {t}!': 'Du klarade det på {t}!',
  'Keep playing': 'Fortsätt spela', 'Pick another valley': 'Välj en annan dal',
  'Zoom in': 'Zooma in', 'Zoom out': 'Zooma ut', 'Show the whole map': 'Visa hela kartan',
  'Scroll or pinch to zoom. Drag the map with 👆 Look, or with two fingers.': 'Scrolla eller nyp för att zooma. Dra kartan med 👆 Titta, eller med två fingrar.',
  'The minimap in the corner shows the whole valley. Click it to jump there!': 'Minikartan i hörnet visar hela dalen. Klicka på den för att hoppa dit!',
};
const NAMES_SV = {
  'Maple Town': 'Lönnstad', 'Puddleby': 'Pölby', 'Honeyhill': 'Honungsbacka', 'Pebble Cove': 'Stenviken', 'Sunnyvale': 'Soldalen',
  'Bramble End': 'Björnbärsände', 'Little Wick': 'Lillvik', 'Cloverdale': 'Klöverdal', 'Button Bay': 'Knappviken', 'Muffin Hill': 'Muffinsbacken',
  'Duckford': 'Ankvad', 'Teacup Green': 'Tekoppsängen', 'Meadow': 'Ängen',
  'Rosy Orchard': 'Rosenodlingen', 'Appleby Orchard': 'Äppelby odling', 'Crunchy Orchard': 'Knaperodlingen',
  'Sunny Farm': 'Solgården', 'Clover Farm': 'Klövergården', 'Haystack Farm': 'Höstacksgården',
  'Pinewood Camp': 'Tallskogslägret', 'Oak Hollow Camp': 'Ekdalslägret', 'Timber Top Camp': 'Timmertoppslägret',
  'Sprinkles Bakery': 'Strösselbageriet', 'Crumb Corner Bakery': 'Smulhörnans bageri',
  'Tinker Toy Workshop': 'Pysslets leksaksverkstad', 'Wobble Toy Workshop': 'Vickans leksaksverkstad',
  'Seagull Harbour': 'Måsviks hamn', 'Bobbing Boat Harbour': 'Guppbåtshamnen',
  'Crispy Fish Factory': 'Krispiga fiskfabriken', 'Goldfin Fish Factory': 'Guldfenans fiskfabrik',
  'Rumble Rock Quarry': 'Mullerstensbrottet', 'Pebblestone Quarry': 'Kiselstensbrottet',
  'Red Brick Works': 'Rödtegelbruket', 'Busy Bee Brickworks': 'Flitiga biets tegelbruk',
  'Puffer': 'Puffaren', 'Dasher': 'Susaren', 'Comet': 'Kometen',
  'Puffy': 'Puffis', 'Zippy': 'Zippan', 'Biscuit': 'Kexet', 'Bramble': 'Björnbär', 'Sunny': 'Solis', 'Clover': 'Klöver',
  'Pepper': 'Pepparn', 'Jellybean': 'Gelébönan', 'Tumble': 'Tumla', 'Button': 'Knappen', 'Noodle': 'Nudeln', 'Waffles': 'Våffla',
  'Pickle': 'Gurkan', 'Marble': 'Kulan', 'Toffee': 'Kola', 'Dot': 'Pricken',
};
const SIDES_SV = { North: 'Norr', East: 'Öst', South: 'Syd', West: 'Väst' };
function t(en, vars) {
  let s = (lang === 'sv' && SV[en]) || en;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
  return s;
}
function tn(name) {
  if (lang !== 'sv' || !name) return name;
  if (NAMES_SV[name]) return NAMES_SV[name];
  const m = /^(.*) (North|East|South|West)( \d+)?$/.exec(name);
  if (m) return `${tn(m[1])} ${SIDES_SV[m[2]]}${m[3] || ''}`;
  const num = /^(.*) (\d+)$/.exec(name); // a second "Sunny Farm 2" on a big map
  return num ? `${tn(num[1])} ${num[2]}` : name;
}
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const NAME_MAX = 18;
const cname = type => t(CARGO[type].name);

// ---------- helpers ----------
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const idx = (x, y) => y * W + x;
const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const tx = i => i % W, ty = i => (i / W) | 0;
function nb(i, d) { const x = tx(i) + DX[d], y = ty(i) + DY[d]; return inB(x, y) ? idx(x, y) : -1; }
function bits(c) { const r = []; for (let d = 0; d < 4; d++) if (c & (1 << d)) r.push(d); return r; }
function hash(x, y, k) { const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); }
function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function shuffle(a, R) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16), f = c => clamp(Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt)), 0, 255);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }

// ---------- state ----------
const cv = $('cv'), ctx = cv.getContext('2d');
const cache = document.createElement('canvas');
let dpr = 1, dirty = true;
const view = { s: 30, ox: 0, oy: 0 };
let G = null;
let tool = 'look', hover = null, hoverW = null, down = false, lastTile = null, sel = null, busDraft = -1, paintOpen = false, renaming = false;
let routeDraft = [], draftEngine = 'puffer', speed = 1, muted = false, armed = null;
const smoke = [], floaters = [], confetti = [], weather = [];
let emo = [], cars = [], trainPts = [], animDeco = [], lights = [];
let draft = null, draftDeco = 'flowers', act = null, curSeason = -1;
const undoStack = [];

const stById = id => G.stations.find(s => s.id === id);
const trById = id => G.trains.find(t => t.id === id);
const seasonIx = () => scn().season ?? Math.floor(G.time / SEASON_LEN) % 4;
const season = () => SEASONS[seasonIx()];
// 0 by day, 1 at midnight. A day starts in the morning; dusk and dawn fade smoothly.
function darkness() {
  const p = (G.time % DAY_LEN) / DAY_LEN, ss = v => v * v * (3 - 2 * v);
  return p < 0.6 ? 0 : p < 0.7 ? ss((p - 0.6) / 0.1) : p < 0.9 ? 1 : ss(1 - (p - 0.9) / 0.1);
}
const dayIcon = () => { const p = (G.time % DAY_LEN) / DAY_LEN; return p < 0.6 ? '☀️' : p < 0.7 ? '🌇' : p < 0.9 ? '🌙' : '🌅'; };
const inTunnel = p => { const x = Math.floor(p.x), y = Math.floor(p.y); return inB(x, y) && G.terr[idx(x, y)] === HILL; };

function newGame(seed, scnId = 'free', size = 'big', diff = 'easy', adv = false) {
  if (!SIZES[size]) size = 'big';
  if (!DIFFS[diff]) diff = 'easy';
  const S = sized(SCENARIOS[scnId] || SCENARIOS.free, size);
  W = S.w; H = S.h;
  G = {
    v: 1, seed, W, H, scn: { id: SCENARIOS[scnId] ? scnId : 'free', size, done: false }, diff, adv: !!adv, coins: Math.round((S.coins || 250) * DIFFS[diff].start / 10) * 10, runT: 0, stars: 0, time: 0, prodT: 0, nextId: 1, nameIx: 0, rr: 0, piggyAt: -999,
    terr: new Uint8Array(W * H), conn: new Uint8Array(W * H), road: new Uint8Array(W * H), deco: new Uint8Array(W * H), sig: new Uint8Array(W * H),
    occ: new Int16Array(W * H).fill(-1), stn: new Int32Array(W * H).fill(-1),
    places: [], stations: [], trains: [], roads: [], buses: [], busN: 0, stats: { delivered: {}, earned: 0 }, quests: [],
  };
  genMap(seed, S);
  initCars(); undoStack.length = 0; curSeason = -1; draft = null; view.init = false; sigDirty = true; wrecks = [];
  G.quests = [
    { kind: 'stations', n: 2, reward: Math.round(30 * D().reward) },
    { kind: 'trains', n: 1, reward: Math.round(30 * D().reward) },
    { kind: 'deliver', type: 'people', n: 10, base: 0, reward: Math.round(40 * D().reward) },
  ];
  sel = null; routeDraft = []; dirty = true;
}

// ---------- map generation ----------
function genMap(seed, S = SCENARIOS.free) {
  const R = mulberry(seed), ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const set = (x, y, v) => { if (inB(x, y)) G.terr[idx(x, y)] = v; };
  const area = W * H / 960; // compared with the original 40×24 valley
  if (S.islands) {
    // sea everywhere, then blobs of land spread apart
    G.terr.fill(WATER);
    const isl = [];
    for (let tries = 0; isl.length < S.islands && tries < 2000; tries++) {
      const cx = ri(4, W - 5), cy = ri(4, H - 5), r = 3.2 + R() * 2.6;
      if (isl.some(o => Math.hypot(o[0] - cx, o[1] - cy) < o[2] + r + 1.5 - Math.floor(tries / 500))) continue;
      isl.push([cx, cy, r]);
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++)
        if (inB(x, y) && Math.hypot((x - cx) / 1.2, y - cy) < r + (hash(x, y, seed % 97) - 0.5) * 1.2) set(x, y, GRASS);
    }
  } else {
    // wiggly rivers from top to bottom, each in its own band
    const rivers = S.rivers || 1, band = (W - 12) / rivers;
    for (let k = 0; k < rivers; k++) {
      let rx = ri(Math.round(6 + band * k + band * 0.25), Math.round(6 + band * k + band * 0.75));
      for (let y = 0; y < H; y++) {
        set(rx, y, WATER);
        if (R() < 0.35) set(rx + 1, y, WATER);
        const m = R(), nx = clamp(rx + (m < 0.3 ? -1 : m > 0.7 ? 1 : 0), 6, W - 7);
        set(nx, y, WATER); rx = nx;
      }
    }
    // ponds
    for (let k = 0; k < (S.ponds || 1); k++) {
      const px = ri(4, W - 5), py = ri(4, H - 5), pr = 1.4 + R() * 1.4;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
        if (((x - px) / (pr * 1.4)) ** 2 + ((y - py) / pr) ** 2 <= 1) set(x, y, WATER);
    }
  }
  // hills (trains tunnel through them)
  for (let k = 0; k < (S.hills ?? 3); k++) {
    const cx = ri(3, W - 4), cy = ri(3, H - 4), r = (1.4 + R() * 1.2) * (S.hillR || 1);
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      if (inB(x, y) && Math.hypot((x - cx) / 1.25, y - cy) < r + (R() - 0.5) * 0.7 && G.terr[idx(x, y)] === GRASS) set(x, y, HILL);
    }
  }
  // forests
  for (let k = 0; k < Math.round(8 * area); k++) {
    const cx = ri(0, W - 1), cy = ri(0, H - 1), r = 2 + R() * 2.5;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (!inB(x, y)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < r && R() < 0.85 - d / r * 0.5 && G.terr[idx(x, y)] === GRASS) set(x, y, TREE);
    }
  }
  for (let i = 0; i < W * H; i++) if (G.terr[i] === GRASS && R() < 0.03) G.terr[i] = TREE;

  // towns and industries
  const towns = shuffle(TOWN_NAMES.slice(), R);
  const names = {};
  for (const k in KINDS) if (KINDS[k].names) names[k] = shuffle(KINDS[k].names.slice(), R);
  const rep = (list, n) => Array.from({ length: n }, () => list).flat();
  const order = [
    ...rep(['town'], S.towns || 4), ...rep(['harbour', 'quarry'], S.ind || 1),
    ...rep(['lumber', 'toyshop', 'farm', 'bakery', 'orchard', 'fishfac', 'bricks'], S.ind || 1),
    ...(S.extra || []), ['orchard', 'farm', 'lumber'][ri(0, 2)],
  ];
  const near = (area, r, terr) => area.some(i => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = tx(i) + dx, y = ty(i) + dy; if (inB(x, y) && G.terr[idx(x, y)] === terr) return true; } return false; });
  for (const kind of order) {
    for (let tries = 0; tries < 800; tries++) {
      const minD = (kind === 'town' ? 10 : 7) - Math.floor(tries / 200) * 1.5;
      const x = ri(2, W - 4), y = ri(2, H - 4);
      const isTown = kind === 'town';
      const cx = isTown ? x + 0.5 : x + 1, cy = isTown ? y + 0.5 : y + 1;
      const area = [];
      if (isTown) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) area.push(idx(x + dx, y + dy)); }
      else area.push(idx(x, y), idx(x + 1, y), idx(x, y + 1), idx(x + 1, y + 1));
      if (area.some(i => G.terr[i] === WATER || G.terr[i] === HILL || G.occ[i] >= 0)) continue;
      if (G.places.some(p => Math.hypot(p.cx - cx, p.cy - cy) < minD)) continue;
      // harbours sit on the water's edge; quarries dig into a hill (relaxed if the map has no good spot)
      if (kind === 'harbour' && tries < 700 && !near(area, 1, WATER)) continue;
      if (kind === 'quarry' && tries < 500 && !near(area, 2, HILL)) continue;
      const p = { id: G.places.length, kind, x, y, cx, cy, tiles: [], stock: {}, growth: 0 };
      if (isTown) {
        const tn0 = G.places.filter(q => q.kind === 'town').length;
        p.name = towns[tn0 % towns.length] + (tn0 >= towns.length ? ` ${Math.floor(tn0 / towns.length) + 1}` : '');
        const cand = [];
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (inB(xx, yy) && G.terr[idx(xx, yy)] !== WATER && G.terr[idx(xx, yy)] !== HILL && G.occ[idx(xx, yy)] < 0) cand.push([Math.max(Math.abs(dx), Math.abs(dy)) + R() * 1.2, idx(xx, yy)]);
        }
        cand.sort((a, b) => a[0] - b[0]);
        p.tiles = cand.slice(0, ri(5, 7)).map(c => c[1]);
      } else {
        const list = names[kind];
        const n = G.places.filter(q => q.kind === kind).length;
        p.name = list[n % list.length] + (n >= list.length ? ` ${Math.floor(n / list.length) + 1}` : '');
        p.tiles = area;
      }
      for (const i of p.tiles) { G.occ[i] = p.id; G.terr[i] = GRASS; }
      G.places.push(p);
      break;
    }
  }
  genRoads();
}

// Roads join the towns (a spanning tree, nearest first). Cars drive on them; rails may cross them at level crossings.
function genRoads() {
  const towns = G.places.filter(p => p.kind === 'town');
  if (towns.length < 2) return;
  const done = [towns[0]], rest = towns.slice(1);
  while (rest.length) {
    let best = null, bd = 1e9;
    for (const a of done) for (const b of rest) { const d = Math.hypot(a.cx - b.cx, a.cy - b.cy); if (d < bd) { bd = d; best = [a, b]; } }
    done.push(best[1]); rest.splice(rest.indexOf(best[1]), 1);
    const path = roadPath(best[0], best[1]);
    if (!path) continue;
    for (let k = 0; k < path.length; k++) {
      const i = path[k];
      if (G.terr[i] === TREE) G.terr[i] = GRASS;
      if (k) { const d = dirTo(path[k - 1], i); G.road[path[k - 1]] |= 1 << d; G.road[i] |= 1 << OPP(d); }
    }
    G.roads.push(path);
  }
}
function dirTo(a, b) { for (let d = 0; d < 4; d++) if (nb(a, d) === b) return d; return -1; }
// Dijkstra over (tile, heading) so roads prefer long straight runs.
function roadPath(a, b) {
  const ok = i => i >= 0 && G.occ[i] < 0 && G.terr[i] !== HILL;
  const ends = p => { const s = new Set(); for (const i of p.tiles) for (let d = 0; d < 4; d++) { const n = nb(i, d); if (ok(n) && G.terr[n] !== WATER) s.add(n); } return s; };
  const S = ends(a), T = ends(b);
  const dist = new Float32Array(W * H * 4).fill(Infinity), prev = new Int32Array(W * H * 4).fill(-1), heap = [];
  for (const i of S) for (let d = 0; d < 4; d++) { dist[i * 4 + d] = 0; heapPush(heap, [0, i * 4 + d]); }
  let found = -1;
  while (heap.length) {
    const [c, k] = heapPop(heap);
    if (c > dist[k]) continue;
    const i = k >> 2, h = k & 3;
    if (T.has(i)) { found = k; break; }
    for (let d = 0; d < 4; d++) {
      const n = nb(i, d); if (!ok(n)) continue;
      const step = (G.road[n] ? 0.4 : G.terr[n] === WATER ? 4 : G.terr[n] === TREE ? 1.4 : 1) + (d !== h ? 0.7 : 0);
      const kk = n * 4 + d;
      if (c + step < dist[kk]) { dist[kk] = c + step; prev[kk] = k; heapPush(heap, [c + step, kk]); }
    }
  }
  if (found < 0) return null;
  const path = [];
  for (let k = found; k >= 0; k = prev[k]) path.push(k >> 2);
  return path.reverse();
}
function heapPush(h, v) { h.push(v); let i = h.length - 1; while (i) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } }
function heapPop(h) {
  const top = h[0], last = h.pop();
  if (h.length) {
    h[0] = last;
    for (let i = 0; ;) {
      const l = 2 * i + 1, r = l + 1; let m = i;
      if (l < h.length && h[l][0] < h[m][0]) m = l;
      if (r < h.length && h[r][0] < h[m][0]) m = r;
      if (m === i) break;
      [h[m], h[i]] = [h[i], h[m]]; i = m;
    }
  }
  return top;
}

// ---------- building ----------
// Checks one rail link without building it. pend holds extra bits from a track draft still being dragged.
// Returns { cost } (0 when already built) or { err } (empty err = silently out of bounds).
function linkCost(a, d, pend) {
  const b = nb(a, d);
  if (b < 0) return { err: '' };
  if (G.conn[a] & (1 << d)) return { cost: 0 };
  if (G.occ[a] >= 0 || G.occ[b] >= 0) return { err: "Trains can't go through buildings!" };
  if (G.stn[a] >= 0 || G.stn[b] >= 0) return { err: 'Track can only go straight through a station.' };
  if (G.deco[a] || G.deco[b]) return { err: 'Something pretty is in the way! Tidy it with 🧹 first.' };
  for (const [i, e] of [[a, d], [b, OPP(d)]]) {
    const r = G.road[i]; if (!r) continue;
    const m = G.conn[i] | (pend ? pend.get(i) || 0 : 0) | (1 << e);
    if (G.terr[i] === WATER || (r !== 5 && r !== 10) || (m & r)) return { err: 'Rails can only cross a straight road, straight across! 🚗' };
  }
  for (const [i, e] of [[a, d], [b, OPP(d)]]) {
    if (G.sig[i] && ((G.conn[i] | (pend ? pend.get(i) || 0 : 0) | (1 << e)) & 15) !== 5 && ((G.conn[i] | (pend ? pend.get(i) || 0 : 0) | (1 << e)) & 15) !== 10) return { err: 'Signals need straight track. Take the signal away first! 🚦' };
  }
  const ta = G.terr[a], tb = G.terr[b];
  return { cost: price(ta === WATER || tb === WATER ? COST.bridge : ta === HILL || tb === HILL ? COST.tunnel : COST.track) };
}
function connect(a, d) {
  const r = linkCost(a, d, null);
  if (r.err !== undefined) return r.err ? fail(r.err) : false;
  if (!r.cost) return true;
  if (G.coins < r.cost) return fail('Not enough coins 🪙');
  const b = nb(a, d);
  G.coins -= r.cost;
  G.conn[a] |= 1 << d; G.conn[b] |= 1 << OPP(d);
  for (const i of [a, b]) if (G.terr[i] === TREE) { G.terr[i] = GRASS; puff(tx(i) + 0.5, ty(i) + 0.5, 3, '#7cc46a'); }
  touch(); dirty = true; sfx('build');
  retryLost();
  return true;
}
function fail(msg) { sfx('err'); toast(t(msg)); return false; }

// ---------- track draft: drag shows ghost rails and their cost, letting go builds them ----------
function stepToward(a, b) { const dx = tx(b) - tx(a), dy = ty(b) - ty(a); return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0); }
function draftStart(i) { draft = { tiles: [i], dirs: [], costs: [], pend: new Map(), err: null, block: -1 }; }
function addPend(a, d) {
  const b = nb(a, d);
  draft.pend.set(a, (draft.pend.get(a) || 0) | 1 << d);
  draft.pend.set(b, (draft.pend.get(b) || 0) | 1 << OPP(d));
}
function draftTo(goal) {
  let a = draft.tiles[draft.tiles.length - 1];
  draft.block = -1;
  for (let guard = 0; a !== goal && guard < 200; guard++) {
    const d = stepToward(a, goal), b = nb(a, d), n = draft.tiles.length;
    if (n > 1 && b === draft.tiles[n - 2]) {
      // dragging back along the draft rubs it out
      draft.tiles.pop(); draft.dirs.pop(); draft.costs.pop();
      draft.pend = new Map(); draft.dirs.forEach((e, k) => addPend(draft.tiles[k], e));
      a = b; continue;
    }
    const r = linkCost(a, d, draft.pend);
    if (r.err !== undefined) {
      if (r.err && r.err !== draft.err) { draft.err = r.err; fail(r.err); }
      draft.block = b; break;
    }
    const dup = (draft.pend.get(a) || 0) & (1 << d);
    draft.err = null;
    draft.tiles.push(b); draft.dirs.push(d); draft.costs.push(dup ? 0 : r.cost); addPend(a, d);
    a = b;
  }
}
const draftCost = () => draft ? draft.costs.reduce((s, c) => s + c, 0) : 0;
function draftCommit() {
  const dr = draft; draft = null;
  if (!dr) return;
  for (let k = 0; k < dr.dirs.length; k++) if (!connect(dr.tiles[k], dr.dirs[k])) break;
}

// ---------- undo: each pointer stroke is one action ----------
function touch() { if (act) act.changed = true; }
function beginAct() {
  act = {
    changed: false, coins: G.coins, terr: G.terr.slice(), conn: G.conn.slice(), deco: G.deco.slice(), sig: G.sig.slice(),
    stations: G.stations.map(({ id, x, y, name, cargo }) => ({ id, x, y, name, cargo: { ...cargo } })),
    routes: G.trains.map(tr => [tr.id, tr.route.slice()]), trains: G.trains.slice(),
  };
}
function endAct() {
  const a = act; act = null;
  if (!a || !a.changed) return;
  a.spent = a.coins - G.coins;
  a.lost = a.trains.filter(tr => !G.trains.includes(tr));
  delete a.trains;
  undoStack.push(a);
  if (undoStack.length > UNDO_MAX) undoStack.shift();
}
const linked = (a, b) => { const d = dirTo(a, b); return d >= 0 && (G.conn[a] & (1 << d)) !== 0; };
function undo() {
  if (draft) { draft = null; return; }
  if (act) return; // mid-stroke
  const a = undoStack[undoStack.length - 1];
  if (!a) { toast(t('Nothing to undo.')); return; }
  if (G.coins + a.spent < 0) { fail('Not enough coins to undo that.'); return; }
  undoStack.pop();
  G.coins += a.spent;
  G.terr = a.terr; G.conn = a.conn; G.deco = a.deco; G.sig = a.sig;
  // houses that grew since the action stay put
  for (const p of G.places) for (const i of p.tiles) {
    for (const d of bits(G.conn[i])) { const n = nb(i, d); if (n >= 0) G.conn[n] &= ~(1 << OPP(d)); }
    G.conn[i] = 0; G.deco[i] = 0; G.terr[i] = GRASS;
  }
  G.stations = a.stations.filter(s => G.occ[idx(s.x, s.y)] < 0 && G.conn[idx(s.x, s.y)])
    .map(s => ({ ...s, cargo: (stById(s.id) || s).cargo, places: [] }));
  G.stn.fill(-1);
  for (const s of G.stations) G.stn[idx(s.x, s.y)] = s.id;
  refreshCatch();
  for (const tr of a.lost) if (!tr.crashed) G.trains.push(tr);
  for (const [id, route] of a.routes) { const tr = trById(id); if (tr) tr.route = route; }
  for (const tr of G.trains.slice()) {
    tr.route = tr.route.filter(id => stById(id));
    if (tr.route.length < 2) { sellTrain(tr); continue; }
    if (!stById(tr.target)) tr.target = tr.route[0];
    const broken = tr.state === 'run' ? tr.leg.tiles.some((i, k) => k && !linked(tr.leg.tiles[k - 1], i)) : !G.conn[tr.atTile];
    if (broken || a.lost.includes(tr)) resetTrain(tr);
  }
  if (sel && sel.type === 'station' && !stById(sel.id)) sel = null;
  routeDraft = routeDraft.filter(id => stById(id));
  dirty = true; retryLost(); sfx('undo'); toast(t('↩️ Undone!'));
  updateUI(true);
}

// ---------- decorations ----------
function decoOk(i) { return G.terr[i] === GRASS && G.occ[i] < 0 && !G.conn[i] && G.stn[i] < 0 && !G.road[i] && !G.deco[i]; }
function placeDeco(i, id, quiet) {
  const d = DECOS[DECO[id] - 1];
  if (!decoOk(i)) return quiet ? false : fail('Decorations go on empty grass. 🌱');
  if (id === 'snowman' && seasonIx() !== 3) return quiet ? false : fail('Snowmen can only be built in winter! ❄️');
  if (G.coins < d.cost) return fail('Not enough coins 🪙');
  G.coins -= d.cost;
  if (id === 'tree') G.terr[i] = TREE; else G.deco[i] = DECO[id];
  touch(); dirty = true; sfx('pop');
  puff(tx(i) + 0.5, ty(i) + 0.5, 5, id === 'snowman' ? '#ffffff' : '#ffe9a8');
  return true;
}
function meltSnowmen() {
  for (let i = 0; i < W * H; i++) if (G.deco[i] === DECO.snowman) {
    G.deco[i] = 0; dirty = true;
    puff(tx(i) + 0.5, ty(i) + 0.5, 8, '#bfe2f4'); floater(tx(i) + 0.5, ty(i), '💧', '#ffffff');
  }
}

function layTrack(from, to) {
  let a = from;
  while (a !== to) {
    const dx = tx(to) - tx(a), dy = ty(to) - ty(a);
    const d = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    if (!connect(a, d)) break;
    a = nb(a, d);
  }
  return a;
}

function buildStation(i) {
  if (G.stn[i] >= 0) return;
  const c = G.conn[i];
  if (c !== 5 && c !== 10) return fail('Put stations on a straight piece of track! 🛤️');
  if (G.terr[i] === WATER) return fail("Stations can't float! Pick a spot on land.");
  if (G.terr[i] === HILL) return fail('Stations need flat ground, not a hill! ⛰️');
  if (G.road[i]) return fail("Stations can't go on a road! 🚗");
  if (G.coins < price(COST.station)) return fail('Not enough coins 🪙');
  const x = tx(i), y = ty(i);
  let best = null, bd = 1e9;
  for (const p of G.places) { const d = Math.hypot(p.cx - x - 0.5, p.cy - y - 0.5); if (d < bd) { bd = d; best = p; } }
  let name = best && bd < 9 ? best.name : 'Meadow';
  if (G.stations.some(s => s.name === name)) {
    const dx = x + 0.5 - (best ? best.cx : 0), dy = y + 0.5 - (best ? best.cy : 0);
    const side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'East' : 'West') : (dy > 0 ? 'South' : 'North');
    let n = `${name} ${side}`, k = 2;
    while (G.stations.some(s => s.name === n)) n = `${name} ${side} ${k++}`;
    name = n;
  }
  G.coins -= price(COST.station);
  const st = { id: G.nextId++, x, y, name, cargo: {}, places: [] };
  G.stations.push(st); G.stn[i] = st.id;
  refreshCatch(); touch(); dirty = true; sfx('pop'); puff(x + 0.5, y + 0.5, 6, '#ffffff');
  if (!st.places.length) toast(t('Nothing is near this station. Try inside the yellow square!'));
}

function removeTile(i) {
  let did = false;
  if (G.sig[i]) { G.sig[i] = 0; G.coins += Math.floor(price(COST.signal) / 2); did = true; }
  else if (G.stn[i] >= 0) { removeStation(G.stn[i]); did = true; }
  else if (G.conn[i]) {
    for (const d of bits(G.conn[i])) {
      const n = nb(i, d);
      G.conn[i] &= ~(1 << d); if (n >= 0) G.conn[n] &= ~(1 << OPP(d));
      G.coins += 1;
    }
    did = true;
  } else if (G.deco[i]) { G.coins += Math.floor(DECOS[G.deco[i] - 1].cost / 2); G.deco[i] = 0; did = true; }
  else if (G.terr[i] === TREE) { G.terr[i] = GRASS; did = true; }
  if (!did) return;
  touch(); dirty = true; sfx('build'); puff(tx(i) + 0.5, ty(i) + 0.5, 6, '#d9c7a8');
  for (const tr of G.trains.slice()) {
    if ((tr.state === 'run' && tr.leg.tiles.includes(i)) || (tr.state !== 'run' && !G.conn[tr.atTile])) resetTrain(tr);
  }
}

function removeStation(id) {
  const st = stById(id); if (!st) return;
  G.stn[idx(st.x, st.y)] = -1;
  G.stations = G.stations.filter(s => s !== st);
  G.coins += Math.floor(price(COST.station) / 2);
  for (const tr of G.trains.slice()) {
    if (!tr.route.includes(id)) continue;
    tr.route = tr.route.filter(r => r !== id);
    if (tr.route.length < 2) { sellTrain(tr); toast(t('{name} went back to the depot.', { name: tn(tr.name) })); }
  }
  if (sel && sel.type === 'station' && sel.id === id) sel = null;
  routeDraft = routeDraft.filter(r => r !== id);
}

function refreshCatch() {
  for (const s of G.stations) {
    s.places = G.places.filter(p => p.tiles.some(i => Math.abs(tx(i) - s.x) <= CATCH && Math.abs(ty(i) - s.y) <= CATCH)).map(p => p.id);
  }
}
function accepts(st) { const r = new Set(); for (const id of st.places) for (const t of KINDS[G.places[id].kind].accepts) r.add(t); return r; }
function supplies(st) {
  const r = new Set();
  for (const id of st.places) { const k = KINDS[G.places[id].kind]; k.produces.forEach(t => r.add(t)); if (k.makes) r.add(k.makes); }
  return r;
}

// ---------- trains ----------
const trainLen = tr => ENG_LEN + tr.wagons * GAP;
const capacity = tr => tr.wagons * WAGON_CAP;
const loaded = tr => tr.load.reduce((a, l) => a + l.n, 0);

function buyTrain(route, engId) {
  const eng = ENG[engId];
  if (route.length < 2) return fail('A train needs at least two stations!');
  if (G.stars < eng.stars) { sfx('err'); toast(t('You need {n} ⭐ for the {name}.', { n: eng.stars, name: tn(eng.name) })); return false; }
  if (G.coins < price(eng.cost)) return fail('Not enough coins 🪙');
  const st = stById(route[0]);
  if (!st) return false;
  if (G.adv && G.trains.some(o => bodyPts(o).some(q => Math.hypot(q.x - st.x - 0.5, q.y - st.y - 0.5) < 1.2)))
    return fail('Another train is in the way at that station! Wait until it leaves. 🚂');
  G.coins -= price(eng.cost);
  undoStack.length = 0; // undo only reaches back to the last train bought
  const tr = {
    id: G.nextId++, name: TRAIN_NAMES[G.nameIx % TRAIN_NAMES.length], color: COLORS[G.nameIx % COLORS.length],
    eng: engId, wagons: eng.wagons, route: route.slice(), target: route[0], load: [], earned: 0,
    state: 'stop', timer: 0.8, trail: null, d: 0, leg: null, atTile: 0, inE: -1, smokeT: 0,
  };
  G.nameIx++;
  placeAt(tr, idx(st.x, st.y));
  G.trains.push(tr);
  sel = { type: 'train', id: tr.id };
  sfx('toot'); puff(st.x + 0.5, st.y + 0.5, 10, '#ffffff');
  toast(t('Hooray! {name} is ready to go! 🚂', { name: tn(tr.name) }));
  return true;
}

function sellTrain(tr) {
  const eng = ENG[tr.eng];
  G.coins += Math.floor(price(eng.cost) / 2) + Math.max(0, tr.wagons - eng.wagons) * Math.floor(price(COST.wagon) / 2);
  const p = posAt(tr.trail, tr.d); puff(p.x, p.y, 10, '#ffffff');
  G.trains = G.trains.filter(t => t !== tr);
  if (sel && sel.type === 'train' && sel.id === tr.id) sel = null;
}

// Parks the train on tile i with its wagons stretched back along the track.
function placeAt(tr, i) {
  const x = tx(i) + 0.5, y = ty(i) + 0.5, b = bits(G.conn[i]);
  tr.atTile = i; tr.leg = null;
  if (!b.length) { tr.inE = -1; tr.trail = mkTrail([[x, y]]); tr.d = 0; return; }
  const e = b[0], L = trainLen(tr);
  tr.inE = e; tr.trail = mkTrail([[x + DX[e] * L, y + DY[e] * L], [x, y]]); tr.d = L;
}

function resetTrain(tr) {
  const st = stById(tr.target) || stById(tr.route[0]);
  if (!st) { sellTrain(tr); return; }
  const p = posAt(tr.trail, tr.d); puff(p.x, p.y, 8, '#ffffff');
  tr.target = st.id; placeAt(tr, idx(st.x, st.y));
  tr.state = 'stop'; tr.timer = 1;
  puff(st.x + 0.5, st.y + 0.5, 8, '#ffffff');
}

function retryLost() { for (const tr of G.trains) if (tr.state === 'lost') tr.timer = Math.min(tr.timer, 0.2); }

function mkTrail(pts) {
  const t = []; let s = 0;
  for (let k = 0; k < pts.length; k++) {
    if (k) s += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    t.push({ x: pts[k][0], y: pts[k][1], s });
  }
  return t;
}
const trailEnd = tr => tr.trail[tr.trail.length - 1].s;
function posAt(trail, s) {
  if (s <= trail[0].s) return trail[0];
  const last = trail[trail.length - 1];
  if (s >= last.s) return last;
  let lo = 0, hi = trail.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (trail[m].s <= s) lo = m; else hi = m; }
  const a = trail[lo], b = trail[hi], f = (s - a.s) / (b.s - a.s || 1);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}
function angAt(trail, s) { const a = posAt(trail, s - 0.15), b = posAt(trail, s + 0.15); return Math.atan2(b.y - a.y, b.x - a.x); }

const edgeMid = (t, e) => [tx(t) + 0.5 + DX[e] * 0.5, ty(t) + 0.5 + DY[e] * 0.5];
const center = t => [tx(t) + 0.5, ty(t) + 0.5];
function cornerOf(x, y, e, f) { return [x + 0.5 + (DX[e] + DX[f]) * 0.5, y + 0.5 + (DY[e] + DY[f]) * 0.5]; }
function arcAng(x, y, e, f) {
  const [ox, oy] = cornerOf(x, y, e, f);
  const a0 = Math.atan2(y + 0.5 + DY[e] * 0.5 - oy, x + 0.5 + DX[e] * 0.5 - ox);
  let da = Math.atan2(y + 0.5 + DY[f] * 0.5 - oy, x + 0.5 + DX[f] * 0.5 - ox) - a0;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  return [a0, da];
}

// Breadth-first search over (tile, entry edge). Trains may only turn back at dead ends.
function findPath(s, g, inE, pen, noBack) {
  if (pen) return findPathPen(s, g, inE, pen, noBack);
  if (s === g) return null;
  const prev = new Int32Array(W * H * 4).fill(-2), how = new Int8Array(W * H * 4), q = [];
  const exits = bits(G.conn[s]);
  if (inE >= 0) exits.sort((a, b) => (b === OPP(inE)) - (a === OPP(inE)));
  for (const x of exits) {
    const n = nb(s, x); if (n < 0) continue;
    const k = n * 4 + OPP(x); if (prev[k] !== -2) continue;
    prev[k] = -1; how[k] = x; q.push(k);
  }
  let found = -1;
  for (let head = 0; head < q.length; head++) {
    const k = q[head], t = k >> 2, e = k & 3;
    if (t === g) { found = k; break; }
    let ex = bits(G.conn[t]).filter(d => d !== e);
    if (!ex.length) ex = [e];
    for (const x of ex) {
      const n = nb(t, x); if (n < 0 || !(G.conn[n] & (1 << OPP(x)))) continue;
      const kk = n * 4 + OPP(x); if (prev[kk] !== -2) continue;
      prev[kk] = k; how[kk] = x; q.push(kk);
    }
  }
  return found < 0 ? null : pathOf(s, g, found, prev, how);
}
// Shortest by cost: tiles marked in pen (taken by other trains) cost extra, so trains go round them if they can.
// noBack: the train is already rolling, so it may not turn back where it starts.
const PEN = 25;
function findPathPen(s, g, inE, pen, noBack) {
  if (s === g) return null;
  const N = W * H * 4, prev = new Int32Array(N).fill(-2), how = new Int8Array(N), dist = new Int32Array(N).fill(1 << 30), heap = [];
  const push = (c, k) => {
    heap.push([c, k]);
    for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  const step = (from, c, x, k0) => {
    const n = nb(from, x); if (n < 0 || !(G.conn[n] & (1 << OPP(x)))) return;
    const k = n * 4 + OPP(x), cc = c + 1 + (pen[n] ? PEN : 0);
    if (cc < dist[k]) { dist[k] = cc; prev[k] = k0; how[k] = x; push(cc, k); }
  };
  for (const x of bits(G.conn[s])) if (!(noBack && x === inE)) step(s, 0, x, -1);
  while (heap.length) {
    const [c, k] = pop(); if (c > dist[k]) continue;
    const t = k >> 2, e = k & 3;
    if (t === g) return pathOf(s, g, k, prev, how);
    let ex = bits(G.conn[t]).filter(d => d !== e);
    if (!ex.length) ex = [e];
    for (const x of ex) step(t, c, x, k);
  }
  return null;
}
function pathOf(s, g, found, prev, how) {
  const chain = [];
  for (let k = found; k !== -1; k = prev[k]) chain.push(k);
  chain.reverse();
  const x0 = how[chain[0]];
  const pts = [center(s), edgeMid(s, x0)];
  for (let i = 0; i < chain.length; i++) {
    const t = chain[i] >> 2, e = chain[i] & 3;
    if (i === chain.length - 1) { pts.push(center(t)); break; }
    turnPts(pts, t, e, how[chain[i + 1]]);
  }
  return { pts, x0, eg: chain[chain.length - 1] & 3, goal: g, tiles: [s, ...chain.map(k => k >> 2)] };
}
// Adds the points for crossing tile t, entering on edge e and leaving on edge x.
function turnPts(pts, t, e, x) {
  if (x === OPP(e)) pts.push(edgeMid(t, x));
  else if (x === e) pts.push(center(t), edgeMid(t, e));
  else {
    const [ox, oy] = cornerOf(tx(t), ty(t), e, x), [a0, da] = arcAng(tx(t), ty(t), e, x);
    for (let j = 1; j <= 6; j++) { const a = a0 + da * j / 6; pts.push([ox + Math.cos(a) * 0.5, oy + Math.sin(a) * 0.5]); }
  }
}

// ---------- advanced mode: signals and crashes ----------
// Path signals: as a train reaches a signal it books every tile of its way up to the next signal (or its
// station). If any of those tiles is taken it waits there, and now and then looks for another way round,
// such as the free side of a passing loop. Track without signals is unprotected: trains there can crash.
const ADV_KEY = 'puffwhistle-adv';
const GHOST_T = 8; // seconds a loaded or rescued train passes through others, so it can get clear
const CRASH_R = 0.4, SIG_LOOK = 1.6, REROUTE_EVERY = 1;
let sigList = [], sigDirty = true, taken = new Int32Array(0), wrecks = [];
const tileOfPt = q => idx(clamp(Math.floor(q.x), 0, W - 1), clamp(Math.floor(q.y), 0, H - 1));
function bodyPts(tr) {
  const out = [], L = trainLen(tr);
  for (let s = tr.d; s >= tr.d - L - 0.01; s -= 0.25) out.push(posAt(tr.trail, s));
  return out;
}
// Who holds each tile: the train standing on it, or the train that booked it (train id; 0 = free).
function updTaken() {
  if (sigDirty) { sigList = []; for (let i = 0; i < W * H; i++) if (G.sig[i]) sigList.push(i); sigDirty = false; }
  if (taken.length !== W * H) taken = new Int32Array(W * H); else taken.fill(0);
  for (const tr of G.trains) {
    const body = new Set(bodyPts(tr).map(tileOfPt));
    if (tr.resPath) {
      // let go of booked tiles the whole train has already passed
      const first = tr.resPath.findIndex(i => body.has(i));
      if (first > 0) tr.resPath = tr.resPath.slice(first);
      for (const i of tr.resPath) taken[i] = tr.id;
    }
    for (const i of body) taken[i] = tr.id;
  }
}
const freeFor = (i, tr) => !taken[i] || taken[i] === tr.id;
function claim(tr, path) { tr.resPath = path; for (const i of path) taken[i] = tr.id; }
// The tiles a train will cross from trail distance s0 (on tile first), up to the next signal or its station.
function tilesAhead(tr, s0, first) {
  const out = [first], end = trailEnd(tr);
  for (let s = s0 + 0.1; s < end + 0.1; s += 0.1) {
    const i = tileOfPt(posAt(tr.trail, Math.min(s, end)));
    if (i === out[out.length - 1]) continue;
    if (G.sig[i]) break;
    out.push(i);
  }
  return out;
}
// How far the head may move this step: up to want, or to just before a signal it can't book past yet.
function sigLimit(tr, want) {
  const end = Math.min(trailEnd(tr), want + SIG_LOOK);
  let prev = tileOfPt(posAt(tr.trail, tr.d));
  for (let s = tr.d + 0.1; s <= end; s += 0.1) {
    const i = tileOfPt(posAt(tr.trail, s));
    if (i === prev) continue;
    const from = prev; prev = i;
    if (!G.sig[i]) continue;
    if (tr.resPath && tr.resPath[0] === i) continue; // already booked through this one
    if (s > want + 0.45) break; // not there yet
    if (book(tr, i, from, s)) continue;
    return Math.max(tr.d, Math.min(want, s - 0.35));
  }
  return want;
}
// At each signal the train plans its way on afresh, steering round track other trains hold (so two trains
// pick different sides of a passing loop), then books it up to the next signal.
function book(tr, sigTile, from, sEntry) {
  if (tr.leg && (tr.planSig !== sigTile || (tr.rerouteAt || 0) <= G.time)) {
    tr.planSig = sigTile; tr.rerouteAt = G.time + REROUTE_EVERY;
    const pen = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (!freeFor(i, tr)) pen[i] = 1;
    const p = findPath(sigTile, tr.leg.goal, OPP(dirTo(from, sigTile)), pen, true);
    const np = [];
    if (p) for (const i of p.tiles) { if (np.length && G.sig[i]) break; np.push(i); }
    if (p && np.every(i => freeFor(i, tr))) {
      // keep the trail up to where the train enters the signal, then follow the new way
      const keep = tr.trail.filter(q => q.s <= sEntry + 1e-9).map(q => [q.x, q.y]);
      tr.trail = mkTrail(keep.concat(p.pts));
      tr.leg = { ...p, tiles: [...new Set([...tr.leg.tiles, ...p.tiles])] };
      claim(tr, np);
      return true;
    }
  }
  const path = tilesAhead(tr, sEntry, sigTile);
  if (path.every(i => freeFor(i, tr))) { claim(tr, path); return true; }
  return false;
}
function checkCrashes() {
  const live = G.trains.filter(tr => !(tr.ghost > 0) && tr.trail);
  const pts = new Map(live.map(tr => [tr, bodyPts(tr)]));
  for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++) {
    const A = live[a], B = live[b];
    if (A.state !== 'run' && B.state !== 'run') continue;
    const hit = (X, Y) => { const h = pts.get(X)[0]; return pts.get(Y).some(q => Math.hypot(q.x - h.x, q.y - h.y) < CRASH_R); };
    if (hit(A, B) || hit(B, A)) { crash(A, B); return; }
  }
}
function crash(a, b) {
  const p = posAt(a.trail, a.d);
  for (const tr of [a, b]) {
    tr.crashed = true;
    for (const q of bodyPts(tr)) puff(q.x, q.y, 5, '#9aa0a6');
    if (sel && sel.type === 'train' && sel.id === tr.id) sel = null;
  }
  puff(p.x, p.y, 24, '#ffb347');
  wrecks.push({ x: p.x, y: p.y, t: 0 });
  G.trains = G.trains.filter(tr => tr !== a && tr !== b);
  G.stats.crashes = (G.stats.crashes || 0) + 1;
  sfx('crash');
  toast(t('💥 Crash! {a} and {b} bumped into each other. Use 🚦 signals to keep trains apart!', { a: tn(a.name), b: tn(b.name) }));
}
function updWrecks(dt) { for (const w of wrecks) w.t += dt; wrecks = wrecks.filter(w => w.t < 3); }
function toggleSignal(i) {
  if (G.sig[i]) {
    G.sig[i] = 0; G.coins += Math.floor(price(COST.signal) / 2);
    touch(); dirty = true; sfx('build'); puff(tx(i) + 0.5, ty(i) + 0.5, 5, '#d9c7a8'); return true;
  }
  const c = G.conn[i];
  if (!c) return fail('Put signals on the track! 🛤️');
  if (c !== 5 && c !== 10) return fail('Signals need a straight piece of track. 🚦');
  if (G.stn[i] >= 0) return fail("Signals can't go on a station. Put one just before it! 🚦");
  if (G.road[i]) return fail("Signals can't go on a road crossing! 🚗");
  if (G.terr[i] === HILL) return fail('Signals need to be outside the tunnel! ⛰️');
  if (G.coins < price(COST.signal)) return fail('Not enough coins 🪙');
  G.coins -= price(COST.signal); G.sig[i] = 1;
  touch(); dirty = true; sfx('pop'); puff(tx(i) + 0.5, ty(i) + 0.5, 5, '#ffffff');
  return true;
}
// A train that has waited a long time can be lifted back to its station.
function rescueTrain(tr) { resetTrain(tr); tr.ghost = GHOST_T; tr.sigWait = 0; tr.resPath = null; sfx('pop'); }
function drawSignals() {
  if (!G.adv) return;
  if (sigDirty || taken.length !== W * H) updTaken();
  for (const i of sigList) {
    const x = tx(i) + 0.5, y = ty(i) + 0.5, vert = (G.conn[i] & 5) === 5;
    // a lamp facing each way: green if the track on that side is free
    const sides = vert ? [0, 2] : [3, 1], px = vert ? 0.38 : 0, py = vert ? 0 : -0.38;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; rr(ctx, x + px - (vert ? 0.12 : 0.27) + 0.03, y + py - (vert ? 0.27 : 0.12) + 0.04, vert ? 0.24 : 0.54, vert ? 0.54 : 0.24, 0.09); ctx.fill();
    rr(ctx, x + px - (vert ? 0.12 : 0.27), y + py - (vert ? 0.27 : 0.12), vert ? 0.24 : 0.54, vert ? 0.54 : 0.24, 0.09);
    ctx.fillStyle = '#2d3138'; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.03; ctx.stroke();
    for (const d of sides) {
      const n = nb(i, d), busy = taken[i] || (n >= 0 && taken[n]);
      const lx = x + px + DX[d] * 0.13, ly = y + py + DY[d] * 0.13;
      ctx.fillStyle = busy ? '#ff3b30' : '#2ecc71'; ctx.beginPath(); ctx.arc(lx, ly, 0.08, 0, 7); ctx.fill();
      lights.push([lx, ly, 0.35, 0.5]);
    }
  }
  for (const w of wrecks) emo.push(['💥', w.x, w.y - w.t * 0.2, 0.9 - w.t * 0.2]);
}

// ---------- cars ----------
// Cars shuttle along each road. They stop before a level crossing while a train is close to it.
// A smooth drivable line along a list of road tiles.
function roadMover(path) {
  const pts = [center(path[0]), edgeMid(path[0], dirTo(path[0], path[1]))];
  for (let k = 1; k < path.length - 1; k++) turnPts(pts, path[k], OPP(dirTo(path[k - 1], path[k])), dirTo(path[k], path[k + 1]));
  pts.push(center(path[path.length - 1]));
  const trail = mkTrail(pts), len = trailEnd({ trail });
  // where along the trail each road tile's centre sits
  const at = path.map(i => { const [cx, cy] = center(i); let best = 0, bd = 9; for (const p of trail) { const d = Math.hypot(p.x - cx, p.y - cy); if (d < bd) { bd = d; best = p.s; } } return best; });
  return { path, trail, len, at };
}
function initCars() {
  cars = [];
  G.roads.forEach((path, n) => {
    if (path.length < 3) return;
    const m = roadMover(path);
    for (let k = 0; k < (path.length > 10 ? 2 : 1); k++) {
      cars.push({ ...m, s: k ? m.len : 0, dir: k ? -1 : 1, wait: 0.5 + k * 2 + Math.random(), v: 1.2 + Math.random() * 0.5, col: CAR_COLS[(n * 2 + k) % CAR_COLS.length] });
    }
  });
  for (const rec of G.buses) spawnBus(rec);
}

// ---------- buses ----------
// A bus shuttles between two towns along the roads, collecting passengers straight from the towns.
const BUS_COLS = ['#ffc83d', '#ff6b6b', '#4dabf7', '#69db7c', '#b197fc'];
const busById = id => G.buses.find(b => b.id === id);
const busCar = rec => cars.find(c => c.bus === rec);
// Breadth-first search along the roads from beside town a to beside town b.
function roadRoute(a, b) {
  const touches = (p, i) => p.tiles.some(j => Math.abs(tx(j) - tx(i)) + Math.abs(ty(j) - ty(i)) === 1);
  const prev = new Int32Array(W * H).fill(-2), q = [];
  for (let i = 0; i < W * H; i++) if (G.road[i] && touches(a, i)) { prev[i] = -1; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    if (touches(b, i)) {
      const path = [];
      for (let k = i; k !== -1; k = prev[k]) path.push(k);
      return path.length >= 3 ? path.reverse() : null;
    }
    for (const d of bits(G.road[i])) { const n = nb(i, d); if (n >= 0 && prev[n] === -2) { prev[n] = i; q.push(n); } }
  }
  return null;
}
function spawnBus(rec) {
  const path = roadRoute(G.places[rec.a], G.places[rec.b]);
  if (!path) return;
  cars.push({ ...roadMover(path), bus: rec, s: 0, dir: 1, wait: 1.5, v: BUS_SPEED, col: rec.col, load: busLoad(G.places[rec.a]) });
}
const busLoad = town => clamp(Math.round(town.tiles.length * 1.2), 3, BUS_CAP);
function buyBus(a, b) {
  if (!G.road.some(v => v)) return fail('There are no roads here. Try a 🗺️ New map!');
  if (!roadRoute(G.places[a], G.places[b])) return fail("Those towns aren't joined by a road. 🚌");
  if (G.coins < price(COST_BUS)) return fail('Not enough coins 🪙');
  G.coins -= price(COST_BUS);
  G.busN = (G.busN || 0) + 1;
  const rec = { id: G.nextId++, n: G.busN, a, b, col: BUS_COLS[(G.busN - 1) % BUS_COLS.length], earned: 0 };
  G.buses.push(rec); spawnBus(rec);
  sel = { type: 'bus', id: rec.id };
  sfx('beep'); toast(t('Beep beep! {name} is on its way! 🚌', { name: busName(rec) }));
  return true;
}
const busName = rec => t('Bus {n}', { n: rec.n });
function sellBus(rec) {
  G.coins += Math.floor(price(COST_BUS) / 2);
  const car = busCar(rec);
  if (car) { const p = posAt(car.trail, car.s); puff(p.x, p.y, 8, '#ffffff'); }
  G.buses = G.buses.filter(b => b !== rec); cars = cars.filter(c => c !== car);
  if (sel && sel.type === 'bus' && sel.id === rec.id) sel = null;
}
// Drop off the passengers on board, then pick up new ones for the trip back.
function busStop(car, atB) {
  const rec = car.bus, town = G.places[atB ? rec.b : rec.a];
  if (car.load) {
    const bonus = season().bonus === 'people' ? 2 : 1;
    // buses need no track, so they pay less than trains do
    const pay = Math.max(1, Math.round(car.load * CARGO.people.rate * 0.45 * (0.6 + car.len / 12) * bonus * D().pay));
    G.coins += pay; rec.earned += pay; G.stats.earned += pay;
    G.stats.delivered.people = (G.stats.delivered.people || 0) + car.load;
    town.growth += car.load * growthPer('people'); tryGrow(town);
    const p = posAt(car.trail, car.s);
    floater(p.x, p.y - 0.3, `🧒 +${pay}🪙${bonus > 1 ? ' ✨' : ''}`, '#ffd23f'); sfx('coin');
  }
  car.load = busLoad(town);
}
// Barriers drop for a moving train nearby, or for any train standing on the crossing itself.
function gateDown(i) {
  const cx = tx(i) + 0.5, cy = ty(i) + 0.5;
  return trainPts.some(p => { const r = p.run ? 1.6 : 0.7; return Math.abs(p.x - cx) < r && Math.abs(p.y - cy) < r; });
}
function updCars(dt) {
  trainPts = [];
  for (const tr of G.trains) for (let s = tr.d + 0.3; s >= tr.d - trainLen(tr) - 0.3; s -= 0.3) trainPts.push({ ...posAt(tr.trail, s), run: tr.state === 'run' });
  for (const car of cars) {
    if (car.wait > 0) { car.wait -= dt; continue; }
    let ns = car.s + car.dir * car.v * dt;
    for (let k = 0; k < car.path.length; k++) {
      const i = car.path[k]; if (!G.conn[i]) continue;
      const stop = car.at[k] - car.dir * 0.6;
      if ((stop - car.s) * car.dir >= -0.01 && (stop - ns) * car.dir < 0 && gateDown(i)) { ns = stop; break; }
    }
    if (ns <= 0 || ns >= car.len) {
      ns = clamp(ns, 0, car.len); car.dir = -car.dir; car.wait = 1.5 + Math.random() * 2.5;
      car.s = ns;
      if (car.bus) { busStop(car, ns >= car.len); car.wait = 2.5; }
    }
    car.s = ns;
  }
}

function depart(tr) {
  const n = tr.route.length; if (n < 2) return;
  const nextId = tr.route[(tr.route.indexOf(tr.target) + 1) % n];
  const st = stById(nextId);
  let pen = null;
  if (st && G.adv) {
    updTaken();
    pen = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (!freeFor(i, tr)) pen[i] = 1;
  }
  const p = st && findPath(tr.atTile, idx(st.x, st.y), tr.inE, pen);
  if (!p) { tr.state = 'lost'; tr.timer = 2; return; }
  tr.resPath = null; tr.planSig = -1;
  tr.target = nextId; tr.leg = p; tr.state = 'run';
  const L = trainLen(tr);
  if (tr.inE >= 0 && p.x0 === OPP(tr.inE)) {
    // carry on forwards: keep the bit of trail the wagons are sitting on
    const old = tr.trail.filter(q => q.s >= tr.d - L - 0.5);
    const pts = old.map(q => [q.x, q.y]).concat(p.pts.slice(1));
    tr.d = old[old.length - 1].s - old[0].s;
    tr.trail = mkTrail(pts);
  } else {
    // turn around: the train flips so the engine leads the other way
    tr.trail = mkTrail(p.pts);
    tr.d = Math.min(L - GAP, trailEnd(tr));
    const q = posAt(tr.trail, tr.d / 2); puff(q.x, q.y, 6, '#ffffff');
  }
  sfx('toot');
}

function arrive(tr) {
  const p = tr.leg;
  tr.atTile = p.goal; tr.inE = p.eg; tr.leg = null; tr.state = 'stop';
  const st = stById(G.stn[p.goal]);
  tr.timer = 1.2 + (st ? serve(tr, st) : 0) * 0.04;
}

function serve(tr, st) {
  let moved = 0;
  const acc = accepts(st);
  tr.load = tr.load.filter(l => {
    if (l.from === st.id || !acc.has(l.type)) return true;
    deliver(tr, st, l); moved += l.n; return false;
  });
  const want = new Set();
  for (const id of tr.route) { const s2 = id !== st.id && stById(id); if (s2) accepts(s2).forEach(t => want.add(t)); }
  let room = capacity(tr) - loaded(tr);
  const types = Object.keys(st.cargo).filter(t => st.cargo[t] > 0 && want.has(t));
  while (room > 0 && types.some(t => st.cargo[t] > 0)) {
    for (const t of types) {
      if (room <= 0 || st.cargo[t] <= 0) continue;
      st.cargo[t]--; room--; moved++;
      let l = tr.load.find(q => q.type === t && q.from === st.id);
      if (!l) tr.load.push(l = { type: t, from: st.id, n: 0 });
      l.n++;
    }
  }
  return moved;
}

function deliver(tr, st, l) {
  const from = stById(l.from);
  const dist = from ? Math.abs(from.x - st.x) + Math.abs(from.y - st.y) : 6;
  const bonus = season().bonus === l.type ? 2 : 1;
  const pay = Math.max(1, Math.round(l.n * CARGO[l.type].rate * (0.6 + dist / 10) * bonus * D().pay));
  G.coins += pay; tr.earned += pay; G.stats.earned += pay;
  G.stats.delivered[l.type] = (G.stats.delivered[l.type] || 0) + l.n;
  const ps = st.places.map(id => G.places[id]).filter(p => KINDS[p.kind].accepts.includes(l.type));
  const fac = ps.find(p => KINDS[p.kind].makes);
  if (fac) { const m = KINDS[fac.kind].makes; fac.stock[m] = (fac.stock[m] || 0) + l.n; }
  else {
    const town = ps.find(p => p.kind === 'town');
    if (town) { town.growth += l.n * growthPer(l.type); tryGrow(town); }
  }
  floater(st.x + 0.5, st.y + 0.2, `${CARGO[l.type].e} +${pay}🪙${bonus > 1 ? ' ✨' : ''}`, '#ffd23f');
  sfx('coin');
}

const growNeed = p => 8 + p.tiles.length * 2;
const growthPer = type => type === 'people' ? 0.5 : type === 'bricks' ? 3 : 1;
function tryGrow(p) {
  while (p.growth >= growNeed(p) && p.tiles.length < 24) {
    p.growth -= growNeed(p);
    if (!growTown(p)) { p.growth = 0; break; }
  }
}
function growTown(p) {
  const c = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = p.x + dx, y = p.y + dy; if (!inB(x, y)) continue;
    const i = idx(x, y);
    if (G.terr[i] === WATER || G.terr[i] === HILL || G.occ[i] >= 0 || G.conn[i] || G.stn[i] >= 0 || G.road[i] || G.deco[i]) continue;
    c.push([Math.max(Math.abs(dx), Math.abs(dy)) + Math.random() * 1.5, i]);
  }
  if (!c.length) return false;
  c.sort((a, b) => a[0] - b[0]);
  const i = c[0][1];
  G.occ[i] = p.id; G.terr[i] = GRASS; p.tiles.push(i);
  refreshCatch(); dirty = true;
  puff(tx(i) + 0.5, ty(i) + 0.5, 8, '#ffe9a8');
  floater(tx(i) + 0.5, ty(i), t('🏠 {name} grew!', { name: tn(p.name) }), '#ffffff');
  sfx('grow');
  return true;
}

function produce() {
  for (const p of G.places) {
    const k = KINDS[p.kind];
    const sts = G.stations.filter(s => s.places.includes(p.id));
    if (!sts.length) continue;
    const add = (type, n) => {
      for (let j = 0; j < n; j++) { const s = sts[G.rr++ % sts.length]; s.cargo[type] = Math.min(STN_CAP, (s.cargo[type] || 0) + 1); }
    };
    if (p.kind === 'town') add('people', Math.max(1, Math.round(p.tiles.length / 2)));
    else for (const t of k.produces) add(t, k.rate);
    if (k.makes && p.stock[k.makes]) { add(k.makes, p.stock[k.makes]); p.stock[k.makes] = 0; }
  }
}

function updTrain(tr, dt) {
  if (tr.state !== 'run') { tr.timer -= dt; if (tr.timer <= 0) depart(tr); return; }
  const want = tr.d + ENG[tr.eng].speed * dt;
  tr.d = G.adv ? sigLimit(tr, want) : want;
  tr.sigWait = tr.d < want - 1e-6 ? (tr.sigWait || 0) + dt : 0;
  tr.smokeT -= dt;
  if (tr.smokeT <= 0 && !inTunnel(posAt(tr.trail, tr.d))) {
    tr.smokeT = 0.13;
    const p = posAt(tr.trail, tr.d), a = angAt(tr.trail, tr.d);
    smoke.push({ x: p.x + Math.cos(a) * 0.16, y: p.y + Math.sin(a) * 0.16, vx: (Math.random() - 0.5) * 0.2, vy: -0.35 - Math.random() * 0.2, r: 0.08, life: 0, max: 1.1, col: '#ffffff' });
  }
  if (tr.d >= trailEnd(tr)) { tr.d = trailEnd(tr); arrive(tr); }
}

// ---------- quests ----------
function questProg(q) {
  switch (q.kind) {
    case 'stations': return G.stations.length;
    case 'trains': return G.trains.length;
    case 'deliver': return (G.stats.delivered[q.type] || 0) - q.base;
    case 'earn': return G.stats.earned - q.base;
    case 'grow': return maxHouses();
  }
  return 0;
}
function questText(q) {
  switch (q.kind) {
    case 'stations': return t('Build {n} stations 🚉', { n: q.n });
    case 'trains': return t(q.n > 1 ? 'Have {n} trains 🚂' : 'Have {n} train 🚂', { n: q.n });
    case 'deliver': return t('Deliver {n} {e} {name}', { n: q.n, e: CARGO[q.type].e, name: cname(q.type), lname: cname(q.type).toLowerCase() });
    case 'earn': return t('Earn {n} 🪙 from deliveries', { n: q.n });
    case 'grow': return t('Grow a town to {n} houses 🏠', { n: q.n });
  }
  return '';
}
const maxHouses = () => Math.max(0, ...G.places.filter(p => p.kind === 'town').map(p => p.tiles.length));
function makeQuest() {
  const lvl = G.stars;
  for (let tries = 0; tries < 30; tries++) {
    const r = Math.random();
    let q;
    if (r < 0.55) {
      // only goods this valley can actually make (older maps have no harbour or quarry)
      const types = Object.keys(CARGO).filter(ty => G.places.some(p => KINDS[p.kind].produces.includes(ty) || KINDS[p.kind].makes === ty));
      const type = types[Math.floor(Math.random() * types.length)];
      if (!type) continue;
      const big = ['cakes', 'toys', 'sticks', 'bricks'].includes(type);
      q = { kind: 'deliver', type, n: Math.round(((big ? 8 : 15) + lvl * (big ? 2 : 4)) / 5) * 5 || 5, base: G.stats.delivered[type] || 0 };
    } else if (r < 0.75) q = { kind: 'earn', n: Math.round((100 + lvl * 40) * D().pay / 10) * 10, base: G.stats.earned };
    else if (r < 0.88) q = { kind: 'trains', n: G.trains.length + 1 };
    else q = { kind: 'grow', n: maxHouses() + 2 };
    if (G.quests.some(o => o.kind === q.kind && o.type === q.type)) continue;
    q.reward = Math.round((30 + lvl * 10) * D().reward);
    return q;
  }
  return { kind: 'earn', n: Math.round((100 + lvl * 40) * D().pay / 10) * 10, base: G.stats.earned, reward: Math.round((30 + lvl * 10) * D().reward) };
}
function checkQuests() {
  for (let k = 0; k < G.quests.length; k++) {
    const q = G.quests[k];
    if (questProg(q) < q.n) continue;
    G.stars++; G.coins += q.reward;
    sfx('fanfare'); burst();
    toast(t('⭐ Quest done! +{n}🪙', { n: q.reward }));
    const unlocked = ENGINES.find(e => e.stars === G.stars && e.stars > 0);
    if (unlocked) setTimeout(() => toast(t('🔓 New engine: the {name}!', { name: tn(unlocked.name) })), 2400);
    G.quests[k] = makeQuest();
  }
}

// ---------- effects ----------
function puff(x, y, n, col) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = 0.4 + Math.random() * 0.8;
    smoke.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.2, r: 0.1 + Math.random() * 0.08, life: 0, max: 0.6 + Math.random() * 0.4, col });
  }
}
function floater(x, y, text, col) { floaters.push({ x, y, text, col, t: 0, max: 1.8 }); }
function burst() {
  const w = innerWidth;
  for (let k = 0; k < 90; k++) confetti.push({ x: w / 2 + (Math.random() - 0.5) * w * 0.6, y: -10 - Math.random() * 80, vx: (Math.random() - 0.5) * 120, vy: 60 + Math.random() * 120, r: Math.random() * 6, va: (Math.random() - 0.5) * 10, a: 0, col: COLORS[k % COLORS.length], life: 0 });
}
function fx(dt) {
  for (const p of smoke) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.r += dt * 0.18; }
  for (const f of floaters) f.t += dt;
  for (const c of confetti) { c.life += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 80 * dt; c.a += c.va * dt; }
  prune(smoke, p => p.life < p.max); prune(floaters, f => f.t < f.max); prune(confetti, c => c.y < innerHeight + 20 && c.life < 5);
  updWeather(dt);
}
// Petals in spring, fireflies on summer nights, leaves in autumn, snow in winter. World coordinates.
const WEATHER = ['petal', 'fly', 'leaf', 'snow'], WEATHER_N = [16, 18, 18, 80];
function flake(kind, anywhere) {
  const R = Math.random;
  return {
    kind, x: R() * W, y: anywhere || kind === 'fly' ? R() * H : -0.3, t: R() * 9, a: R() * 6,
    vx: kind === 'snow' ? 0.1 : kind === 'fly' ? (R() - 0.5) * 0.4 : 0.35, vy: kind === 'snow' ? 0.5 + R() * 0.4 : kind === 'fly' ? (R() - 0.5) * 0.3 : 0.35 + R() * 0.3,
    sw: kind === 'fly' ? 0.4 : 0.35, f: 0.8 + R() * 1.4, r: kind === 'snow' ? 0.05 + R() * 0.04 : 0.08,
    col: kind === 'leaf' ? AUTUMN_LEAVES[Math.floor(R() * 3)][0] : kind === 'petal' ? (R() < 0.5 ? '#ffc2dc' : '#ffffff') : '#ffffff',
  };
}
function updWeather(dt) {
  const s = seasonIx(), kind = WEATHER[s];
  prune(weather, w => w.kind === kind);
  const want = Math.round(WEATHER_N[s] * W * H / 960);
  if (weather.length > want) weather.length = want;
  while (weather.length < want) weather.push(flake(kind, true));
  for (const w of weather) {
    w.t += dt; w.a += dt * 2;
    w.x += (w.vx + Math.sin(w.t * w.f) * w.sw) * dt; w.y += (w.vy + (w.kind === 'fly' ? Math.cos(w.t * w.f * 1.3) * 0.3 : 0)) * dt;
    if (w.kind === 'fly') { w.x = (w.x + W) % W; w.y = (w.y + H) % H; }
    else if (w.y > H + 0.3 || w.x > W + 0.5) Object.assign(w, flake(kind, false));
  }
}
function prune(a, keep) { let j = 0; for (const v of a) if (keep(v)) a[j++] = v; a.length = j; }

// ---------- sound ----------
let AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone(f, t0, dur, type, vol, f2) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + t0;
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.05);
}
const lastSfx = {};
function sfx(name) {
  const now = performance.now(), gap = { toot: 900, coin: 120, build: 50, err: 400 }[name] || 60;
  if (lastSfx[name] && now - lastSfx[name] < gap) return;
  lastSfx[name] = now;
  switch (name) {
    case 'toot': tone(587, 0, 0.3, 'triangle', 0.06); tone(740, 0, 0.3, 'triangle', 0.05); tone(587, 0.36, 0.45, 'triangle', 0.06); tone(740, 0.36, 0.45, 'triangle', 0.05); break;
    case 'coin': tone(988, 0, 0.08, 'square', 0.035); tone(1319, 0.07, 0.2, 'square', 0.035); break;
    case 'build': tone(320, 0, 0.06, 'square', 0.03, 180); break;
    case 'pop': tone(500, 0, 0.14, 'sine', 0.12, 950); break;
    case 'err': tone(210, 0, 0.2, 'sawtooth', 0.04, 140); break;
    case 'grow': tone(660, 0, 0.1, 'sine', 0.1); tone(880, 0.1, 0.22, 'sine', 0.1); break;
    case 'fanfare': [523, 659, 784, 1047].forEach((f, k) => tone(f, k * 0.12, 0.35, 'triangle', 0.09)); break;
    case 'honk': tone(587, 0, 0.18, 'triangle', 0.08); tone(740, 0, 0.18, 'triangle', 0.06); tone(587, 0.22, 0.3, 'triangle', 0.08); tone(740, 0.22, 0.3, 'triangle', 0.06); break;
    case 'beep': tone(880, 0, 0.09, 'square', 0.04); tone(880, 0.13, 0.12, 'square', 0.04); break;
    case 'quack': tone(330, 0, 0.11, 'sawtooth', 0.05, 220); tone(330, 0.15, 0.13, 'sawtooth', 0.05, 200); break;
    case 'undo': tone(700, 0, 0.12, 'sine', 0.1, 420); break;
    case 'crash': {
      tone(140, 0, 0.5, 'sawtooth', 0.09, 50); tone(90, 0.05, 0.6, 'square', 0.06, 40);
      [1200, 900, 1500].forEach((f, k) => tone(f, 0.08 + k * 0.07, 0.12, 'triangle', 0.04, f * 0.6));
      break;
    }
    case 'season': [784, 659, 784, 1047].forEach((f, k) => tone(f, k * 0.1, 0.3, 'sine', 0.07)); break;
  }
}

// ---------- music ----------
// A gentle generated tune over C–Am–F–G. Phrases follow an A A B A form and are rewritten every 16 bars.
// Night drops the drums and plays softer; winter adds a bell an octave up; summer adds a shaker.
let musicOn = true;
try { musicOn = localStorage.getItem(MUSIC_KEY) !== 'off'; } catch (e) { /* default on */ }
const STEP8 = 60 / 92 / 2;
const MEL = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
const CHORD_PC = [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2]], BASS = [48, 45, 41, 43];
let mGain = null, mNext = 0, mStep = 0, mSeed = 11, mPhr = null, noiseBuf = null;
const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);
function makePhrase(seed) {
  const R = mulberry(seed), out = [];
  let k = 3 + Math.floor(R() * 4);
  for (let bar = 0; bar < 4; bar++) for (let s = 0; s < 8; s++) {
    if (s % 2 && R() < 0.4) { out.push(0); continue; } // 0 holds the previous note
    k = clamp(k + [-2, -1, -1, 0, 1, 1, 2][Math.floor(R() * 7)], 0, MEL.length - 1);
    if (s % 4 === 0) {
      let best = k, bd = 99;
      MEL.forEach((n, j) => { if (CHORD_PC[bar].includes(n % 12) && Math.abs(j - k) < bd) { bd = Math.abs(j - k); best = j; } });
      k = best;
    }
    out.push(MEL[k]);
  }
  return out;
}
function mNote(f, time, dur, type, vol) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, time);
  g.gain.setValueAtTime(0.0001, time); g.gain.linearRampToValueAtTime(vol, time + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  o.connect(g).connect(mGain); o.start(time); o.stop(time + dur + 0.05);
}
function mDrum(time, kind) {
  if (kind === 'kick') {
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.setValueAtTime(140, time); o.frequency.exponentialRampToValueAtTime(45, time + 0.15);
    g.gain.setValueAtTime(0.09, time); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    o.connect(g).connect(mGain); o.start(time); o.stop(time + 0.2);
    return;
  }
  if (!noiseBuf) {
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  }
  const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = kind === 'hat' ? 7000 : 4500;
  const vol = kind === 'hat' ? 0.012 : 0.007, len = kind === 'hat' ? 0.05 : 0.09;
  g.gain.setValueAtTime(vol, time); g.gain.exponentialRampToValueAtTime(0.0001, time + len);
  src.connect(f).connect(g).connect(mGain); src.start(time); src.stop(time + len + 0.02);
}
function playStep(step, time) {
  const bar = Math.floor(step / 8), s = step % 8, cb = bar % 4, sec = Math.floor(bar / 4) % 4;
  if (!mPhr || step % 128 === 0) mPhr = { A: makePhrase(mSeed++), B: makePhrase(mSeed++) };
  const ph = sec === 2 ? mPhr.B : mPhr.A, night = darkness() > 0.4, sn = seasonIx();
  if (s === 0 || s === 4) mNote(midiHz(BASS[cb]), time, STEP8 * 3.2, 'triangle', night ? 0.05 : 0.07);
  if (s === 0) for (const pc of CHORD_PC[cb]) mNote(midiHz(55 + ((pc - 7 + 12) % 12)), time, STEP8 * 7.5, 'sine', 0.012);
  const n = ph[cb * 8 + s];
  if (n) {
    let len = 1; while (s + len < 8 && !ph[cb * 8 + s + len]) len++;
    mNote(midiHz(n), time, STEP8 * len * 0.95, 'triangle', night ? 0.028 : 0.045);
    if (sn === 3) mNote(midiHz(n + 12), time, 0.5, 'sine', 0.014);
  }
  if (night) return;
  if (s === 0 || s === 4) mDrum(time, 'kick');
  if (s === 2 || s === 6) mDrum(time, 'hat');
  if (sn === 1 && s % 2) mDrum(time, 'shaker');
}
const musicWanted = () => musicOn && !muted;
function music() {
  if (!AC) return;
  if (!mGain) { mGain = AC.createGain(); mGain.gain.value = 0; mGain.connect(AC.destination); }
  const want = musicWanted() ? 0.9 : 0;
  if (Math.abs(mGain.gain.value - want) > 0.01 && mGain.wantV !== want) { mGain.wantV = want; mGain.gain.setTargetAtTime(want, AC.currentTime, 0.4); }
  if (!want || AC.state !== 'running') return;
  if (mNext < AC.currentTime) mNext = AC.currentTime + 0.05;
  while (mNext < AC.currentTime + 0.3) { playStep(mStep++, mNext); mNext += STEP8; }
}

// ---------- rendering: static map cache ----------
// The static map is cached at one of a few fixed sharpness levels and scaled when drawn,
// so zooming only re-renders when it crosses a level. Big maps are capped to keep memory sane.
let cacheK = 0;
function wantCacheK() {
  const want = view.s * dpr, cap = Math.min(64, 6144 / W, 6144 / H);
  for (const b of [12, 16, 24, 32, 48, 64]) if (b >= want) return Math.min(b, cap);
  return cap;
}
function renderCache() {
  dirty = false; sigDirty = true;
  const k = cacheK = wantCacheK();
  cache.width = Math.ceil(W * k); cache.height = Math.ceil(H * k);
  const c = cache.getContext('2d');
  c.setTransform(k, 0, 0, k, 0, 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) drawGround(c, x, y);
  for (let i = 0; i < W * H; i++) if (G.terr[i] === WATER && G.road[i]) drawBridge(c, i, G.road[i], '#9a8f80', '#6f665b', 0.66);
  for (let i = 0; i < W * H; i++) if (G.terr[i] === WATER && G.conn[i]) drawBridge(c, i, G.conn[i], '#b9824d', '#8a5a35', 0.72);
  drawRoads(c);
  drawTracks(c);
  drawTunnels(c);
  for (const p of G.places) drawPlace(c, p);
  for (let i = 0; i < W * H; i++) if (G.terr[i] === TREE) drawTree(c, tx(i), ty(i));
  animDeco = [];
  for (let i = 0; i < W * H; i++) if (G.deco[i]) {
    const id = DECOS[G.deco[i] - 1].id;
    drawDeco(c, id, tx(i), ty(i), i);
    if (id === 'windmill' || id === 'pond' || id === 'lamp') animDeco.push([id, tx(i), ty(i)]);
  }
  for (const s of G.stations) drawStation(c, s);
  for (const p of G.places) if (p.kind !== 'town') {
    const bx = p.x + 1.72, by = p.y + 0.28;
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.arc(bx + 0.04, by + 0.06, 0.3, 0, 7); c.fill();
    c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(bx, by, 0.3, 0, 7); c.fill();
    c.strokeStyle = '#e9d6b4'; c.lineWidth = 0.05; c.stroke();
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.font = `${Math.round(0.4 * k)}px ${EMOJI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(KINDS[p.kind].e, bx * k, by * k + 0.03 * k);
    c.restore();
  }
  renderMini();
}

// ---------- minimap ----------
// One small block per tile; the frame for the view and dots for trains are drawn on top each frame.
const miniImg = document.createElement('canvas'), mini = $('mini');
let miniPx = 3;
function renderMini() {
  miniPx = Math.max(2, Math.min(4, Math.floor(200 / W)));
  miniImg.width = W * miniPx; miniImg.height = H * miniPx;
  const c = miniImg.getContext('2d'), P = PAL[seasonIx()];
  for (let i = 0; i < W * H; i++) {
    const tr = G.terr[i];
    c.fillStyle = G.occ[i] >= 0 ? (G.places[G.occ[i]].kind === 'town' ? '#e8584f' : '#ff9f43')
      : G.stn[i] >= 0 ? '#ffd23f' : G.conn[i] ? '#6b4a2f' : G.road[i] ? '#8d9098'
      : tr === WATER ? P.water : tr === HILL ? shade(P.hill, -0.15) : tr === TREE ? (P.leaf ? P.leaf[0] : '#c9772e') : P.g[0];
    c.fillRect(tx(i) * miniPx, ty(i) * miniPx, miniPx, miniPx);
  }
  mini.width = miniImg.width * dpr; mini.height = miniImg.height * dpr;
  mini.style.width = miniImg.width + 'px'; mini.style.height = miniImg.height + 'px';
}
function drawMini() {
  const c = mini.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.drawImage(miniImg, 0, 0);
  c.fillStyle = '#ffffff';
  for (const tr of G.trains) { const p = posAt(tr.trail, tr.d); c.fillRect(p.x * miniPx - 1.5, p.y * miniPx - 1.5, 3, 3); }
  const top = viewArea.top, bot = innerHeight - viewArea.bot;
  const x0 = (0 - view.ox) / view.s, y0 = (top - view.oy) / view.s, x1 = (innerWidth - view.ox) / view.s, y1 = (bot - view.oy) / view.s;
  c.strokeStyle = '#ffffff'; c.lineWidth = 2;
  c.strokeRect(clamp(x0, 0, W) * miniPx + 1, clamp(y0, 0, H) * miniPx + 1, (clamp(x1, 0, W) - clamp(x0, 0, W)) * miniPx - 2, (clamp(y1, 0, H) - clamp(y0, 0, H)) * miniPx - 2);
}

function drawGround(c, x, y) {
  const i = idx(x, y), h = hash(x, y, 1), P = PAL[seasonIx()], winter = seasonIx() === 3;
  if (G.terr[i] === WATER) {
    c.fillStyle = P.water; c.fillRect(x, y, 1.01, 1.01);
    c.fillStyle = P.sand;
    for (let d = 0; d < 4; d++) {
      const xx = x + DX[d], yy = y + DY[d];
      if (!inB(xx, yy) || G.terr[idx(xx, yy)] === WATER) continue;
      if (d === 0) c.fillRect(x, y, 1, 0.12); else if (d === 2) c.fillRect(x, y + 0.88, 1, 0.12);
      else if (d === 1) c.fillRect(x + 0.88, y, 0.12, 1); else c.fillRect(x, y, 0.12, 1);
    }
    if (h > 0.5) {
      const wx = x + 0.3 + hash(x, y, 2) * 0.4, wy = y + 0.3 + hash(x, y, 3) * 0.4;
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.05; c.lineCap = 'round'; c.beginPath();
      if (winter) { c.moveTo(wx - 0.18, wy + 0.08); c.lineTo(wx + 0.18, wy - 0.08); } // ice streak
      else { c.moveTo(wx - 0.14, wy); c.quadraticCurveTo(wx, wy - 0.1, wx + 0.14, wy); }
      c.stroke();
    }
    return;
  }
  c.fillStyle = P.g[(x + y) % 2]; c.fillRect(x, y, 1.01, 1.01);
  if (G.terr[i] === HILL) { drawHill(c, x, y, P); return; }
  if (P.dots && h > P.dotP && G.occ[i] < 0 && !G.conn[i] && !G.road[i] && !G.deco[i] && G.terr[i] === GRASS) {
    for (let k = 0; k < 3; k++) {
      c.fillStyle = P.dots[Math.floor(hash(x, y, 10 + k) * 3)];
      c.beginPath(); c.arc(x + 0.2 + hash(x, y, 20 + k) * 0.6, y + 0.2 + hash(x, y, 30 + k) * 0.6, 0.05, 0, 7); c.fill();
    }
  }
}
// Hills are raised plateaus: lit on the top/left edges, shaded on the bottom/right.
function drawHill(c, x, y, P) {
  const isHill = (d) => { const xx = x + DX[d], yy = y + DY[d]; return inB(xx, yy) && G.terr[idx(xx, yy)] === HILL; };
  c.fillStyle = P.hill; c.fillRect(x, y, 1.01, 1.01);
  // little rounded humps give the hill a lumpy, grassy top
  const hx = x + 0.3 + hash(x, y, 40) * 0.4, hy = y + 0.3 + hash(x, y, 41) * 0.4;
  c.fillStyle = 'rgba(30,50,15,0.16)'; c.beginPath(); c.ellipse(hx + 0.05, hy + 0.06, 0.3, 0.2, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(hx - 0.04, hy - 0.04, 0.24, 0.15, 0, 0, 7); c.fill();
  const edge = 0.2;
  c.fillStyle = 'rgba(255,255,255,0.4)';
  if (!isHill(0)) c.fillRect(x, y, 1, edge * 0.7);
  if (!isHill(3)) c.fillRect(x, y, edge * 0.7, 1);
  c.fillStyle = 'rgba(30,45,15,0.38)';
  if (!isHill(2)) c.fillRect(x, y + 1 - edge, 1, edge);
  if (!isHill(1)) c.fillRect(x + 1 - edge, y, edge, 1);
  c.fillStyle = 'rgba(110,100,90,0.55)';
  for (let k = 0; k < 2; k++) { c.beginPath(); c.arc(x + 0.2 + hash(x, y, 42 + k) * 0.6, y + 0.2 + hash(x, y, 50 + k) * 0.6, 0.045 + k * 0.02, 0, 7); c.fill(); }
}

function drawBridge(c, i, cn, fill, edge, w) {
  const x = tx(i), y = ty(i), o = (1 - w) / 2;
  c.fillStyle = fill; c.fillRect(x + o, y + o, w, w);
  for (const d of bits(cn)) {
    if (d === 0) c.fillRect(x + o, y, w, 0.5); else if (d === 2) c.fillRect(x + o, y + 0.5, w, 0.5);
    else if (d === 1) c.fillRect(x + 0.5, y + o, 0.5, w); else c.fillRect(x, y + o, 0.5, w);
  }
  c.strokeStyle = edge; c.lineWidth = 0.04; c.strokeRect(x + o, y + o, w, w);
}

function drawRoads(c) {
  const list = [];
  for (let i = 0; i < W * H; i++) if (G.road[i]) for (const s of tileSegs(G.road[i])) list.push([tx(i), ty(i), s[0], s[1]]);
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [col, lw] of [['#6f7179', 0.6], ['#9da0a8', 0.5]]) {
    c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
    for (const s of list) railPath(c, ...s, 0);
    c.stroke();
  }
  c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 0.04; c.setLineDash([0.14, 0.14]); c.beginPath();
  for (const s of list) if (!G.conn[idx(s[0], s[1])]) railPath(c, ...s, 0);
  c.stroke(); c.setLineDash([]);
}

// Track inside a hill is covered over, with a faint dashed line so kids can still follow it, and portals where it comes out.
function drawTunnels(c) {
  const P = PAL[seasonIx()];
  for (let i = 0; i < W * H; i++) {
    if (G.terr[i] !== HILL || !G.conn[i]) continue;
    const x = tx(i), y = ty(i);
    c.globalAlpha = 0.86; drawGround(c, x, y); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(60,45,30,0.35)'; c.lineWidth = 0.08; c.setLineDash([0.12, 0.1]); c.beginPath();
    for (const s of tileSegs(G.conn[i])) railPath(c, x, y, s[0], s[1], 0);
    c.stroke(); c.setLineDash([]);
    for (const d of bits(G.conn[i])) {
      const n = nb(i, d);
      if (n < 0 || G.terr[n] === HILL) continue;
      c.save(); c.translate(x + 0.5 + DX[d] * 0.5, y + 0.5 + DY[d] * 0.5); c.rotate(Math.atan2(DY[d], DX[d]));
      rr(c, -0.2, -0.42, 0.2, 0.84, 0.08); c.fillStyle = '#a69d8f'; c.fill();
      c.strokeStyle = '#7d7468'; c.lineWidth = 0.035; c.stroke();
      rr(c, -0.16, -0.27, 0.18, 0.54, 0.12); c.fillStyle = '#2f2a26'; c.fill();
      if (P === PAL[3]) { c.fillStyle = '#ffffff'; c.fillRect(-0.22, -0.44, 0.08, 0.88); }
      c.restore();
    }
  }
}

function tileSegs(cn) {
  const b = bits(cn);
  if (b.length === 1) return [[b[0], -1]];
  const r = [];
  for (let a = 0; a < b.length; a++) for (let z = a + 1; z < b.length; z++) r.push([b[a], b[z]]);
  return r;
}
function lineEnds(x, y, e, f) {
  const ax = x + 0.5 + DX[e] * 0.5, ay = y + 0.5 + DY[e] * 0.5;
  const bx = f === -1 ? x + 0.5 : x + 0.5 + DX[f] * 0.5, by = f === -1 ? y + 0.5 : y + 0.5 + DY[f] * 0.5;
  const len = Math.hypot(bx - ax, by - ay);
  return { ax, ay, bx, by, len, ux: (bx - ax) / len, uy: (by - ay) / len };
}
function segSleepers(c, x, y, e, f) {
  if (f === -1 || f === OPP(e)) {
    const L = lineEnds(x, y, e, f), n = Math.round(L.len / 0.25);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n * L.len, cx = L.ax + L.ux * t, cy = L.ay + L.uy * t;
      c.moveTo(cx + L.uy * 0.25, cy - L.ux * 0.25); c.lineTo(cx - L.uy * 0.25, cy + L.ux * 0.25);
    }
  } else {
    const [ox, oy] = cornerOf(x, y, e, f), [a0, da] = arcAng(x, y, e, f);
    for (const k of [1 / 6, 0.5, 5 / 6]) {
      const a = a0 + da * k;
      c.moveTo(ox + Math.cos(a) * 0.25, oy + Math.sin(a) * 0.25); c.lineTo(ox + Math.cos(a) * 0.75, oy + Math.sin(a) * 0.75);
    }
  }
}
function railPath(c, x, y, e, f, off) {
  if (f === -1 || f === OPP(e)) {
    const L = lineEnds(x, y, e, f);
    c.moveTo(L.ax - L.uy * off, L.ay + L.ux * off); c.lineTo(L.bx - L.uy * off, L.by + L.ux * off);
  } else {
    const [ox, oy] = cornerOf(x, y, e, f), [a0, da] = arcAng(x, y, e, f), r = 0.5 + off;
    c.moveTo(ox + Math.cos(a0) * r, oy + Math.sin(a0) * r); c.arc(ox, oy, r, a0, a0 + da, da < 0);
  }
}
function drawTracks(c) {
  const list = [];
  for (let i = 0; i < W * H; i++) if (G.conn[i]) for (const s of tileSegs(G.conn[i])) list.push([tx(i), ty(i), s[0], s[1]]);
  c.lineCap = 'butt';
  c.strokeStyle = '#9a6a3f'; c.lineWidth = 0.09; c.beginPath();
  for (const s of list) segSleepers(c, ...s);
  c.stroke();
  c.lineCap = 'round';
  for (const [col, lw] of [['#5d6270', 0.08], ['#c7ccd6', 0.03]]) {
    c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
    for (const s of list) { railPath(c, ...s, -0.14); railPath(c, ...s, 0.14); }
    c.stroke();
  }
  // buffer stops at dead ends
  c.strokeStyle = '#e74c3c'; c.lineWidth = 0.1; c.beginPath();
  for (const [x, y, e, f] of list) if (f === -1) {
    const px = DY[e] !== 0 ? 0.24 : 0, py = DX[e] !== 0 ? 0.24 : 0;
    c.moveTo(x + 0.5 - px, y + 0.5 - py); c.lineTo(x + 0.5 + px, y + 0.5 + py);
  }
  c.stroke();
}

function drawStation(c, s) {
  const vert = (G.conn[idx(s.x, s.y)] & 5) !== 0;
  c.save(); c.translate(s.x + 0.5, s.y + 0.5); if (!vert) c.rotate(Math.PI / 2);
  c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(-0.47, -0.46, 0.2, 0.98); c.fillRect(0.31, -0.46, 0.2, 0.98);
  c.fillStyle = '#e8e1d0'; c.fillRect(-0.5, -0.5, 0.22, 1); c.fillRect(0.28, -0.5, 0.22, 1);
  c.fillStyle = '#f5d547'; c.fillRect(-0.3, -0.5, 0.04, 1); c.fillRect(0.26, -0.5, 0.04, 1);
  for (const sx of [-0.52, 0.3]) {
    rr(c, sx, -0.3, 0.22, 0.6, 0.05); c.fillStyle = '#e8584f'; c.fill();
    c.fillStyle = '#ffffff';
    for (let k = 0; k < 3; k++) c.fillRect(sx + 0.03, -0.24 + k * 0.2, 0.16, 0.06);
  }
  c.restore();
}

function drawPlace(c, p) {
  if (p.kind === 'town') { for (const i of p.tiles) drawHouse(c, tx(i), ty(i)); return; }
  const x = p.x, y = p.y;
  const base = { orchard: '#aee07c', farm: '#aee07c', lumber: '#dcc08a', bakery: '#f6e7d2', toyshop: '#dceefa', harbour: '#f3dfa2', fishfac: '#e3f2fb', quarry: '#cfc8bb', bricks: '#f2ddd0' }[p.kind];
  rr(c, x + 0.1, y + 0.12, 1.84, 1.84, 0.25); c.fillStyle = 'rgba(0,0,0,0.12)'; c.fill();
  rr(c, x + 0.06, y + 0.06, 1.88, 1.88, 0.25); c.fillStyle = base; c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.05; c.stroke();
  const circle = (cx, cy, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); };
  if (p.kind === 'orchard') {
    for (const [ox, oy] of [[0.55, 0.6], [1.4, 0.75], [0.6, 1.45], [1.45, 1.45]]) {
      circle(x + ox + 0.05, y + oy + 0.07, 0.33, 'rgba(0,0,0,0.15)');
      circle(x + ox, y + oy, 0.33, '#3e9e4c'); circle(x + ox - 0.08, y + oy - 0.08, 0.18, seasonIx() === 3 ? '#ffffff' : '#5cbd5f');
      if (seasonIx() !== 3) for (let k = 0; k < 4; k++) circle(x + ox + Math.cos(k * 1.7 + ox) * 0.2, y + oy + Math.sin(k * 1.7 + oy) * 0.2, 0.06, '#e8402e');
    }
  } else if (p.kind === 'farm') {
    c.fillStyle = '#f2cf5b'; c.fillRect(x + 0.18, y + 0.18, 0.78, 1.64);
    c.strokeStyle = '#d9ae3a'; c.lineWidth = 0.05; c.beginPath();
    for (let k = 1; k < 4; k++) { c.moveTo(x + 0.18 + k * 0.195, y + 0.22); c.lineTo(x + 0.18 + k * 0.195, y + 1.78); }
    c.stroke();
    c.fillStyle = '#d64534'; c.fillRect(x + 1.08, y + 0.2, 0.74, 0.7);
    c.fillStyle = '#a8322a'; c.fillRect(x + 1.08, y + 0.2, 0.74, 0.14);
    c.strokeStyle = '#ffffff'; c.lineWidth = 0.05; c.beginPath();
    c.rect(x + 1.3, y + 0.5, 0.3, 0.4); c.moveTo(x + 1.3, y + 0.5); c.lineTo(x + 1.6, y + 0.9); c.moveTo(x + 1.6, y + 0.5); c.lineTo(x + 1.3, y + 0.9); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 0.035; c.strokeRect(x + 1.08, y + 1.08, 0.74, 0.74);
    for (const [ox, oy] of [[1.3, 1.35], [1.6, 1.6]]) {
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x + ox, y + oy, 0.13, 0.08, 0, 0, 7); c.fill();
      circle(x + ox + 0.03, y + oy - 0.01, 0.035, '#333');
    }
  } else if (p.kind === 'lumber') {
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) {
      const lx = x + 0.3 + k * 0.26 + r * 0.13, ly = y + 1.55 - r * 0.22;
      rr(c, lx - 0.12, ly - 0.1, 0.24, 0.2, 0.08); c.fillStyle = '#9b6436'; c.fill();
      circle(lx, ly, 0.07, '#e2b47c');
    }
    for (const [ox, oy] of [[1.4, 0.6], [1.0, 0.45], [1.5, 1.35]]) {
      c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.ellipse(x + ox + 0.05, y + oy + 0.3, 0.22, 0.08, 0, 0, 7); c.fill();
      c.fillStyle = '#2e7d4f'; c.beginPath(); c.moveTo(x + ox, y + oy - 0.35); c.lineTo(x + ox + 0.25, y + oy + 0.28); c.lineTo(x + ox - 0.25, y + oy + 0.28); c.closePath(); c.fill();
      c.fillStyle = '#3f9c62'; c.beginPath(); c.moveTo(x + ox, y + oy - 0.35); c.lineTo(x + ox + 0.1, y + oy + 0.1); c.lineTo(x + ox - 0.15, y + oy + 0.15); c.closePath(); c.fill();
    }
    circle(x + 0.55, y + 0.6, 0.2, '#b98a5a'); circle(x + 0.55, y + 0.6, 0.12, '#e2b47c');
  } else if (p.kind === 'harbour') {
    // a little jetty with a sailing boat
    c.fillStyle = '#b9824d'; c.fillRect(x + 0.2, y + 0.9, 1.6, 0.32);
    c.strokeStyle = '#8a5a35'; c.lineWidth = 0.03; c.beginPath();
    for (let k = 1; k < 8; k++) { c.moveTo(x + 0.2 + k * 0.2, y + 0.9); c.lineTo(x + 0.2 + k * 0.2, y + 1.22); }
    c.stroke();
    c.fillStyle = '#4fb4ea'; rr(c, x + 0.25, y + 1.3, 1.5, 0.55, 0.15); c.fill();
    c.fillStyle = '#e8584f'; c.beginPath(); c.moveTo(x + 0.6, y + 1.5); c.lineTo(x + 1.3, y + 1.5); c.lineTo(x + 1.18, y + 1.72); c.lineTo(x + 0.72, y + 1.72); c.closePath(); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x + 0.95, y + 1.0); c.lineTo(x + 0.95, y + 1.48); c.lineTo(x + 1.25, y + 1.48); c.closePath(); c.fill();
    for (const [ox, col] of [[0.35, '#8a5a35'], [0.7, '#4f7cac']]) { c.fillStyle = col; rr(c, x + ox, y + 0.3, 0.3, 0.35, 0.05); c.fill(); }
    circle(x + 1.4, y + 0.5, 0.18, '#d9d4c7'); circle(x + 1.4, y + 0.5, 0.1, '#7aa6c2');
  } else if (p.kind === 'quarry') {
    c.fillStyle = '#a39a8c'; c.beginPath(); c.moveTo(x + 0.15, y + 0.2); c.lineTo(x + 1.85, y + 0.2); c.lineTo(x + 1.6, y + 0.85); c.lineTo(x + 0.4, y + 0.85); c.closePath(); c.fill();
    for (const [ox, oy, r] of [[0.45, 1.3, 0.2], [0.75, 1.45, 0.16], [0.6, 1.1, 0.13], [1.5, 1.5, 0.12]]) { circle(x + ox, y + oy, r, '#8f877b'); circle(x + ox - r * 0.3, y + oy - r * 0.3, r * 0.45, '#b7b0a4'); }
    c.fillStyle = '#e0a83e'; c.fillRect(x + 1.05, y + 1.1, 0.5, 0.3);
    circle(x + 1.12, y + 1.45, 0.07, '#333'); circle(x + 1.48, y + 1.45, 0.07, '#333');
    c.fillStyle = '#9da0a8'; c.fillRect(x + 1.1, y + 1.02, 0.4, 0.1);
  } else if (p.kind === 'bakery' || p.kind === 'toyshop' || p.kind === 'fishfac' || p.kind === 'bricks') {
    const wall = { bakery: '#f7a8c4', toyshop: '#6db6ef', fishfac: '#8fd3ff', bricks: '#d9694a' }[p.kind];
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(x + 0.32, y + 0.42, 1.5, 1.35);
    c.fillStyle = wall; c.fillRect(x + 0.25, y + 0.35, 1.5, 1.35);
    if (p.kind === 'bakery' || p.kind === 'fishfac') {
      const stripe = p.kind === 'bakery' ? '#e8588f' : '#2d7fc9';
      for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#ffffff' : stripe; c.fillRect(x + 0.2 + k * 0.267, y + 0.25, 0.267, 0.45); }
      c.fillStyle = '#8a5a35'; c.fillRect(x + 1.45, y + 0.05, 0.16, 0.3);
      if (p.kind === 'fishfac') { // fish sign
        c.fillStyle = '#ff9f43'; c.beginPath(); c.ellipse(x + 1.0, y + 0.82, 0.2, 0.09, 0, 0, 7); c.fill();
        c.beginPath(); c.moveTo(x + 1.18, y + 0.82); c.lineTo(x + 1.32, y + 0.72); c.lineTo(x + 1.32, y + 0.92); c.closePath(); c.fill();
      }
    } else if (p.kind === 'bricks') {
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.025; c.beginPath();
      for (let r = 0; r < 6; r++) { c.moveTo(x + 0.25, y + 0.55 + r * 0.2); c.lineTo(x + 1.75, y + 0.55 + r * 0.2); }
      c.stroke();
      c.fillStyle = '#7a3b2a'; c.fillRect(x + 0.2, y + 0.25, 1.6, 0.25);
      c.fillStyle = '#8f877b'; c.fillRect(x + 1.4, y - 0.05, 0.22, 0.4); // chimney
    } else {
      const cols = ['#ff6b6b', '#ffd23f', '#3fb36b', '#9b6bd6', '#ff9f43'];
      c.fillStyle = '#3d7fc9'; c.fillRect(x + 0.2, y + 0.25, 1.6, 0.4);
      for (let k = 0; k < 5; k++) { c.fillStyle = cols[k]; c.beginPath(); c.moveTo(x + 0.25 + k * 0.3, y + 0.65); c.lineTo(x + 0.55 + k * 0.3, y + 0.65); c.lineTo(x + 0.4 + k * 0.3, y + 0.88); c.closePath(); c.fill(); }
    }
    c.fillStyle = '#fff6dc'; c.fillRect(x + 0.4, y + 1.0, 0.45, 0.35); c.fillRect(x + 1.15, y + 1.0, 0.45, 0.35);
    c.fillStyle = '#7a4e2d'; c.fillRect(x + 0.88, y + 1.25, 0.25, 0.45);
  }
}

function drawHouse(c, x, y) {
  const roof = ROOFS[Math.floor(hash(x, y, 5) * ROOFS.length)];
  const ox = x + 0.12 + hash(x, y, 6) * 0.06, oy = y + 0.1 + hash(x, y, 8) * 0.06;
  c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(ox + 0.06, oy + 0.12, 0.74, 0.7);
  c.fillStyle = '#fff4dc'; c.fillRect(ox, oy + 0.3, 0.72, 0.48);
  c.fillStyle = '#7a4e2d'; c.fillRect(ox + 0.29, oy + 0.52, 0.14, 0.26);
  c.fillStyle = '#8fd3ff'; c.fillRect(ox + 0.08, oy + 0.44, 0.14, 0.13); c.fillRect(ox + 0.5, oy + 0.44, 0.14, 0.13);
  c.fillStyle = roof; c.beginPath();
  c.moveTo(ox - 0.07, oy + 0.36); c.lineTo(ox + 0.1, oy + 0.02); c.lineTo(ox + 0.62, oy + 0.02); c.lineTo(ox + 0.79, oy + 0.36); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 0.04; c.beginPath(); c.moveTo(ox + 0.1, oy + 0.12); c.lineTo(ox + 0.62, oy + 0.12); c.stroke();
}

function drawTree(c, x, y) {
  const two = hash(x, y, 7) > 0.5, sn = seasonIx();
  const [dark, light] = PAL[sn].leaf || AUTUMN_LEAVES[Math.floor(hash(x, y, 9) * 3)];
  const trees = two ? [[-0.15, -0.12, 0.26], [0.17, 0.14, 0.27]] : [[0, 0, 0.34]];
  for (const [ox, oy, r] of trees) {
    const cx = x + 0.5 + ox, cy = y + 0.5 + oy;
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.arc(cx + 0.05, cy + 0.07, r, 0, 7); c.fill();
    c.fillStyle = dark; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    c.fillStyle = light; c.beginPath(); c.arc(cx - r * 0.28, cy - r * 0.28, r * 0.5, 0, 7); c.fill();
    if (sn === 0) for (let k = 0; k < 4; k++) { // spring blossom
      c.fillStyle = '#ffc2dc'; c.beginPath(); c.arc(cx + Math.cos(k * 1.9 + x) * r * 0.6, cy + Math.sin(k * 1.9 + y) * r * 0.6, 0.045, 0, 7); c.fill();
    }
  }
}

// Decorations. x, y is the tile's top-left corner; i (optional) lets fences join up with their neighbours.
function drawDeco(c, id, x, y, i) {
  const circle = (cx, cy, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); };
  const winter = G && seasonIx() === 3;
  if (id === 'flowers') {
    const cols = ['#ff6b8b', '#ffd43b', '#b197fc', '#ff922b', '#ffffff'];
    for (let k = 0; k < 6; k++) {
      const fx = x + 0.2 + ((k * 0.37 + 0.13) % 0.6), fy = y + 0.22 + ((k * 0.53 + 0.31) % 0.56);
      c.fillStyle = cols[(k + x + y) % cols.length];
      for (let p = 0; p < 5; p++) { c.beginPath(); c.arc(fx + Math.cos(p * 1.26) * 0.055, fy + Math.sin(p * 1.26) * 0.055, 0.045, 0, 7); c.fill(); }
      circle(fx, fy, 0.03, '#ffe066');
    }
  } else if (id === 'tree') {
    drawTree(c, x, y);
  } else if (id === 'fence') {
    const has = d => i !== undefined && (() => { const n = nb(i, d); return n >= 0 && G.deco[n] === DECO.fence; })();
    let dirs = [0, 1, 2, 3].filter(has);
    if (!dirs.length) dirs = [1, 3];
    c.strokeStyle = '#a0703f'; c.lineWidth = 0.06; c.lineCap = 'round'; c.beginPath();
    for (const d of dirs) for (const off of [-0.07, 0.07]) {
      const px = DY[d] ? off : 0, py = DX[d] ? off : 0;
      c.moveTo(x + 0.5 + px, y + 0.5 + py); c.lineTo(x + 0.5 + DX[d] * 0.5 + px, y + 0.5 + DY[d] * 0.5 + py);
    }
    c.stroke();
    circle(x + 0.5, y + 0.5, 0.09, '#7a4e2d');
    for (const d of dirs) circle(x + 0.5 + DX[d] * 0.38, y + 0.5 + DY[d] * 0.38, 0.06, '#7a4e2d');
    if (winter) circle(x + 0.5, y + 0.47, 0.06, '#ffffff');
  } else if (id === 'bench') {
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(x + 0.2, y + 0.42, 0.64, 0.3);
    c.fillStyle = '#5a5f6b'; c.fillRect(x + 0.22, y + 0.55, 0.06, 0.2); c.fillRect(x + 0.72, y + 0.55, 0.06, 0.2);
    rr(c, x + 0.16, y + 0.32, 0.68, 0.12, 0.04); c.fillStyle = '#b5783f'; c.fill();
    rr(c, x + 0.16, y + 0.48, 0.68, 0.14, 0.04); c.fillStyle = '#c98b4e'; c.fill();
    if (winter) { c.fillStyle = '#ffffff'; c.fillRect(x + 0.18, y + 0.48, 0.64, 0.05); }
  } else if (id === 'lamp') {
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.ellipse(x + 0.55, y + 0.82, 0.14, 0.06, 0, 0, 7); c.fill();
    c.fillStyle = '#3d4250'; c.fillRect(x + 0.47, y + 0.28, 0.06, 0.54);
    rr(c, x + 0.38, y + 0.76, 0.24, 0.08, 0.03); c.fill();
    rr(c, x + 0.38, y + 0.14, 0.24, 0.2, 0.06); c.fill();
    c.fillStyle = '#fff3a6'; c.fillRect(x + 0.42, y + 0.18, 0.16, 0.12);
  } else if (id === 'pond') {
    c.fillStyle = PAL[G ? seasonIx() : 0].sand; c.beginPath(); c.ellipse(x + 0.5, y + 0.52, 0.46, 0.36, 0, 0, 7); c.fill();
    c.fillStyle = PAL[G ? seasonIx() : 0].water; c.beginPath(); c.ellipse(x + 0.5, y + 0.52, 0.38, 0.28, 0, 0, 7); c.fill();
    c.strokeStyle = '#3f8f3f'; c.lineWidth = 0.035; c.beginPath();
    for (const k of [0, 1, 2]) { c.moveTo(x + 0.12 + k * 0.05, y + 0.45); c.lineTo(x + 0.1 + k * 0.06, y + 0.24); }
    c.stroke();
  } else if (id === 'windmill') {
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.arc(x + 0.55, y + 0.56, 0.32, 0, 7); c.fill();
    circle(x + 0.5, y + 0.5, 0.3, '#efe3c8');
    circle(x + 0.5, y + 0.5, 0.2, winter ? '#ffffff' : '#c0533a');
    c.fillStyle = '#7a4e2d'; c.fillRect(x + 0.45, y + 0.72, 0.1, 0.1);
  } else if (id === 'snowman') {
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.ellipse(x + 0.55, y + 0.86, 0.22, 0.07, 0, 0, 7); c.fill();
    circle(x + 0.5, y + 0.68, 0.2, '#ffffff'); circle(x + 0.5, y + 0.42, 0.14, '#ffffff'); circle(x + 0.5, y + 0.22, 0.11, '#ffffff');
    c.strokeStyle = '#c9d6e3'; c.lineWidth = 0.02;
    for (const [yy, r] of [[0.68, 0.2], [0.42, 0.14], [0.22, 0.11]]) { c.beginPath(); c.arc(x + 0.5, y + yy, r, 0, 7); c.stroke(); }
    circle(x + 0.46, y + 0.2, 0.018, '#333'); circle(x + 0.54, y + 0.2, 0.018, '#333');
    c.fillStyle = '#ff8c2b'; c.beginPath(); c.moveTo(x + 0.5, y + 0.23); c.lineTo(x + 0.64, y + 0.25); c.lineTo(x + 0.5, y + 0.26); c.fill();
    c.fillStyle = '#e8584f'; c.fillRect(x + 0.4, y + 0.31, 0.2, 0.04);
    c.fillStyle = '#333'; c.fillRect(x + 0.41, y + 0.04, 0.18, 0.1); c.fillRect(x + 0.36, y + 0.12, 0.28, 0.03);
  }
}
// Moving parts drawn every frame: windmill sails, swimming ducks.
function drawAnimDeco() {
  const now = performance.now() / 1000;
  for (const [id, x, y] of animDeco) {
    if (id === 'windmill') {
      ctx.save(); ctx.translate(x + 0.5, y + 0.5); ctx.rotate(now * 1.2 + x);
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#fffaf0'; ctx.fillRect(0.06, -0.06, 0.4, 0.12);
        ctx.strokeStyle = '#8a5a35'; ctx.lineWidth = 0.025; ctx.strokeRect(0.06, -0.06, 0.4, 0.12);
      }
      ctx.fillStyle = '#7a4e2d'; ctx.beginPath(); ctx.arc(0, 0, 0.06, 0, 7); ctx.fill();
      ctx.restore();
    } else if (id === 'pond' && seasonIx() !== 3) {
      for (let k = 0; k < 2; k++) {
        const a = now * 0.5 + k * Math.PI + x, dx = x + 0.5 + Math.cos(a) * 0.2, dy = y + 0.52 + Math.sin(a) * 0.12;
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(dx, dy, 0.08, 0.055, a + Math.PI / 2, 0, 7); ctx.fill();
        const hx = dx + Math.cos(a + Math.PI / 2) * 0.07, hy = dy + Math.sin(a + Math.PI / 2) * 0.07;
        ctx.fillStyle = '#2f8f45'; ctx.beginPath(); ctx.arc(hx, hy, 0.04, 0, 7); ctx.fill();
        ctx.fillStyle = '#ff9f1a'; ctx.beginPath(); ctx.arc(hx + Math.cos(a + Math.PI / 2) * 0.035, hy + Math.sin(a + Math.PI / 2) * 0.035, 0.018, 0, 7); ctx.fill();
      }
    }
  }
}

// ---------- rendering: per frame ----------
const worldMode = () => { const k = view.s * dpr; ctx.setTransform(k, 0, 0, k, view.ox * dpr, view.oy * dpr); };
const screenMode = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
const sx = x => view.ox + x * view.s, sy = y => view.oy + y * view.s;

function draw() {
  if (dirty || wantCacheK() !== cacheK) renderCache();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#6aa84f'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect((view.ox + 4) * dpr, (view.oy + 6) * dpr, W * view.s * dpr, H * view.s * dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cache, view.ox * dpr, view.oy * dpr, W * view.s * dpr, H * view.s * dpr);
  drawMini();
  emo = []; lights = [];
  worldMode();
  drawAnimDeco();
  drawGates();
  drawSignals();
  drawOverlay();
  for (const s of G.stations) {
    const types = Object.keys(s.cargo).filter(t => s.cargo[t] > 0).sort((a, b) => s.cargo[b] - s.cargo[a]).slice(0, 3);
    types.forEach((t, k) => emo.push([CARGO[t].e, s.x + 0.5 + (k - (types.length - 1) / 2) * 0.32, s.y - 0.12, 0.3]));
  }
  for (const car of cars) drawCar(car);
  for (const tr of G.trains) drawTrain(tr);
  for (const p of smoke) {
    const a = 1 - p.life / p.max;
    ctx.globalAlpha = a * 0.85; ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawWeather(false);
  drawNight(darkness());
  worldMode();
  drawWeather(true);
  screenMode();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [e, x, y, size] of emo) { ctx.font = `${Math.round(size * view.s)}px ${EMOJI_FONT}`; ctx.fillText(e, sx(x), sy(y)); }
  const fs = clamp(view.s * 0.42, 11, 18);
  for (const p of G.places) if (p.kind === 'town') pill(tn(p.name), sx(p.cx), sy(p.cy + 0.05), fs, 'rgba(255,250,235,0.92)', '#4a3426');
  if (hover && (tool === 'look' || tool === 'station' || tool === 'train')) {
    const sId = G.stn[hover.i], pId = G.occ[hover.i];
    const label = sId >= 0 ? `🚉 ${tn(stById(sId).name)}` : pId >= 0 && G.places[pId].kind !== 'town' ? tn(G.places[pId].name) : null;
    if (label) pill(label, sx(hover.x + 0.5), sy(hover.y - 0.45), fs, '#4a3426', '#ffffff');
  }
  const dc = draftCost();
  if (draft && dc > 0 && hover) pill(`${dc}🪙`, sx(hover.x + 0.5), sy(hover.y - 0.5), fs, dc > G.coins ? '#e74c3c' : '#4a3426', '#ffffff');
  for (const f of floaters) {
    const a = 1 - Math.max(0, f.t - f.max + 0.5) / 0.5;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.font = `800 ${Math.round(fs * 1.1)}px ${UI_FONT}`;
    const x = sx(f.x), y = sy(f.y) - f.t * view.s * 0.7;
    ctx.lineWidth = 4; ctx.strokeStyle = '#4a3426'; ctx.strokeText(f.text, x, y);
    ctx.fillStyle = f.col; ctx.fillText(f.text, x, y);
  }
  ctx.globalAlpha = 1;
  for (const c of confetti) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a); ctx.fillStyle = c.col; ctx.fillRect(-4, -2.5, 8, 5); ctx.restore();
  }
}

function pill(text, x, y, fs, bg, fg) {
  ctx.font = `700 ${Math.round(fs)}px ${UI_FONT}`;
  const w = ctx.measureText(text).width + fs, h = fs * 1.5;
  x = clamp(x, view.ox + w / 2, view.ox + W * view.s - w / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; rr(ctx, x - w / 2 + 2, y - h / 2 + 3, w, h, h / 2); ctx.fill();
  ctx.fillStyle = bg; rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = fg; ctx.fillText(text, x, y + 1);
}

function catchRect(x, y, fill, stroke) {
  ctx.fillStyle = fill; ctx.fillRect(x - CATCH, y - CATCH, CATCH * 2 + 1, CATCH * 2 + 1);
  ctx.strokeStyle = stroke; ctx.lineWidth = 0.06; ctx.setLineDash([0.2, 0.12]);
  ctx.strokeRect(x - CATCH, y - CATCH, CATCH * 2 + 1, CATCH * 2 + 1); ctx.setLineDash([]);
}
function outlinePlace(p, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 0.08;
  for (const i of p.tiles) ctx.strokeRect(tx(i) + 0.06, ty(i) + 0.06, 0.88, 0.88);
}

function drawOverlay() {
  const selSt = sel && sel.type === 'station' && stById(sel.id);
  if (selSt) { catchRect(selSt.x, selSt.y, 'rgba(255,230,100,0.18)', '#f2b632'); selSt.places.forEach(id => outlinePlace(G.places[id], '#ffffff')); }
  const selTr = sel && sel.type === 'train' && trById(sel.id);
  if (selTr) drawRoute(selTr.route, selTr.color, false);
  if (tool === 'train') drawRoute(routeDraft, '#ff7a59', true);
  if (tool === 'train') for (const s of G.stations) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.arc(s.x + 0.5, s.y + 0.5, 0.62 + Math.sin(performance.now() / 250) * 0.05, 0, 7); ctx.stroke();
  }
  const selBus = sel && sel.type === 'bus' && busById(sel.id), bc = selBus && busCar(selBus);
  if (bc) {
    ctx.strokeStyle = bc.col; ctx.lineWidth = 0.12; ctx.globalAlpha = 0.6; ctx.setLineDash([0.25, 0.18]); ctx.beginPath();
    bc.trail.forEach((p, k) => k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  if (tool === 'bus') {
    if (busDraft >= 0) outlinePlace(G.places[busDraft], '#ffd23f');
    const hp = hover && G.occ[hover.i] >= 0 && G.places[G.occ[hover.i]];
    if (hp && hp.kind === 'town') outlinePlace(hp, '#ffffff');
  }
  drawDraft();
  if (!hover) return;
  const { x, y, i } = hover;
  if (tool === 'deco') {
    const ok = decoOk(i);
    if (ok) { ctx.globalAlpha = 0.65; drawDeco(ctx, draftDeco, x, y); ctx.globalAlpha = 1; }
    ctx.strokeStyle = ok ? '#3fb36b' : '#e74c3c'; ctx.lineWidth = 0.08; ctx.strokeRect(x + 0.04, y + 0.04, 0.92, 0.92);
  } else if (tool === 'station') {
    const ok = (G.conn[i] === 5 || G.conn[i] === 10) && G.stn[i] < 0 && G.terr[i] !== WATER && G.terr[i] !== HILL && !G.road[i];
    catchRect(x, y, 'rgba(255,230,100,0.22)', '#f2b632');
    for (const p of G.places) if (p.tiles.some(t => Math.abs(tx(t) - x) <= CATCH && Math.abs(ty(t) - y) <= CATCH)) outlinePlace(p, '#ffffff');
    ctx.strokeStyle = ok ? '#3fb36b' : '#e74c3c'; ctx.lineWidth = 0.1; ctx.strokeRect(x + 0.05, y + 0.05, 0.9, 0.9);
  } else if ((tool === 'track' && !draft) || tool === 'remove') {
    ctx.fillStyle = tool === 'remove' ? 'rgba(231,76,60,0.3)' : 'rgba(255,255,255,0.3)';
    ctx.fillRect(x, y, 1, 1);
    ctx.strokeStyle = tool === 'remove' ? '#e74c3c' : '#ffffff'; ctx.lineWidth = 0.06; ctx.strokeRect(x + 0.03, y + 0.03, 0.94, 0.94);
  } else if (tool === 'train' && G.stn[i] >= 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, 1, 1);
  }
}

// Ghost rails for the track being dragged: white where affordable, red where the coins run out.
function drawDraft() {
  if (!draft) return;
  let sum = 0;
  const bad = new Set();
  draft.costs.forEach((c, k) => { sum += c; if (sum > G.coins) { bad.add(draft.tiles[k]); bad.add(draft.tiles[k + 1]); } });
  ctx.lineCap = 'round';
  for (const red of [false, true]) {
    ctx.strokeStyle = red ? 'rgba(231,76,60,0.9)' : 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.09; ctx.beginPath();
    for (const [i, m] of draft.pend) {
      const add = m & ~G.conn[i];
      if (!add || bad.has(i) !== red) continue;
      for (const [e, f] of tileSegs(m | G.conn[i])) {
        if (!((add >> e) & 1) && !(f >= 0 && (add >> f) & 1)) continue;
        railPath(ctx, tx(i), ty(i), e, f, -0.14); railPath(ctx, tx(i), ty(i), e, f, 0.14);
      }
    }
    ctx.stroke();
  }
  if (draft.block >= 0) {
    const x = tx(draft.block), y = ty(draft.block);
    ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 0.1; ctx.beginPath();
    ctx.moveTo(x + 0.25, y + 0.25); ctx.lineTo(x + 0.75, y + 0.75); ctx.moveTo(x + 0.75, y + 0.25); ctx.lineTo(x + 0.25, y + 0.75); ctx.stroke();
  }
}

// Level-crossing barriers: down with blinking lights while a train is close.
function drawGates() {
  const blink = Math.floor(performance.now() / 350) % 2;
  for (let i = 0; i < W * H; i++) {
    if (!G.road[i] || !G.conn[i]) continue;
    const down = gateDown(i);
    ctx.save(); ctx.translate(tx(i) + 0.5, ty(i) + 0.5); if (G.road[i] === 10) ctx.rotate(Math.PI / 2);
    for (const side of [-1, 1]) {
      const px = side * 0.36, py = side * 0.4;
      ctx.lineCap = 'round';
      if (down) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(-px * 0.95, py); ctx.stroke();
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 0.07; ctx.setLineDash([0.08, 0.08]); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(-px * 0.95, py); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.fillStyle = '#3d4250'; ctx.beginPath(); ctx.arc(px, py, 0.07, 0, 7); ctx.fill();
      ctx.fillStyle = down && (blink ^ (side > 0)) ? '#ff3b30' : '#6b2a2a'; ctx.beginPath(); ctx.arc(px, py, 0.04, 0, 7); ctx.fill();
      if (down) lights.push([tx(i) + 0.5, ty(i) + 0.5, 0.7, 0.4]);
    }
    ctx.restore();
  }
}

function carPose(car) {
  const p = posAt(car.trail, car.s), a = angAt(car.trail, car.s) + (car.dir < 0 ? Math.PI : 0);
  return { x: p.x - Math.sin(a) * 0.13, y: p.y + Math.cos(a) * 0.13, a }; // keep to the right
}
function drawCar(car) {
  const { x, y, a } = carPose(car);
  if (car.hop > 0) car.hop -= 1 / 60;
  const hop = car.hop > 0 ? Math.sin(car.hop * 12) * 0.06 : 0;
  ctx.save(); ctx.translate(x, y - Math.abs(hop)); ctx.rotate(a);
  if (car.bus) { drawBus(car); ctx.restore(); if (car.load) emo.push(['🧒', x, y - 0.3, 0.24]); lights.push([x + Math.cos(a) * 0.6, y + Math.sin(a) * 0.6, 0.7, 0.8]); return; }
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; rr(ctx, -0.15, -0.07, 0.34, 0.2, 0.06); ctx.fill();
  rr(ctx, -0.17, -0.1, 0.34, 0.2, 0.06); ctx.fillStyle = car.col; ctx.fill();
  ctx.strokeStyle = shade(car.col, -0.35); ctx.lineWidth = 0.025; ctx.stroke();
  rr(ctx, -0.08, -0.075, 0.15, 0.15, 0.04); ctx.fillStyle = shade(car.col, 0.35); ctx.fill();
  ctx.fillStyle = '#bfe6ff'; ctx.fillRect(0.06, -0.07, 0.04, 0.14);
  ctx.fillStyle = '#fff3a6'; ctx.fillRect(0.15, -0.08, 0.025, 0.04); ctx.fillRect(0.15, 0.04, 0.025, 0.04);
  ctx.restore();
  lights.push([x + Math.cos(a) * 0.45, y + Math.sin(a) * 0.45, 0.55, 0.7]);
}
// Drawn in the bus's own frame, facing +x.
function drawBus(car) {
  const col = car.col;
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; rr(ctx, -0.25, -0.09, 0.54, 0.24, 0.06); ctx.fill();
  rr(ctx, -0.28, -0.12, 0.56, 0.24, 0.06); ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = shade(col, -0.4); ctx.lineWidth = 0.025; ctx.stroke();
  ctx.fillStyle = '#ffffff'; rr(ctx, -0.24, -0.08, 0.4, 0.16, 0.04); ctx.fill(); // roof
  ctx.fillStyle = shade(col, -0.15);
  for (let k = 0; k < 4; k++) ctx.fillRect(-0.21 + k * 0.095, -0.06, 0.06, 0.12); // roof vents/seats
  ctx.fillStyle = '#bfe6ff'; ctx.fillRect(0.19, -0.1, 0.05, 0.2);
  ctx.fillStyle = '#fff3a6'; ctx.fillRect(0.26, -0.1, 0.025, 0.045); ctx.fillRect(0.26, 0.055, 0.025, 0.045);
  if (sel && sel.type === 'bus' && car.bus.id === sel.id) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(0, 0, 0.42, 0, 7); ctx.stroke();
  }
}

// Paint shop helpers. 'rainbow' is a special colour that isn't a hex value.
const solid = col => col === 'rainbow' ? '#e84393' : col;
function bodyFill(col, amt, w) {
  if (col !== 'rainbow') return shade(col, amt);
  const g = ctx.createLinearGradient(0, -w, 0, w);
  ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'].forEach((c, k) => g.addColorStop(k / 5, shade(c, amt)));
  return g;
}
// Pattern over a rounded body of half-width w and half-height h (local frame).
function drawPattern(pattern, w, h) {
  if (!pattern || pattern === 'plain') return;
  ctx.save(); rr(ctx, -w, -h, w * 2, h * 2, 0.06); ctx.clip();
  if (pattern === 'stripes') {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(-w, -h * 0.55, w * 2, h * 0.25); ctx.fillRect(-w, h * 0.3, w * 2, h * 0.25);
  } else if (pattern === 'spots') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [px, py] of [[-0.6, -0.5], [0.1, 0.45], [0.55, -0.4], [-0.25, 0.3]]) { ctx.beginPath(); ctx.arc(px * w, py * h, 0.04, 0, 7); ctx.fill(); }
  } else if (pattern === 'stars') {
    ctx.fillStyle = '#ffe066';
    for (const [px, py] of [[-0.5, -0.35], [0.4, 0.4], [0.3, -0.45]]) { starPath(px * w, py * h, 0.055); ctx.fill(); }
  }
  ctx.restore();
}
function starPath(x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr2 = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  ctx.closePath();
}
// A sticker face on the engine's front, kept upright so it always reads as a face.
function drawFace(face, x, y) {
  if (!face || face === 'none') return;
  const r = 0.13;
  ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#4a3426'; ctx.lineWidth = 0.02; ctx.stroke();
  ctx.fillStyle = '#4a3426';
  if (face === 'cool') {
    rr(ctx, x - 0.1, y - 0.055, 0.2, 0.06, 0.02); ctx.fill();
  } else {
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 0.045, y - 0.03, 0.02, 0, 7); ctx.fill(); }
  }
  ctx.beginPath();
  if (face === 'wow') { ctx.arc(x, y + 0.055, 0.03, 0, 7); ctx.fill(); }
  else { ctx.lineWidth = 0.02; ctx.arc(x, y + 0.02, 0.055, 0.2, Math.PI - 0.2); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,120,120,0.5)';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 0.085, y + 0.03, 0.022, 0, 7); ctx.fill(); }
}

function drawWeather(glow) {
  const f = darkness();
  for (const w of weather) {
    if ((w.kind === 'fly') !== glow) continue;
    if (w.kind === 'fly') {
      const a = f * (0.6 + 0.4 * Math.sin(w.t * 4));
      if (a < 0.02) continue;
      ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#fff59d'; ctx.beginPath(); ctx.arc(w.x, w.y, 0.18, 0, 7); ctx.fill();
      ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(w.x, w.y, 0.05, 0, 7); ctx.fill();
    } else if (w.kind === 'snow') {
      ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, 7); ctx.fill();
    } else {
      ctx.globalAlpha = 0.9; ctx.fillStyle = w.col; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.r, w.r * 0.5, w.a, 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// Night: a dark layer with holes cut out where lights shine, then a warm glow added on top.
const lc = document.createElement('canvas'), lctx = lc.getContext('2d');
function drawNight(f) {
  if (f < 0.01) return;
  for (const p of G.places) {
    if (p.kind === 'town') for (const i of p.tiles) lights.push([tx(i) + 0.5, ty(i) + 0.6, 0.9, 0.85]);
    else lights.push([p.x + 1, p.y + 1.1, 1.3, 0.6]);
  }
  for (const s of G.stations) lights.push([s.x + 0.5, s.y + 0.5, 1.2, 0.8]);
  for (const [id, x, y] of animDeco) if (id === 'lamp') lights.push([x + 0.5, y + 0.3, 2, 1]);
  if (lc.width !== cv.width || lc.height !== cv.height) { lc.width = cv.width; lc.height = cv.height; }
  const L = lctx, k = view.s * dpr;
  L.globalCompositeOperation = 'source-over'; L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, lc.width, lc.height);
  // dusk is a warm purple, deep night a soft navy
  L.fillStyle = `rgba(${Math.round(110 - 92 * f)},${Math.round(60 - 36 * f)},${Math.round(120 - 50 * f)},${NIGHT_DARK * f})`;
  L.fillRect(0, 0, lc.width, lc.height);
  L.setTransform(k, 0, 0, k, view.ox * dpr, view.oy * dpr);
  L.globalCompositeOperation = 'destination-out';
  for (const [x, y, r, a] of lights) {
    const g = L.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    L.fillStyle = g; L.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lc, 0, 0);
  worldMode(); ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, r, a] of lights) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.6);
    g.addColorStop(0, `rgba(255,190,90,${0.3 * f * a})`); g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawRoute(route, col, numbered) {
  const sts = route.map(stById).filter(Boolean);
  if (!sts.length) return;
  col = solid(col);
  ctx.strokeStyle = col; ctx.lineWidth = 0.1; ctx.setLineDash([0.25, 0.18]); ctx.globalAlpha = 0.85;
  ctx.beginPath();
  sts.forEach((s, k) => k ? ctx.lineTo(s.x + 0.5, s.y + 0.5) : ctx.moveTo(s.x + 0.5, s.y + 0.5));
  if (!numbered && sts.length > 2) ctx.closePath();
  ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  if (!numbered) return;
  sts.forEach((s, k) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s.x + 0.5, s.y - 0.35, 0.28, 0, 7); ctx.fill();
    emo.push([String(k + 1), s.x + 0.5, s.y - 0.33, 0.32]);
  });
}

function drawTrain(tr) {
  const T = tr.trail, eng = ENG[tr.eng], fade = G.adv && tr.ghost > 0 ? 0.45 : 1;
  const types = [];
  for (const l of tr.load) for (let k = 0; k < l.n; k++) types.push(l.type);
  for (let w = tr.wagons; w >= 1; w--) {
    const s = tr.d - 0.6 - (w - 1) * GAP, p = posAt(T, s), a = angAt(T, s), hid = inTunnel(p);
    ctx.globalAlpha = (hid ? 0.22 : 1) * fade;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; rr(ctx, -0.22, -0.13, 0.48, 0.36, 0.08); ctx.fill();
    ctx.fillStyle = '#333'; ctx.fillRect(0.2, -0.03, 0.12, 0.06);
    rr(ctx, -0.24, -0.18, 0.48, 0.36, 0.08); ctx.fillStyle = bodyFill(tr.color, 0.25, 0.18); ctx.fill();
    ctx.strokeStyle = shade(solid(tr.color), -0.35); ctx.lineWidth = 0.035; ctx.stroke();
    rr(ctx, -0.18, -0.12, 0.36, 0.24, 0.05); ctx.fillStyle = '#fff8e8'; ctx.fill();
    ctx.restore();
    const t = types[(w - 1) * WAGON_CAP];
    if (t && !hid) emo.push([CARGO[t].e, p.x, p.y, 0.26]);
  }
  const p = posAt(T, tr.d), a = angAt(T, tr.d), hid = inTunnel(p);
  ctx.globalAlpha = (hid ? 0.22 : 1) * fade;
  if (!hid) lights.push([p.x + Math.cos(a) * 0.8, p.y + Math.sin(a) * 0.8, 1.1, 0.9], [p.x, p.y, 0.6, 0.5]);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; rr(ctx, -0.29, -0.15, 0.64, 0.42, 0.1); ctx.fill();
  const col = solid(tr.color);
  rr(ctx, -0.32, -0.21, 0.64, 0.42, 0.12); ctx.fillStyle = bodyFill(tr.color, 0, 0.21); ctx.fill();
  ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 0.035; ctx.stroke();
  drawPattern(tr.pattern, 0.32, 0.21);
  if (eng.stripe) { ctx.fillStyle = eng.stripe; ctx.fillRect(-0.08, -0.04, 0.36, 0.08); }
  ctx.fillStyle = shade(col, -0.3); ctx.fillRect(0.0, -0.21, 0.035, 0.42);
  rr(ctx, -0.34, -0.23, 0.24, 0.46, 0.06); ctx.fillStyle = bodyFill(tr.color, -0.25, 0.23); ctx.fill();
  ctx.fillStyle = '#bfe6ff'; ctx.fillRect(-0.29, -0.14, 0.14, 0.28);
  ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0.16, 0, 0.085, 0, 7); ctx.fill();
  ctx.fillStyle = '#666'; ctx.beginPath(); ctx.arc(0.16, 0, 0.045, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(0.31, 0, 0.055, 0, 7); ctx.fill();
  ctx.restore();
  if (!hid) drawFace(tr.face, p.x + Math.cos(a) * 0.24, p.y + Math.sin(a) * 0.24);
  ctx.globalAlpha = 1;
  if (sel && sel.type === 'train' && sel.id === tr.id) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, 0.5, 0, 7); ctx.stroke();
  }
  if (tr.state === 'lost') emo.push(['❓', p.x, p.y - 0.5, 0.4]);
}

// ---------- UI ----------
let toastTimer = 0;
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}

function setTool(name) {
  tool = name; draft = null; busDraft = -1;
  if (name !== 'train') routeDraft = [];
  document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === name));
  if (name === 'train' && G.stations.length < 2) toast(t('You need two stations first! 🚉🚉'));
  updateUI(true);
}

function hintText() {
  if (tool === 'train') {
    if (!routeDraft.length) return t('Click the station where your train should start.');
    if (routeDraft.length < 2) return t('Now click another station for your train to visit!');
    return t('Add more stops if you like, then press Go! 🚂');
  }
  if (tool === 'station') return t('Click a straight piece of track. The station picks up from everything in the yellow square.');
  if (tool === 'signal') return t('Click a straight piece of track for a 🚦 signal. Trains wait at a red signal until the track ahead is clear. Click it again to take it away.');
  if (G.adv && G.trains.some(tr => tr.sigWait > 20)) return t('🚦 Some trains are stuck waiting. Try a passing loop, or click the train and press ✨ Rescue.');
  if (tool === 'remove') return t('Click things to tidy them away. You get some coins back!');
  if (tool === 'deco') return t('Pick something pretty, then click on the grass. Drag to plant lots! 🌷');
  if (tool === 'bus') return t(busDraft < 0 ? 'Click a town to start a bus route. Buses drive on the roads 🚌' : 'Now click another town joined to it by a road!');
  let track = 0;
  for (let i = 0; i < W * H; i++) if (G.conn[i]) { track++; break; }
  if (tool === 'track' && track) return t('Drag to draw rails, then let go to build them. Rails can cross roads 🚗 and go through hills ⛰️ in tunnels.');
  if (!track) return t("Hi! I'm Conductor Bea. Pick 🛤️ Track and drag on the map to lay rails from a town to somewhere else!");
  if (G.stations.length < 2) return t('Lovely rails! Now pick 🚉 Station and put a station on the track near each end.');
  if (!G.trains.length) return t('Choo choo! Pick 🚂 Train, click your stations, then press Go!');
  if (G.trains.some(tr => tr.state === 'lost')) return t("A train with ❓ can't find a way. Check that the track joins up!");
  return t(TIPS[Math.floor(G.time / 14) % TIPS.length]);
}

const cargoList = obj => Object.keys(obj).filter(k => obj[k] > 0).map(k => `${CARGO[k].e} ${obj[k]}`).join(' &nbsp;') || '';
const emojis = list => list.map(k => CARGO[k].e).join(' ');

function panelHTML() {
  if (!sel) return '';
  const close = '<button class="x" data-act="close">✕</button>';
  if (sel.type === 'train') {
    const tr = trById(sel.id); if (!tr) return '';
    const eng = ENG[tr.eng], tot = {};
    for (const l of tr.load) tot[l.type] = (tot[l.type] || 0) + l.n;
    const route = tr.route.map(id => { const s = stById(id); return `<span class="${id === tr.target ? 'cur' : ''}">${s ? tn(s.name) : '?'}</span>`; }).join(' → ');
    const status = t(tr.state === 'lost' ? '❓ Looking for a way…' : tr.state === 'run' ? (tr.sigWait > 0.5 ? '🚦 Waiting at a signal' : '🚂 Chugging along') : '⏳ Loading at the station');
    const sure = armed === 'sell' + tr.id;
    const head = renaming
      ? `<input id="rename" maxlength="${NAME_MAX}" value="${esc(tn(tr.name))}" aria-label="${t('Train name')}"><button data-act="nameok" title="${t('Save name')}">✔</button>`
      : `${esc(tn(tr.name))} <button class="pen" data-act="rename" title="${t('Rename')}">✏️</button> <small>${tn(eng.name)}</small>`;
    return `<div class="ph"><span class="sw" style="background:${paintCss(tr.color)}"></span>${head}${close}</div>
      <div class="row">${status}</div>
      <div class="row"><b>${t('Route:')}</b> ${route}</div>
      <div class="row"><b>${t('Carrying:')}</b> ${cargoList(tot) || t('nothing yet')} <small>(${loaded(tr)}/${capacity(tr)})</small></div>
      <div class="row"><b>${t('Wagons:')}</b> ${'🚃'.repeat(tr.wagons)}</div>
      <div class="row"><b>${t('Earned:')}</b> 🪙 ${tr.earned}${trainRun(tr) ? ` <small>· ${t('costs {n}🪙 a minute to run', { n: trainRun(tr) })}</small>` : ''}</div>
      <div class="btns"><button data-act="addw">${t('➕ Wagon')} ${price(COST.wagon)}🪙</button><button data-act="remw">${t('➖ Wagon')}</button>
      <button data-act="paint" class="${paintOpen ? 'armed' : ''}">${t('🎨 Paint')}</button>
      <button data-act="sell" class="${sure ? 'armed' : ''}">${t(sure ? 'Sure? 💰' : '💰 Sell')}</button>${G.adv && tr.sigWait > 6 ? `<button data-act="rescue">${t('✨ Rescue')}</button>` : ''}</div>
      ${paintOpen ? paintHTML(tr) : ''}`;
  }
  if (sel.type === 'bus') {
    const rec = busById(sel.id); if (!rec) return '';
    const car = busCar(rec), load = car ? car.load : 0, sure = armed === 'sellbus' + rec.id;
    return `<div class="ph"><span class="sw" style="background:${rec.col}"></span>🚌 ${busName(rec)}${close}</div>
      <div class="row">${t(car && car.wait <= 0 ? '🚌 Driving' : '🧒 At the bus stop')}</div>
      <div class="row"><b>${t('Route:')}</b> ${tn(G.places[rec.a].name)} ⇄ ${tn(G.places[rec.b].name)}</div>
      <div class="row"><b>${t('Carrying:')}</b> ${load ? `🧒 ${load}` : t('nothing yet')} <small>(${load}/${BUS_CAP})</small></div>
      <div class="row"><b>${t('Earned:')}</b> 🪙 ${rec.earned}${busRun() ? ` <small>· ${t('costs {n}🪙 a minute to run', { n: busRun() })}</small>` : ''}</div>
      <div class="btns"><button data-act="sellbus" class="${sure ? 'armed' : ''}">${t(sure ? 'Sure? 💰' : '💰 Sell')}</button></div>`;
  }
  if (sel.type === 'station') {
    const s = stById(sel.id); if (!s) return '';
    const near = s.places.map(id => tn(G.places[id].name)).join(', ') || t('nothing nearby');
    const visits = G.trains.filter(tr => tr.route.includes(s.id)).map(tr => esc(tn(tr.name))).join(', ') || t('no trains yet');
    return `<div class="ph">🚉 ${tn(s.name)}${close}</div>
      <div class="row"><b>${t('Waiting:')}</b> ${cargoList(s.cargo) || t('nothing')}</div>
      <div class="row"><b>${t('Sends:')}</b> ${emojis([...supplies(s)]) || '—'}</div>
      <div class="row"><b>${t('Wants:')}</b> ${emojis([...accepts(s)]) || '—'}</div>
      <div class="row"><b>${t('Near:')}</b> ${near}</div>
      <div class="row"><b>${t('Trains:')}</b> ${visits}</div>`;
  }
  if (sel.type === 'place') {
    const p = G.places[sel.id], k = KINDS[p.kind];
    let html = `<div class="ph">${k.e} ${tn(p.name)} <small>${t(k.label)}</small>${close}</div>`;
    if (k.produces.length) html += `<div class="row"><b>${t('Makes:')}</b> ${emojis(k.produces)}</div>`;
    if (k.makes) html += `<div class="row">${t('<b>Turns</b> {a} <b>into</b> {b}', { a: emojis(k.accepts), b: `${CARGO[k.makes].e} ${cname(k.makes)}` })}</div>`;
    else if (k.accepts.length) html += `<div class="row"><b>${t('Wants:')}</b> ${emojis(k.accepts)}</div>`;
    if (p.kind === 'town') {
      html += `<div class="row"><b>${t('Houses:')}</b> ${p.tiles.length} 🏠</div><div class="row">${t('Growing…')} <div class="bar"><i style="width:${Math.round(clamp(p.growth / growNeed(p), 0, 1) * 100)}%"></i></div></div>`;
    }
    if (!G.stations.some(s => s.places.includes(p.id))) html += `<div class="row">${t('💡 Build a station nearby to connect it!')}</div>`;
    return html;
  }
  return '';
}

const paintCss = c => c === 'rainbow' ? 'linear-gradient(90deg,#ff6b6b,#ffd43b,#69db7c,#4dabf7,#b197fc)' : c;
function paintHTML(tr) {
  const btn = (act, inner, stars, on) => G.stars < stars
    ? `<button disabled title="${t('Unlocks at {n} ⭐', { n: stars })}">🔒${stars}⭐</button>`
    : `<button data-act="${act}" class="${on ? 'on' : ''}">${inner}</button>`;
  const cols = PAINT_COLORS.map(p => btn('col:' + p.c, `<span class="sw" style="background:${paintCss(p.c)}"></span>`, p.stars, tr.color === p.c)).join('');
  const pats = PATTERNS.map(p => btn('pat:' + p.id, t(p.name), p.stars, (tr.pattern || 'plain') === p.id)).join('');
  const faces = FACES.map(f => btn('face:' + f.id, f.e, f.stars, (tr.face || 'none') === f.id)).join('');
  return `<div class="row"><b>${t('Colour')}</b></div><div class="pal">${cols}</div>
    <div class="row"><b>${t('Pattern')}</b></div><div class="pal">${pats}</div>
    <div class="row"><b>${t('Face')}</b></div><div class="pal">${faces}</div>`;
}

function routeBarHTML() {
  const names = routeDraft.map(id => stById(id)).filter(Boolean).map(s => `<span>🚉 ${tn(s.name)}</span>`);
  const eng = ENGINES.map((e, n) => {
    const locked = G.stars < e.stars;
    const info = locked ? t('needs {n} ⭐', { n: e.stars }) : `${price(e.cost)}🪙 · ${'⚡'.repeat(n + 1)} · ${t('{n} wagons', { n: e.wagons })}`;
    return `<button data-eng="${e.id}" class="${e.id === draftEngine ? 'on' : ''}" ${locked ? 'disabled' : ''}>${locked ? '🔒' : '🚂'} ${tn(e.name)}<small>${info}</small></button>`;
  }).join('');
  return `<div class="rt">${names.length ? names.join('<em>→</em>') : `<span class="dim">${t('Click stations on the map…')}</span>`}</div>
    <div class="eng">${eng}</div>
    <div class="go"><button data-act="go" ${routeDraft.length < 2 ? 'disabled' : ''}>${t('Go! 🚂')}</button><button data-act="undo" title="${t('Undo last stop')}">↩</button><button data-act="cancel" title="${t('Cancel')}">✕</button></div>`;
}

function decoBarHTML() {
  return `<div class="eng">${DECOS.map(d => `<button data-deco="${d.id}" class="${d.id === draftDeco ? 'on' : ''}"><canvas data-prev="${d.id}"></canvas>${t(d.name)}<small>${d.cost}🪙${d.id === 'snowman' ? ' ❄️' : ''}</small></button>`).join('')}</div>`;
}
function drawDecoPreviews() {
  document.querySelectorAll('#decobar canvas').forEach(cvs => {
    const px = 34, k = px * dpr, c = cvs.getContext('2d');
    cvs.width = k; cvs.height = k; cvs.style.width = cvs.style.height = px + 'px';
    c.setTransform(k, 0, 0, k, 0, 0);
    c.fillStyle = PAL[seasonIx()].g[0]; rr(c, 0, 0, 1, 1, 0.2); c.fill();
    drawDeco(c, cvs.dataset.prev, 0, 0);
    if (cvs.dataset.prev === 'windmill') {
      c.fillStyle = '#fffaf0'; c.strokeStyle = '#8a5a35'; c.lineWidth = 0.025;
      for (let a = 0.4; a < 6.6; a += Math.PI / 2) { c.save(); c.translate(0.5, 0.5); c.rotate(a); c.fillRect(0.06, -0.06, 0.4, 0.12); c.strokeRect(0.06, -0.06, 0.4, 0.12); c.restore(); }
    }
  });
}

// Static page text is marked with data-i18n / data-i18n-title in index.html.
function applyLang() {
  document.documentElement.lang = lang;
  document.title = t('Puffwhistle Valley');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.dataset.en = el.dataset.en || el.textContent; el.textContent = t(el.dataset.en); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  $('lang').textContent = lang === 'sv' ? '🌐 English' : '🌐 Svenska';
}
function setLang(l) {
  lang = l;
  try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* not remembered */ }
  applyLang(); updateUI(true);
}

const uiCache = {};
function setHTML(id, html) { if (uiCache[id] === html) return false; uiCache[id] = html; $(id).innerHTML = html; return true; }
function updateUI(force) {
  if (force) for (const k in uiCache) delete uiCache[k];
  $('coins').textContent = `🪙 ${G.coins}`;
  $('coins').classList.toggle('debt', G.coins < 0);
  const run = D().run ? G.trains.reduce((a, tr) => a + trainRun(tr), 0) + G.buses.length * busRun() : 0;
  $('coins').title = run ? t('Running costs: {n}🪙 a minute', { n: run }) : '';
  for (const el of document.querySelectorAll('[data-price]')) el.textContent = `${price(el.dataset.price === 'bus' ? COST_BUS : el.dataset.price === 'train' ? ENGINES[0].cost : COST[el.dataset.price])}🪙`;
  $('diffchip').textContent = D().e + (G.adv ? '🚦' : ''); $('diffchip').title = t(D().name) + (G.adv ? ' · ' + t('🚦 Signals & crashes') : '');
  $('sigtool').hidden = !G.adv;
  $('stars').textContent = `⭐ ${G.stars}`;
  $('hinttext').textContent = hintText();
  setHTML('quests', goalCard() + G.quests.map(q => {
    const pr = clamp(questProg(q), 0, q.n);
    return `<div class="q"><div class="t" title="${questText(q)}">${questText(q)}</div><div class="bar"><i style="width:${pr / q.n * 100}%"></i></div><small>${t('{p} / {n} · reward ⭐ + {r}🪙', { p: pr, n: q.n, r: q.reward })}</small></div>`;
  }).join(''));
  const ph = panelHTML();
  // keep the name box alive while typing
  if (!(renaming && document.activeElement && document.activeElement.id === 'rename')) { $('panel').hidden = !ph; setHTML('panel', ph); }
  $('routebar').hidden = tool !== 'train';
  if (tool === 'train') setHTML('routebar', routeBarHTML());
  $('decobar').hidden = tool !== 'deco';
  if (tool === 'deco' && setHTML('decobar', `${decoBarHTML()}<!--${seasonIx()}-->`)) drawDecoPreviews();
  const S = season();
  $('season').textContent = `${S.e} ${t(S.name)} · ${CARGO[S.bonus].e}×2 ${dayIcon()}`;
  $('season').title = t(S.msg);
  $('undo').classList.toggle('dim', !undoStack.length && !draft);
  document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.speed === speed));
  $('sound').textContent = muted ? '🔇' : '🔊';
  $('music').classList.toggle('off', !musicOn);
  $('newmap').textContent = t('🗺️ New map');
}

function arm(key) { armed = key; setTimeout(() => { if (armed === key) { armed = null; updateUI(true); } }, 3000); }

function renameTrain(tr, name) {
  renaming = false;
  name = String(name || '').replace(/s+/g, ' ').trim().slice(0, NAME_MAX);
  if (name && name !== tn(tr.name)) { tr.name = name; sfx('pop'); }
  updateUI(true);
}

function panelAct(act) {
  const tr = sel && sel.type === 'train' && trById(sel.id);
  if (act === 'close') sel = null;
  else if (tr && act === 'addw') {
    if (tr.wagons >= MAX_WAGONS) toast(t("{name} can't pull any more wagons!", { name: tn(tr.name) }));
    else if (G.coins < price(COST.wagon)) fail('Not enough coins 🪙');
    else { G.coins -= price(COST.wagon); tr.wagons++; sfx('pop'); }
  } else if (tr && act === 'remw') {
    if (tr.wagons <= 1) toast(t('Every train needs at least one wagon!'));
    else {
      tr.wagons--; G.coins += Math.floor(price(COST.wagon) / 2); sfx('build');
      let over = loaded(tr) - capacity(tr);
      for (let k = tr.load.length - 1; k >= 0 && over > 0; k--) { const m = Math.min(over, tr.load[k].n); tr.load[k].n -= m; over -= m; }
      tr.load = tr.load.filter(l => l.n > 0);
    }
  } else if (tr && act === 'sell') {
    if (armed === 'sell' + tr.id) { armed = null; sellTrain(tr); sfx('coin'); }
    else arm('sell' + tr.id);
  } else if (tr && act === 'rescue') rescueTrain(tr);
  else if (tr && act === 'paint') paintOpen = !paintOpen;
  else if (tr && act === 'rename') { renaming = true; updateUI(true); const i = $('rename'); i.focus(); i.select(); return; }
  else if (tr && act === 'nameok') { renameTrain(tr, $('rename').value); return; }
  else if (tr && /^(col|pat|face):/.test(act)) {
    const [k, v] = [act.slice(0, act.indexOf(':')), act.slice(act.indexOf(':') + 1)];
    const opt = k === 'col' ? PAINT_COLORS.find(p => p.c === v) : k === 'pat' ? PATTERNS.find(p => p.id === v) : FACES.find(f => f.id === v);
    if (opt && G.stars >= opt.stars) {
      if (k === 'col') tr.color = v; else if (k === 'pat') tr.pattern = v; else tr.face = v;
      const p = posAt(tr.trail, tr.d); puff(p.x, p.y, 8, solid(tr.color)); sfx('pop');
    }
  } else if (sel && sel.type === 'bus' && act === 'sellbus') {
    const rec = busById(sel.id);
    if (rec && armed === 'sellbus' + rec.id) { armed = null; sellBus(rec); sfx('coin'); }
    else if (rec) arm('sellbus' + rec.id);
  }
  updateUI(true);
}

function routeAct(act, engId) {
  if (engId) { draftEngine = engId; sfx('pop'); }
  else if (act === 'go') {
    if (routeDraft.length >= 2 && buyTrain(routeDraft, draftEngine)) { routeDraft = []; setTool('look'); return; }
  } else if (act === 'undo') routeDraft.pop();
  else if (act === 'cancel') { setTool('look'); return; }
  updateUI(true);
}

// ---------- input ----------
function worldAt(e) { return { x: (e.clientX - view.ox) / view.s, y: (e.clientY - view.oy) / view.s }; }
function tileAt(w) { const x = Math.floor(w.x), y = Math.floor(w.y); return inB(x, y) ? { x, y, i: idx(x, y) } : null; }

// Look tool: select things, and make them honk. Trains toot, cars and buses beep, ducks quack.
function pick(w, tile) {
  let best = null, bd = 0.5, car = null, cd = 0.4;
  for (const tr of G.trains) for (let k = 0; k <= tr.wagons; k++) {
    const p = posAt(tr.trail, tr.d - (k ? 0.6 + (k - 1) * GAP : 0)), d = Math.hypot(p.x - w.x, p.y - w.y);
    if (d < bd) { bd = d; best = tr; }
  }
  for (const c of cars) { const p = carPose(c), d = Math.hypot(p.x - w.x, p.y - w.y); if (d < cd) { cd = d; car = c; } }
  const prev = sel && sel.type + sel.id;
  if (best) {
    sel = { type: 'train', id: best.id };
    const p = posAt(best.trail, best.d);
    sfx('honk'); puff(p.x, p.y, 10, '#ffffff'); floater(p.x, p.y - 0.4, t('Toot toot!'), '#ffffff');
  } else if (car) {
    sel = car.bus ? { type: 'bus', id: car.bus.id } : null;
    const p = carPose(car);
    car.hop = 0.5; sfx('beep'); floater(p.x, p.y - 0.3, t('Beep beep!'), '#ffffff');
  } else if (tile && G.deco[tile.i] === DECO.pond && seasonIx() !== 3) {
    sel = null; sfx('quack'); floater(tile.x + 0.5, tile.y + 0.2, t('Quack!'), '#ffffff');
  } else {
    if (tile && G.stn[tile.i] >= 0) sel = { type: 'station', id: G.stn[tile.i] };
    else if (tile && G.occ[tile.i] >= 0) sel = { type: 'place', id: G.occ[tile.i] };
    else sel = null;
    if (sel) sfx('pop');
  }
  if (!sel || sel.type + sel.id !== prev) paintOpen = renaming = false;
  updateUI(true);
}

function busToolClick(tile) {
  const pid = G.occ[tile.i];
  if (pid < 0 || G.places[pid].kind !== 'town') { toast(t('Click on a town! 🏘️')); return; }
  if (busDraft < 0 || busDraft === pid) { busDraft = pid; sfx('pop'); }
  else if (buyBus(busDraft, pid)) { busDraft = -1; setTool('look'); return; }
  updateUI(true);
}

function trainToolClick(tile) {
  const id = G.stn[tile.i];
  if (id < 0) { toast(t('Click on a station! 🚉')); return; }
  if (routeDraft.includes(id)) { toast(t('That station is already on the route.')); return; }
  routeDraft.push(id); sfx('pop'); updateUI(true);
}

// ---------- view: zoom and pan ----------
// The map sits between the top and bottom bars. Fully zoomed out shows the whole valley.
const viewArea = { top: 0, bot: 0 };
const fitScale = () => Math.min((innerWidth - 16) / W, Math.max(100, innerHeight - viewArea.top - viewArea.bot) / H);
const minScale = () => Math.min(fitScale(), MAX_S);
function clampView() {
  view.s = clamp(view.s, minScale(), MAX_S);
  const mw = W * view.s, mh = H * view.s, top = viewArea.top, bot = innerHeight - viewArea.bot, m = 60;
  view.ox = mw <= innerWidth ? (innerWidth - mw) / 2 : clamp(view.ox, innerWidth - mw - m, m);
  view.oy = mh <= bot - top ? top + (bot - top - mh) / 2 : clamp(view.oy, bot - mh - m, top + m);
}
// Zoom so the world point under screen point (x, y) stays put.
function zoomAt(x, y, s) {
  const wx = (x - view.ox) / view.s, wy = (y - view.oy) / view.s;
  view.s = clamp(s, minScale(), MAX_S);
  view.ox = x - wx * view.s; view.oy = y - wy * view.s;
  clampView();
}
function centerOn(wx, wy) {
  view.ox = innerWidth / 2 - wx * view.s;
  view.oy = (viewArea.top + innerHeight - viewArea.bot) / 2 - wy * view.s;
  clampView();
}
const screenMid = () => [innerWidth / 2, (viewArea.top + innerHeight - viewArea.bot) / 2];
// A new map starts zoomed in on a town, at a size small hands can tap.
function startView() {
  view.s = clamp(34, minScale(), MAX_S);
  const town = G.places.find(p => p.kind === 'town');
  if (town) centerOn(town.cx, town.cy); else centerOn(W / 2, H / 2);
  view.init = true;
}

const ptrs = new Map();
let pan = null, pinch = null, pinchDone = false;
function startPinch() {
  const [a, b] = [...ptrs.values()];
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: view.s, wx: (mx - view.ox) / view.s, wy: (my - view.oy) / view.s };
  // a second finger cancels whatever the first one started
  if (draft) draft = null;
  down = false; lastTile = null; pan = null; endAct();
}
cv.addEventListener('pointerdown', e => {
  audio();
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  cv.setPointerCapture(e.pointerId);
  if (ptrs.size === 2) { startPinch(); return; }
  if (ptrs.size > 2 || pinchDone) return;
  // middle or right drag pans in any tool; with 👆 Look a plain drag pans too
  if (e.button === 1 || e.button === 2 || tool === 'look') {
    pan = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy, moved: false, btn: e.button };
    return;
  }
  const w = worldAt(e), tile = tileAt(w);
  down = true;
  if (!tile) return;
  beginAct();
  if (tool === 'track') draftStart(tile.i);
  else if (tool === 'remove') { removeTile(tile.i); lastTile = tile.i; }
  else if (tool === 'deco') { placeDeco(tile.i, draftDeco); lastTile = tile.i; }
  else if (tool === 'station') buildStation(tile.i);
  else if (tool === 'train') trainToolClick(tile);
  else if (tool === 'bus') busToolClick(tile);
  else if (tool === 'signal' && G.adv) toggleSignal(tile.i);
  updateUI();
});
cv.addEventListener('pointermove', e => {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  hoverW = worldAt(e); hover = tileAt(hoverW);
  if (pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    view.s = clamp(pinch.s0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0, minScale(), MAX_S);
    view.ox = mx - pinch.wx * view.s; view.oy = my - pinch.wy * view.s;
    clampView(); return;
  }
  if (pan) {
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) > 6) pan.moved = true;
    if (pan.moved) { view.ox = pan.ox + dx; view.oy = pan.oy + dy; clampView(); }
    return;
  }
  if (!down || !hover) return;
  if (tool === 'track' && draft) draftTo(hover.i);
  else if (tool === 'remove' && hover.i !== lastTile) { removeTile(hover.i); lastTile = hover.i; }
  else if (tool === 'deco' && hover.i !== lastTile) { placeDeco(hover.i, draftDeco, true); lastTile = hover.i; }
});
const up = e => {
  ptrs.delete(e.pointerId);
  if (pinch) { if (ptrs.size < 2) { pinch = null; pinchDone = ptrs.size > 0; } return; }
  if (pinchDone) { pinchDone = ptrs.size > 0; return; } // ignore the last finger left over from a pinch
  if (pan) {
    const p = pan; pan = null;
    if (p.moved || e.type === 'pointercancel') return;
    // a click, not a drag
    if (p.btn === 2) { if (draft) draft = null; else setTool('look'); }
    else if (p.btn === 0 && tool === 'look') { const w = worldAt(e); pick(w, tileAt(w)); }
    return;
  }
  if (down && tool === 'track') draftCommit();
  down = false; lastTile = null;
  endAct(); updateUI();
};
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);
cv.addEventListener('pointerleave', () => { hover = null; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, view.s * Math.pow(1.0018, -e.deltaY * (e.deltaMode === 1 ? 30 : 1)));
}, { passive: false });
// minimap: click or drag to jump there
mini.addEventListener('pointerdown', e => {
  mini.setPointerCapture(e.pointerId); mini.dragging = true;
  const r = mini.getBoundingClientRect(); centerOn((e.clientX - r.left) / miniPx, (e.clientY - r.top) / miniPx);
});
mini.addEventListener('pointermove', e => {
  if (!mini.dragging) return;
  const r = mini.getBoundingClientRect(); centerOn((e.clientX - r.left) / miniPx, (e.clientY - r.top) / miniPx);
});
mini.addEventListener('pointerup', () => { mini.dragging = false; });
$('zoombar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const [mx, my] = screenMid();
  if (b.dataset.z === 'in') zoomAt(mx, my, view.s * 1.4);
  else if (b.dataset.z === 'out') zoomAt(mx, my, view.s / 1.4);
  else { view.s = minScale(); clampView(); }
});

$('tools').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  audio();
  if (b.id === 'undo') undo(); else { setTool(b.dataset.tool); sfx('build'); }
});
$('decobar').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { draftDeco = b.dataset.deco; sfx('pop'); updateUI(true); } });
$('music').addEventListener('click', () => {
  musicOn = !musicOn; audio();
  try { localStorage.setItem(MUSIC_KEY, musicOn ? 'on' : 'off'); } catch (e) { /* not remembered */ }
  updateUI();
});
$('panel').addEventListener('keydown', e => {
  if (e.target.id !== 'rename') return;
  const tr = sel && sel.type === 'train' && trById(sel.id);
  if (e.key === 'Enter' && tr) renameTrain(tr, e.target.value);
  else if (e.key === 'Escape') { renaming = false; updateUI(true); }
  e.stopPropagation();
});
$('panel').addEventListener('focusout', e => {
  if (e.target.id !== 'rename' || !renaming) return;
  if (e.relatedTarget && e.relatedTarget.dataset && e.relatedTarget.dataset.act === 'nameok') return;
  const tr = sel && sel.type === 'train' && trById(sel.id);
  if (tr) renameTrain(tr, e.target.value); else renaming = false;
});
$('panel').addEventListener('click', e => { const b = e.target.closest('button'); if (b) panelAct(b.dataset.act); });
$('routebar').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) routeAct(b.dataset.act, b.dataset.eng); });
$('speed').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { speed = +b.dataset.speed; updateUI(); } });
$('sound').addEventListener('click', () => { muted = !muted; audio(); updateUI(); });
// ---------- valley picker and scenario goals ----------
function loadBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch (e) { return {}; } }
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const starStr = n => '⭐'.repeat(n) + '☆'.repeat(3 - n);
let mapSize = (() => { try { return SIZES[localStorage.getItem(SIZE_KEY)] ? localStorage.getItem(SIZE_KEY) : 'big'; } catch (e) { return 'big'; } })();
let mapAdv = (() => { try { return localStorage.getItem(ADV_KEY) === '1'; } catch (e) { return false; } })();
let mapDiff = (() => { try { return DIFFS[localStorage.getItem(DIFF_KEY)] ? localStorage.getItem(DIFF_KEY) : 'easy'; } catch (e) { return 'easy'; } })();
function openMaps() {
  const best = loadBest();
  $('mapsizes').innerHTML = Object.entries(SIZES).map(([id, z]) => {
    const S = sized(SCENARIOS.free, id);
    return `<button data-size="${id}" class="${id === mapSize ? 'on' : ''}"><span>${z.e}</span> ${t(z.name)} <small>${S.w}×${S.h}</small></button>`;
  }).join('');
  $('mapdiffs').innerHTML = Object.entries(DIFFS).map(([id, z]) => `<button data-diff="${id}" class="${id === mapDiff ? 'on' : ''}"><span>${z.e}</span> ${t(z.name)}</button>`).join('');
  $('diffdesc').textContent = t(DIFFS[mapDiff].desc);
  $('mapadv').innerHTML = [false, true].map(v => `<button data-adv="${v ? 1 : 0}" class="${v === mapAdv ? 'on' : ''}">${v ? '🚦 ' + t('On') : t('Off')}</button>`).join('');
  $('advdesc').textContent = mapAdv ? t('Trains can crash into each other! Build 🚦 signals so only one train uses a piece of track at a time.') : '';
  $('mapsgrid').innerHTML = Object.entries(SCENARIOS).map(([id, S0]) => { const S = sized(S0, mapSize), b = best[bestKey(id, mapSize, mapDiff) + (mapAdv ? '!' : '')]; return `
    <button data-scn="${id}"><span class="big">${S.e}</span><b>${t(S.name)}</b><span>${t(S.desc)}</span>
    ${S.goal ? `<small>${t('Goal:')} ${questText(S.goal)}${b ? `<br>${t('Best:')} ${starStr(b)}` : ''}</small>` : ''}</button>`; }).join('');
  $('maps').hidden = false; $('scndone').hidden = true;
}
function startScenario(id) {
  newGame(Math.floor(Math.random() * 1e9), id, mapSize, mapDiff, mapAdv);
  $('maps').hidden = true;
  setTool('look'); startView(); save();
  toast(`${SCENARIOS[id].e} ${t(SCENARIOS[id].name)} · ${SIZES[mapSize].e} ${t(SIZES[mapSize].name)} · ${DIFFS[mapDiff].e} ${t(DIFFS[mapDiff].name)}${mapAdv ? ' · 🚦' : ''}`); sfx('toot');
}
const goalOf = () => scn().goal && { ...scn().goal, base: 0 };
function checkGoal() {
  const goal = goalOf();
  if (!goal || G.scn.done || questProg(goal) < goal.n) return;
  const par = scn().par, stars = G.time <= par[0] ? 3 : G.time <= par[1] ? 2 : 1;
  G.scn.done = true; G.scn.at = G.time; G.scn.stars = stars;
  const best = loadBest();
  const bk = bestKey(G.scn.id, G.scn.size, G.diff) + (G.adv ? '!' : '');
  if ((best[bk] || 0) < stars) { best[bk] = stars; try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch (e) { /* not remembered */ } }
  $('donestars').textContent = starStr(stars);
  $('donetime').textContent = t('You did it in {t}!', { t: fmtTime(G.time) });
  $('scndone').hidden = false;
  sfx('fanfare'); burst(); save();
}
function goalCard() {
  const goal = goalOf(); if (!goal) return '';
  const pr = clamp(questProg(goal), 0, goal.n);
  const sub = G.scn.done ? `${starStr(G.scn.stars)} · ${t('Done in {t}!', { t: fmtTime(G.scn.at) })}` : `${pr} / ${goal.n} · ${t('⭐⭐⭐ if done by {t}', { t: fmtTime(scn().par[0]) })}`;
  return `<div class="q goal"><div class="t">🎯 ${questText(goal)}</div><div class="bar"><i style="width:${pr / goal.n * 100}%"></i></div><small>${sub}</small></div>`;
}
$('newmap').addEventListener('click', openMaps);
$('maps').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.scn) startScenario(b.dataset.scn);
  else if (b.dataset.adv) { mapAdv = b.dataset.adv === '1'; try { localStorage.setItem(ADV_KEY, mapAdv ? '1' : '0'); } catch (e) { /* not remembered */ } sfx('pop'); openMaps(); }
  else if (b.dataset.diff) { mapDiff = b.dataset.diff; try { localStorage.setItem(DIFF_KEY, mapDiff); } catch (e) { /* not remembered */ } sfx('pop'); openMaps(); }
  else if (b.dataset.size) { mapSize = b.dataset.size; try { localStorage.setItem(SIZE_KEY, mapSize); } catch (e) { /* not remembered */ } sfx('pop'); openMaps(); }
  else if (b.id === 'mapscancel') $('maps').hidden = true;
});
$('donekeep').addEventListener('click', () => { $('scndone').hidden = true; });
$('donemaps').addEventListener('click', openMaps);
$('lang').addEventListener('click', () => { setLang(lang === 'sv' ? 'en' : 'sv'); sfx('pop'); });
$('startbtn').addEventListener('click', () => { audio(); $('welcome').hidden = true; sfx('toot'); });

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const tools = ['look', 'track', 'station', 'train', 'bus', 'deco', 'remove', 'signal'];
  if (e.key >= '1' && e.key <= (G.adv ? '8' : '7')) setTool(tools[+e.key - 1]);
  else if (e.key === 'z' || e.key === 'Z') { undo(); e.preventDefault(); }
  else if (e.key === 'Escape') { if (draft) draft = null; else { sel = null; setTool('look'); } }
  else if (e.key === 'Enter' && tool === 'train') routeAct('go');
  else if (e.key === ' ') { speed = speed ? 0 : 1; updateUI(); e.preventDefault(); }
  else if (e.key.startsWith('Arrow')) {
    const k = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    view.ox += k[0] * 80; view.oy += k[1] * 80; clampView(); e.preventDefault();
  } else if (e.key === '+' || e.key === '=') zoomAt(...screenMid(), view.s * 1.25);
  else if (e.key === '-') zoomAt(...screenMid(), view.s / 1.25);
  else if (e.key === '0') { view.s = minScale(); clampView(); }
});

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = innerWidth, h = innerHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const [mx, my] = view.init ? screenMid() : [0, 0];
  const keep = view.init && [(mx - view.ox) / view.s, (my - view.oy) / view.s];
  viewArea.top = $('top').getBoundingClientRect().bottom + 8;
  viewArea.bot = h - $('bottom').getBoundingClientRect().top + 8;
  if (keep) { view.s = clamp(view.s, minScale(), MAX_S); centerOn(...keep); } else startView();
  $('hint').style.bottom = (viewArea.bot + 4) + 'px';
  $('mapnav').style.bottom = (viewArea.bot + 4) + 'px';
  dirty = true;
}
addEventListener('resize', resize);

// ---------- save / load ----------
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1, seed: G.seed, W, H, scn: G.scn, diff: G.diff, adv: G.adv, sig: G.adv ? Array.from(G.sig) : undefined, runT: G.runT, runAcc: G.runAcc, coins: G.coins, stars: G.stars, time: G.time, nextId: G.nextId, nameIx: G.nameIx, piggyAt: G.piggyAt,
      terr: Array.from(G.terr), conn: Array.from(G.conn), road: Array.from(G.road), deco: Array.from(G.deco), roads: G.roads, places: G.places,
      stations: G.stations.map(({ id, x, y, name, cargo }) => ({ id, x, y, name, cargo })),
      trains: G.trains.map(t => ({ id: t.id, name: t.name, color: t.color, pattern: t.pattern, face: t.face, eng: t.eng, wagons: t.wagons, route: t.route, target: t.target, load: t.load, earned: t.earned })),
      buses: G.buses, busN: G.busN, stats: G.stats, quests: G.quests,
    }));
  } catch (e) { /* storage unavailable: the game still plays, it just won't remember */ }
}
function load() {
  let d;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
  if (!d || d.v !== 1) return false;
  try {
    W = d.W || 40; H = d.H || 24; // saves from before big maps are 40×24
    if (d.terr.length !== W * H) return false;
    G = {
      v: 1, seed: d.seed, W, H, scn: d.scn || { id: 'free', done: false }, diff: DIFFS[d.diff] ? d.diff : 'easy', adv: !!d.adv, sig: d.sig && d.sig.length === W * H ? Uint8Array.from(d.sig) : new Uint8Array(W * H), runT: d.runT || 0, runAcc: d.runAcc || 0, coins: d.coins, stars: d.stars, time: d.time, prodT: 0, nextId: d.nextId, nameIx: d.nameIx, rr: 0, piggyAt: d.piggyAt ?? -999,
      terr: Uint8Array.from(d.terr), conn: Uint8Array.from(d.conn),
      road: d.road ? Uint8Array.from(d.road) : new Uint8Array(W * H), deco: d.deco ? Uint8Array.from(d.deco) : new Uint8Array(W * H),
      occ: new Int16Array(W * H).fill(-1), stn: new Int32Array(W * H).fill(-1),
      places: d.places, stations: d.stations.map(s => ({ ...s, places: [] })), trains: [], roads: d.roads || [],
      buses: d.buses || [], busN: d.busN || 0, stats: d.stats, quests: (d.quests || []).filter(q => q.kind !== 'deliver' || CARGO[q.type]),
    };
    for (const p of G.places) for (const i of p.tiles) G.occ[i] = p.id;
    while (G.quests.length < 3) G.quests.push(makeQuest());
    for (const s of G.stations) G.stn[idx(s.x, s.y)] = s.id;
    refreshCatch();
    for (const t of d.trains) {
      const st = stById(t.target) || stById(t.route[0]);
      if (!st || !ENG[t.eng]) continue;
      const tr = { ...t, state: 'stop', timer: 1, trail: null, d: 0, leg: null, atTile: 0, inE: -1, smokeT: 0 };
      tr.target = st.id; placeAt(tr, idx(st.x, st.y));
      tr.ghost = GHOST_T; // trains parked together at a station get time to spread out
      G.trains.push(tr);
    }
    initCars(); undoStack.length = 0; curSeason = -1; draft = null; view.init = false;
    dirty = true; sigDirty = true; wrecks = [];
    return true;
  } catch (e) { return false; }
}

// ---------- main loop ----------
function sim(dt) {
  G.time += dt;
  if (G.adv) updTaken();
  for (const tr of G.trains.slice()) { updTrain(tr, dt); if (tr.ghost > 0) tr.ghost -= dt; }
  if (G.adv) checkCrashes();
  updCars(dt);
  G.prodT += dt;
  if (G.prodT >= PROD_EVERY) { G.prodT -= PROD_EVERY; produce(); }
  if (D().run) {
    G.runT = (G.runT || 0) + dt;
    if (G.runT >= RUN_EVERY) { G.runT -= RUN_EVERY; payRunning(); }
  }
}
// Running costs come out a little at a time; coins can dip below zero, and then nothing new can be bought.
function payRunning() {
  const perMin = G.trains.reduce((a, tr) => a + trainRun(tr), 0) + G.buses.length * busRun();
  G.runAcc = (G.runAcc || 0) + perMin * RUN_EVERY / 60;
  const n = Math.floor(G.runAcc); if (n <= 0) return;
  G.runAcc -= n; G.coins -= n; G.stats.running = (G.stats.running || 0) + n;
}
let uiT = 0, saveT = 0;
function tick(rdt) {
  let sdt = rdt * speed;
  while (sdt > 1e-6) { const h = Math.min(0.05, sdt); sim(h); sdt -= h; }
  fx(rdt); updWrecks(rdt);
  music();
  const si = seasonIx();
  if (si !== curSeason) {
    if (curSeason >= 0) { toast(t(SEASONS[si].msg)); sfx('season'); if (si === 0) meltSnowmen(); }
    curSeason = si; dirty = true;
  }
  uiT -= rdt;
  if (uiT <= 0) {
    uiT = 0.25;
    checkQuests(); checkGoal();
    if (G.coins < price(ENGINES[0].cost) && !G.trains.length && !G.buses.length && G.time - G.piggyAt > 45) {
      const n = price(80); G.piggyAt = G.time; G.coins = Math.max(0, G.coins) + n; sfx('coin');
      toast(t('🐷 Oink! Your piggy bank found {n} coins!', { n }));
    }
    updateUI();
  }
  saveT += rdt;
  if (saveT > 10) { saveT = 0; save(); }
}
let last = performance.now();
function frame(now) {
  const rdt = Math.min(0.1, (now - last) / 1000); last = now;
  tick(rdt); draw();
  requestAnimationFrame(frame);
}

if (!load()) { newGame(Math.floor(Math.random() * 1e9)); $('welcome').hidden = false; }
addEventListener('beforeunload', save);
addEventListener('pagehide', save);
applyLang();
resize();
updateUI(true);
requestAnimationFrame(frame);

if (/[?&]debug\b/.test(location.search)) {
  window.__game = {
    get G() { return G; }, tick, sim, draw, newGame, findPath, buyTrain, buildStation, connect, layTrack, removeTile,
    setTool, produce, idx, KINDS, CARGO, save, load, undo, beginAct, endAct, placeDeco, draftStart, draftTo, draftCommit,
    darkness, seasonIx, gateDown, buyBus, sellBus, roadRoute, pick, panelAct, panelHTML, deliver, makeQuest,
    get sel() { return sel; }, set sel(v) { sel = v; },
    get W() { return W; }, get H() { return H; }, view, zoomAt, centerOn, clampView, minScale, startScenario, openMaps, checkGoal, SCENARIOS, SIZES, sized, DIFFS, price, trainRun, busRun, payRunning, toggleSignal, updTaken, sigLimit, posAt, checkCrashes, rescueTrain, get taken() { return taken; }, get mapAdv() { return mapAdv; }, set mapAdv(v) { mapAdv = v; }, get mapDiff() { return mapDiff; }, set mapDiff(v) { mapDiff = v; }, get mapSize() { return mapSize; }, set mapSize(v) { mapSize = v; }, resize, get cars() { return cars; }, get undoStack() { return undoStack; }, get draft() { return draft; },
  };
}
})();
