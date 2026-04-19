import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import LogoIcon from './LogoIcon';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const navLinks = [
    { label: 'Assinatura', id: 'assinatura' },
    { label: 'Tablaturas', id: 'tablatura-isolada' },
    { label: 'Vídeo Aulas', id: 'tablatura-video' },
    { label: 'Loja', id: 'pingente' },
    { label: 'Sobre', id: 'sobre' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-md shadow-sm shadow-black/10'
          : 'bg-gradient-to-b from-[#060607]/90 via-[#060607]/50 to-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 group"
          >
            <LogoIcon className={`h-12 w-12 rounded-md object-contain m-2 transition-all duration-500 ${scrolled ? 'bg-[#060607]' : 'bg-transparent'}`} />
            <span className={`text-base transition-colors duration-300 ${scrolled ? 'text-stone-900' : 'text-white'}`}>
              <span className="font-light">Vinde </span>
              <span className="font-bold">Adoremos</span>
            </span>
          </button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className={`text-sm transition-colors duration-200 ${scrolled ? 'text-stone-600 hover:text-amber-600' : 'text-stone-300 hover:text-amber-400'}`}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* TabVinde desktop */}
          <Link
            to="/tabmaker"
            className={`hidden md:block text-sm font-medium px-4 py-2 rounded-full border transition-colors duration-200 ${
              scrolled ? 'border-amber-600 text-amber-600 hover:bg-amber-600 hover:text-white' : 'border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-stone-900'
            }`}
          >
            TabVinde
          </Link>

          {/* CTA desktop */}
          <button
            onClick={() => scrollTo('assinatura')}
            className="hidden md:block bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors duration-200"
          >
            Assinar
          </button>

          {/* Hamburger mobile */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-1"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Abrir menu"
          >
            <span className={`block w-5 h-0.5 transition-all duration-200 ${scrolled ? 'bg-stone-800' : 'bg-white'} ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 transition-all duration-200 ${scrolled ? 'bg-stone-800' : 'bg-white'} ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 transition-all duration-200 ${scrolled ? 'bg-stone-800' : 'bg-white'} ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className={`md:hidden border-t px-4 py-4 flex flex-col gap-3 ${scrolled ? 'bg-white border-stone-200' : 'bg-[#060607] border-stone-800'}`}>
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              className={`text-sm text-left transition-colors duration-200 py-1 ${scrolled ? 'text-stone-600 hover:text-amber-600' : 'text-stone-300 hover:text-amber-400'}`}
            >
              {link.label}
            </button>
          ))}
          <Link
            to="/tabmaker"
            onClick={() => setMenuOpen(false)}
            className="mt-1 border border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-stone-900 text-sm font-medium px-4 py-2 rounded-full transition-colors duration-200 text-center"
          >
            TabVinde
          </Link>
          <button
            onClick={() => scrollTo('assinatura')}
            className="mt-1 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors duration-200 w-full"
          >
            Assinar
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
