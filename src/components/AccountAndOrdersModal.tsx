import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Gift,
  LogIn,
  LogOut,
  MessageCircle,
  Package,
  ShieldCheck,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { buildOrderWhatsappUrl, formatCOP } from '../lib/starterCatalog';
import { BRAND_INFO, type OrderStatus } from '../types/store';

interface AccountAndOrdersModalProps {
  open: boolean;
  onClose: () => void;
  onOpenAdmin: () => void;
}

const STATUS_META: Record<
  OrderStatus,
  { label: string; description: string; badgeClass: string }
> = {
  pendiente: {
    label: 'Pendiente de pago',
    description: 'Envía tu solicitud por WhatsApp para confirmar el pago y coordinar el envío.',
    badgeClass: 'bg-[#FFF7ED] text-[#9A3412] border-[#FED7AA]',
  },
  pagado: {
    label: 'Pagado',
    description: 'Tu pago fue confirmado. Pronto alistaremos tus prendas.',
    badgeClass: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
  },
  preparando: {
    label: 'Preparando pedido',
    description: 'Pago confirmado. Estamos empacando tus prendas con dedicación.',
    badgeClass: 'bg-[#F8EFEA] text-[#8C5E58] border-[#D8C8BE]',
  },
  enviado: {
    label: 'Enviado',
    description: 'Tu pedido ya salió en camino hacia tu dirección de entrega.',
    badgeClass: 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]',
  },
  entregado: {
    label: 'Entregado',
    description: 'Pedido entregado con éxito. Gracias por elegir Mía Store.',
    badgeClass: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
  },
  cancelado: {
    label: 'Cancelado',
    description: 'Este pedido fue cancelado y las unidades regresaron al inventario.',
    badgeClass: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
  },
};

function getOrderStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'pendiente':
      return 0;
    case 'pagado':
    case 'preparando':
      return 1;
    case 'enviado':
      return 2;
    case 'entregado':
      return 3;
    case 'cancelado':
      return -1;
  }
}

function formatOrderDate(ts?: { toDate?: () => Date } | null): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Hoy';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(ts.toDate());
}

export function AccountAndOrdersModal({
  open,
  onClose,
  onOpenAdmin,
}: AccountAndOrdersModalProps) {
  const {
    user,
    isAdmin,
    isEligibleForWelcomeDiscount,
    orders,
    ordersLoading,
    loginWithGoogle,
    logout,
  } = useStore();
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleLogin = async () => {
    setAuthError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'No pudimos completar el inicio de sesión.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[#231F20]/45 backdrop-blur-xs p-0 md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Cuenta y Mis Pedidos"
    >
      <div
        className="w-full md:max-w-2xl max-h-[90vh] overflow-y-auto bg-[#FBF9F7] rounded-t-3xl md:rounded-2xl border border-[#EAE0DA] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#EAE0DA] flex items-center justify-between sticky top-0 bg-[#FBF9F7] z-10">
          <div>
            <h2 className="font-display text-2xl font-medium text-[#231F20]">
              {user ? 'Mi Cuenta y Pedidos' : 'Regístrate o Inicia Sesión'}
            </h2>
            <p className="text-xs text-[#756661]">
              {user
                ? user.email
                : 'Obtén 10% de descuento en tu primera compra al registrarte'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar cuenta"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-[#F8EFEA] text-[#231F20]"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!user ? (
            <div className="bg-white border border-[#EAE0DA] rounded-2xl p-6 text-center space-y-5">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#F8EFEA] border border-[#EAE0DA] flex items-center justify-center text-[#8C5E58]">
                <Gift className="w-5 h-5" strokeWidth={1.6} />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="font-display text-2xl text-[#231F20]">
                  10% de bienvenida en tu primer pedido
                </h3>
                <p className="text-sm text-[#574B47]">
                  Regístrate por primera vez con Google para activar automáticamente tu descuento del
                  10% en tu primera compra y hacer seguimiento en vivo a tus pedidos.
                </p>
              </div>
              {authError && (
                <p className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-2.5">
                  {authError}
                </p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={handleLogin}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium inline-flex items-center justify-center gap-2.5 hover:bg-[#3A3335] disabled:opacity-50 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>{busy ? 'Conectando...' : 'Registrarme / Entrar con Google'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* Profile & Admin Switch */}
              <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-semibold text-[#231F20] truncate">
                    {user.displayName || 'Clienta Mía Store'}
                  </p>
                  <p className="text-xs text-[#756661] truncate">
                    {user.email}
                    {isAdmin ? ' · Cuenta Administradora' : ' · Cuenta Registrada'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAdmin();
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#231F20] text-[#FBF9F7] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#3A3335] transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Abrir Panel Admin</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleLogout}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-[#EAE0DA] bg-[#FBF9F7] text-[#574B47] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#F8EFEA] transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Salir</span>
                  </button>
                </div>
              </div>

              {/* Welcome discount status */}
              <div className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-2xl p-4 flex items-center gap-3">
                <Gift className="w-5 h-5 text-[#8C5E58] shrink-0" strokeWidth={1.6} />
                <div className="text-xs text-[#574B47]">
                  {isEligibleForWelcomeDiscount ? (
                    <span>
                      <strong className="text-[#231F20]">Beneficio activo:</strong> Tienes un{' '}
                      <strong>10% de descuento</strong> disponible automáticamente para tu primer
                      pedido.
                    </span>
                  ) : (
                    <span>
                      Tu descuento único de bienvenida (10% en la primera compra) ya fue utilizado.
                    </span>
                  )}
                </div>
              </div>

              {/* Orders History & Live Tracking */}
              <div className="space-y-3">
                <h3 className="font-display text-2xl text-[#231F20]">Estado de Mis Pedidos</h3>
                {ordersLoading ? (
                  <div className="space-y-3">
                    <div className="h-28 rounded-2xl bg-[#F8EFEA] animate-pulse" />
                    <div className="h-28 rounded-2xl bg-[#F8EFEA] animate-pulse" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="bg-white border border-[#EAE0DA] rounded-2xl p-8 text-center space-y-2">
                    <Package className="w-6 h-6 mx-auto text-[#8C5E58]" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-[#231F20]">
                      Aún no tienes pedidos registrados
                    </p>
                    <p className="text-xs text-[#756661]">
                      Cuando solicites tu primer pedido por WhatsApp, verás aquí si está pendiente,
                      pagado, enviado o entregado.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => {
                      const meta = STATUS_META[order.status] ?? STATUS_META.pendiente;
                      const stepIndex = getOrderStepIndex(order.status);
                      const isPaid =
                        order.paymentStatus === 'pagado' ||
                        order.status === 'pagado' ||
                        order.status === 'preparando' ||
                        order.status === 'enviado' ||
                        order.status === 'entregado';

                      const timelineSteps = [
                        { label: 'Solicitado', icon: Clock },
                        { label: 'Pagado', icon: CheckCircle2 },
                        { label: 'Enviado', icon: Truck },
                        { label: 'Entregado', icon: Package },
                      ];

                      return (
                        <div
                          key={order.id}
                          className="bg-white border border-[#EAE0DA] rounded-2xl p-5 space-y-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EAE0DA] pb-3">
                            <div className="space-y-0.5">
                              <p className="font-mono text-sm font-semibold text-[#231F20] tabular-nums">
                                {order.orderNumber}
                              </p>
                              <p className="text-xs text-[#756661]">
                                {formatOrderDate(order.createdAt)} · {order.city} ·{' '}
                                {order.shippingAddress}
                              </p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-base font-semibold text-[#231F20] tabular-nums">
                                {formatCOP(order.total)}
                              </p>
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-lg border text-[11px] font-medium ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </span>
                            </div>
                          </div>

                          {/* Visual Order Tracking Progress */}
                          {order.status === 'cancelado' ? (
                            <div className="rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-[#B91C1C]">
                              <XCircle className="w-4 h-4 shrink-0" />
                              <span>{meta.description}</span>
                            </div>
                          ) : (
                            <div className="bg-[#FBF9F7] border border-[#EAE0DA] rounded-xl p-3.5 space-y-3">
                              <div className="grid grid-cols-4 gap-1.5">
                                {timelineSteps.map((st, idx) => {
                                  const Icon = st.icon;
                                  const completed = idx <= stepIndex;
                                  return (
                                    <div key={st.label} className="flex flex-col items-center gap-1">
                                      <div
                                        className={`w-7 h-7 rounded-full flex items-center justify-center border text-xs transition-colors ${
                                          completed
                                            ? 'bg-[#231F20] text-[#FBF9F7] border-[#231F20]'
                                            : 'bg-white text-[#9E8F8A] border-[#EAE0DA]'
                                        }`}
                                      >
                                        <Icon className="w-3.5 h-3.5" strokeWidth={1.7} />
                                      </div>
                                      <span
                                        className={`text-[11px] text-center leading-tight ${
                                          completed
                                            ? 'font-semibold text-[#231F20]'
                                            : 'text-[#756661]'
                                        }`}
                                      >
                                        {st.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EAE0DA] text-xs">
                                <span className="text-[#574B47]">{meta.description}</span>
                                <span
                                  className={`font-medium shrink-0 ${
                                    isPaid ? 'text-[#065F46]' : 'text-[#9A3412]'
                                  }`}
                                >
                                  {isPaid ? 'Pago confirmado' : 'Pago pendiente'}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="space-y-1.5">
                            {order.items.map((item, idx) => (
                              <div
                                key={`${order.id}-${idx}`}
                                className="flex items-center justify-between text-xs text-[#574B47]"
                              >
                                <span>
                                  {item.quantity}× {item.name} (Talla {item.size} · {item.color})
                                </span>
                                <span className="tabular-nums">
                                  {formatCOP(item.price * item.quantity)}
                                </span>
                              </div>
                            ))}
                            {order.discountAmount > 0 && (
                              <div className="flex items-center justify-between text-xs text-[#8C5E58] pt-1">
                                <span>Descuento 10% primera compra</span>
                                <span className="tabular-nums">
                                  -{formatCOP(order.discountAmount)}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-xs text-[#756661]">
                              <span>Envío</span>
                              <span className="tabular-nums">
                                {order.shippingCost === 0
                                  ? 'Gratis'
                                  : formatCOP(order.shippingCost)}
                              </span>
                            </div>
                          </div>

                          {order.status === 'pendiente' && (
                            <div className="pt-2 border-t border-[#EAE0DA]">
                              <a
                                href={buildOrderWhatsappUrl(order)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#231F20] text-[#FBF9F7] text-xs font-medium inline-flex items-center justify-center gap-2 hover:bg-[#3A3335] transition-colors w-full sm:w-auto"
                              >
                                <MessageCircle className="w-4 h-4" />
                                <span>
                                  Enviar solicitud por WhatsApp ({BRAND_INFO.whatsappDisplay})
                                </span>
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
