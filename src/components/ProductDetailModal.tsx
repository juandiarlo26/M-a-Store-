import { useEffect, useState } from 'react';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatCOP } from '../lib/starterCatalog';
import type { Product } from '../types/store';
import { ResilientImage } from './ResilientImage';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddedToCart: () => void;
}

export function ProductDetailModal({
  product,
  onClose,
  onAddedToCart,
}: ProductDetailModalProps) {
  const { addToCart } = useStore();
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (product) {
      setSelectedSize(product.sizes[0] || 'Única');
      setQuantity(1);
    }
  }, [product]);

  if (!product) return null;

  const isOutOfStock = product.stock <= 0;
  const stockLabel = isOutOfStock
    ? 'Agotado temporalmente'
    : product.stock <= 3
      ? `Últimas ${product.stock} unidades`
      : `Disponible · ${product.stock} unidades`;

  const handleAdd = () => {
    if (isOutOfStock) return;
    addToCart(product, selectedSize || product.sizes[0] || 'Única', quantity);
    onClose();
    onAddedToCart();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[#231F20]/45 backdrop-blur-xs p-0 md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
    >
      <div
        className="relative w-full md:max-w-4xl max-h-[92vh] overflow-y-auto bg-[#FBF9F7] rounded-t-3xl md:rounded-2xl border border-[#EAE0DA] shadow-2xl grid grid-cols-1 md:grid-cols-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden w-full flex justify-center pt-3 pb-1 bg-[#FBF9F7] sticky top-0 z-10">
          <span className="w-10 h-1 rounded-full bg-[#D8C8BE]" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle de prenda"
          className="absolute top-4 right-4 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-[#FBF9F7]/90 border border-[#EAE0DA] text-[#231F20] hover:bg-[#F8EFEA] transition-colors"
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>

        {/* Editorial 3:4 Image */}
        <div className="bg-[#F8EFEA] aspect-[3/4] md:aspect-auto md:h-full overflow-hidden">
          <ResilientImage
            src={product.imageUrl}
            alt={product.name}
            fallbackLabel={product.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Contiguous Purchase Module */}
        <div className="p-6 md:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs text-[#756661] tracking-wide">
                {product.category} <span aria-hidden="true">·</span> {product.color}
                {product.sku ? (
                  <>
                    {' '}
                    <span aria-hidden="true">·</span>{' '}
                    <span className="font-mono text-[#574B47]">Cód. {product.sku}</span>
                  </>
                ) : null}
              </p>
              <h2
                id="pdp-title"
                className="font-display text-3xl md:text-4xl font-medium text-[#231F20] leading-tight"
              >
                {product.name}
              </h2>
              <p className="text-xl font-semibold text-[#231F20] tabular-nums pt-1">
                {formatCOP(product.price)}
              </p>
            </div>

            <p className="text-sm leading-relaxed text-[#574B47]">{product.description}</p>

            {/* Size selector */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#231F20]">Seleccionar talla</span>
                <span className="text-[#756661]">{stockLabel}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => {
                  const active = selectedSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`min-h-[44px] min-w-[52px] px-4 rounded-xl text-sm font-medium border transition-colors ${
                        active
                          ? 'bg-[#231F20] text-[#FBF9F7] border-[#231F20]'
                          : 'bg-white text-[#231F20] border-[#EAE0DA] hover:border-[#231F20]/40'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity selector */}
            {!isOutOfStock && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-[#231F20] block">Cantidad</span>
                <div className="inline-flex items-center border border-[#EAE0DA] rounded-xl bg-white">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Reducir cantidad"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#231F20] hover:bg-[#F8EFEA] rounded-l-xl transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-medium tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    aria-label="Aumentar cantidad"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#231F20] hover:bg-[#F8EFEA] rounded-r-xl transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#EAE0DA] space-y-3">
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={handleAdd}
              className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium flex items-center justify-center gap-2.5 hover:bg-[#3A3335] disabled:bg-[#D8C8BE] disabled:cursor-not-allowed transition-colors"
            >
              <ShoppingBag className="w-4 h-4" strokeWidth={1.75} />
              <span>
                {isOutOfStock
                  ? 'Prenda agotada'
                  : `Agregar a la bolsa · ${formatCOP(product.price * quantity)}`}
              </span>
            </button>
            <p className="text-xs text-center text-[#756661]">
              Cambios sin costo dentro de los primeros 15 días
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
