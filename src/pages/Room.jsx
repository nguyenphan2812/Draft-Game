import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp, getDoc
} from 'firebase/firestore';
import { shuffleArray, createTeamTemplate, isGameComplete } from '../utils/helpers.js';

export default function Room() {
  const { roomCode }  = useParams();
  const navigate      = useNavigate();
  const [room, setRoom]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRoles, setShowRoles]     = useState(false);
  const [newRole, setNewRole]         = useState('');
  const [editingRole, setEditingRole] = useState(null);

  // Leave/inactivity
  const [otherLeft, setOtherLeft]             = useState(false);
  const [showInactivePopup, setShowInactivePopup] = useState(false);
  const inactiveTimer = useRef(null);

  // Join flow (visiting URL directly without sessionStorage)
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinName, setJoinName]         = useState('');
  const [joinError, setJoinError]       = useState('');
  const [joining, setJoining]           = useState(false);

  const myRole    = sessionStorage.getItem('playerRole');
  const myRoomCode = sessionStorage.getItem('roomCode');
  const isMyRoom  = myRoomCode === roomCode;

  const roomRef   = doc(db, 'rooms', roomCode);
  const isMyTurn  = room?.currentTurn === myRole;
  const myTeamKey = myRole === 'player1' ? 'player1Team' : 'player2Team';
  const oppTeamKey= myRole === 'player1' ? 'player2Team' : 'player1Team';
  const oppRole   = myRole === 'player1' ? 'player2' : 'player1';

  useEffect(() => {
    const unsub = onSnapshot(roomRef, snap => {
      if (!snap.exists()) {
        sessionStorage.removeItem('roomCode');
        sessionStorage.removeItem('playerRole');
        sessionStorage.removeItem('playerName');
        navigate('/');
        return;
      }
      const data = snap.data();
      setRoom(data);
      setLoading(false);

      // Check if other player left during active game
      if (isMyRoom && myRole) {
        const other = data.players?.[oppRole];
        if (other?.left && data.status === 'active') {
          setOtherLeft(true);
          if (!inactiveTimer.current) {
            inactiveTimer.current = setTimeout(() => setShowInactivePopup(true), 5 * 60 * 1000);
          }
        } else {
          setOtherLeft(false);
          if (inactiveTimer.current) {
            clearTimeout(inactiveTimer.current);
            inactiveTimer.current = null;
          }
          setShowInactivePopup(false);
        }
      }

      // If not a player and room needs player 2 → show join form
      if (!isMyRoom && !myRole) {
        if (!data.players?.player2 && data.status === 'waiting') {
          setShowJoinForm(true);
        }
      }
    });
    return () => {
      unsub();
      if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, navigate, myRole, isMyRoom, oppRole]);

  async function handleJoinDirect() {
    if (!joinName.trim()) return setJoinError('Please enter your name');
    setJoining(true);
    setJoinError('');
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) return setJoinError('Room not found');
      if (snap.data().players?.player2) return setJoinError('Room is already full');

      // Check if name is same as player 1
      const p1Name = snap.data().players?.player1?.name?.toLowerCase();
      if (p1Name && p1Name === joinName.trim().toLowerCase()) {
        setJoining(false);
        return setJoinError('This name is already taken in this room. Please choose a different name.');
      }

      await updateDoc(roomRef, {
        'players.player2': { name: joinName.trim(), skipsLeft: 1, left: false },
        status: 'active',
        lastActive: serverTimestamp(),
      });

      sessionStorage.setItem('roomCode', roomCode);
      sessionStorage.setItem('playerRole', 'player2');
      sessionStorage.setItem('playerName', joinName.trim());
      setShowJoinForm(false);
    } catch (err) {
      console.error(err);
      setJoinError('Something went wrong.');
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    try {
      const other = room?.players?.[oppRole];
      if (!other || other.left) {
        await deleteDoc(roomRef);
      } else {
        await updateDoc(roomRef, {
          [`players.${myRole}.left`]: true,
          lastActive: serverTimestamp(),
        });
      }
    } catch (err) { console.error(err); }
    sessionStorage.removeItem('roomCode');
    sessionStorage.removeItem('playerRole');
    sessionStorage.removeItem('playerName');
    navigate('/');
  }

  async function handleEndRoom() {
    try { await deleteDoc(roomRef); } 
    catch { console.error(`Failed to delete room ${roomCode}. It may have already been deleted.`); }
    sessionStorage.removeItem('roomCode');
    sessionStorage.removeItem('playerRole');
    sessionStorage.removeItem('playerName');
    navigate('/');
  }

  function handleStillWaiting() {
    setShowInactivePopup(false);
    if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
    inactiveTimer.current = setTimeout(() => setShowInactivePopup(true), 5 * 60 * 1000);
  }

  // ── Game actions ──────────────────────────────

  async function handleDraw() {
    if (!isMyTurn || room.phase !== 'draw' || actionLoading) return;
    setActionLoading(true);
    try {
      const pool  = [...room.imagePool];
      const drawn = pool.shift();
      await updateDoc(roomRef, { drawnImage: drawn, imagePool: pool, phase: 'place', lastActive: serverTimestamp() });
    } finally { setActionLoading(false); }
  }

  async function handlePlace(role) {
    if (!isMyTurn || room.phase !== 'place' || actionLoading) return;
    if (room[myTeamKey][role]) return;
    setActionLoading(true);
    try {
      const nextTurn    = myRole === 'player1' ? 'player2' : 'player1';
      const updatedMine = { ...room[myTeamKey], [role]: room.drawnImage };
      const updates = {
        [`${myTeamKey}.${role}`]: room.drawnImage,
        drawnImage: null,
        phase: 'draw',
        currentTurn: nextTurn,
        lastActive: serverTimestamp(),
      };
      if (isGameComplete(updatedMine, room[oppTeamKey], room.roles)) updates.status = 'complete';
      await updateDoc(roomRef, updates);
    } finally { setActionLoading(false); }
  }

  async function handleSkip() {
    if (!isMyTurn || room.phase !== 'place' || actionLoading) return;
    if (room.players[myRole]?.skipsLeft <= 0) return;
    setActionLoading(true);
    try {
      await updateDoc(roomRef, {
        [`players.${myRole}.skipsLeft`]: room.players[myRole].skipsLeft - 1,
        drawnImage: null,
        phase: 'draw',
        lastActive: serverTimestamp(),
      });
    } finally { setActionLoading(false); }
  }

  async function handleReset() {
    if (!confirm('Reset the game? All placed cards will be cleared.')) return;
    setActionLoading(true);
    try {
      const teamTemplate = createTeamTemplate(room.roles);
      const nextFirst    = room.firstTurn === 'player1' ? 'player2' : 'player1';
      await updateDoc(roomRef, {
        status: 'active',
        currentTurn: nextFirst,
        firstTurn: nextFirst,
        phase: 'draw',
        drawnImage: null,
        imagePool: shuffleArray(room.allImages),
        'players.player1.skipsLeft': 1,
        'players.player2.skipsLeft': 1,
        player1Team: { ...teamTemplate },
        player2Team: { ...teamTemplate },
        lastActive: serverTimestamp(),
      });
    } finally { setActionLoading(false); }
  }

  // ── Role management ───────────────────────────

  async function handleAddRole() {
    if (!newRole.trim()) return;
    const name = newRole.trim();
    await updateDoc(roomRef, {
      roles: [...room.roles, name],
      [`player1Team.${name}`]: null,
      [`player2Team.${name}`]: null,
    });
    setNewRole('');
  }

  async function handleEditRole(index, oldName, newName) {
    const trimmed = newName.trim();
    setEditingRole(null);
    if (!trimmed || trimmed === oldName) return;
    const rename = team => {
      const t = { ...team, [trimmed]: team[oldName] };
      delete t[oldName];
      return t;
    };
    await updateDoc(roomRef, {
      roles: room.roles.map((r, i) => i === index ? trimmed : r),
      player1Team: rename(room.player1Team),
      player2Team: rename(room.player2Team),
    });
  }

  async function handleDeleteRole(index) {
    const role = room.roles[index];
    if (!confirm(`Delete role "${role}"?`)) return;
    const removeKey = team => { const t = { ...team }; delete t[role]; return t; };
    await updateDoc(roomRef, {
      roles: room.roles.filter((_, i) => i !== index),
      player1Team: removeKey(room.player1Team),
      player2Team: removeKey(room.player2Team),
    });
  }

  // ── Render ────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>
  );

  if (!room) return null;

  const p1Name  = room.players?.player1?.name || 'Player 1';
  const p2Name  = room.players?.player2?.name || 'Player 2';
  const oppName = myRole === 'player1' ? p2Name : p1Name;
  const mySkipsLeft = room.players?.[myRole]?.skipsLeft ?? 0;

  // ── Join form (direct URL visit) ──
  if (showJoinForm) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-sm">
        <h2 className="text-xl font-bold text-slate-100 mb-1">{room.name}</h2>
        <p className="text-slate-400 text-sm mb-4">{p1Name} is waiting for a opponent</p>
        <div className="flex flex-col gap-3">
          <input className="input" placeholder="Enter your name"
            value={joinName} onChange={e => setJoinName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoinDirect()} />
          {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
          <button onClick={handleJoinDirect} disabled={joining} className="btn-primary">
            {joining ? 'Joining...' : 'Join Game'}
          </button>
          <button onClick={() => navigate('/')} className="btn-ghost text-sm">← Back to home</button>
        </div>
      </div>
    </div>
  );

  // ── Lobby ──
  if (room.status === 'waiting') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5">
      <h1 className="text-3xl font-bold text-slate-100">{room.name}</h1>

      <div className="card w-full max-w-sm text-center">
        <p className="text-slate-400 text-sm mb-2">Share this code with your friend</p>
        <div className="text-5xl font-mono font-bold text-indigo-400 tracking-widest mb-3">{roomCode}</div>
        <button onClick={() => navigator.clipboard.writeText(roomCode)} className="btn-ghost text-sm">
          📋 Copy code
        </button>
      </div>

      <div className="card w-full max-w-sm">
        <p className="text-xs text-slate-400 mb-3">Players</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-slate-200 font-medium">{p1Name}</span>
            <span className="ml-auto text-xs text-blue-400">Host</span>
          </div>
          <div className="flex items-center gap-3 border border-dashed border-slate-600 rounded-lg px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
            <span className="text-slate-500 text-sm">Waiting for opponent...</span>
          </div>
        </div>
      </div>

      {/* Roles editor (host only) */}
      {myRole === 'player1' && (
        <div className="card w-full max-w-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400">Roles</p>
            <button onClick={() => setShowRoles(!showRoles)}
              className="text-xs text-indigo-400 hover:text-indigo-300">
              {showRoles ? 'Done' : 'Edit'}
            </button>
          </div>
          {showRoles ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {room.roles.map((role, i) => (
                  <span key={i} className="flex items-center gap-1 bg-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200">
                    {role}
                    <button onClick={() => handleDeleteRole(i)} className="text-slate-500 hover:text-red-400 ml-1">✕</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input text-sm py-1" placeholder="New role..."
                  value={newRole} onChange={e => setNewRole(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddRole()} />
                <button onClick={handleAddRole} className="btn-ghost text-sm py-1">Add</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {room.roles.map((role, i) => (
                <span key={i} className="bg-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300">{role}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <button onClick={handleLeave} className="btn-danger px-8">Leave Room</button>
    </div>
  );

  // ── Complete ──
  if (room.status === 'complete') return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 p-4 overflow-hidden">
      <h1 className="text-3xl font-bold text-slate-100 shrink-0">Draft Complete! 🎉</h1>
      <div className="flex gap-6 w-full max-w-4xl flex-1 min-h-0">
        {[{ key: 'player1Team', name: p1Name, color: 'blue' }, { key: 'player2Team', name: p2Name, color: 'red' }].map(p => (
          <div key={p.key} className="flex-1 card flex flex-col min-h-0">
            <h2 className={`text-lg font-bold pb-2 mb-3 border-b shrink-0 ${
              p.color === 'blue' ? 'text-blue-400 border-blue-500/30' : 'text-red-400 border-red-500/30'}`}>
              {p.name}
            </h2>
            <div className="grid gap-2 flex-1 min-h-0"
              style={{ gridTemplateColumns: `repeat(${Math.ceil(room.roles.length / 2)}, 1fr)` }}>
              {room.roles.map(role => (
                <div key={role} className="relative rounded-xl overflow-hidden bg-slate-700 border border-slate-600">
                  {room[p.key][role]
                    ? <img src={room[p.key][role]} alt={role} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-slate-500 text-2xl">?</div>
                  }
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center py-1 px-2">
                    <span className="text-xs font-bold text-white">{role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 shrink-0">
        <button onClick={handleReset} className="btn-primary px-8 py-3 text-lg">Play Again</button>
        <button onClick={handleLeave} className="btn-ghost px-8 py-3 text-lg">🏠 Leave Room</button>
      </div>
    </div>
  );

  // ── Game ──
  return (
    <div className="min-h-screen flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-card flex-wrap gap-2">
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
          isMyTurn ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-700 text-slate-400'}`}>
          {isMyTurn ? '🎯 Your turn' : `⏳ ${oppName}'s turn`}
        </span>
        <span className="text-slate-500 text-xs font-mono">{roomCode}</span>
        <span className="text-slate-400 text-sm">🃏 {room.imagePool.length} cards left</span>
        <div className="flex gap-2">
          <button onClick={() => setShowRoles(!showRoles)} className="btn-ghost text-sm py-1">⚙️ Roles</button>
          <button onClick={handleReset} className="btn-danger text-sm py-1">Reset</button>
          <button onClick={handleLeave} className="btn-ghost text-sm py-1">🏠 Leave</button>
        </div>
      </div>

      {/* Other player left banner */}
      {otherLeft && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-6 py-2 text-center">
          <p className="text-yellow-400 text-sm">⚠️ {oppName} has left the room — waiting for them to return...</p>
        </div>
      )}

      {/* Role manager */}
      {showRoles && (
        <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Manage Roles</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {room.roles.map((role, index) => (
              <div key={index} className="flex items-center gap-1 bg-slate-700 rounded-lg px-3 py-1">
                {editingRole?.index === index ? (
                  <input autoFocus
                    className="bg-transparent text-sm text-slate-100 outline-none w-28"
                    value={editingRole.value}
                    onChange={e => setEditingRole({ index, value: e.target.value })}
                    onBlur={() => handleEditRole(index, role, editingRole.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  handleEditRole(index, role, editingRole.value);
                      if (e.key === 'Escape') setEditingRole(null);
                    }} />
                ) : (
                  <span className="text-sm text-slate-200 cursor-pointer hover:text-white"
                    onClick={() => setEditingRole({ index, value: role })}>
                    {role}
                  </span>
                )}
                <button onClick={() => handleDeleteRole(index)}
                  className="text-slate-500 hover:text-red-400 ml-2 text-xs">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="input text-sm py-1 w-44" placeholder="New role name"
              value={newRole} onChange={e => setNewRole(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddRole()} />
            <button onClick={handleAddRole} disabled={!newRole.trim()} className="btn-primary text-sm py-1">Add</button>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 gap-4 p-4 overflow-auto">
        <div className="flex-1 min-w-0">
          <TeamPanel title={p1Name} team={room.player1Team} roles={room.roles} color="blue"
            canPlace={isMyTurn && myRole === 'player1' && room.phase === 'place'}
            onSlotClick={myRole === 'player1' ? handlePlace : null}
            drawnImage={room.drawnImage} />
        </div>

        <div className="flex flex-col items-center justify-start pt-6 gap-4 w-44 shrink-0">
          <div className={`w-36 h-36 rounded-xl border-2 overflow-hidden flex items-center justify-center bg-slate-800
            ${room.drawnImage ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-slate-600 border-dashed'}`}>
            {room.drawnImage
              ? <img src={room.drawnImage} alt="drawn" className="w-full h-full object-cover" />
              : <span className="text-slate-500 text-xs text-center px-3 leading-relaxed">
                  {isMyTurn && room.phase === 'draw' ? 'Press Draw' : 'Waiting...'}
                </span>
            }
          </div>
          {room.phase === 'draw' && (
            <button onClick={handleDraw}
              disabled={!isMyTurn || actionLoading || room.imagePool.length === 0}
              className="btn-primary w-full">
              {actionLoading ? '...' : 'Draw'}
            </button>
          )}
          {room.phase === 'place' && isMyTurn && (
            <p className="text-xs text-indigo-300 text-center leading-relaxed">
              Click a role slot to place this card
            </p>
          )}
          {room.phase === 'place' && isMyTurn && (
            <button onClick={handleSkip} disabled={mySkipsLeft <= 0 || actionLoading}
              className="btn-ghost w-full text-sm">
              Skip ({mySkipsLeft} left)
            </button>
          )}
          {room.phase === 'draw' && (
            <p className="text-xs text-slate-500 text-center">Your skips: {mySkipsLeft}</p>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <TeamPanel title={p2Name} team={room.player2Team} roles={room.roles} color="red"
            canPlace={isMyTurn && myRole === 'player2' && room.phase === 'place'}
            onSlotClick={myRole === 'player2' ? handlePlace : null}
            drawnImage={room.drawnImage} />
        </div>
      </div>

      {/* Inactivity popup */}
      {showInactivePopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-slate-700 rounded-2xl p-6 w-full max-w-sm text-center">
            <p className="text-3xl mb-3">👋</p>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Are you still there?</h3>
            <p className="text-slate-400 text-sm mb-6">
              {oppName} has been gone for a while. What would you like to do?
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={handleStillWaiting} className="btn-ghost w-full">⏳ Keep Waiting</button>
              <button onClick={handleEndRoom} className="btn-danger w-full">🗑️ End Room</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamPanel({ title, team, roles, color, canPlace, onSlotClick, drawnImage }) {
  const headerColor = color === 'blue' ? 'text-blue-400 border-blue-500/30' : 'text-red-400 border-red-500/30';
  return (
    <div className="card h-full flex flex-col">
      <h2 className={`text-lg font-bold mb-4 pb-2 border-b ${headerColor}`}>{title}</h2>
      <div className="flex flex-col gap-2 flex-1">
        {roles.map(role => {
          const image    = team?.[role];
          const placeable = canPlace && !image && drawnImage;
          return (
            <div key={role} onClick={() => placeable && onSlotClick(role)}
              className={`flex items-center gap-3 rounded-lg border p-2 transition-all duration-150
                ${placeable
                  ? 'border-indigo-500 bg-indigo-500/10 cursor-pointer hover:bg-indigo-500/20'
                  : image ? 'border-slate-600 bg-slate-800/50' : 'border-slate-700 border-dashed'
                }`}>
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-700 flex items-center justify-center">
                {image
                  ? <img src={image} alt={role} className="w-full h-full object-cover" />
                  : <span className="text-slate-500 text-xl">?</span>
                }
              </div>
              <span className="text-sm text-slate-300 font-medium">{role}</span>
              {placeable && <span className="ml-auto text-xs text-indigo-400 font-medium">Place here ↓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}