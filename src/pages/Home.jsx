import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot
} from 'firebase/firestore';
import { shuffleArray, createTeamTemplate } from '../utils/helpers.js';

const DEFAULT_ROLES = ['Captain', 'Vice Captain', 'Tank', 'Healer', 'Support'];

export default function Home() {
  const [imageLists, setImageLists]     = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [gameState, setGameState]       = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const navigate = useNavigate();

  // Load image lists from Firestore
  useEffect(() => {
    async function loadLists() {
      try {
        const snap = await getDoc(doc(db, 'config', 'imageLists'));
        if (snap.exists()) {
          const lists = snap.data().lists || [];
          setImageLists(lists);
          if (lists.length > 0) setSelectedList(lists[0].name);
        }
      } catch (err) {
        console.error('Failed to load image lists', err);
      }
    }
    loadLists();
  }, []);

  // Real-time listener — detect when both players are ready
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'game', 'current'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGameState(data);
        if (data.selectedList) setSelectedList(data.selectedList);
        if (data.status === 'active' && sessionStorage.getItem('playerRole')) {
          navigate('/game');
        }
      } else {
        setGameState(null);
      }
    });
    return () => unsub();
  }, [navigate]);

  // When dropdown changes, sync to Firestore so other device sees it
  async function handleListChange(name) {
    setSelectedList(name);
    try {
      const snap = await getDoc(doc(db, 'game', 'current'));
      if (snap.exists()) {
        await updateDoc(doc(db, 'game', 'current'), { selectedList: name });
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handlePlayerSelect(player) {
    if (!selectedList) return setError('Please select a card list first');
    setLoading(true);
    setError('');
    sessionStorage.setItem('playerRole', player);

    try {
      const list = imageLists.find((l) => l.name === selectedList);
      const images = list ? list.images : [];
      const teamTemplate = createTeamTemplate(DEFAULT_ROLES);
      const shuffled = shuffleArray(images);

      const snap = await getDoc(doc(db, 'game', 'current'));

      if (!snap.exists() || snap.data().status === 'waiting' && !snap.data().player1 && !snap.data().player2) {
        // Fresh game — write everything including image pool
        await setDoc(doc(db, 'game', 'current'), {
          status: 'waiting',
          player1: player === 'player1' ? { name: 'Player 1', skipsLeft: 1 } : null,
          player2: player === 'player2' ? { name: 'Player 2', skipsLeft: 1 } : null,
          selectedList,
          currentTurn: 'player1',
          phase: 'draw',
          drawnImage: null,
          imagePool: shuffled,
          allImages: images,
          roles: DEFAULT_ROLES,
          player1Team: { ...teamTemplate },
          player2Team: { ...teamTemplate },
        });
      } else {
        const data = snap.data();
        const other = player === 'player1' ? 'player2' : 'player1';
        const updates = {
          [player]: { name: player === 'player1' ? 'Player 1' : 'Player 2', skipsLeft: 1 },
          selectedList,
          imagePool: shuffled,
          allImages: images,
        };
        if (data[other]) updates.status = 'active';
        await updateDoc(doc(db, 'game', 'current'), updates);
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    try {
      await setDoc(doc(db, 'game', 'current'), {
        status: 'waiting',
        player1: null,
        player2: null,
        selectedList,
        currentTurn: 'player1',
        phase: 'draw',
        drawnImage: null,
        imagePool: [],
        allImages: [],
        roles: DEFAULT_ROLES,
        player1Team: {},
        player2Team: {},
      });
    } catch (err) {
      console.error(err);
    }
  }

  const p1Ready = gameState?.player1 !== null && gameState?.player1 !== undefined;
  const p2Ready = gameState?.player2 !== null && gameState?.player2 !== undefined;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">

      {/* Title */}
      <h1 className="text-3xl font-bold tracking-widest uppercase text-slate-100 mb-10">
        Draft Team Game
      </h1>

      {/* Card list selector */}
      <div className="mb-8 w-64">
        <label className="block text-sm text-slate-400 mb-2 text-center">
          Select card list
        </label>
        {imageLists.length === 0 ? (
          <p className="text-slate-500 text-sm text-center">
            No lists found.{' '}
            <Link to="/manage" className="text-indigo-400 underline">
              Add one here
            </Link>
          </p>
        ) : (
          <select
            value={selectedList}
            onChange={(e) => handleListChange(e.target.value)}
            className="input text-center"
          >
            {imageLists.map((l) => (
              <option key={l.name} value={l.name}>{l.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Who are you */}
      <p className="text-slate-400 text-sm mb-4">Who are you?</p>
      {(() => {
        const mySelectedRole = sessionStorage.getItem('playerRole');
        return (
          <div className="flex gap-6 mb-6">
            <button
              onClick={() => handlePlayerSelect('player1')}
              disabled={loading || p1Ready || !!mySelectedRole}
              className={`w-36 py-3 rounded-xl font-bold text-lg border-2 transition-all
                ${p1Ready
                  ? 'border-blue-500 bg-blue-500/20 text-blue-300 cursor-not-allowed'
                  : mySelectedRole
                  ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                  : 'border-slate-600 hover:border-blue-500 hover:bg-blue-500/10 text-slate-100'
                }`}
            >
              Player 1
              {p1Ready && <span className="block text-xs font-normal mt-1">Ready ✓</span>}
            </button>

            <button
              onClick={() => handlePlayerSelect('player2')}
              disabled={loading || p2Ready || !!mySelectedRole}
              className={`w-36 py-3 rounded-xl font-bold text-lg border-2 transition-all
                ${p2Ready
                  ? 'border-red-500 bg-red-500/20 text-red-300 cursor-not-allowed'
                  : mySelectedRole
                  ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                  : 'border-slate-600 hover:border-red-500 hover:bg-red-500/10 text-slate-100'
                }`}
            >
              Player 2
              {p2Ready && <span className="block text-xs font-normal mt-1">Ready ✓</span>}
            </button>
          </div>
        );
      })()}

      {/* Status / error */}
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {gameState?.status === 'waiting' && (p1Ready || p2Ready) && (
        <p className="text-slate-400 text-sm mb-4 animate-pulse">
          Waiting for the other player...
        </p>
      )}

      {/* Reset button — shown if game doc exists */}
      {gameState && (
        <button onClick={handleReset} className="text-slate-500 text-xs underline mt-2 hover:text-slate-300">
          Reset game
        </button>
      )}

      {/* Manage lists link */}
      <Link
        to="/manage"
        className="absolute bottom-6 right-6 text-slate-500 text-xs hover:text-indigo-400 transition-colors"
      >
        Manage image lists →
      </Link>
    </div>
  );
}