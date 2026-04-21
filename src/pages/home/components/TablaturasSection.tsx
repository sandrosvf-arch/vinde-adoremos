import { MonitorPlay, Play, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { tablaturas } from '@/mocks/products';

const TablaturasSection = () => {
  const navigate = useNavigate();
  const preview = tablaturas.slice(0, 10);

  return (
    <section id="tablatura-isolada" className="py-24 bg-[#060607]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 border border-stone-700 text-stone-400 text-xs font-medium tracking-widest uppercase px-4 py-2 rounded-full mb-8">
            Biblioteca
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-6">
            Tablaturas
          </h2>

          {/* TABVINDE callout */}
          <div className="mt-8 flex flex-col gap-1 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-6 py-4 w-full sm:px-10 sm:py-6">
            <div className="flex items-start gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0 mt-0.5" />
              <span className="text-amber-400 font-black text-sm sm:text-base tracking-wide uppercase leading-snug">Tablatura Interativa + Vídeo Aula</span>
            </div>
            <p className="text-white text-sm leading-relaxed">
              <span className="font-bold">TABVINDE</span> — Sistema interativo de tablatura desenvolvido 100% pela Vinde Adoremos e focado para violão Fingerstyle.
            </p>
            <p className="text-white text-sm leading-relaxed">
              Acompanhe nota a nota do que está sendo tocado, ajuste a velocidade, veja e reveja trecho por trecho quantas vezes for necessário para aprender de verdade!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {preview.map((tab) => (
            <div
              key={tab.id}
              onClick={() => tab.hasVideo && navigate(`/aprender/${tab.id}`)}
              className={`group bg-stone-900/40 rounded-2xl ring-1 ring-stone-800/60 transition-all duration-300 hover:shadow-2xl hover:shadow-black/60 isolate ${
                tab.hasVideo
                  ? 'hover:ring-stone-600 cursor-pointer'
                  : 'hover:ring-stone-700'
              }`}
            >
              {/* Cover image */}
              <div className="relative h-48 overflow-hidden rounded-t-2xl -mb-px">
                <img
                  src={tab.image}
                  alt={tab.title}
                  className="w-full h-full object-cover scale-[1.002] group-hover:scale-[1.07] transition-transform duration-500 transform-gpu backface-hidden"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/20 to-transparent" />
                {tab.hasVideo && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 border border-white/30">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="text-white font-bold text-lg sm:text-base leading-snug mb-1">{tab.title}</h3>
                <p className="text-stone-400 text-base sm:text-sm leading-snug mb-3">{tab.composer}</p>
                {tab.hasVideo && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-bold whitespace-nowrap">
                    <MonitorPlay className="w-3.5 h-3.5 flex-shrink-0" />
                    TABVINDE + Vídeo Aula
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-stone-500 text-sm">
            +{tablaturas.length} tablaturas incluídas na assinatura
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/tablaturas')}
              className="border border-stone-700 hover:border-stone-500 text-stone-300 hover:text-white font-semibold px-6 py-3 rounded-full text-sm transition-all duration-200"
            >
              Ver todas
            </button>
            <button
              onClick={() => document.getElementById('assinatura')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white hover:bg-stone-100 text-stone-900 font-semibold px-6 py-3 rounded-full text-sm transition-all duration-200"
            >
              Ver Planos
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TablaturasSection;
