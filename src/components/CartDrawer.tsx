import { useState } from 'react';
import { Gift, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { getAvailableStockForSize, useStore } from '../context/StoreContext';
import { formatCOP } from '../lib/starterCatalog';
import { ResilientImage } from './ResilientImage';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export function CartDrawer({ open, onClose, onCheckout }: CartDrawerProps) {
  const {
    user,
    products,
    cart,
    cartSubtotal,
    welcomeDiscountAmount,
    isEligibleForWelcomeDiscount,
    shippingCost,
    cartTotal,
    settings,
    loginWithGoogle,
    updateCartQuantity,
    removeFromCart,
  } = useStore();

  const [registering, setRegistering] = useState(false);

  if (!open) return null;

  const netSubtotal = Math.max(0, cartSubtotal - welcomeDiscountAmount);
  const remainingForFreeShipping = Math.max(0, settings.freeShippingThreshold - netSubtotal);
  const progressPct =
    settings.freeShippingThreshold > 0
      ? Math.min(100, Math.round((netSubtotal / settings.freeShippingThreshold) * 100))
      : 100;

  const handleQuickRegister = async () => {
    setRegistering(true);
    try {
      await loginWithGoogle();
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#231F20]/45 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Bolsa de compras"
    >
      <div
        className="w-full max-w-md h-full bg-[#FBF9F7] border-l border-[#EAE0DA] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAE0DA] flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-medium text-[#231F20]">Tu Bolsa</h2>
            <p className="text-xs text-[#756661] tabular-nums">
              {cart.reduce((sum, i) => sum + i.quantity, 0)} prendas seleccionadas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar bolsa"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-[#F8EFEA] text-[#231F20] transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Free shipping indicator */}
        {cart.length > 0 && (
          <div className="px-6 py-3 bg-[#F8EFEA] border-b border-[#EAE0DA] space-y-2">
            <p className="text-xs text-[#574B47]">
              {remainingForFreeShipping === 0
                ? 'Tienes envío gratuito incluido en este pedido.'
                : `Te faltan ${formatCOP(remainingForFreeShipping)} para obtener envío gratuito.`}
            </p>
            <div className="w-full h-1.5 bg-[#EAE0DA] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8C5E58] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* First-order 10% welcome registration notice */}
        {cart.length > 0 && !user && (
          <div className="px-6 py-3 bg-white border-b border-[#EAE0DA] flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Gift className="w-4 h-4 text-[#8C5E58] shrink-0 mt-0.5" strokeWidth={1.6} />
              <p className="text-xs text-[#574B47] leading-snug">
                Regístrate por primera vez y recibe <strong>10% de descuento</strong> en este
                pedido.
              </p>
            </div>
            <button
              type="button"
              disabled={registering}
              onClick={handleQuickRegister}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#231F20] text-[#FBF9F7] text-[11px] font-medium whitespace-nowrap shrink-0 hover:bg-[#3A3335]"
            >
              {registering ? 'Conectando...' : 'Registrarme'}
            </button>
          </div>
        )}

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-[#EAE0DA]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#F8EFEA] flex items-center justify-center text-[#8C5E58]">
                <ShoppingBag className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 max-w-xs">
                <p className="font-display text-2xl text-[#231F20]">Tu bolsa está vacía</p>
                <p className="text-sm text-[#756661]">
                  Explora nuestras prendas atemporales y agrega tus favoritas aquí.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium hover:bg-[#3A3335] transition-colors"
              >
                Explorar colección
              </button>
            </div>
          ) : (
            cart.map((item) => {
              const liveProd = products.find((p) => p.id === item.productId);
              const liveImg = liveProd?.imageUrl || item.imageUrl;
              const liveMaxStock = liveProd
                ? getAvailableStockForSize(liveProd, item.size)
                : item.maxStock;
              return (
              <div key={`${item.productId}-${item.size}`} className="py-4 flex gap-4">
                <div className="w-20 h-26 rounded-xl overflow-hidden bg-[#F8EFEA] shrink-0 border border-[#EAE0DA]">
                  <ResilientImage
                    src={liveImg}
                    alt={item.name}
                    fallbackLabel={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#231F20] truncate">
                        {item.name}
                      </h3>
                      <p className="text-xs text-[#756661] mt-0.5">
                        Talla {item.size} <span aria-hidden="true">·</span> {item.color}
                      </p>
                      {liveMaxStock <= 0 ? (
                        <p className="text-[11px] text-[#B91C1C] mt-0.5">
                          Sin unidades en talla {item.size}
                        </p>
                      ) : item.quantity > liveMaxStock ? (
                        <p className="text-[11px] text-[#B91C1C] mt-0.5 tabular-nums">
                          Disponibles en talla {item.size}: {liveMaxStock}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId, item.size)}
                      aria-label={`Eliminar ${item.name}`}
                      className="min-h-[44px] min-w-[44px] -mt-2 -mr-2 flex items-center justify-center text-[#756661] hover:text-[#B91C1C] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="inline-flex items-center border border-[#EAE0DA] rounded-lg bg-white">
                      <button
                        type="button"
                        onClick={() =>
                          updateCartQuantity(item.productId, item.size, item.quantity - 1)
                        }
                        aria-label="Disminuir cantidad"
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#231F20] hover:bg-[#F8EFEA]"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-medium tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateCartQuantity(item.productId, item.size, item.quantity + 1)
                        }
                        disabled={item.quantity >= liveMaxStock}
                        aria-label="Aumentar cantidad"
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#231F20] hover:bg-[#F8EFEA] disabled:opacity-35"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-[#231F20] tabular-nums">
                      {formatCOP(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>

        {/* Summary footer */}
        {cart.length > 0 && (
          <div className="px-6 py-5 bg-white border-t border-[#EAE0DA] space-y-4 pb-safe">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#574B47]">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCOP(cartSubtotal)}</span>
              </div>
              {isEligibleForWelcomeDiscount && welcomeDiscountAmount > 0 && (
                <div className="flex justify-between text-[#8C5E58] font-medium">
                  <span>Descuento 10% primera compra</span>
                  <span className="tabular-nums">-{formatCOP(welcomeDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#574B47]">
                <span>Envío</span>
                <span className="tabular-nums">
                  {shippingCost === 0 ? 'Gratis' : formatCOP(shippingCost)}
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold text-[#231F20] pt-2 border-t border-[#EAE0DA]">
                <span>Total</span>
                <span className="tabular-nums">{formatCOP(cartTotal)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onCheckout}
              className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium hover:bg-[#3A3335] transition-colors"
            >
              Continuar con mi pedido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
