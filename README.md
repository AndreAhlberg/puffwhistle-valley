# Puffwhistle Valley

A cosy single-player train game for kids. Lay track, build stations and run trains that carry
people and goods around a little valley. Towns grow when they get deliveries.

Open `index.html` in a browser. There's no build step and no server needed.

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
  or bus. Clicking makes things honk: trains toot, cars and buses beep, ducks quack.
- **🎨 Paint** (in a train's panel): colours, patterns and faces. Fancier ones unlock with ⭐ stars:
  black at 1, gold at 2, pink at 3 and rainbow at 5; stripes at 1, spots at 2 and stars at 4; the 😮 face at
  1 and the 😎 face at 3.
- **🧹 Remove**: removes a station first, then the track under it, then decorations and trees.
- **↩️ Undo**: each drag or click is one step, up to 30 back. Buying a train clears the undo history.
- Keys: `1`–`7` pick tools, `Z` undoes, `Space` pauses, `Enter` sends off a new train, `Esc` cancels.

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
