# 🎮 Draft Team Game

A real-time 2-player card drafting game where players take turns drawing and placing characters into role slots to build their team. Works on any device, anywhere in the world.

---

## 📋 Table of Contents

- [What You Need](#what-you-need)
- [Step 1 — Install Node.js](#step-1--install-nodejs)
- [Step 2 — Download the Project](#step-2--download-the-project)
- [Step 3 — Set Up Firebase](#step-3--set-up-firebase)
- [Step 4 — Configure the App](#step-4--configure-the-app)
- [Step 5 — Run Locally](#step-5--run-locally)
- [Step 6 — Deploy Online (Play with Friends)](#step-6--deploy-online-play-with-friends)
- [How to Add Images](#how-to-add-images)
- [How to Play](#how-to-play)
- [Common Problems](#common-problems)

---

## What You Need

- A computer (Windows, Mac, or Linux)
- An internet connection
- A Google account (for Firebase)
- A GitHub account — free at [https://github.com](https://github.com)
- A web browser (Chrome recommended)

---

## Step 1 — Install Node.js

Node.js is the engine that runs this project. You only need to install it once.

1. Go to **[https://nodejs.org](https://nodejs.org)**
2. Click the big green **"LTS"** button to download
3. Open the downloaded file and follow the installer (just keep clicking Next)
4. When done, open a terminal:
   - **Windows:** Press `Win + R`, type `cmd`, press Enter
   - **Mac:** Press `Cmd + Space`, type `Terminal`, press Enter
5. Confirm it worked by typing:
   ```
   node -v
   ```
   You should see something like `v20.x.x` ✅

---

## Step 2 — Download the Project

1. Download the project as a ZIP file
2. Extract/unzip it somewhere easy to find, like your Desktop
3. You should see a folder called `draft-team-game` with files inside

---

## Step 3 — Set Up Firebase

Firebase is the free online database that keeps both players in sync in real time.

### 3.1 — Create a Firebase Project

1. Go to **[https://console.firebase.google.com](https://console.firebase.google.com)**
2. Sign in with your Google account
3. Click **"Add project"**
4. Name it anything, e.g. `draft-team-game`
5. Turn off Google Analytics (not needed) → click **"Create project"**
6. Wait for it to finish → click **"Continue"**

### 3.2 — Enable Firestore Database

1. In the left sidebar click **"Build"** → **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"** → click **Next**
4. Pick a region close to you → click **"Enable"**
5. Wait for the database to be ready ✅

### 3.3 — Register a Web App & Get Your Keys

1. Go back to the project overview (click the Firebase logo top-left)
2. Click **"+ Add app"** → click the **Web icon `</>`**
3. Give it a nickname like `draft-game-web` → click **"Register app"**
4. You'll see a block of code with your secret keys:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

5. **Copy and save these values** — you'll need them in the next step
6. Click **"Continue to console"**

### 3.4 — Create the Image List Document

1. In Firestore, click **"Start collection"**
2. Collection ID: `config` → click **Next**
3. Document ID: `imageLists`
4. Add a field:
   - Field: `lists` | Type: `array`
   - Inside the array add one item, type: `map`
   - Inside that map add:
     - `name` (string): leave blank
     - `images` (array): leave blank
5. Click **Save**

> You'll add real images later through the app itself — this just sets up the structure.

---

## Step 4 — Configure the App

1. Open the `draft-team-game` folder
2. Find **`.env.example`** → make a copy and rename it to **`.env`**

   > ⚠️ On Windows, enable hidden files: File Explorer → View → check "Hidden items"

3. Open `.env` with Notepad and fill in your Firebase keys:

```
VITE_FIREBASE_API_KEY=paste_your_apiKey_here
VITE_FIREBASE_AUTH_DOMAIN=paste_your_authDomain_here
VITE_FIREBASE_PROJECT_ID=paste_your_projectId_here
VITE_FIREBASE_STORAGE_BUCKET=paste_your_storageBucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=paste_your_messagingSenderId_here
VITE_FIREBASE_APP_ID=paste_your_appId_here
```

4. Save the file

---

## Step 5 — Run Locally

Use this to test the game on your own computer first.

1. Open a terminal and navigate to the project folder:
   ```
   cd Desktop/draft-team-game
   ```
2. Install packages:
   ```
   npm install
   ```
3. Start the game:
   ```
   npm run dev
   ```
4. Open **[http://localhost:5173](http://localhost:5173)** in your browser

🎉 The game is running! Keep the terminal open while playing.

> This only works on your own computer. To play with a friend online, follow Step 6.

---

## Step 6 — Deploy Online (Play with Friends)

This puts the game on the internet permanently so you and your friend can play from anywhere. It's **free forever**.

### 6.1 — Upload to GitHub

1. Download **GitHub Desktop** from **[https://desktop.github.com](https://desktop.github.com)** and install it
2. Sign in with your GitHub account
3. Click **File → Add local repository** → select your `draft-team-game` folder
4. Click **"Publish repository"** → set it to **Private** → click Publish

### 6.2 — Deploy on Vercel

1. Go to **[https://vercel.com](https://vercel.com)** → click **"Sign up"** → sign up with GitHub
2. Click **"Add New Project"**
3. Find `draft-team-game` in the list → click **"Import"**
4. Before clicking Deploy, expand **"Environment Variables"** and add all 6 keys from your `.env` file:

   | Name | Value |
   |------|-------|
   | `VITE_FIREBASE_API_KEY` | your value |
   | `VITE_FIREBASE_AUTH_DOMAIN` | your value |
   | `VITE_FIREBASE_PROJECT_ID` | your value |
   | `VITE_FIREBASE_STORAGE_BUCKET` | your value |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | your value |
   | `VITE_FIREBASE_APP_ID` | your value |

5. Click **"Deploy"**
6. Wait ~1 minute — you'll get a permanent URL like:
   ```
   https://draft-team-game.vercel.app
   ```

**Share that URL with your friend and you're ready to play!** 🌍

### Updating the game later

Whenever you change the code and want to update the live site:
1. Open GitHub Desktop
2. Write any message in the summary box (e.g. "fixed a bug")
3. Click **"Commit"**
4. Click **"Push to origin"**

Vercel automatically redeploys in ~1 minute. No other steps needed.

---

## How to Add Images

Before your first game, add your character images through the app.

1. Open the game URL (local or live)
2. Click **"Manage image lists →"** (bottom right of the home screen)
3. Click **"+ New image list"**
4. Give it a name (e.g. `Honkai`, `Season 1`)
5. Paste image URLs — **one per line**:
   ```
   https://example.com/character1.jpg
   https://example.com/character2.jpg
   https://example.com/character3.jpg
   ```
6. Click **"Create list"**
7. Go back home — your list appears in the dropdown ✅

You can create multiple lists (one per game season, game title, etc.) and switch between them before each game.

> 💡 **Tip:** You need at least **roles × 2 images** (e.g. 5 roles = 10+ images)

---

## How to Play

### Starting a Game

1. Both players open the same URL in their browser
2. One player selects the **card list** from the dropdown
3. **Player 1** clicks the Player 1 button on their device
4. **Player 2** clicks the Player 2 button on their device
5. The game starts automatically — no room codes needed ✅

> ⚠️ Each player must use a **different device or browser tab**. Once you click a player button, the other button locks so you can't accidentally switch.

### Game Rules

| Action | Description |
|--------|-------------|
| **Draw** | Click Draw to reveal a random card from the pool |
| **Place** | Click any empty role slot on your side to assign the card there |
| **Skip** | Discard the drawn card and draw a new one. Each player gets **1 skip** per game |
| **Reset** | Clears all cards and restarts the draft — both players see this instantly |
| **🏠 Home** | Returns both players to the home screen |

### Turn Order
- **Player 1 always goes first**
- Turns alternate strictly: P1 → P2 → P1 → P2...
- After placing a card, the turn passes automatically
- Both players see each other's team update in real time

### End of Game
All role slots filled → **Draft Complete** screen shows both full teams side by side with large images.

Click **Play Again** to restart with the same settings, or **🏠 Home** to go back and change the card list.

### Managing Roles
- Click **⚙️ Roles** in the top bar during the game
- You can **add**, **rename** (click the role name), or **delete** (✕) roles
- Changes sync to both players instantly
- Default roles: Captain, Vice Captain, Tank, Healer, Support

---

## Common Problems

### "npm is not recognized"
Node.js is not installed or not set up correctly. Reinstall it from [https://nodejs.org](https://nodejs.org).

### Firebase error on the page
Your `.env` file has wrong or missing values. Make sure you copied all 6 keys from Firebase with no extra spaces.

### "0 cards left" when the game starts
Your image list is empty. Go to the **Manage image lists** page and add URLs.

### Both players see the same turn indicator
Make sure each player is on a **different device or browser tab**. The same tab can only be one player at a time.

### Stuck on home screen / keeps redirecting to game
Open your browser console (`F12` → Console tab) and run:
```js
sessionStorage.clear()
```
Then refresh the page.

### After clicking Home, the other player's screen didn't update
Wait a few seconds — the sync happens in real time but may take 1-2 seconds on slow connections.

### Vercel deployment shows a blank page
Make sure you added all 6 environment variables in Vercel before deploying. Go to Vercel → Project Settings → Environment Variables to check.

---

## 💰 Is it really free?

Yes — permanently free for personal use:

| Service | Plan | Limits |
|---------|------|--------|
| **Firebase** | Spark (free) | 50,000 reads + 20,000 writes per day |
| **Vercel** | Hobby (free) | 100GB bandwidth per month |

You would need thousands of games per day to approach these limits.

---

## 📁 Project Structure

```
draft-team-game/
├── src/
│   ├── pages/
│   │   ├── Home.jsx          # Home screen — player selection & card list picker
│   │   ├── Game.jsx          # Main game board — draw, place, skip, roles
│   │   └── ManageLists.jsx   # Image list manager — create, edit, delete lists
│   ├── utils/
│   │   └── helpers.js        # Shuffle, room code, team template helpers
│   ├── firebase.js           # Firebase connection
│   ├── App.jsx               # App routes
│   └── index.css             # Global styles (Tailwind v4)
├── .env                      # Your Firebase keys — never share or commit this!
├── .env.example              # Safe template for .env
├── vite.config.js            # Vite + Tailwind config
└── package.json              # Dependencies
```

---

Made with React · Firebase · Tailwind CSS · Deployed on Vercel