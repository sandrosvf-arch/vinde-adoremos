import { Music, ChevronDown } from 'lucide-react';

const HeroSection = () => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#060607]">
      {/* Background guitar image — positioned to the right */}
      <div
        className="absolute inset-0 bg-cover bg-right bg-no-repeat"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=1920&q=85&fit=crop)',
        }}
      />

      {/* Gradient overlay: very dark on left, fades right */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#060607] via-[#060607]/90 to-[#060607]/30" />
      {/* Bottom fade to blend with next section */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#060607] to-transparent" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 border border-stone-600 text-stone-300 text-xs font-medium tracking-widest uppercase px-4 py-2 rounded-full mb-10">
          <Music className="w-3.5 h-3.5" />
          <span>Violão Fingerstyle</span>
        </div>

        {/* Heading */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-white leading-tight mb-4 max-w-2xl">
          Toque seus louvores preferidos de um jeito único
        </h1>
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-serif italic text-stone-300 leading-tight mb-8">
          Usando a técnica fingerstyle
        </h2>

        <p className="text-stone-400 text-lg md:text-xl leading-relaxed mb-10 max-w-xl">
          Tablaturas exclusivas + vídeo aulas + arranjos prontos que fazem o VIOLÃO CANTAR elevando a alma em adoração.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <button
            onClick={() => scrollTo('assinatura')}
            className="bg-white hover:bg-stone-100 text-stone-900 font-semibold px-8 py-4 rounded-full text-base transition-all duration-200 shadow-lg"
          >
            Quero Tocar Assim
          </button>
          <button
            onClick={() => scrollTo('tablatura-isolada')}
            className="border border-stone-500 hover:border-white hover:text-white text-stone-300 font-semibold px-8 py-4 rounded-full text-base transition-all duration-200"
          >
            Explorar Tablaturas
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 text-stone-400 text-sm">
          <span className="flex items-center gap-2">
            <Music className="w-4 h-4" />
            +120 músicas com vídeo aula e técnicas avançadas
          </span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-40">
        <ChevronDown className="w-5 h-5 text-stone-400 animate-bounce" />
      </div>
    </section>
  );
};

export default HeroSection;
