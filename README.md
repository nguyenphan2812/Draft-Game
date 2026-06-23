# 🎮 Draft Team Game

A real-time 2-player card drafting game where players take turns drawing and placing characters into role slots to build their team.

---

## 📋 Table of Contents

- [What You Need](#what-you-need)
- [Step 1 — Install Node.js](#step-1--install-nodejs)
- [Step 2 — Download the Project](#step-2--download-the-project)
- [Step 3 — Set Up Firebase](#step-3--set-up-firebase)
- [Step 4 — Configure the App](#step-4--configure-the-app)
- [Step 5 — Run the Game](#step-5--run-the-game)
- [How to Add Images](#how-to-add-images)
- [How to Play](#how-to-play)
- [Common Problems](#common-problems)

---

## What You Need

Before starting, make sure you have:

- A computer (Windows, Mac, or Linux)
- An internet connection
- A Google account (for Firebase)
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
5. Type this and press Enter to confirm it worked:
   ```
   node -v
   ```
   You should see a version number like `v20.x.x` — that means it's working ✅

---

## Step 2 — Download the Project

1. Download the project as a ZIP file (or clone it with Git if you know how)
2. Extract/unzip it somewhere easy to find, like your Desktop
3. You should see a folder called `draft-team-game` with files inside it

---

## Step 3 — Set Up Firebase

Firebase is the online database that lets two players connect and play together in real time. It's free.

### 3.1 — Create a Firebase Account & Project

1. Go to **[https://console.firebase.google.com](https://console.firebase.google.com)**
2. Sign in with your Google account
3. Click **"Add project"**
4. Name it anything, e.g. `draft-team-game`
5. Turn off Google Analytics (not needed) → click **"Create project"**
6. Wait for it to finish, then click **"Continue"**

### 3.2 — Enable the Database (Firestore)

1. In the left sidebar, click **"Build"** → **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"** → click **Next**
4. Pick a region close to you → click **"Enable"**
5. Wait for the database to be ready ✅

### 3.3 — Register the App & Get Your Keys

1. Go back to the project home page (click the Firebase logo top-left)
2. Click **"+ Add app"** → click the **Web icon `</>`**
3. Give it a nickname like `draft-game-web` → click **"Register app"**
4. You will see a block of code with your secret keys. It looks like this:

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

5. **Copy these values and keep them somewhere safe** — you'll need them in the next step
6. Click **"Continue to console"**

---

## Step 4 — Configure the App

1. Open the `draft-team-game` folder
2. Find the file called **`.env.example`**
3. Make a copy of it and rename the copy to **`.env`** (just `.env`, no `.example`)

   > ⚠️ On Windows, the file might not show if hidden files are disabled.
   > Open File Explorer → View → check "Hidden items" to see it.

4. Open `.env` with any text editor (Notepad is fine)
5. Replace each value with what you copied from Firebase:

```
VITE_FIREBASE_API_KEY=paste_your_apiKey_here
VITE_FIREBASE_AUTH_DOMAIN=paste_your_authDomain_here
VITE_FIREBASE_PROJECT_ID=paste_your_projectId_here
VITE_FIREBASE_STORAGE_BUCKET=paste_your_storageBucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=paste_your_messagingSenderId_here
VITE_FIREBASE_APP_ID=paste_your_appId_here
```

6. Save the file

---

## Step 5 — Run the Game

1. Open a terminal (see Step 1 for how)
2. Navigate to the project folder. Type this and press Enter:
   ```
   cd Desktop/draft-team-game
   ```
   (Change `Desktop/draft-team-game` to wherever you put the folder)

3. Install the required packages — type this and press Enter:
   ```
   npm install
   ```
   Wait for it to finish (may take 1-2 minutes)

4. Start the game — type this and press Enter:
   ```
   npm run dev
   ```

5. Open your browser and go to:
   ```
   http://localhost:5173
   ```

🎉 The game is running! Keep the terminal open while playing.

---

## How to Add Images

Before playing, you need to add a list of character images.

1. Open your browser and go to `http://localhost:5173/manage`
2. Click **"+ New image list"**
3. Give it a name (e.g. `Season 1`)
4. Paste image URLs — one per line. You can use any public image URL from the internet.

   Example:
   ```
   https://example.com/character1.jpg
   https://example.com/character2.jpg
   https://example.com/character3.jpg
   ```

5. Click **"Create list"**
6. Go back to the home screen — your list will appear in the dropdown ✅

> 💡 **Tip:** You need at least as many images as there are role slots × 2 (e.g. 5 roles = 10+ images recommended)

---

## How to Play

### Setup
1. Both players open the game in their browser
   - Same computer: open two different browser tabs
   - Different devices: both connect to the same URL (see note below)
2. One player selects the **card list** from the dropdown
3. Player 1 clicks **"Player 1"**, Player 2 clicks **"Player 2"**
4. The game starts automatically when both players are ready

> 📱 **Playing on two different devices:**
> Both devices must be on the same Wi-Fi network.
> On the host computer, run `npm run dev -- --host` instead of `npm run dev`.
> The terminal will show a network URL like `http://192.168.1.x:5173` — share that with the other player.

### Game Rules

| Action | Description |
|--------|-------------|
| **Draw** | Click the Draw button to reveal a random card from the pool |
| **Place** | Click any empty role slot on your team to assign the drawn card there |
| **Skip** | Discard the current card and draw again. Each player gets **1 skip** per game |
| **Reset** | Clears all placements and restarts the draft (both players see this) |

### Turn Order
- **Player 1 always goes first**
- Players strictly alternate turns: P1 → P2 → P1 → P2...
- After placing a card, the turn automatically passes to the other player
- Both players can always see each other's team in real time

### Winning
The game ends when all role slots for both teams are filled. A **Draft Complete** screen shows both teams side by side.

### Role Management
- Click **⚙️ Roles** during the game to add, rename, or delete role slots
- Changes apply to both players instantly

---

## Common Problems

### "npm is not recognized"
Node.js is not installed. Go back to [Step 1](#step-1--install-nodejs).

### The page shows a Firebase error
Your `.env` file has wrong or missing values. Double-check that you copied all the keys from Firebase correctly with no extra spaces.

### "0 cards left" when the game starts
Your image list is empty. Go to `/manage` and add image URLs to your list.

### Both players end up as the same player
Make sure each player uses a **different browser tab or device**. Don't refresh the page after selecting your player role.

### The game is stuck on the home screen after both players are ready
Try clicking the **Reset game** link at the bottom of the home screen, then both players select their roles again.

### Can't go back to home / stuck on game screen
Open the browser console (`F12` → Console tab) and type:
```js
sessionStorage.clear()
```
Then refresh the page.

---

## 📁 Project Structure (for the curious)

```
draft-team-game/
├── src/
│   ├── pages/
│   │   ├── Home.jsx          # Home screen (player selection)
│   │   ├── Game.jsx          # Main game board
│   │   └── ManageLists.jsx   # Image list manager
│   ├── utils/
│   │   └── helpers.js        # Utility functions
│   ├── firebase.js           # Firebase connection
│   ├── App.jsx               # App routes
│   └── index.css             # Global styles
├── .env                      # Your Firebase keys (never share this!)
├── .env.example              # Template for .env
└── package.json              # Project dependencies
```

---

Made with React, Firebase, and Tailwind CSS.