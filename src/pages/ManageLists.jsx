import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function ManageLists() {
  const [lists, setLists]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  // Editing state
  const [editingIndex, setEditingIndex] = useState(null); // which list is open
  const [editName, setEditName]         = useState('');
  const [editImages, setEditImages]     = useState(''); // newline-separated URLs

  // New list form
  const [newName, setNewName]     = useState('');
  const [newImages, setNewImages] = useState('');
  const [showNew, setShowNew]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, 'config', 'imageLists')).then((snap) => {
      if (!cancelled && snap.exists()) setLists(snap.data().lists || []);
    }).catch(console.error).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function saveLists(updated) {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'imageLists'), { lists: updated });
      setLists(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  // Parse textarea into clean URL array
  function parseUrls(text) {
    return text
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
  }

  // Create new list
  async function handleCreate() {
    if (!newName.trim()) return;
    const images = parseUrls(newImages);
    const updated = [...lists, { name: newName.trim(), images }];
    await saveLists(updated);
    setNewName('');
    setNewImages('');
    setShowNew(false);
  }

  // Open edit panel
  function startEdit(index) {
    setEditingIndex(index);
    setEditName(lists[index].name);
    setEditImages(lists[index].images.join('\n'));
  }

  // Save edits
  async function handleSaveEdit() {
    const updated = lists.map((l, i) =>
      i === editingIndex
        ? { name: editName.trim(), images: parseUrls(editImages) }
        : l
    );
    await saveLists(updated);
    setEditingIndex(null);
  }

  // Delete list
  async function handleDelete(index) {
    if (!confirm(`Delete "${lists[index].name}"?`)) return;
    const updated = lists.filter((_, i) => i !== index);
    await saveLists(updated);
    if (editingIndex === index) setEditingIndex(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Image Lists</h1>
        <Link to="/" className="text-slate-400 hover:text-slate-200 text-sm">
          ← Back to home
        </Link>
      </div>

      {/* Existing lists */}
      <div className="flex flex-col gap-4 mb-6">
        {lists.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">
            No image lists yet. Create one below.
          </p>
        )}

        {lists.map((list, index) => (
          <div key={index} className="card">
            {editingIndex === index ? (
              /* Edit mode */
              <div className="flex flex-col gap-3">
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="List name"
                />
                <label className="text-xs text-slate-400">
                  Image URLs — one per line
                </label>
                <textarea
                  className="input font-mono text-xs"
                  rows={8}
                  value={editImages}
                  onChange={(e) => setEditImages(e.target.value)}
                  placeholder={"https://example.com/image1.jpg\nhttps://example.com/image2.jpg"}
                />
                <p className="text-xs text-slate-500">
                  {parseUrls(editImages).length} images
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="btn-primary text-sm"
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button
                    onClick={() => setEditingIndex(null)}
                    className="btn-ghost text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-100">{list.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {list.images.length} image{list.images.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(index)}
                    className="btn-ghost text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    className="btn-danger text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create new list */}
      {showNew ? (
        <div className="card flex flex-col gap-3">
          <h2 className="font-semibold text-slate-100">New list</h2>
          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="List name (e.g. Season 1)"
          />
          <label className="text-xs text-slate-400">
            Image URLs — one per line
          </label>
          <textarea
            className="input font-mono text-xs"
            rows={8}
            value={newImages}
            onChange={(e) => setNewImages(e.target.value)}
            placeholder={"https://example.com/image1.jpg\nhttps://example.com/image2.jpg"}
          />
          <p className="text-xs text-slate-500">
            {parseUrls(newImages).length} images
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="btn-primary text-sm"
            >
              {saving ? 'Creating...' : 'Create list'}
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className="btn-primary w-full"
        >
          + New image list
        </button>
      )}
    </div>
  );
}