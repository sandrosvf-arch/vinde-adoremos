import { FileText, Play } from 'lucide-react';
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
          <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-3">
            Tablaturas
          </h2>
          <p className="text-stone-400 text-lg font-serif italic">
            tablaturas com vídeo aula disponíveis
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {preview.map((tab) => (
            <div
              key={tab.id}
              onClick={() => tab.hasVideo && navigate(`/aprender/${tab.id}`)}
              className={`group bg-stone-900/40 rounded-2xl overflow-hidden border border-stone-800/60 transition-all duration-300 hover:-translate-y-1 ${
                tab.hasVideo
                  ? 'hover:border-stone-600 cursor-pointer'
                  : 'hover:border-stone-700'
              }`}
            >
              {/* Cover image */}
              <div className="relative h-48 overflow-hidden">
                <img
                  src={tab.image}
                  alt={tab.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
                <h3 className="text-white font-bold text-sm leading-snug mb-1">{tab.title}</h3>
                <p className="text-stone-500 text-xs leading-snug mb-3">{tab.composer}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-stone-600 text-xs">
                    <FileText className="w-3 h-3" />
                    {tab.pages} páginas
                  </div>
                  {tab.hasVideo && (
                    <span className="flex items-center gap-1 text-xs text-amber-500/80 font-medium">
                      <Play className="w-3 h-3 fill-amber-500/80" />
                      Vídeo aula
                    </span>
                  )}
                </div>
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
