import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Instagram, Lock, MessageCircle } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BRAND_INFO, COLOMBIA_WHATSAPP_10_REGEX } from '../types/store';

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  expired: boolean;
}

function getCountdownParts(targetMs: number, nowMs: number): CountdownParts {
  const diff = targetMs - nowMs;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, expired: true };
  }
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes, expired: false };
}

export function ComingSoonPage() {
  const { user, settings, submitWaitlistEntry, loginWithGoogle, logout } = useStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const launchTargetMs = useMemo(() => {
    if (!settings.launchDate || typeof settings.launchDate.toMillis !== 'function') {
      return null;
    }
    return settings.launchDate.toMillis();
  }, [settings.launchDate]);

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!launchTargetMs) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15000);
    return () => window.clearInterval(timer);
  }, [launchTargetMs]);

  const countdown = useMemo(() => {
    if (!launchTargetMs) return null;
    return getCountdownParts(launchTargetMs, nowMs);
  }, [launchTargetMs, nowMs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setErrorMsg('Por favor escribe tu nombre (mínimo 2 caracteres).');
      return;
    }

    const digitsOnly = phone.replace(/\D/g, '');
    const normalizedLocal =
      digitsOnly.length === 12 && digitsOnly.startsWith('57')
        ? digitsOnly.slice(2)
        : digitsOnly;

    if (!COLOMBIA_WHATSAPP_10_REGEX.test(normalizedLocal)) {
      setErrorMsg(
        'Ingresa un celular WhatsApp colombiano de 10 dígitos que empiece por 3 (ej. 310 123 4567).'
      );
      return;
    }

    if (!consent) {
      setErrorMsg(
        'Debes autorizar el tratamiento de tus datos personales según la Política de Privacidad.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await submitWaitlistEntry(cleanName, normalizedLocal, consent);
      setSubmitted(true);
      setName('');
      setPhone('');
      setConsent(false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No pudimos guardar tu registro en este momento. Intenta de nuevo.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminSignIn = async () => {
    setAuthBusy(true);
    try {
      await loginWithGoogle();
    } catch {
      // User closed popup or auth cancelled
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7EFEA] text-[#231F20] relative overflow-hidden flex flex-col justify-between px-4 py-10 sm:py-14">
      {/* Subtle tactile paper texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-[0.35] bg-[radial-gradient(#D8C8BE_0.75px,transparent_0.75px)] [background-size:20px_20px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_65%)]"
      />

      <div aria-hidden="true" className="h-4" />

      <main className="relative z-10 w-full max-w-lg mx-auto flex flex-col items-center text-center space-y-8">
        {/* Centered Brand Logo */}
        <div className="w-40 sm:w-48">
          <img
            src={BRAND_INFO.logoPath}
            alt="Mía Store"
            className="w-full h-auto object-contain mix-blend-multiply mx-auto"
          />
        </div>

        {/* Display Headline */}
        <div className="space-y-3">
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight text-[#231F20] leading-[1.08]">
            Se avecina algo grande
          </h1>
          <p className="text-sm sm:text-base text-[#574B47] max-w-md mx-auto leading-relaxed">
            Estamos preparando nuestra próxima colección de prendas atemporales en seda y lino.
          </p>
        </div>

        {/* Elegant Optional Countdown (rendered only if launchDate is configured) */}
        {countdown && (
          <section aria-label="Cuenta regresiva de lanzamiento" className="w-full max-w-sm">
            <div className="grid grid-cols-3 gap-3 bg-white/75 backdrop-blur-xs border border-[#EAE0DA] rounded-2xl px-4 py-4">
              <div className="space-y-0.5">
                <p className="font-display text-3xl sm:text-4xl font-semibold text-[#231F20] tabular-nums leading-none">
                  {String(countdown.days).padStart(2, '0')}
                </p>
                <p className="text-[11px] uppercase tracking-widest text-[#756661]">Días</p>
              </div>
              <div className="space-y-0.5 border-x border-[#EAE0DA]">
                <p className="font-display text-3xl sm:text-4xl font-semibold text-[#231F20] tabular-nums leading-none">
                  {String(countdown.hours).padStart(2, '0')}
                </p>
                <p className="text-[11px] uppercase tracking-widest text-[#756661]">Horas</p>
              </div>
              <div className="space-y-0.5">
                <p className="font-display text-3xl sm:text-4xl font-semibold text-[#231F20] tabular-nums leading-none">
                  {String(countdown.minutes).padStart(2, '0')}
                </p>
                <p className="text-[11px] uppercase tracking-widest text-[#756661]">Minutos</p>
              </div>
            </div>
            {countdown.expired && (
              <p className="text-xs text-[#8C5E58] mt-2">
                Apertura muy pronto · Déjanos tu WhatsApp para avisarte al instante
              </p>
            )}
          </section>
        )}

        {/* Waitlist Card */}
        <section
          aria-labelledby="waitlist-heading"
          className="w-full bg-white/85 backdrop-blur-xs border border-[#EAE0DA] rounded-2xl p-6 sm:p-8 text-left shadow-xs"
        >
          {submitted ? (
            <div className="py-4 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#F7EFEA] border border-[#EAE0DA] flex items-center justify-center text-[#231F20]">
                <CheckCircle2 className="w-6 h-6" strokeWidth={1.6} />
              </div>
              <div className="space-y-1.5">
                <h2 className="font-display text-2xl sm:text-3xl font-medium text-[#231F20]">
                  Gracias, serás de las primeras en saberlo.
                </h2>
                <p className="text-xs text-[#574B47]">
                  Te avisaremos por WhatsApp en cuanto abramos las puertas de Mía Store.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1 text-center pb-1">
                <h2
                  id="waitlist-heading"
                  className="font-display text-2xl sm:text-3xl font-medium text-[#231F20]"
                >
                  Quiero enterarme primero
                </h2>
                <p className="text-xs text-[#756661]">
                  Recibe acceso anticipado y aviso directo el día del lanzamiento.
                </p>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3.5 py-2.5"
                >
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#231F20]" htmlFor="waitlist-name">
                  Nombre
                </label>
                <input
                  id="waitlist-name"
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre completo"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-sm text-[#231F20] placeholder:text-[#9E8F8A] focus:outline-none focus:border-[#231F20]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#231F20]" htmlFor="waitlist-phone">
                  WhatsApp
                </label>
                <div className="flex items-center rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] focus-within:border-[#231F20] overflow-hidden">
                  <span className="px-3 text-xs font-mono text-[#756661] border-r border-[#EAE0DA] bg-[#F7EFEA]/60 min-h-[44px] flex items-center select-none">
                    +57
                  </span>
                  <input
                    id="waitlist-phone"
                    type="tel"
                    inputMode="numeric"
                    required
                    maxLength={14}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="310 123 4567"
                    className="w-full min-h-[44px] px-3.5 bg-transparent text-sm font-mono text-[#231F20] placeholder:text-[#9E8F8A] focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-[#756661]">
                  Celular colombiano de 10 dígitos empezando por 3.
                </p>
              </div>

              <label
                htmlFor="waitlist-consent"
                className="flex items-start gap-3 pt-1 cursor-pointer select-none"
              >
                <input
                  id="waitlist-consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#D8C8BE] text-[#231F20] focus:ring-[#231F20] shrink-0"
                />
                <span className="text-xs text-[#574B47] leading-relaxed">
                  Autorizo el tratamiento de mis datos personales según la{' '}
                  <a
                    href="#privacidad"
                    className="text-[#231F20] font-medium underline underline-offset-4 hover:text-[#8C5E58]"
                  >
                    Política de Privacidad
                  </a>
                  .
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium hover:bg-[#3A3335] disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Registrando...' : 'Quiero enterarme primero'}
              </button>
            </form>
          )}
        </section>
      </main>

      {/* Bottom Social Links & Discreet Admin Sign-In */}
      <footer className="relative z-10 w-full max-w-lg mx-auto pt-10 flex flex-col items-center gap-4">
        <div className="flex items-center justify-center gap-3">
          <a
            href={BRAND_INFO.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram de Mía Store"
            title="Instagram"
            className="min-h-[44px] min-w-[44px] rounded-full border border-[#D8C8BE] bg-white/70 flex items-center justify-center text-[#231F20] hover:bg-white transition-colors"
          >
            <Instagram className="w-4 h-4" strokeWidth={1.6} />
          </a>

          <a
            href={BRAND_INFO.tiktokUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok de Mía Store"
            title="TikTok"
            className="min-h-[44px] min-w-[44px] rounded-full border border-[#D8C8BE] bg-white/70 flex items-center justify-center text-[#231F20] hover:bg-white transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
            </svg>
          </a>

          <a
            href={BRAND_INFO.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook de Mía Store"
            title="Facebook"
            className="min-h-[44px] min-w-[44px] rounded-full border border-[#D8C8BE] bg-white/70 flex items-center justify-center text-[#231F20] hover:bg-white transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
          </a>

          <a
            href={`https://wa.me/${BRAND_INFO.whatsappDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp de Mía Store"
            title="WhatsApp"
            className="min-h-[44px] min-w-[44px] rounded-full border border-[#D8C8BE] bg-white/70 flex items-center justify-center text-[#231F20] hover:bg-white transition-colors"
          >
            <MessageCircle className="w-4 h-4" strokeWidth={1.6} />
          </a>
        </div>

        <div className="flex flex-col items-center gap-2 text-[11px] text-[#756661]">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <a href="#privacidad" className="hover:text-[#231F20] underline underline-offset-4">
              Política de Privacidad
            </a>
            <a href="#terminos" className="hover:text-[#231F20] underline underline-offset-4">
              Términos y Condiciones
            </a>
            <a href="#cambios" className="hover:text-[#231F20] underline underline-offset-4">
              Cambios y Retracto
            </a>
          </div>
          <p>© {new Date().getFullYear()} {BRAND_INFO.name}</p>
          {user ? (
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-[#756661] hover:text-[#231F20] underline underline-offset-4 py-1"
            >
              <Lock className="w-3 h-3" />
              <span>Sesión: {user.email} · Cerrar sesión</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={authBusy}
              onClick={handleAdminSignIn}
              className="inline-flex items-center gap-1.5 text-[#756661] hover:text-[#231F20] underline underline-offset-4 py-1 disabled:opacity-50"
            >
              <Lock className="w-3 h-3" />
              <span>{authBusy ? 'Conectando...' : 'Acceso administradora'}</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
