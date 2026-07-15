# Empty Knight

A high-fidelity, atmospheric 2D action-adventure platformer clone of *Hollow Knight* built using **HTML5 Canvas**, **Vanilla Javascript**, and **Vite**. Features custom hand-drawn gothic backgrounds, character sprites, advanced platforming physics, and a modular spell system.

---

## 🎮 Controls

| Action | Keyboard Binds | Mouse Binds |
| --- | --- | --- |
| **Walk Left / Right** | `A` / `D` or `←` / `→` | - |
| **Look Up** | `W` or `↑` | - |
| **Look Down / Sit** | `S` or `↓` | - |
| **Jump / Double Jump** | `Space` or `C` | - |
| **Dash (Mothwing Cloak)** | `Shift` or `X` | `Right Click` |
| **Attack (Nail Slash)** | `Z` or `J` | `Left Click` |
| **Focus / Heal** | `E` or `F` (Hold still) | - |
| **Quick Cast Spell** | `Q` | - |
| **Pause Menu** | `Enter` or `Esc` | - |

---

## ✨ Spells

Spells consume **33 Soul** (gain Soul by hitting enemies with your Nail):

1. **Vengeful Spirit** (Horizontal): Press `Q` (or `W + Attack`) to shoot a high-speed glowing blue skull projectile.
2. **Desolate Dive** (Downward Slam): Press `Q` (or `W + Attack`) in mid-air while holding `S` or `Down` to slam down rapidly, creating a wide cyan shockwave burst on landing.
3. **Howling Wraiths** (Upward Scream): Press `Q` (or `W + Attack`) while holding `W` or `Up` to release an upward cone of violet spirit energy.

---

## ⚡ Secret Cheat Code

Type **`godmod`** sequentially on your keyboard during gameplay to toggle **God Mode**:
- **Infinite Health**: Full invulnerability to enemies.
- **Spike Trap Immunity**: Walk, run, or stand directly on nail traps without getting hurt or teleported.
- **Unlimited Soul**: Full soul vessel for infinite spell casting.
- **5x Nail Damage**: Attack power boosted from `1` to `5`.

---

## 🛠️ Setup & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build for Production
```bash
npm run build
```
Production assets will be generated in the `dist/` directory.
