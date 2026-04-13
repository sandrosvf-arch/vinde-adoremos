import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import HeroSection from './components/HeroSection';
import AssinaturaSection from './components/AssinaturaSection';
import TablaturasSection from './components/TablaturasSection';
import PingenteSection from './components/PingenteSection';
import SobreSection from './components/SobreSection';
import CtaSection from './components/CtaSection';

const HomePage = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <HeroSection />
        <AssinaturaSection />
        <TablaturasSection />
        <PingenteSection />
        <SobreSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
};

export default HomePage;
