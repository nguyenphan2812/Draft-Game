import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Game from './pages/Game.jsx';
import ManageLists from './pages/ManageLists.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="/manage" element={<ManageLists />} />
      </Routes>
    </BrowserRouter>
  );
}