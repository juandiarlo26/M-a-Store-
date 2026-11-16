import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Gift,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { buildOrderWhatsappUrl, formatCOP } from '../lib/starterCatalog';
import { BRAND_INFO, COLOMBIA_WHATSAPP_10_REGEX, type OrderStatus } from '../types/store';

interface AccountAndOrdersModalProps {
  open: boolean;
  initialTab?: 'login' | 'register';
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

interface PasswordStrength {
  bars: 0 | 1 | 2 | 3 | 4;
  label: string;
  textClass: string;
  barClass: string;
}

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      bars: 0,
      label: 'Mínimo 8 caracteres',
      textClass: 'text-[#756661]',
      barClass: 'bg-[#EAE0DA]',
    };
  }
  if (password.length < 8) {
    return {
      bars: 1,
      label: `Muy corta (${password.length}/8 caracteres)`,
      textClass: 'text-[#B91C1C]',
      barClass: 'bg-[#DC2626]',
    };
  }

  let criteria = 0;
  if (password.length >= 10) criteria += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) criteria += 1;
  if (/[0-9]/.test(password)) criteria += 1;
  if (/[^A-Za-z0-9]/.test(password)) criteria += 1;

  if (criteria <= 1) {
    return {
      bars: 2,
      label: 'Seguridad: Débil — agrega mayúsculas o números',
      textClass: 'text-[#C2410C]',
      barClass: 'bg-[#EA580C]',
    };
  }
  if (criteria === 2) {
    return {
      bars: 3,
      label: 'Seguridad: Media',
      textClass: 'text-[#B45309]',
      barClass: 'bg-[#D97706]',
    };
  }
  return {
    bars: 4,
    label: 'Seguridad: Fuerte',
    textClass: 'text-[#065F46]',
    barClass: 'bg-[#059669]',
  };
}

export function AccountAndOrdersModal({
  open,
  initialTab = 'register',
  onClose,
  onOpenAdmin,
}: AccountAndOrdersModalProps) {
  const {
    user,
    isEmailVerified,
    isAdmin,
    customerProfile,
    isEligibleForWelcomeDiscount,
    orders,
    ordersLoading,
    loginWithGoogle,
    registerWithEmail,
    loginWithEmail,
    resendVerificationEmail,
    sendPasswordReset,
    refreshEmailVerification,
    logout,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);
  const [forgotMode, setForgotMode] = useState(false);

  // Registration fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);

  // Login & Password Reset fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Status & Cooldown
  const [authError, setAuthError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setForgotMode(false);
      setAuthError(null);
      setInfoMsg(null);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  if (!open) return null;

  const passwordStrength = getPasswordStrength(regPassword);

  const handleGoogleLogin = async (requireConsent: boolean) => {
    setAuthError(null);
    setInfoMsg(null);
    if (requireConsent && !privacyConsent) {
      setAuthError(
        'Debes autorizar el tratamiento de tus datos personales según la Política de Privacidad para continuar.'
      );
      return;
    }
    setBusy(true);
    try {
      await loginWithGoogle(requireConsent ? true : privacyConsent);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'No pudimos completar el inicio de sesión.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfoMsg(null);

    if (regName.trim().length < 2) {
      setAuthError('Ingresa tu nombre completo (mínimo 2 caracteres).');
      return;
    }
    if (!regEmail.trim().includes('@') || regEmail.trim().length < 5) {
      setAuthError('Ingresa un correo electrónico válido.');
      return;
    }
    const cleanPhoneRaw = regPhone.trim();
    if (cleanPhoneRaw.length > 0) {
      const digits = cleanPhoneRaw.replace(/\D/g, '');
      const local10 =
        digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits;
      if (!COLOMBIA_WHATSAPP_10_REGEX.test(local10)) {
        setAuthError(
          'Si ingresas celular, debe ser un número colombiano de 10 dígitos que empiece por 3 (ej. 310 123 4567).'
        );
        return;
      }
    }
    if (regPassword.length < 8) {
      setAuthError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!privacyConsent) {
      setAuthError(
        'Debes autorizar el tratamiento de tus datos personales según la Política de Privacidad para registrarte.'
      );
      return;
    }

    setBusy(true);
    try {
      await registerWithEmail({
        name: regName,
        email: regEmail,
        phone: cleanPhoneRaw || undefined,
        password: regPassword,
        acceptedPrivacy: true,
      });
      setResendCooldown(60);
      setInfoMsg(
        'Te enviamos un enlace de activación en español. Revisa tu correo (también la carpeta de spam o promociones).'
      );
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'No pudimos crear tu cuenta en este momento.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      await loginWithEmail(loginEmail, loginPassword);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'No pudimos iniciar sesión con tu correo.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfoMsg(null);
    if (!resetEmail.trim().includes('@')) {
      setAuthError('Ingresa el correo electrónico con el que te registraste.');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(resetEmail);
      setInfoMsg(
        'Te enviamos un correo en español con el enlace para restablecer tu contraseña.'
      );
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'No pudimos enviar el correo de recuperación.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    setAuthError(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      await resendVerificationEmail();
      setResendCooldown(60);
      setInfoMsg('Reenviamos el correo de verificación. Revisa tu bandeja de entrada o spam.');
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'No pudimos reenviar el correo de verificación.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCheckVerified = async () => {
    setAuthError(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      const verified = await refreshEmailVerification();
      if (!verified) {
        setAuthError(
          'Tu correo aún aparece pendiente de verificación. Abre el enlace que te enviamos e inténtalo nuevamente.'
        );
      }
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'No pudimos comprobar el estado de tu verificación.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setAuthError(null);
    setInfoMsg(null);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  };

  const modalTitle = !user
    ? 'Ingresar o Crear Cuenta'
    : !isEmailVerified
      ? 'Activa tu cuenta'
      : 'Mi Cuenta y Pedidos';

  const modalSubtitle = !user
    ? 'Obtén 10% de descuento en tu primera compra y sigue tus pedidos'
    : user.email || '';

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
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-medium text-[#231F20]">{modalTitle}</h2>
            <p className="text-xs text-[#756661] truncate">{modalSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar cuenta"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-[#F8EFEA] text-[#231F20] shrink-0"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!user ? (
            <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 sm:p-6 space-y-5">
              {/* Segmented Tabs: Ingresar / Crear cuenta */}
              <div
                role="tablist"
                aria-label="Opciones de acceso"
                className="grid grid-cols-2 p-1 rounded-xl bg-[#F8EFEA] border border-[#EAE0DA]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'login'}
                  onClick={() => {
                    setActiveTab('login');
                    setForgotMode(false);
                    setAuthError(null);
                    setInfoMsg(null);
                  }}
                  className={`min-h-[42px] rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'login'
                      ? 'bg-[#231F20] text-[#FBF9F7]'
                      : 'text-[#574B47] hover:text-[#231F20]'
                  }`}
                >
                  Ingresar
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'register'}
                  onClick={() => {
                    setActiveTab('register');
                    setForgotMode(false);
                    setAuthError(null);
                    setInfoMsg(null);
                  }}
                  className={`min-h-[42px] rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'register'
                      ? 'bg-[#231F20] text-[#FBF9F7]'
                      : 'text-[#574B47] hover:text-[#231F20]'
                  }`}
                >
                  Crear cuenta
                </button>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3"
                >
                  {authError}
                </div>
              )}

              {infoMsg && (
                <div className="text-xs text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl px-4 py-3">
                  {infoMsg}
                </div>
              )}

              {activeTab === 'register' ? (
                <div className="space-y-5">
                  <div className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-xl px-4 py-3 flex items-center gap-3">
                    <Gift className="w-5 h-5 text-[#8C5E58] shrink-0" strokeWidth={1.6} />
                    <p className="text-xs text-[#574B47] leading-relaxed">
                      <strong className="text-[#231F20]">10% de bienvenida:</strong> regístrate por
                      primera vez para activar automáticamente el 10% en tu primer pedido.
                    </p>
                  </div>

                  <form onSubmit={handleEmailRegister} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[#231F20]" htmlFor="reg-name">
                        Nombre completo
                      </label>
                      <input
                        id="reg-name"
                        type="text"
                        required
                        maxLength={100}
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="María Fernanda Gómez"
                        className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-sm text-[#231F20] focus:outline-none focus:border-[#231F20]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[#231F20]" htmlFor="reg-email">
                          Correo electrónico
                        </label>
                        <input
                          id="reg-email"
                          type="email"
                          required
                          maxLength={160}
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="tu@correo.com"
                          className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-sm text-[#231F20] focus:outline-none focus:border-[#231F20]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[#231F20]" htmlFor="reg-phone">
                          Celular WhatsApp (opcional)
                        </label>
                        <input
                          id="reg-phone"
                          type="tel"
                          inputMode="numeric"
                          maxLength={14}
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="310 123 4567"
                          className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-sm font-mono text-[#231F20] focus:outline-none focus:border-[#231F20]"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[#231F20]" htmlFor="reg-password">
                        Contraseña
                      </label>
                      <div className="relative">
                        <input
                          id="reg-password"
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="Mínimo 8 caracteres"
                          className="w-full min-h-[44px] pl-3.5 pr-11 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-sm text-[#231F20] focus:outline-none focus:border-[#231F20]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword((v) => !v)}
                          aria-label={
                            showRegPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                          }
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#756661] hover:text-[#231F20]"
                        >
                          {showRegPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Password strength indicator */}
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
                          {[1, 2, 3, 4].map((stepIdx) => (
                            <div
                              key={stepIdx}
                              className={`h-1.5 rounded-full transition-colors ${
                                passwordStrength.bars >= stepIdx
                                  ? passwordStrength.barClass
                                  : 'bg-[#EAE0DA]'
                              }`}
                            />
                          ))}
                        </div>
                        <p className={`text-[11px] font-medium ${passwordStrength.textClass}`}>
                          {passwordStrength.label}
                        </p>
                      </div>
                    </div>

                    <label
                      htmlFor="account-privacy-consent"
                      className="flex items-start gap-2.5 text-left bg-[#FBF9F7] border border-[#EAE0DA] rounded-xl p-3.5 cursor-pointer select-none"
                    >
                      <input
                        id="account-privacy-consent"
                        type="checkbox"
                        checked={privacyConsent}
                        onChange={(e) => {
                          setPrivacyConsent(e.target.checked);
                          if (e.target.checked) setAuthError(null);
                        }}
                        className="mt-0.5 h-4 w-4 accent-[#231F20] shrink-0"
                      />
                      <span className="text-xs text-[#574B47] leading-relaxed">
                        Autorizo el tratamiento de mis datos personales según la{' '}
                        <a
                          href="#privacidad"
                          onClick={onClose}
                          className="text-[#231F20] font-medium underline underline-offset-4 hover:text-[#8C5E58]"
                        >
                          Política de Privacidad
                        </a>
                        .
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[#3A3335] disabled:opacity-50 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      <span>{busy ? 'Creando cuenta...' : 'Crear cuenta con correo'}</span>
                    </button>
                  </form>

                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-[#EAE0DA]" />
                    <span className="mx-3 text-[11px] uppercase tracking-widest text-[#756661]">
                      o
                    </span>
                    <div className="flex-grow border-t border-[#EAE0DA]" />
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleGoogleLogin(true)}
                    className="w-full min-h-[46px] px-6 py-2.5 rounded-xl border border-[#EAE0DA] bg-[#FBF9F7] text-[#231F20] text-sm font-medium inline-flex items-center justify-center gap-2.5 hover:bg-[#F8EFEA] disabled:opacity-50 transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{busy ? 'Conectando...' : 'Continuar con Google'}</span>
                  </button>
                </div>
              ) : forgotMode ? (
                <form onSubmit={handlePasswordReset} className="space-y-4" noValidate>
                  <div className="space-y-1">
                    <h3 className="font-display text-2xl text-[#231F20]">Recuperar contraseña</h3>
                    <p className="text-xs text-[#574B47] leading-relaxed">
                      Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#231F20]" htmlFor="reset-email">
                      Correo electrónico
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-sm text-[#231F20] focus:outline-none focus:border-[#231F20]"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="submit"
                      disabled={busy}
                      className="flex-1 min-h-[46px] px-5 py-2.5 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium hover:bg-[#3A3335] disabled:opacity-50 transition-colors"
                    >
                      {busy ? 'Enviando...' : 'Enviar enlace de recuperación'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotMode(false);
                        setAuthError(null);
                        setInfoMsg(null);
                      }}
                      className="min-h-[46px] px-5 py-2.5 rounded-xl border border-[#EAE0DA] bg-[#FBF9F7] text-[#574B47] text-xs font-medium hover:bg-[#F8EFEA] transition-colors"
                    >
                      Volver a ingresar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-5">
                  <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[#231F20]" htmlFor="login-email">
                        Correo electrónico
                      </label>
                      <input
                        id="login-email"
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="tu@correo.com"
                        className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-sm text-[#231F20] focus:outline-none focus:border-[#231F20]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          className="text-xs font-medium text-[#231F20]"
                          htmlFor="login-password"
                        >
                          Contraseña
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setResetEmail(loginEmail);
                            setForgotMode(true);
                            setAuthError(null);
                            setInfoMsg(null);
                          }}
                          className="text-xs text-[#8C5E58] hover:text-[#231F20] underline underline-offset-4"
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="login-password"
                          type={showLoginPassword ? 'text' : 'password'}
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Tu contraseña"
                          className="w-full min-h-[44px] pl-3.5 pr-11 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-sm text-[#231F20] focus:outline-none focus:border-[#231F20]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((v) => !v)}
                          aria-label={
                            showLoginPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                          }
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#756661] hover:text-[#231F20]"
                        >
                          {showLoginPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[#3A3335] disabled:opacity-50 transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{busy ? 'Ingresando...' : 'Ingresar con correo'}</span>
                    </button>
                  </form>

                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-[#EAE0DA]" />
                    <span className="mx-3 text-[11px] uppercase tracking-widest text-[#756661]">
                      o
                    </span>
                    <div className="flex-grow border-t border-[#EAE0DA]" />
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleGoogleLogin(false)}
                    className="w-full min-h-[46px] px-6 py-2.5 rounded-xl border border-[#EAE0DA] bg-[#FBF9F7] text-[#231F20] text-sm font-medium inline-flex items-center justify-center gap-2.5 hover:bg-[#F8EFEA] disabled:opacity-50 transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{busy ? 'Conectando...' : 'Continuar con Google'}</span>
                  </button>
                  <p className="text-[11px] text-center text-[#756661]">
                    ¿Primera vez en Mía Store?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('register');
                        setAuthError(null);
                        setInfoMsg(null);
                      }}
                      className="text-[#231F20] font-medium underline underline-offset-4"
                    >
                      Crea tu cuenta aquí
                    </button>{' '}
                    para activar tu 10% de bienvenida.
                  </p>
                </div>
              )}
            </div>
          ) : !isEmailVerified ? (
            <div className="bg-white border border-[#EAE0DA] rounded-2xl p-6 sm:p-8 text-center space-y-5">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#F8EFEA] border border-[#EAE0DA] flex items-center justify-center text-[#8C5E58]">
                <Mail className="w-5 h-5" strokeWidth={1.6} />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="font-display text-2xl sm:text-3xl text-[#231F20]">
                  Revisa tu correo para activar tu cuenta
                </h3>
                <p className="text-sm text-[#574B47] leading-relaxed">
                  Enviamos un enlace de verificación a{' '}
                  <strong className="text-[#231F20]">{user.email}</strong>. Ábrelo desde tu
                  bandeja de entrada (o carpeta de spam) y luego presiona{' '}
                  <strong className="text-[#231F20]">Ya verifiqué</strong>.
                </p>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3 max-w-md mx-auto text-left"
                >
                  {authError}
                </div>
              )}

              {infoMsg && (
                <div className="text-xs text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl px-4 py-3 max-w-md mx-auto text-left">
                  {infoMsg}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCheckVerified}
                  className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[#3A3335] disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
                  <span>{busy ? 'Comprobando...' : 'Ya verifiqué'}</span>
                </button>

                <button
                  type="button"
                  disabled={busy || resendCooldown > 0}
                  onClick={handleResendVerification}
                  className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl border border-[#EAE0DA] bg-[#FBF9F7] text-[#231F20] text-xs font-medium inline-flex items-center justify-center gap-2 hover:bg-[#F8EFEA] disabled:opacity-55 transition-colors tabular-nums"
                >
                  <Mail className="w-4 h-4" />
                  <span>
                    {resendCooldown > 0
                      ? `Reenviar correo (${resendCooldown}s)`
                      : 'Reenviar correo'}
                  </span>
                </button>
              </div>

              <div className="pt-2 border-t border-[#EAE0DA] max-w-md mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#756661]">
                <span>Puedes seguir armando tu bolsa mientras confirmas.</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleLogout}
                  className="text-[#231F20] font-medium underline underline-offset-4 hover:text-[#8C5E58]"
                >
                  Usar otro correo
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Profile & Admin Switch */}
              <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-semibold text-[#231F20] truncate">
                    {user.displayName || customerProfile?.name || 'Clienta Mía Store'}
                  </p>
                  <p className="text-xs text-[#756661] truncate">
                    {user.email}
                    {customerProfile?.phone ? ` · ${customerProfile.phone}` : ''}
                    {isAdmin ? ' · Cuenta Administradora' : ' · Cuenta Verificada'}
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
