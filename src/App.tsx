import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import HomePage from './pages/home/page';
import TablaturasPage from './pages/tablaturas/page';
import AprenderPage from './pages/aprender/page';
import TabmakerPage from './pages/tabmaker/page';
import AssinaturaPage from './pages/assinatura/page';
import PerfilPage from './pages/perfil/page';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tablaturas" element={<TablaturasPage />} />
        <Route path="/aprender/:id" element={<AprenderPage />} />
        <Route path="/tabmaker" element={<TabmakerPage />} />
        <Route path="/assinatura" element={<AssinaturaPage />} />
        <Route path="/perfil" element={<PerfilPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
