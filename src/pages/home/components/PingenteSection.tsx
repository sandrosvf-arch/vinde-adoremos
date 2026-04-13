import { ShoppingBag } from 'lucide-react';
import { produtos } from '@/mocks/products';

const PingenteSection = () => {
  return (
    <section id="pingente" className="py-24 bg-stone-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm font-medium tracking-widest uppercase mb-3">Loja</p>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Produtos</h2>
          <p className="text-stone-400 text-lg max-w-xl mx-auto">
            Leve a música sacra com você no dia a dia.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {produtos.map((produto) => (
            <div
              key={produto.id}
              className="group bg-stone-950 rounded-xl overflow-hidden border border-stone-800 hover:border-amber-600/50 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="relative aspect-square overflow-hidden bg-stone-800">
                <img
                  src={produto.image}
                  alt={produto.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-4">
                <span className="text-amber-500 text-xs font-medium">{produto.category}</span>
                <h3 className="text-white font-semibold text-sm mt-1 mb-3 leading-tight">{produto.name}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-bold text-sm">{produto.price}</span>
                  <button className="flex items-center gap-1 text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-full transition-colors">
                    <ShoppingBag className="w-3 h-3" />
                    Comprar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PingenteSection;
