const CtaSection = () => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="py-24 bg-gradient-to-b from-stone-900 to-stone-950">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight">
          Eleve o nível<br />
          <span className="text-amber-400">dos seus louvores</span>
        </h2>
        <button
          onClick={() => scrollTo('assinatura')}
          className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-10 py-4 rounded-full text-base transition-all duration-200 shadow-xl shadow-amber-900/40 hover:shadow-amber-800/60"
        >
          Começar Agora
        </button>

        <div className="mt-14 border-t border-stone-800 pt-10 max-w-xl mx-auto">
          <p className="text-white text-lg italic leading-relaxed font-serif">
            "Sempre que o espírito mandado por Deus se apoderava de Saul, Davi apanhava sua harpa e tocava. Então Saul sentia alívio e melhorava, e o espírito maligno o deixava."
          </p>
          <p className="text-amber-500 text-sm font-semibold mt-3 tracking-wide">1 Samuel 16:23</p>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
