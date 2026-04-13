const CtaSection = () => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="py-24 bg-gradient-to-b from-stone-900 to-stone-950">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight">
          Comece a tocar<br />
          <span className="text-amber-400">música sacra hoje</span>
        </h2>
        <p className="text-stone-400 text-lg mb-10 max-w-xl mx-auto">
          Junte-se a centenas de músicos que já estão levando a beleza da música sagrada através do violão.
        </p>
        <button
          onClick={() => scrollTo('assinatura')}
          className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-10 py-4 rounded-full text-base transition-all duration-200 shadow-xl shadow-amber-900/40 hover:shadow-amber-800/60"
        >
          Ver Planos de Assinatura
        </button>
      </div>
    </section>
  );
};

export default CtaSection;
