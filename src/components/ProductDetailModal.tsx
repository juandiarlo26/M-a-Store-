import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RefreshCcw,
  Ruler,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react';
import { getAvailableStockForSize, useStore } from '../context/StoreContext';
import { trackViewContent } from '../lib/analytics';
import {
  DEFAULT_DELIVERY_TIME_TEXT,
  DEFAULT_SHOE_SIZE_GUIDE,
  DEFAULT_SIZE_GUIDE,
  formatCOP,
  getProductImages,
} from '../lib/starterCatalog';
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
  const { addToCart, settings } = useStore();
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const trackedProductIdRef = useRef<string | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (product) {
      const firstAvailable =
        product.sizes.find((sz) => getAvailableStockForSize(product, sz) > 0) ||
        product.sizes[0] ||
        'Única';
      setSelectedSize(firstAvailable);
      setQuantity(1);
      setActiveImageIdx(0);
      setSizeGuideOpen(false);
      if (trackedProductIdRef.current !== product.id) {
        trackedProductIdRef.current = product.id;
        trackViewContent(product);
      }
    } else {
      trackedProductIdRef.current = null;
      setSizeGuideOpen(false);
    }
  }, [product?.id]);

  if (!product) return null;

  const gallery = getProductImages(product);
  const safeIdx = Math.min(activeImageIdx, Math.max(0, gallery.length - 1));
  const currentImageSrc = gallery[safeIdx] || product.imageUrl;

  const hasSizeBreakdown = Boolean(
    product.stockBySize && Object.keys(product.stockBySize).length > 0
  );
  const activeSize = selectedSize || product.sizes[0] || 'Única';
  const selectedSizeStock = getAvailableStockForSize(product, activeSize);
  const isOutOfStock = product.stock <= 0 || selectedSizeStock <= 0;

  const deliveryTime = settings.deliveryTimeText?.trim() || DEFAULT_DELIVERY_TIME_TEXT;
  const sizeGuideRows =
    settings.sizeGuide && settings.sizeGuide.length > 0 ? settings.sizeGuide : DEFAULT_SIZE_GUIDE;
  const shoeGuideRows =
    settings.shoeSizeGuide && settings.shoeSizeGuide.length > 0
      ? settings.shoeSizeGuide
      : DEFAULT_SHOE_SIZE_GUIDE;
  const isShoes = product.category === 'Calzado';
  const isBag = product.category === 'Bolsos';
  const isAccessory = product.category === 'Accesorios';
  const showGuideTrigger = !isAccessory && (!isBag || Boolean(product.dimensions));

  const stockLabel =
    product.stock <= 0
      ? 'Agotado temporalmente'
      : selectedSizeStock <= 0
        ? 'Talla agotada'
        : selectedSizeStock <= 3
          ? `Últimas ${selectedSizeStock} ${selectedSizeStock === 1 ? 'unidad' : 'unidades'}${hasSizeBreakdown ? ` en talla ${activeSize}` : ''}`
          : `Disponible · ${selectedSizeStock} unidades${hasSizeBreakdown ? ` (talla ${activeSize})` : ''}`;

  const handlePrevImage = () => {
    if (gallery.length <= 1) return;
    setActiveImageIdx((idx) => (idx - 1 + gallery.length) % gallery.length);
  };

  const handleNextImage = () => {
    if (gallery.length <= 1) return;
    setActiveImageIdx((idx) => (idx + 1) % gallery.length);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null || gallery.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const delta = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) {
      handleNextImage();
    } else {
      handlePrevImage();
    }
  };

  const handleAdd = () => {
    if (isOutOfStock) return;
    addToCart(product, activeSize, Math.min(selectedSizeStock, quantity));
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

        {/* Swipeable Multi-Photo Gallery */}
        <div className="flex flex-col bg-[#F8EFEA]">
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative aspect-[3/4] w-full overflow-hidden select-none group"
          >
            <ResilientImage
              src={currentImageSrc}
              alt={`${product.name} — fotografía ${safeIdx + 1}`}
              fallbackLabel={product.name}
              className="w-full h-full object-cover transition-opacity duration-300"
            />

            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevImage}
                  aria-label="Foto anterior"
                  className="absolute left-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-full bg-[#FBF9F7]/85 border border-[#EAE0DA] text-[#231F20] flex items-center justify-center shadow-xs hover:bg-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextImage}
                  aria-label="Siguiente foto"
                  className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-full bg-[#FBF9F7]/85 border border-[#EAE0DA] text-[#231F20] flex items-center justify-center shadow-xs hover:bg-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Indicator Dots */}
                <div
                  aria-label="Indicadores de galería"
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#231F20]/45 backdrop-blur-xs"
                >
                  {gallery.map((_, idx) => (
                    <button
                      key={`dot-${idx}`}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      aria-label={`Ver fotografía ${idx + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        idx === safeIdx ? 'w-5 bg-white' : 'w-2 bg-white/55 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="p-3 bg-[#F8EFEA] border-t border-[#EAE0DA] flex items-center gap-2 overflow-x-auto">
              {gallery.map((imgUrl, idx) => (
                <button
                  key={`thumb-${idx}`}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  aria-label={`Seleccionar miniatura ${idx + 1}`}
                  className={`w-14 h-18 rounded-xl overflow-hidden border shrink-0 transition-all ${
                    idx === safeIdx
                      ? 'border-[#231F20] ring-2 ring-[#231F20]/20'
                      : 'border-[#EAE0DA] opacity-70 hover:opacity-100'
                  }`}
                >
                  <ResilientImage
                    src={imgUrl}
                    alt={`${product.name} miniatura ${idx + 1}`}
                    fallbackLabel={product.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
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

            {product.dimensions && (
              <div className="bg-white border border-[#EAE0DA] rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs text-[#574B47]">
                <Ruler className="w-4 h-4 text-[#8C5E58] shrink-0 mt-0.5" strokeWidth={1.6} />
                <div>
                  <span className="font-semibold text-[#231F20]">
                    Medidas (alto × ancho × fondo):{' '}
                  </span>
                  <span>{product.dimensions}</span>
                </div>
              </div>
            )}

            {/* Size selector + Size Guide trigger */}
            <div className="space-y-2.5 pt-2">
              <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-[#231F20]">
                    {isBag || isAccessory ? 'Presentación' : 'Seleccionar talla'}
                  </span>
                  {showGuideTrigger && (
                    <button
                      type="button"
                      onClick={() => setSizeGuideOpen(true)}
                      className="inline-flex items-center gap-1 text-[#8C5E58] hover:text-[#231F20] underline underline-offset-4 font-medium"
                    >
                      <Ruler className="w-3.5 h-3.5" strokeWidth={1.6} />
                      <span>{isBag ? 'Ver medidas' : 'Guía de tallas'}</span>
                    </button>
                  )}
                </div>
                <span className="text-[#756661] tabular-nums">{stockLabel}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => {
                  const sizeStock = getAvailableStockForSize(product, size);
                  const sizeUnavailable = product.stock <= 0 || sizeStock <= 0;
                  const active = activeSize === size && !sizeUnavailable;
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={sizeUnavailable}
                      onClick={() => {
                        setSelectedSize(size);
                        setQuantity((q) => Math.max(1, Math.min(q, sizeStock)));
                      }}
                      className={`min-h-[44px] min-w-[52px] px-4 rounded-xl text-sm font-medium border transition-colors inline-flex items-center justify-center gap-1.5 ${
                        sizeUnavailable
                          ? 'bg-[#F8EFEA]/60 text-[#9E8F8A] border-[#EAE0DA] cursor-not-allowed'
                          : active
                            ? 'bg-[#231F20] text-[#FBF9F7] border-[#231F20]'
                            : 'bg-white text-[#231F20] border-[#EAE0DA] hover:border-[#231F20]/40'
                      }`}
                    >
                      <span className={sizeUnavailable ? 'line-through' : ''}>{size}</span>
                      {sizeUnavailable && (
                        <span className="text-[11px] font-normal text-[#9E8F8A]">Agotada</span>
                      )}
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
                    disabled={quantity >= selectedSizeStock}
                    onClick={() => setQuantity((q) => Math.min(selectedSizeStock, q + 1))}
                    aria-label="Aumentar cantidad"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#231F20] hover:bg-[#F8EFEA] disabled:opacity-35 rounded-r-xl transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Shipping & Returns Info Block */}
            <div className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-xl p-4 space-y-2 text-xs text-[#574B47]">
              <p className="font-semibold text-[#231F20] flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#8C5E58]" strokeWidth={1.6} />
                <span>Envíos y cambios</span>
              </p>
              <p className="leading-relaxed">
                <strong>Tiempos de entrega:</strong> {deliveryTime}.
              </p>
              <p className="leading-relaxed tabular-nums">
                <strong>Envío estándar:</strong> {formatCOP(settings.shippingFee)} · Gratis en
                compras desde {formatCOP(settings.freeShippingThreshold)}.
              </p>
              <p className="flex items-center gap-1.5 pt-0.5">
                <RefreshCcw className="w-3.5 h-3.5 text-[#8C5E58] shrink-0" strokeWidth={1.6} />
                <a
                  href="#cambios"
                  onClick={onClose}
                  className="text-[#231F20] font-medium underline underline-offset-4 hover:text-[#8C5E58]"
                >
                  Ver política de cambios, garantías y retracto
                </a>
              </p>
            </div>
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
              Derecho de retracto en 5 días hábiles · Cambios sujetos a disponibilidad
            </p>
          </div>
        </div>
      </div>

      {/* Nested Size Guide Modal */}
      {sizeGuideOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-[#231F20]/50 backdrop-blur-xs p-4"
          onClick={(e) => {
            e.stopPropagation();
            setSizeGuideOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Guía de tallas Mía Store"
        >
          <div
            className="w-full max-w-lg bg-[#FBF9F7] border border-[#EAE0DA] rounded-2xl p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#EAE0DA] pb-3">
              <div>
                <h3 className="font-display text-2xl font-medium text-[#231F20]">
                  {isBag
                    ? 'Medidas del Bolso'
                    : isShoes
                      ? 'Guía de Tallas · Calzado'
                      : 'Guía de Tallas'}
                </h3>
                <p className="text-xs text-[#756661]">
                  {isBag
                    ? 'Dimensiones aproximadas expresadas en centímetros (alto × ancho × fondo).'
                    : isShoes
                      ? 'Numeración colombiana y largo aproximado del pie en centímetros (cm).'
                      : 'Medidas de referencia corporales expresadas en centímetros (cm).'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSizeGuideOpen(false)}
                aria-label="Cerrar guía de tallas"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-[#F8EFEA] text-[#231F20]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isBag ? (
              <div className="space-y-4">
                <div className="bg-white border border-[#EAE0DA] rounded-xl p-4 space-y-1.5">
                  <p className="text-xs text-[#756661]">Alto × Ancho × Fondo</p>
                  <p className="text-base font-semibold text-[#231F20] tabular-nums">
                    {product.dimensions}
                  </p>
                </div>
                <div className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-xl p-3.5 text-xs text-[#574B47] leading-relaxed">
                  Las medidas pueden presentar variaciones mínimas por confección artesanal. Si
                  deseas confirmar capacidad para tu celular o accesorios, escríbenos por WhatsApp.
                </div>
              </div>
            ) : isShoes ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#EAE0DA] text-[#756661]">
                        <th className="py-2.5 pr-4 font-medium">Talla COL</th>
                        <th className="py-2.5 pl-4 font-medium">Largo del pie (cm)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE0DA] text-[#231F20] tabular-nums">
                      {shoeGuideRows.map((row) => (
                        <tr key={row.size}>
                          <td className="py-2.5 pr-4 font-semibold">{row.size}</td>
                          <td className="py-2.5 pl-4 text-[#574B47]">{row.footLength}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-xl p-3.5 text-xs text-[#574B47] leading-relaxed">
                  Para medir tu pie, apoya el talón sobre una hoja contra la pared y mide hasta la
                  punta del dedo más largo. Si estás entre dos tallas, elige la superior.
                </div>
              </>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#EAE0DA] text-[#756661]">
                        <th className="py-2.5 pr-3 font-medium">Talla</th>
                        <th className="py-2.5 px-3 font-medium">Busto</th>
                        <th className="py-2.5 px-3 font-medium">Cintura</th>
                        <th className="py-2.5 pl-3 font-medium">Cadera</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE0DA] text-[#231F20] tabular-nums">
                      {sizeGuideRows.map((row) => (
                        <tr key={row.size}>
                          <td className="py-2.5 pr-3 font-semibold">{row.size}</td>
                          <td className="py-2.5 px-3 text-[#574B47]">{row.bust}</td>
                          <td className="py-2.5 px-3 text-[#574B47]">{row.waist}</td>
                          <td className="py-2.5 pl-3 text-[#574B47]">{row.hip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-xl p-3.5 text-xs text-[#574B47] leading-relaxed">
                  Si estás entre dos tallas y prefieres un calce más holgado, te sugerimos elegir la
                  talla superior o escribirnos por WhatsApp para asesorarte según el corte de esta
                  prenda.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
