import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Gift,
  LogIn,
  MessageCircle,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  buildOrderWhatsappMessage,
  buildOrderWhatsappUrl,
  formatCOP,
} from '../lib/starterCatalog';
import { BRAND_INFO, type Order } from '../types/store';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onViewOrders: () => void;
}

export function CheckoutModal({ open, onClose, onViewOrders }: CheckoutModalProps) {
  const {
    user,
    cart,
    cartSubtotal,
    welcomeDiscountAmount,
    isEligibleForWelcomeDiscount,
    shippingCost,
    cartTotal,
    isUsingStarterPreview,
    loginWithGoogle,
    placeOrder,
  } = useStore();

  const [step, setStep] = useState<'form' | 'success'>('form');
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [city, setCity] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setStep('form');
      setConfirmedOrder(null);
      setErrorMsg(null);
      setCopiedSummary(false);
      if (user) {
        if (!customerName && user.displayName) setCustomerName(user.displayName);
        if (!customerEmail && user.email) setCustomerEmail(user.email);
      }
    }
  }, [open, user]);

  if (!open) return null;

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setProcessing(true);
    try {
      const loggedUser = await loginWithGoogle();
      if (!customerName && loggedUser.displayName) setCustomerName(loggedUser.displayName);
      if (!customerEmail && loggedUser.email) setCustomerEmail(loggedUser.email);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No pudimos iniciar sesión con Google.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user) {
      setErrorMsg(
        'Por favor regístrate o inicia sesión con Google para registrar tu pedido y aplicar tu beneficio.'
      );
      return;
    }
    if (customerName.trim().length < 2) {
      setErrorMsg('Ingresa tu nombre completo.');
      return;
    }
    if (customerPhone.trim().length < 7) {
      setErrorMsg('Ingresa un número de teléfono o WhatsApp válido.');
      return;
    }
    if (city.trim().length < 2 || shippingAddress.trim().length < 5) {
      setErrorMsg('Completa tu ciudad y dirección de entrega.');
      return;
    }

    setProcessing(true);
    try {
      const order = await placeOrder({
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        city,
        notes,
      });

      setConfirmedOrder(order);
      setStep('success');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Ocurrió un error al registrar tu pedido.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleCopySummary = async () => {
    if (!confirmedOrder) return;
    try {
      await navigator.clipboard.writeText(buildOrderWhatsappMessage(confirmedOrder));
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[#231F20]/50 backdrop-blur-xs p-0 md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Solicitar pedido por WhatsApp"
    >
      <div
        className="w-full md:max-w-3xl max-h-[94vh] overflow-y-auto bg-[#FBF9F7] rounded-t-3xl md:rounded-2xl border border-[#EAE0DA] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAE0DA] flex items-center justify-between sticky top-0 bg-[#FBF9F7] z-10">
          <div>
            <h2 className="font-display text-2xl font-medium text-[#231F20]">
              {step === 'form' ? 'Solicitar Pedido por WhatsApp' : 'Pedido Listo para Enviar'}
            </h2>
            <p className="text-xs text-[#756661]">
              {step === 'form'
                ? `Confirma tu dirección y envía tu solicitud directa al ${BRAND_INFO.whatsappDisplay}`
                : `Registrado en tu cuenta · WhatsApp ${BRAND_INFO.whatsappDisplay}`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar solicitud de pedido"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-[#F8EFEA] text-[#231F20]"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6">
          {errorMsg && (
            <div className="mb-5 text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3">
              {errorMsg}
            </div>
          )}

          {isUsingStarterPreview && step !== 'success' && (
            <div className="mb-5 text-xs text-[#7C2D12] bg-[#FFF7ED] border border-[#FED7AA] rounded-xl px-4 py-3">
              Nota: El catálogo en vivo aún no está publicado en Firebase. Inicia sesión como
              administradora y pulsa &ldquo;Publicar colección inicial&rdquo; para activar el
              inventario real antes de recibir pedidos.
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleSubmitOrder} className="space-y-6">
              {!user ? (
                <div className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#231F20] flex items-center gap-2">
                      <Gift className="w-4 h-4 text-[#8C5E58]" />
                      <span>Regístrate y obtén 10% en tu primer pedido</span>
                    </p>
                    <p className="text-xs text-[#574B47]">
                      Al registrarte por primera vez con Google descontamos el 10% automáticamente y
                      podrás ver el estado de tu pedido en tiempo real.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={handleGoogleAuth}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#231F20] text-[#FBF9F7] text-xs font-medium inline-flex items-center justify-center gap-2 hover:bg-[#3A3335] shrink-0"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{processing ? 'Conectando...' : 'Registrarme con Google'}</span>
                  </button>
                </div>
              ) : (
                isEligibleForWelcomeDiscount && (
                  <div className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-2xl px-4 py-3 flex items-center gap-2.5 text-xs text-[#231F20]">
                    <Gift className="w-4 h-4 text-[#8C5E58] shrink-0" />
                    <span>
                      Descuento del <strong>10% de primera compra</strong> aplicado (
                      -{formatCOP(welcomeDiscountAmount)}).
                    </span>
                  </div>
                )
              )}

              {/* Selected garments summary */}
              <div className="bg-white border border-[#EAE0DA] rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-[#756661]">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#8C5E58]" />
                  <span>Prendas seleccionadas ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
                </div>
                <div className="divide-y divide-[#EAE0DA]">
                  {cart.map((item) => (
                    <div
                      key={`${item.productId}-${item.size}`}
                      className="py-2 flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-[#231F20]">
                        {item.quantity}× {item.name}{' '}
                        <span className="text-[#756661]">
                          (Talla {item.size} · {item.color})
                        </span>
                      </span>
                      <span className="font-medium text-[#231F20] tabular-nums shrink-0">
                        {formatCOP(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#231F20]" htmlFor="chk-name">
                    Nombre completo
                  </label>
                  <input
                    id="chk-name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="María Fernanda Gómez"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#231F20]" htmlFor="chk-email">
                    Correo electrónico
                  </label>
                  <input
                    id="chk-email"
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="nombre@correo.com"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#231F20]" htmlFor="chk-phone">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    id="chk-phone"
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="300 123 4567"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#231F20]" htmlFor="chk-city">
                    Ciudad
                  </label>
                  <input
                    id="chk-city"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bogotá, Medellín, Cali..."
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#231F20]" htmlFor="chk-address">
                  Dirección completa (barrio, apartamento o conjunto)
                </label>
                <input
                  id="chk-address"
                  type="text"
                  required
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Calle 85 # 12-40, Apto 402"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#231F20]" htmlFor="chk-notes">
                  Notas de entrega o empaque regalo (opcional)
                </label>
                <input
                  id="chk-notes"
                  type="text"
                  maxLength={300}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Dejar en portería o incluir tarjeta de regalo"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                />
              </div>

              {/* Breakdown & WhatsApp Request CTA */}
              <div className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-2xl p-5 space-y-4">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-[#574B47]">
                    <span>Subtotal prendas</span>
                    <span className="tabular-nums">{formatCOP(cartSubtotal)}</span>
                  </div>
                  {isEligibleForWelcomeDiscount && welcomeDiscountAmount > 0 && (
                    <div className="flex justify-between text-[#8C5E58] font-medium">
                      <span>Descuento 10% primera compra</span>
                      <span className="tabular-nums">-{formatCOP(welcomeDiscountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#574B47]">
                    <span>Envío {city.trim() ? `a ${city.trim()}` : ''}</span>
                    <span className="tabular-nums">
                      {shippingCost === 0 ? 'Gratis' : formatCOP(shippingCost)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-semibold text-[#231F20] pt-2 border-t border-[#EAE0DA]">
                    <span>Total del pedido</span>
                    <span className="tabular-nums">{formatCOP(cartTotal)}</span>
                  </div>
                </div>

                <p className="text-xs text-[#574B47] leading-relaxed">
                  Al confirmar, apartamos tus prendas del inventario, guardamos tu pedido en tu
                  cuenta como <strong>Pendiente de pago</strong> y te damos el enlace directo a
                  nuestro WhatsApp ({BRAND_INFO.whatsappDisplay}) para coordinar el pago y el
                  envío.
                </p>

                <button
                  type="submit"
                  disabled={processing}
                  className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#3A3335] disabled:opacity-60 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    {processing
                      ? 'Registrando solicitud...'
                      : `Confirmar y solicitar por WhatsApp · ${formatCOP(cartTotal)}`}
                  </span>
                </button>
              </div>
            </form>
          )}

          {step === 'success' && confirmedOrder && (
            <div className="py-2 text-center space-y-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#F8EFEA] border border-[#EAE0DA] flex items-center justify-center text-[#231F20]">
                <CheckCircle2 className="w-7 h-7" strokeWidth={1.5} />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <p className="font-mono text-xs text-[#8C5E58] tracking-wider">
                  {confirmedOrder.orderNumber} · Estado: Pendiente de pago
                </p>
                <h3 className="font-display text-3xl text-[#231F20]">
                  Solicitud lista, {confirmedOrder.customerName.split(' ')[0]}
                </h3>
                <p className="text-sm text-[#574B47]">
                  Tus prendas quedaron apartadas en inventario. Pulsa el botón para enviar tu
                  solicitud con dirección y valores a nuestro WhatsApp (
                  {BRAND_INFO.whatsappDisplay}).
                </p>
              </div>

              {/* Primary WhatsApp Direct Handoff */}
              <div className="max-w-lg mx-auto space-y-3">
                <a
                  href={buildOrderWhatsappUrl(confirmedOrder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium flex items-center justify-center gap-2.5 hover:bg-[#3A3335] transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>Enviar solicitud a WhatsApp ({BRAND_INFO.whatsappDisplay})</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="w-full min-h-[44px] px-5 py-2.5 rounded-xl border border-[#EAE0DA] bg-white text-[#574B47] text-xs font-medium inline-flex items-center justify-center gap-2 hover:bg-[#F8EFEA]"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-4 h-4 text-[#16A34A]" />
                      <span>Mensaje copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar resumen del pedido</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 text-left space-y-3 max-w-lg mx-auto">
                <div className="flex justify-between text-xs text-[#756661] pb-2 border-b border-[#EAE0DA]">
                  <span>Entrega en {confirmedOrder.city}</span>
                  <span>Ref. {confirmedOrder.paymentReference}</span>
                </div>
                <p className="text-xs text-[#574B47]">{confirmedOrder.shippingAddress}</p>
                <div className="space-y-1.5 pt-1">
                  {confirmedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-[#231F20]">
                      <span>
                        {item.quantity}× {item.name} ({item.size})
                      </span>
                      <span className="tabular-nums">
                        {formatCOP(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                  {confirmedOrder.discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-[#8C5E58] font-medium">
                      <span>Descuento 10% primera compra</span>
                      <span className="tabular-nums">
                        -{formatCOP(confirmedOrder.discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-[#574B47]">
                    <span>Envío</span>
                    <span className="tabular-nums">
                      {confirmedOrder.shippingCost === 0
                        ? 'Gratis'
                        : formatCOP(confirmedOrder.shippingCost)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-sm font-semibold text-[#231F20] pt-2 border-t border-[#EAE0DA]">
                  <span>Total a pagar</span>
                  <span className="tabular-nums">{formatCOP(confirmedOrder.total)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewOrders();
                  }}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl border border-[#EAE0DA] bg-white text-[#231F20] text-sm font-medium hover:bg-[#F8EFEA]"
                >
                  Ver estado en Mi Cuenta
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#F8EFEA] text-[#231F20] text-sm font-medium hover:bg-[#EAE0DA]"
                >
                  Seguir explorando
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
