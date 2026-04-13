import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/home/page';
import TablaturasPage from './pages/tablaturas/page';
import AprenderPage from './pages/aprender/page';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tablaturas" element={<TablaturasPage />} />
        <Route path="/aprender/:id" element={<AprenderPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
