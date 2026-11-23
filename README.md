# Dustline Tactics: online version

This repository holds the game and a small multiplayer server in one place. The server sends out the game's page and
passes live messages between players' devices. The host's device still runs the battle, exactly as on claude.ai.

## Put it online for free (Render)
1. Sign in at render.com with your GitHub account.
2. Choose **New → Blueprint** and pick this repository. Render reads `render.yaml` and creates a free web service
   called `dustline`. (Or choose **New → Web Service**, pick this repository, then set Build command `npm install`,
   Start command `npm start`, and the Free plan.)
3. Wait for the first deploy to finish (a few minutes). Your game is at `https://dustline-XXXX.onrender.com`.
4. Send that link to a friend. One of you opens **Multiplayer → Host**, the other taps **Join**.

## Good to know
- **Waking up:** a free Render service sleeps after a quiet spell. The first visit afterwards can take up to a minute
  to load; after that it's quick.
- **Private rooms:** everyone on the same link sees each other's open matches. Add `?room=yourname` to the link to
  share a private room with only the people you send it to.
- **Saves and settings** stay on each device, as before.
- **Health check:** `/health` shows the number of open rooms and connected players.

## Files
- `server.js`: serves `public/` and relays messages on `/ws` (rooms, presence, 60 messages a second per device,
  16 KB per message, 64 devices per room).
- `public/`: the game (`index.html`, `music/`, `sfx/`, `voice/`). `index.html` sets `window.DL_SERVER=''`, which tells
  the game to use this server instead of Claude's live room.
- `render.yaml`: Render setup.

## Run it on your own computer
`npm install` then `npm start`, and open http://localhost:10000
