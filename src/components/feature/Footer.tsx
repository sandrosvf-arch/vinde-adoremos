import LogoIcon from './LogoIcon';

const Footer = () => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="bg-stone-950 border-t border-stone-800 pt-16 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <LogoIcon className="h-10 w-auto rounded-full" />
              <span className="text-white font-semibold">Vinde Adoremos</span>
            </div>
            <p className="text-stone-400 text-sm leading-relaxed">
              Música Cristã em arranjo fingerstyle para violão.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-medium mb-4 text-sm">Conteúdo</h4>
            <ul className="space-y-2">
              {[
                { label: 'Assinatura', id: 'assinatura' },
                { label: 'Tablaturas', id: 'tablatura-isolada' },
              ].map((link) => (
                <li key={link.id}>
                  <button
                    onClick={() => scrollTo(link.id)}
                    className="text-stone-400 hover:text-amber-400 text-sm transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h4 className="text-white font-medium mb-4 text-sm">Contato</h4>
            <ul className="space-y-2 text-stone-400 text-sm">
              <li>TikTok: @vindeadoremosoficial</li>
              <li>Instagram: @vindeadoremos_</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-stone-800 pt-6 text-center text-stone-500 text-xs">
          © 2026 Vinde Adoremos. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
