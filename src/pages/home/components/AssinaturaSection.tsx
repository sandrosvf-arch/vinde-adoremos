import { Check, Star } from 'lucide-react';
import { planos } from '@/mocks/products';

const AssinaturaSection = () => {
  return (
    <section id="assinatura" className="pt-6 pb-24 sm:py-24 bg-[#060607]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 border border-stone-700 text-stone-400 text-xs font-medium tracking-widest uppercase px-4 py-2 rounded-full mb-8">
            Planos
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-3">
            Escolha seu acesso
          </h2>
          <p className="text-stone-400 text-lg font-serif italic mb-4">
            conteúdo completo em todos os planos
          </p>
          <p className="text-stone-500 text-sm">
            A única diferença entre os planos é o tempo de acesso.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          {planos.map((plano) => (
            <div
              key={plano.id}
              className={`relative rounded-2xl flex flex-col transition-transform duration-200 hover:-translate-y-1 ${
                plano.highlight
                  ? 'bg-white text-stone-900 shadow-2xl shadow-black/40 p-10 order-first md:order-none'
                  : 'bg-stone-900/60 border border-stone-800 text-white p-8 order-last md:order-none'
              }`}
            >
              {plano.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-stone-900 text-white text-xs font-bold px-4 py-1.5 rounded-full border border-stone-700">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  Mais vantajoso
                </div>
              )}

              {/* Name & duration */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className={`text-2xl font-black ${plano.highlight ? 'text-stone-900' : 'text-white'}`}>
                    {plano.name}
                  </h3>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${plano.highlight ? 'bg-stone-900 text-white' : 'bg-stone-800 text-stone-300'}`}>
                    {plano.duration}
                  </span>
                </div>
                <p className={`text-sm ${plano.highlight ? 'text-stone-500' : 'text-stone-500'}`}>
                  Acesso completo ao conteúdo
                </p>
              </div>

              {/* Price */}
              <div className="mb-2">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className={`text-sm ${plano.highlight ? 'text-stone-500' : 'text-stone-500'}`}>
                    {plano.installments}x de
                  </span>
                  <span className={`text-5xl font-black leading-none ${plano.highlight ? 'text-stone-900' : 'text-white'}`}>
                    {plano.pricePerInstallment}
                  </span>
                </div>
                <p className={`text-sm ${plano.highlight ? 'text-stone-400' : 'text-stone-600'}`}>
                  ou {plano.fullPrice} à vista
                </p>
              </div>

              {/* Daily cost */}
              {plano.dailyCost && (
                <p className={`text-sm font-serif italic mt-4 mb-6 pt-4 border-t ${plano.highlight ? 'text-stone-500 border-stone-200' : 'text-stone-500 border-stone-800'}`}>
                  {plano.dailyCost}
                </p>
              )}
              {!plano.dailyCost && <div className="mb-6" />}

              {/* Features */}
              <ul className="space-y-3 flex-1 mb-8">
                {plano.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <Check className={`w-4 h-4 flex-shrink-0 ${plano.highlight ? 'text-stone-900' : 'text-stone-400'}`} />
                    <span className={plano.highlight ? 'text-stone-700' : 'text-stone-400'}>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                className={`w-full py-3.5 rounded-full font-bold text-sm transition-all duration-200 ${
                  plano.highlight
                    ? 'bg-stone-900 text-white hover:bg-stone-800'
                    : 'bg-white text-stone-900 hover:bg-stone-100'
                }`}
              >
                {plano.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AssinaturaSection;
