import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { shuffleArray, createTeamTemplate, isGameComplete } from '../utils/helpers.js';

export default function Game() {
  const [game, setGame]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRoles, setShowRoles]     = useState(false);
  const [newRole, setNewRole]         = useState('');
  const [editingRole, setEditingRole] = useState(null);
  const navigate = useNavigate();

  const myRole    = sessionStorage.getItem('playerRole');
  const gameRef   = doc(db, 'game', 'current');
  const isMyTurn  = game?.currentTurn === myRole;
  const myTeamKey = myRole === 'player1' ? 'player1Team' : 'player2Team';
  const oppTeamKey= myRole === 'player1' ? 'player2Team' : 'player1Team';

  // Real-time listener
  useEffect(() => {
  if (!myRole) return;
  const unsub = onSnapshot(gameRef, (snap) => {
    if (!snap.exists()) { navigate('/'); return; }
    const data = snap.data();
    setGame(data);
    // If game was sent back to waiting (home clicked), redirect both players
    if (data.status === 'waiting') {
      sessionStorage.removeItem('playerRole');
      navigate('/');
    }
    setLoading(false);
  });
  return () => unsub();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [navigate, myRole]);

  // ── Actions ──────────────────────────────────────────────

  async function handleDraw() {
    if (!isMyTurn || game.phase !== 'draw' || actionLoading) return;
    if (game.imagePool.length === 0) return;
    setActionLoading(true);
    try {
      const pool  = [...game.imagePool];
      const drawn = pool.shift();
      await updateDoc(gameRef, { drawnImage: drawn, imagePool: pool, phase: 'place' });
    } finally { setActionLoading(false); }
  }

  async function handlePlace(role) {
    if (!isMyTurn || game.phase !== 'place' || actionLoading) return;
    if (game[myTeamKey][role]) return; // already filled
    setActionLoading(true);
    try {
      const nextTurn    = myRole === 'player1' ? 'player2' : 'player1';
      const updatedMine = { ...game[myTeamKey], [role]: game.drawnImage };
      const updates = {
        [`${myTeamKey}.${role}`]: game.drawnImage,
        drawnImage: null,
        phase: 'draw',
        currentTurn: nextTurn,
      };
      if (isGameComplete(updatedMine, game[oppTeamKey], game.roles)) {
        updates.status = 'complete';
      }
      await updateDoc(gameRef, updates);
    } finally { setActionLoading(false); }
  }

  async function handleSkip() {
    if (!isMyTurn || game.phase !== 'place' || actionLoading) return;
    if (game[myRole]?.skipsLeft <= 0) return;
    setActionLoading(true);
    try {
      await updateDoc(gameRef, {
        [`${myRole}.skipsLeft`]: game[myRole].skipsLeft - 1,
        drawnImage: null,
        phase: 'draw',
        // currentTurn stays same — player draws again
      });
    } finally { setActionLoading(false); }
  }

  async function handleReset() {
    if (!confirm('Reset the entire game? All placed cards will be cleared.')) return;
    setActionLoading(true);
    try {
      const teamTemplate = createTeamTemplate(game.roles);
      await updateDoc(gameRef, {
        status: 'active',
        currentTurn: 'player1',
        phase: 'draw',
        drawnImage: null,
        imagePool: shuffleArray(game.allImages),
        'player1.skipsLeft': 1,
        'player2.skipsLeft': 1,
        player1Team: { ...teamTemplate },
        player2Team: { ...teamTemplate },
      });
    } finally { setActionLoading(false); }
  }

  // ── Role management ───────────────────────────────────────

  async function handleAddRole() {
    if (!newRole.trim()) return;
    const name = newRole.trim();
    await updateDoc(gameRef, {
      roles: [...game.roles, name],
      [`player1Team.${name}`]: null,
      [`player2Team.${name}`]: null,
    });
    setNewRole('');
  }

  async function handleEditRole(index, oldName, newName) {
    const trimmed = newName.trim();
    setEditingRole(null);
    if (!trimmed || trimmed === oldName) return;
    const updatedRoles = game.roles.map((r, i) => i === index ? trimmed : r);
    const rename = (team) => {
      const t = { ...team, [trimmed]: team[oldName] };
      delete t[oldName];
      return t;
    };
    await updateDoc(gameRef, {
      roles: updatedRoles,
      player1Team: rename(game.player1Team),
      player2Team: rename(game.player2Team),
    });
  }

  async function handleDeleteRole(index) {
    const role = game.roles[index];
    if (!confirm(`Delete role "${role}"?`)) return;
    const removeKey = (team) => {
      const t = { ...team };
      delete t[role];
      return t;
    };
    await updateDoc(gameRef, {
      roles: game.roles.filter((_, i) => i !== index),
      player1Team: removeKey(game.player1Team),
      player2Team: removeKey(game.player2Team),
    });
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-slate-400">
      Loading game...
    </div>
  );

  if (!game) return null;

  // Game complete screen
  if (game.status === 'complete') return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 p-4 overflow-hidden">
      <h1 className="text-3xl font-bold text-slate-100 shrink-0">Draft Complete! 🎉</h1>

      <div className="flex gap-6 w-full max-w-4xl flex-1 min-h-0">

        {/* Player 1 */}
        <div className="flex-1 card flex flex-col min-h-0">
          <h2 className="text-lg font-bold text-blue-400 border-b border-blue-500/30 pb-2 mb-3 shrink-0">
            Player 1
          </h2>
          <div className="grid gap-2 flex-1 min-h-0" style={{ gridTemplateColumns: `repeat(${Math.ceil(game.roles.length / 2)}, 1fr)` }}>
            {game.roles.map((role) => (
              <div key={role} className="relative rounded-xl overflow-hidden bg-slate-700 border border-slate-600 min-h-0">
                {game.player1Team[role]
                  ? <img src={game.player1Team[role]} alt={role} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-slate-500 text-2xl">?</div>
                }
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center py-1 px-2">
                  <span className="text-xl font-bold text-white">{role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Player 2 */}
        <div className="flex-1 card flex flex-col min-h-0">
          <h2 className="text-lg font-bold text-red-400 border-b border-red-500/30 pb-2 mb-3 shrink-0">
            Player 2
          </h2>
          <div className="grid gap-2 flex-1 min-h-0" style={{ gridTemplateColumns: `repeat(${Math.ceil(game.roles.length / 2)}, 1fr)` }}>
            {game.roles.map((role) => (
              <div key={role} className="relative rounded-xl overflow-hidden bg-slate-700 border border-slate-600 min-h-0">
                {game.player2Team[role]
                  ? <img src={game.player2Team[role]} alt={role} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-slate-500 text-2xl">?</div>
                }
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center py-1 px-2">
                  <span className="text-xl font-bold text-white">{role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-4 shrink-0">
        <button onClick={handleReset} className="btn-primary px-8 py-3 text-lg">
          Play Again
        </button>
        <button
          onClick={async () => {
            sessionStorage.removeItem('playerRole');
            await updateDoc(gameRef, { status: 'waiting', player1: null, player2: null });
            navigate('/');
          }}
          className="btn-ghost px-8 py-3 text-lg"
        >
          🏠 Home
        </button>
      </div>
    </div>
  );

  const mySkipsLeft  = game[myRole]?.skipsLeft ?? 0;
  const opponentName = myRole === 'player1' ? 'Player 2' : 'Player 1';

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 bg-card">
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
          isMyTurn
            ? 'bg-indigo-600 text-white animate-pulse'
            : 'bg-slate-700 text-slate-400'
        }`}>
          {isMyTurn ? '🎯 Your turn' : `⏳ ${opponentName}'s turn`}
        </span>

        <span className="text-slate-400 text-sm">
          🃏 {game.imagePool.length} cards left
        </span>

        <div className="flex gap-2">
          <button
            onClick={() => setShowRoles(!showRoles)}
            className="btn-ghost text-sm py-1"
          >
            ⚙️ Roles
          </button>
          <button onClick={handleReset} className="btn-danger text-sm py-1">
            Reset
          </button>
          <button
            onClick={async () => {
              sessionStorage.removeItem('playerRole');
              await updateDoc(gameRef, {
                status: 'waiting',
                player1: null,
                player2: null,
              });
              navigate('/');
            }}
            className="btn-ghost text-sm py-1"
          >
            🏠 Home
          </button>
        </div>
      </div>

      {/* ── Role manager ── */}
      {showRoles && (
        <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Manage Roles</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {game.roles.map((role, index) => (
              <div key={index} className="flex items-center gap-1 bg-slate-700 rounded-lg px-3 py-1">
                {editingRole?.index === index ? (
                  <input
                    autoFocus
                    className="bg-transparent text-sm text-slate-100 outline-none w-28"
                    value={editingRole.value}
                    onChange={(e) => setEditingRole({ index, value: e.target.value })}
                    onBlur={() => handleEditRole(index, role, editingRole.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditRole(index, role, editingRole.value);
                      if (e.key === 'Escape') setEditingRole(null);
                    }}
                  />
                ) : (
                  <span
                    className="text-sm text-slate-200 cursor-pointer hover:text-white"
                    onClick={() => setEditingRole({ index, value: role })}
                  >
                    {role}
                  </span>
                )}
                <button
                  onClick={() => handleDeleteRole(index)}
                  className="text-slate-500 hover:text-red-400 ml-2 text-xs leading-none"
                >✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input text-sm py-1 w-44"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="New role name"
              onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
            />
            <button onClick={handleAddRole} disabled={!newRole.trim()} className="btn-primary text-sm py-1">
              Add
            </button>
          </div>
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="flex flex-1 gap-4 p-4 overflow-auto">

        {/* Player 1 team */}
        <div className="flex-1 min-w-0">
          <TeamPanel
            title="Player 1"
            team={game.player1Team}
            roles={game.roles}
            color="blue"
            canPlace={isMyTurn && myRole === 'player1' && game.phase === 'place'}
            onSlotClick={myRole === 'player1' ? handlePlace : null}
            drawnImage={game.drawnImage}
          />
        </div>

        {/* Center controls */}
        <div className="flex flex-col items-center justify-start pt-6 gap-4 w-44 shrink-0">

          {/* Drawn card */}
          <div className={`w-36 h-36 rounded-xl border-2 overflow-hidden flex items-center justify-center bg-slate-800
            ${game.drawnImage ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-slate-600 border-dashed'}`}
          >
            {game.drawnImage
              ? <img src={game.drawnImage} alt="drawn card" className="w-full h-full object-cover" />
              : <span className="text-slate-500 text-xs text-center px-3 leading-relaxed">
                  {isMyTurn && game.phase === 'draw' ? 'Press Draw' : 'Waiting...'}
                </span>
            }
          </div>

          {/* Draw button */}
          {game.phase === 'draw' && (
            <button
              onClick={handleDraw}
              disabled={!isMyTurn || actionLoading || game.imagePool.length === 0}
              className="btn-primary w-full"
            >
              {actionLoading ? '...' : 'Draw'}
            </button>
          )}

          {/* Place instruction */}
          {game.phase === 'place' && isMyTurn && (
            <p className="text-xs text-indigo-300 text-center leading-relaxed">
              Click a role slot to place this card
            </p>
          )}

          {/* Skip button */}
          {game.phase === 'place' && isMyTurn && (
            <button
              onClick={handleSkip}
              disabled={mySkipsLeft <= 0 || actionLoading}
              className="btn-ghost w-full text-sm"
            >
              Skip ({mySkipsLeft} left)
            </button>
          )}

          {/* Skips remaining (when not your turn) */}
          {game.phase === 'draw' && (
            <p className="text-xs text-slate-500 text-center">
              Your skips: {mySkipsLeft}
            </p>
          )}
        </div>

        {/* Player 2 team */}
        <div className="flex-1 min-w-0">
          <TeamPanel
            title="Player 2"
            team={game.player2Team}
            roles={game.roles}
            color="red"
            canPlace={isMyTurn && myRole === 'player2' && game.phase === 'place'}
            onSlotClick={myRole === 'player2' ? handlePlace : null}
            drawnImage={game.drawnImage}
          />
        </div>
      </div>
    </div>
  );
}

// ── TeamPanel component ──────────────────────────────────────

function TeamPanel({ title, team, roles, color, canPlace, onSlotClick, drawnImage }) {
  const headerColor = color === 'blue' ? 'text-blue-400 border-blue-500/30' : 'text-red-400 border-red-500/30';

  return (
    <div className="card h-full flex flex-col">
      <h2 className={`text-lg font-bold mb-4 pb-2 border-b ${headerColor}`}>
        {title}
      </h2>
      <div className="flex flex-col gap-2 flex-1">
        {roles.map((role) => {
          const image     = team?.[role];
          const placeable = canPlace && !image && drawnImage;
          return (
            <div
              key={role}
              onClick={() => placeable && onSlotClick(role)}
              className={`flex items-center gap-3 rounded-lg border p-2 transition-all duration-150
                ${placeable
                  ? 'border-indigo-500 bg-indigo-500/10 cursor-pointer hover:bg-indigo-500/20'
                  : image
                  ? 'border-slate-600 bg-slate-800/50'
                  : 'border-slate-700 border-dashed'
                }`}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-700 flex items-center justify-center">
                {image
                  ? <img src={image} alt={role} className="w-full h-full object-cover" />
                  : <span className="text-slate-500 text-xl">?</span>
                }
              </div>
              <span className="text-sm text-slate-300 font-medium">{role}</span>
              {placeable && (
                <span className="ml-auto text-xs text-indigo-400 font-medium">Place here ↓</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
