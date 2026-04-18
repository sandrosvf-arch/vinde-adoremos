import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/home/page';
import TablaturasPage from './pages/tablaturas/page';
import AprenderPage from './pages/aprender/page';
import TabmakerPage from './pages/tabmaker/page';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tablaturas" element={<TablaturasPage />} />
        <Route path="/aprender/:id" element={<AprenderPage />} />
        <Route path="/tabmaker" element={<TabmakerPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
