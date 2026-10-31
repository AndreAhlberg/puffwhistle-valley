# Puffwhistle Valley

A cosy single-player train game for kids. Lay track, build stations and run trains that carry
people and goods around a little valley. Towns grow when they get deliveries.

**▶ Play it here: https://andreahlberg.github.io/puffwhistle-valley/**

Or open `index.html` in a browser. There's no build step and no server needed.

## How to play
- **🛤️ Track** (2🪙, bridges 8🪙, tunnels 6🪙): drag to draw ghost rails with a running cost, then let go
  to build them. Red means you can't afford that part, and a red ✕ marks something in the way. Drag back
  to rub out. Curves and junctions form automatically. Rails can cross a road only where the road is
  straight, and only straight across; that makes a level crossing with barriers.
- **🚉 Station** (15🪙): click a straight piece of track (not on a hill or a road). It serves everything
  in its 5×5 yellow square.
- **🚂 Train**: click stations in order, pick an engine and press **Go!** Trains load whatever another
  stop on their route wants and get paid more for longer trips.
- **🚌 Bus** (40🪙): click a town, then another town joined to it by a road. The bus shuttles passengers
  between them. It pays less than a train but needs no track.
- **🌷 Decorate**: flowers, trees, fences (they join up), benches, lamp posts (they glow at night), duck
  ponds, windmills, and snowmen (winter only; they melt in spring). Drag to place lots.
- **👆 Look**: click trains, buses, stations, towns and industries. Add or remove wagons, or sell a train
  or bus. Clicking makes things honk: trains toot, cars and buses beep, ducks quack. Press ✏️ next to a
  train's name to rename it (Enter saves, Esc cancels).
- **🎨 Paint** (in a train's panel): colours, patterns and faces. Fancier ones unlock with ⭐ stars:
  black at 1, gold at 2, pink at 3 and rainbow at 5; stripes at 1, spots at 2 and stars at 4; the 😮 face at
  1 and the 😎 face at 3.
- **🧹 Remove**: removes a station first, then the track under it, then decorations and trees.
- **↩️ Undo**: each drag or click is one step, up to 30 back. Buying a train clears the undo history.
- **Moving around**: scroll or pinch to zoom. Drag with 👆 Look, or with the right or middle mouse button
  in any tool, to pan. The ➕ ➖ ⤢ buttons also zoom, and clicking the minimap in the corner jumps there.
- Keys: `1`–`7` pick tools, `Z` undoes, `Space` pauses, `Enter` sends off a new train, `Esc` cancels,
  arrow keys pan, `+`/`-` zoom and `0` shows the whole map.

## Difficulty
Pick a difficulty along with the map size when you start a new map. The top bar shows which one you're on.

| | 🌼 Easy | 🚂 Normal | 🎩 Tycoon |
|---|---|---|---|
| Who it's for | little conductors | older kids | big kids and grown-ups |
| Coins per delivery | ×1 | ×0.35 | ×0.18 |
| Building prices (not decorations) | ×1 | ×1.5 | ×2 |
| Running costs | none | yes | high (a Puffer with 2 wagons costs 24🪙 a minute) |
| Starting coins | ×1 | ×1.3 | ×1.5 |
| Quest coins | ×1 | ×0.6 | ×0.4 |
| Time allowed for ⭐⭐⭐ | ×1 | ×1.5 | ×2.2 |

Running costs come out every few seconds, and a train's or bus's panel shows what it costs a minute. Coins can drop
below zero (they turn red), and then you can't buy anything until money comes in again or you sell something.
Long routes with full trains pay best. The piggy bank still helps if you have no trains or buses and no money.

## 🚦 Advanced mode: signals and crashes
Switch on **🚦 Signals & crashes** in the valley picker (it works with any difficulty and size). Trains are no
longer friendly ghosts: two trains that meet on the same track crash 💥 and both are lost. A **🚦 Signal** tool
(12🪙, key `8`) appears in the toolbar:

- Put signals on straight track (not on stations, road crossings, tunnels or junctions). Click one again, or use 🧹,
  to take it away. Each signal works in both directions.
- As a train reaches a signal it books the track ahead up to the next signal (or its station). If another train
  is on that track, or has booked it, the train waits at the signal. The signal's lamps show red on any side where
  the track is taken.
- At each signal a train picks the best way on, steering round track other trains are using. On a **passing loop**
  with signals at both ends of each side, two trains going opposite ways pass each other.
- Track without signals is unprotected. Put a signal at every way into a shared stretch of track.
- Trains can still get stuck facing each other on a single line without a loop. Conductor Bea warns you, and a train
  that has waited a while gets a **✨ Rescue** button that lifts it back to its station.
- Trains that have just been loaded or rescued pass through others for a few seconds so they can get clear. A new
  train can't be put on a station where another train is standing.

## Valleys
**🗺️ New map** opens the valley picker. First pick a map size: 🐣 Small, 🐥 Medium, 🐔 Big (the sizes
below) or 🦚 Huge. Small free play is 43×26 with 3 towns, and Huge is 97×59 with 13 towns. The number of towns,
industries and hills, and the delivery goals, all grow with the map. Your best stars are kept for each size.

| Valley | Size | What's special | Goal |
|---|---|---|---|
| 🗺️ Free play | 72×44 | 7 towns, rivers, hills, every industry | none, just build |
| 🏝️ Island Hop | 64×40 | towns on islands, 450🪙 to start for bridges | grow a town to 12 houses |
| ⛰️ Mountain Railway | 64×40 | big hills everywhere, extra quarry and brickworks | deliver 60 🧱 bricks |
| ❄️ Snowy Valley | 56×36 | always winter, extra farms | deliver 120 🥛 milk |
| 🏙️ Busy Towns | 72×44 | 9 towns joined by roads | deliver 200 🧒 passengers |

Finishing a goal gives ⭐⭐⭐, ⭐⭐ or ⭐ depending on how fast you were; the goal card shows the time to beat
for ⭐⭐⭐. The picker remembers your best stars for each valley, and you can keep playing afterwards.

## The valley
- **Hills** ⛰️: trains go through them in tunnels and fade out while inside.
- **Roads** 🚗 join the towns. Cars drive back and forth and wait at level crossings while a train passes.
- **Seasons** (2½ minutes each at normal speed): spring 🧁, summer 🧒, autumn 🍎 and winter 🥛. In each
  season that cargo pays double; the top bar shows which one. The valley is repainted each season, with
  blossom, fireflies, autumn leaves, or snow and ice.
- **Day and night** (2 minutes per day): at night, windows, stations, lamp posts, train headlights and
  car lights glow.
- **Music** 🎵: a gentle generated tune with its own on/off button. It's quieter at night, adds bells in
  winter, and 🔇 silences everything.

## Goods
| Source | Cargo | Goes to |
|---|---|---|
| Town | 🧒 Passengers | other towns |
| Apple Orchard | 🍎 Apples | towns |
| Farm | 🌾 Wheat, 🥛 Milk | Bakery (milk also to towns) |
| Lumber Camp | 🪵 Logs | Toy Workshop |
| Bakery | 🧁 Cupcakes | towns |
| Toy Workshop | 🧸 Toys | towns |
| Harbour (by the water) | 🐟 Fish | Fish Finger Factory |
| Fish Finger Factory | 🍤 Fish fingers | towns |
| Quarry (by a hill) | 🪨 Stone | Brickworks |
| Brickworks | 🧱 Bricks | towns (they grow 3× as fast) |

Quests award ⭐ stars, which unlock faster engines: Dasher at 3 ⭐ and Comet at 7 ⭐. The game
autosaves to localStorage. If you run out of money with no trains, the piggy bank helps out.
Trains are friendly ghosts and pass through each other, so nothing can crash.

## Languages
English and Swedish (Puffvisseldalen). The 🌐 button in the top bar switches between them and the choice
is remembered. A Swedish browser starts in Swedish. All text is in `game.js`: `t()` looks up an English
string in the `SV` table, and `tn()` translates stored English names (towns, industries, trains, engines)
through `NAMES_SV`. Static HTML text is marked with `data-i18n` / `data-i18n-title`.

## Dev
`index.html?debug` exposes `window.__game` (`G`, `sim(dt)`, `tick`, `connect`, `layTrack`, `buildStation`,
`buyTrain`, `findPath`, …) for scripted testing.
