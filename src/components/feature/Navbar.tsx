import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCircle, X } from 'lucide-react';
import LogoIcon from './LogoIcon';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from './AuthModal';

const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const goTo = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  const navLinks = [
    { label: 'Tablaturas', action: () => goTo('/tablaturas') },
    { label: 'Assinatura', action: () => goTo('/assinatura') },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
      if (menuOpen) setMenuOpen(false);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [menuOpen]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-500 ${
          scrolled
            ? 'bg-stone-950/80 backdrop-blur-md shadow-lg shadow-black/20'
            : 'bg-gradient-to-b from-[#060607]/90 via-[#060607]/50 to-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <LogoIcon className="h-12 w-12 rounded-md object-contain m-2 bg-transparent" />
              <span className="text-base text-white transition-colors duration-300">
                <span className="font-light">Vinde </span>
                <span className="font-bold">Adoremos</span>
              </span>
            </Link>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={link.action}
                  className="text-sm text-stone-400 hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </button>
              ))}
              <Link
                to="/tabmaker"
                className="text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors duration-200"
              >
                TABVINDE
              </Link>
            </div>

            {/* CTAs desktop */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => goTo('/assinatura')}
                className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors duration-200"
              >
                Assinar
              </button>
              {user ? (
                <button onClick={() => goTo('/perfil')} className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-amber-500 hover:ring-amber-400 transition-all duration-200 flex-shrink-0" aria-label="Perfil">
                  {user.avatar
                    ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    : <span className="w-full h-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold">{user.name[0].toUpperCase()}</span>
                  }
                </button>
              ) : (
                <button onClick={() => setAuthOpen(true)} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-white transition-colors duration-200">
                  <UserCircle className="w-5 h-5" />
                  Login
                </button>
              )}
            </div>

            {/* Mobile right actions */}
            <div className="md:hidden flex items-center gap-3">
              {user ? (
                <button onClick={() => goTo('/perfil')} className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-amber-500 flex-shrink-0" aria-label="Perfil">
                  {user.avatar
                    ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    : <span className="w-full h-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold">{user.name[0].toUpperCase()}</span>
                  }
                </button>
              ) : (
                <button onClick={() => setAuthOpen(true)} className="text-stone-400 hover:text-white transition-colors duration-200" aria-label="Login">
                  <UserCircle className="w-6 h-6" />
                </button>
              )}
              <button
                className="p-1"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Abrir menu"
              >
                {menuOpen
                  ? <X className="w-5 h-5 text-white" />
                  : <div className="flex flex-col gap-1.5">
                      <span className="block w-5 h-0.5 bg-white" />
                      <span className="block w-5 h-0.5 bg-white" />
                      <span className="block w-5 h-0.5 bg-white" />
                    </div>
                }
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile drawer — dropdown below navbar */}
      {menuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 z-50 bg-stone-950/95 backdrop-blur-md border-t border-white/5 px-6 py-6 flex flex-col gap-3 shadow-xl shadow-black/40">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={link.action}
              className="w-full text-center text-base text-stone-300 hover:text-white font-medium py-3 rounded-xl border border-stone-800 hover:border-stone-600 transition-all duration-150"
            >
              {link.label}
            </button>
          ))}
          <Link
            to="/tabmaker"
            onClick={() => setMenuOpen(false)}
            className="w-full text-center text-base font-bold text-amber-400 hover:text-amber-300 py-3 rounded-xl border border-amber-500/40 hover:border-amber-500/70 transition-all duration-150"
          >
            TABVINDE
          </Link>

          <div className="flex flex-col gap-2 mt-2 pt-4 border-t border-white/5">
            <button
              onClick={() => goTo('/assinatura')}
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold py-3 rounded-full text-sm transition-all duration-200"
            >
              Assinar
            </button>
            {!user && (
              <button onClick={() => { setMenuOpen(false); setAuthOpen(true); }} className="w-full border border-stone-700 text-stone-400 font-medium py-3 rounded-full text-sm flex items-center justify-center gap-2 transition-all duration-200">
                <UserCircle className="w-4 h-4" />
                Entrar
              </button>
            )}
          </div>
        </div>
      )}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </>
  );
};

export default Navbar;
