import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, setDoc, updateDoc, getDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { generateRoomCode, shuffleArray, createTeamTemplate } from '../utils/helpers.js';

const DEFAULT_ROLES = ['Captain', 'Vice Captain', 'Tank', 'Healer', 'Support'];

export default function Home() {
  const [rooms, setRooms]             = useState([]);
  const [imageLists, setImageLists]   = useState([]);
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);

  // Create room modal
  const [showCreate, setShowCreate]   = useState(false);
  const [createForm, setCreateForm]   = useState({
    roomName: '', playerName: '', selectedList: '',
    visibility: 'public', roles: [...DEFAULT_ROLES], newRole: '',
  });
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState('');

  // Join modals
  const [joiningRoom, setJoiningRoom] = useState(null);
  const [joinName, setJoinName]       = useState('');
  const [joinCode, setJoinCode]       = useState('');
  const [showJoinByCode, setShowJoinByCode] = useState(false);
  const [joining, setJoining]         = useState(false);
  const [joinError, setJoinError]     = useState('');

  const [verifyingRoom, setVerifyingRoom] = useState(null); // private room pending code verify
  const [verifyCode, setVerifyCode]       = useState('');
  const [verifyError, setVerifyError]     = useState('');

  const [page, setPage] = useState(1);
  const ROOMS_PER_PAGE  = 10;

  const navigate = useNavigate();

  // Load image lists
  useEffect(() => {
    getDoc(doc(db, 'config', 'imageLists')).then(snap => {
      if (snap.exists()) {
        const lists = snap.data().lists || [];
        setImageLists(lists);
        if (lists.length > 0)
          setCreateForm(f => ({ ...f, selectedList: lists[0].name }));
      }
    });
  }, []);

  // Real-time rooms + auto-cleanup
  useEffect(() => {
    const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, async snap => {
      const now = Date.now();
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Auto-delete rooms inactive for 30 minutes
    for (const room of all) {
      const last = room.lastActive?.toMillis?.() || room.createdAt?.toMillis?.() || null;
      if (!last) continue;

      const ageMinutes = (now - last) / 1000 / 60;

      // Delete waiting rooms after 30 minutes
      if (room.status === 'waiting' && ageMinutes > 30) {
        try 
          { await deleteDoc(doc(db, 'rooms', room.id)); } 
        catch (err)
          { console.error(`Failed to delete room ${room.id}:`, err); }
        continue;
      }

      // Delete active rooms after 60 minutes of inactivity (both players probably left)
      if (room.status === 'active' && ageMinutes > 60) {
        try 
          { await deleteDoc(doc(db, 'rooms', room.id)); } 
        catch (err)
          { console.error(`Failed to delete room ${room.id}:`, err); }
        continue;
      }

      // Delete completed rooms after 10 minutes
      if (room.status === 'complete' && ageMinutes > 10) {
        try 
          { await deleteDoc(doc(db, 'rooms', room.id)); } 
        catch (err)
          { console.error(`Failed to delete room ${room.id}:`, err); }
        continue;
      }
    }

      setRooms(all.slice(0, 20));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Show ALL rooms (public and private), filter by search
  const filtered = [...rooms].filter(r => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(s) ||
      r.id?.toLowerCase().includes(s) ||
      r.status?.toLowerCase().includes(s)
    );
  });

  // Reset to page 1 automatically when search changes by deriving currentPage
  const totalPages = Math.ceil(filtered.length / ROOMS_PER_PAGE);
  const safePage   = Math.min(page, totalPages || 1);
  const paginated  = filtered.slice((safePage - 1) * ROOMS_PER_PAGE, safePage * ROOMS_PER_PAGE);

  async function handleCreate() {
    if (!createForm.playerName.trim()) return setCreateError('Please enter your name');
    if (!createForm.selectedList)      return setCreateError('Please select an image list');
    setCreating(true);
    setCreateError('');
    try {
      const code        = generateRoomCode();
      const list        = imageLists.find(l => l.name === createForm.selectedList);
      const images      = list?.images || [];
      const teamTemplate = createTeamTemplate(createForm.roles);
      const roomName    = createForm.roomName.trim() || `Room ${code}`;

      // Check if room name already exists
      const existingRooms = rooms.filter(r => 
        r.name?.toLowerCase() === roomName.toLowerCase() && r.status !== 'complete'
      );
      if (existingRooms.length > 0) {
        setCreating(false);
        return setCreateError('A room with this name already exists. Please choose a different name.');
      }
      
      await setDoc(doc(db, 'rooms', code), {
        name: roomName,
        visibility: createForm.visibility,
        status: 'waiting',
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        players: {
          player1: { name: createForm.playerName.trim(), skipsLeft: 1, left: false },
          player2: null,
        },
        currentTurn: 'player1',
        firstTurn: 'player1',
        phase: 'draw',
        drawnImage: null,
        selectedList: createForm.selectedList,
        imagePool: shuffleArray(images),
        allImages: images,
        roles: createForm.roles,
        player1Team: { ...teamTemplate },
        player2Team: { ...teamTemplate },
      });

      sessionStorage.setItem('roomCode', code);
      sessionStorage.setItem('playerRole', 'player1');
      sessionStorage.setItem('playerName', createForm.playerName.trim());
      navigate(`/room/${code}`);
    } catch (err) {
      console.error(err);
      setCreateError('Something went wrong. Try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(room, name) {
    if (!name.trim()) return setJoinError('Please enter your name');
    setJoining(true);
    setJoinError('');
    try {
      const snap = await getDoc(doc(db, 'rooms', room.id));
      if (!snap.exists())            return setJoinError('Room not found');
      if (snap.data().players?.player2) return setJoinError('Room is already full');

      // Check if name is same as player 1
      const p1Name = snap.data().players?.player1?.name?.toLowerCase();
      if (p1Name && p1Name === name.trim().toLowerCase()) {
        setJoining(false);
        return setJoinError('This name is already taken in this room. Please choose a different name.');
      }

      await updateDoc(doc(db, 'rooms', room.id), {
        'players.player2': { name: name.trim(), skipsLeft: 1, left: false },
        status: 'active',
        lastActive: serverTimestamp(),
      });

      sessionStorage.setItem('roomCode', room.id);
      sessionStorage.setItem('playerRole', 'player2');
      sessionStorage.setItem('playerName', name.trim());
      navigate(`/room/${room.id}`);
    } catch (err) {
      console.error(err);
      setJoinError('Something went wrong. Try again.');
    } finally {
      setJoining(false);
    }
  }

  async function handleJoinByCode() {
    if (!joinCode.trim()) return setJoinError('Please enter a room code');
    setJoinError('');
    try {
      const snap = await getDoc(doc(db, 'rooms', joinCode.toUpperCase()));
      if (!snap.exists()) return setJoinError('Room not found');
      setJoiningRoom({ id: joinCode.toUpperCase(), ...snap.data() });
      setShowJoinByCode(false);
      setJoinCode('');
    } catch {
      setJoinError('Something went wrong. Try again.');
    }
  }

  function addRole() {
    if (!createForm.newRole.trim()) return;
    setCreateForm(f => ({ ...f, roles: [...f.roles, f.newRole.trim()], newRole: '' }));
  }

  function removeRole(i) {
    setCreateForm(f => ({ ...f, roles: f.roles.filter((_, idx) => idx !== i) }));
  }

  const statusBadge = s => {
    if (s === 'waiting')  return 'text-yellow-400 bg-yellow-400/10';
    if (s === 'active')   return 'text-green-400 bg-green-400/10';
    if (s === 'complete') return 'text-slate-400 bg-slate-400/10';
    return 'text-slate-400 bg-slate-700';
  };
  const statusText = s => ({ waiting: 'Waiting', active: 'In Game', complete: 'Complete' }[s] || s);

  return (
    <div className="min-h-screen px-6 py-10 max-w-4xl mx-auto">

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-widest uppercase text-slate-100 mb-2">
          Draft Team Game
        </h1>
        <p className="text-slate-400 text-sm">Create a room or join a friend's game</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-6 justify-center">
        <button onClick={() => { setShowCreate(true); setCreateError(''); }} className="btn-primary px-6">
          + Create Room
        </button>
        <button onClick={() => { setShowJoinByCode(true); setJoinError(''); }} className="btn-ghost px-6">
          🔑 Enter Code
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          className="input"
          placeholder="Search by room name, code, or status..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Room list */}
      <div className="flex flex-col gap-3">
        {loading && <p className="text-slate-400 text-center py-8">Loading rooms...</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-slate-500 text-center py-8">No public rooms right now. Create one!</p>
        )}
        {paginated.map(room => {
          const p1Name = room.players?.player1?.name || 'Player 1';
          const p2Name = room.players?.player2?.name;
          const isFull = !!room.players?.player2;
          const isPrivate = room.visibility === 'private';

          return (
            <div key={room.id} className="card flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-slate-100 truncate">{room.name}</p>
                  {isPrivate && <span className="text-slate-400 text-sm">🔒</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(room.status)}`}>
                    {statusText(room.status)}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {p2Name ? `${p1Name} vs ${p2Name}` : `${p1Name} is waiting...`}
                  {' · '}
                  {isFull ? '2/2' : '1/2'} players
                </p>
              </div>
              <button
                onClick={() => {
                  if (isFull) return;
                  if (isPrivate) {
                    // Private room — verify code matches THIS room
                    setVerifyingRoom(room);
                    setVerifyCode('');
                    setVerifyError('');
                  } else {
                    setJoiningRoom(room);
                    setJoinName('');
                    setJoinError('');
                  }
                }}
                disabled={isFull}
                className={isFull
                  ? 'btn-ghost text-sm opacity-40 cursor-not-allowed'
                  : 'btn-primary text-sm'
                }
              >
                {isFull ? 'Full' : isPrivate ? '🔒 Join' : 'Join'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Manage lists link */}
      <Link to="/manage" className="fixed bottom-6 right-6 text-slate-600 text-xs hover:text-indigo-400 transition-colors">
        Manage lists →
      </Link>

      {/* ── Create Room Modal ── */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <h2 className="text-xl font-bold text-slate-100 mb-4">Create Room</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Room name (optional)</label>
              <input className="input" placeholder="e.g. Nguyen vs Tuan"
                value={createForm.roomName}
                onChange={e => setCreateForm(f => ({ ...f, roomName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Your name *</label>
              <input className="input" placeholder="Enter your name"
                value={createForm.playerName}
                onChange={e => setCreateForm(f => ({ ...f, playerName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Image list *</label>
              {imageLists.length === 0
                ? <p className="text-slate-500 text-sm">No lists found. <Link to="/manage" className="text-indigo-400 underline">Add one here</Link></p>
                : <select className="input" value={createForm.selectedList}
                    onChange={e => setCreateForm(f => ({ ...f, selectedList: e.target.value }))}>
                    {imageLists.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
                  </select>
              }
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Visibility</label>
              <div className="flex gap-2">
                {['public', 'private'].map(v => (
                  <button key={v} onClick={() => setCreateForm(f => ({ ...f, visibility: v }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all
                      ${createForm.visibility === v
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                        : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                    {v === 'public' ? '🌐 Public' : '🔒 Private'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Roles</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {createForm.roles.map((role, i) => (
                  <span key={i} className="flex items-center gap-1 bg-slate-700 rounded-lg px-3 py-1 text-sm text-slate-200">
                    {role}
                    <button onClick={() => removeRole(i)} className="text-slate-500 hover:text-red-400 ml-1 text-xs">✕</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input text-sm py-1" placeholder="Add role..."
                  value={createForm.newRole}
                  onChange={e => setCreateForm(f => ({ ...f, newRole: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addRole()} />
                <button onClick={addRole} className="btn-ghost text-sm py-1">Add</button>
              </div>
            </div>
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
            <button onClick={handleCreate} disabled={creating} className="btn-primary w-full mt-1">
              {creating ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Join by code modal ── */}
      {showJoinByCode && (
        <Modal onClose={() => { setShowJoinByCode(false); setJoinError(''); setJoinCode(''); }}>
          <h2 className="text-xl font-bold text-slate-100 mb-4">Join by Code</h2>
          <div className="flex flex-col gap-3">
            <input className="input font-mono uppercase tracking-widest text-center text-xl"
              placeholder="ABC123" maxLength={6}
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())} />
            {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
            <button onClick={handleJoinByCode} className="btn-primary">Find Room</button>
          </div>
        </Modal>
      )}

      {/* ── Join room modal ── */}
      {joiningRoom && (
        <Modal onClose={() => { setJoiningRoom(null); setJoinName(''); setJoinError(''); }}>
          <h2 className="text-xl font-bold text-slate-100 mb-1">Join Room</h2>
          <p className="text-slate-400 text-sm mb-4">{joiningRoom.name}</p>
          <div className="flex flex-col gap-3">
            <input className="input" placeholder="Enter your name"
              value={joinName}
              onChange={e => setJoinName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin(joiningRoom, joinName)} />
            {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
            <button onClick={() => handleJoin(joiningRoom, joinName)} disabled={joining} className="btn-primary">
              {joining ? 'Joining...' : 'Join Game'}
            </button>
          </div>
        </Modal>
      )}
      {/* ── Verify private room code modal ── */}
      {verifyingRoom && (
        <Modal onClose={() => { setVerifyingRoom(null); setVerifyCode(''); setVerifyError(''); }}>
          <h2 className="text-xl font-bold text-slate-100 mb-1">Private Room</h2>
          <p className="text-slate-400 text-sm mb-4">Enter the room code to join <span className="text-slate-200 font-medium">{verifyingRoom.name}</span></p>
          <div className="flex flex-col gap-3">
            <input
              className="input font-mono uppercase tracking-widest text-center text-xl"
              placeholder="ABC123"
              maxLength={6}
              value={verifyCode}
              onChange={e => { setVerifyCode(e.target.value.toUpperCase()); setVerifyError(''); }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (verifyCode === verifyingRoom.id) {
                    setJoiningRoom(verifyingRoom);
                    setJoinName('');
                    setJoinError('');
                    setVerifyingRoom(null);
                    setVerifyCode('');
                  } else {
                    setVerifyError('Incorrect code. Please try again.');
                  }
                }
              }}
            />
            {verifyError && <p className="text-red-400 text-sm text-center">{verifyError}</p>}
            <button
              className="btn-primary"
              onClick={() => {
                if (verifyCode === verifyingRoom.id) {
                  setJoiningRoom(verifyingRoom);
                  setJoinName('');
                  setJoinError('');
                  setVerifyingRoom(null);
                  setVerifyCode('');
                } else {
                  setVerifyError('Incorrect code. Please try again.');
                }
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="btn-ghost text-sm py-1 px-3 disabled:opacity-40"
          >
            ← Prev
          </button>

          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-all
                  ${safePage === n
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="btn-ghost text-sm py-1 px-3 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      {/* Room count */}
      {filtered.length > 0 && (
        <p className="text-slate-600 text-xs text-center mt-2">
          Showing {(safePage - 1) * ROOMS_PER_PAGE + 1}–{Math.min(safePage * ROOMS_PER_PAGE, filtered.length)} of {filtered.length} rooms
        </p>
      )}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card border border-slate-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}