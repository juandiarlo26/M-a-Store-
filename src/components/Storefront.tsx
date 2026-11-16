import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Gift,
  Home,
  Instagram,
  Mail,
  MessageCircle,
  Search,
  ShoppingBag,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatCOP, getProductImages, HERO_IMAGE_URL } from '../lib/starterCatalog';
import { BRAND_INFO, type Product } from '../types/store';
import { AccountAndOrdersModal } from './AccountAndOrdersModal';
import { CartDrawer } from './CartDrawer';
import { CheckoutModal } from './CheckoutModal';
import { ProductDetailModal } from './ProductDetailModal';
import { ResilientImage } from './ResilientImage';

interface StorefrontProps {
  onOpenAdmin: () => void;
  isComingSoonPreview?: boolean;
}

export function Storefront({ onOpenAdmin, isComingSoonPreview = false }: StorefrontProps) {
  const {
    user,
    isEmailVerified,
    isAdmin,
    isEligibleForWelcomeDiscount,
    products,
    productsLoading,
    settings,
    cartCount,
  } = useStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountInitialTab, setAccountInitialTab] = useState<'login' | 'register'>('register');

  const openAccountWithTab = (tab: 'login' | 'register') => {
    setAccountInitialTab(tab);
    setAccountOpen(true);
  };

  const visibleProducts = useMemo(() => {
    return products.filter((p) => p.active);
  }, [products]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(visibleProducts.map((p) => p.category)));
    return ['Todas', ...unique];
  }, [visibleProducts]);

  const liveSelectedProduct = useMemo(() => {
    if (!selectedProduct) return null;
    return products.find((p) => p.id === selectedProduct.id) ?? selectedProduct;
  }, [products, selectedProduct]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return visibleProducts.filter((p) => {
      const catMatch = selectedCategory === 'Todas' || p.category === selectedCategory;
      const textMatch =
        !q ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        p.name.toLowerCase().includes(q) ||
        p.color.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [visibleProducts, selectedCategory, searchTerm]);

  return (
    <div className="min-h-screen bg-[#FBF9F7] text-[#231F20] pb-20 md:pb-0">
      {/* Admin preview notice when store is in Próximamente mode */}
      {isComingSoonPreview && (
        <div className="bg-[#231F20] text-[#FBF9F7] px-4 py-2 text-center text-xs flex flex-wrap items-center justify-center gap-3">
          <span>Vista previa: la tienda está en modo Próximamente</span>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="underline underline-offset-4 font-medium hover:text-[#EBDAD3]"
          >
            Configurar lanzamiento
          </button>
        </div>
      )}

      {/* Slim non-sticky announcement strip */}
      {settings.announcementText && (
        <div className="bg-[#F8EFEA] border-b border-[#EAE0DA] px-4 py-2 text-center">
          <p className="text-xs text-[#574B47] tracking-wide">{settings.announcementText}</p>
        </div>
      )}

      {/* Top Bar Contract: 3 zones */}
      <header className="sticky top-0 z-30 h-14 md:h-16 bg-[#FBF9F7]/92 backdrop-blur-md border-b border-[#EAE0DA]">
        <div className="max-w-7xl mx-auto h-full px-4 md:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#inicio"
            className="font-display text-2xl font-semibold tracking-tight text-[#231F20] whitespace-nowrap shrink-0"
          >
            {BRAND_INFO.name}
          </a>

          {/* Zone 2: Clean single-line navigation links */}
          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#574B47]"
          >
            <a
              href="#coleccion"
              className="hover:text-[#231F20] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Colección
            </a>
            <a
              href="#esencia"
              className="hover:text-[#231F20] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Esencia
            </a>
            <a
              href="#contacto"
              className="hover:text-[#231F20] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Contacto
            </a>
            <button
              type="button"
              onClick={() => (isAdmin ? onOpenAdmin() : openAccountWithTab(user ? 'login' : 'register'))}
              className="hover:text-[#231F20] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isAdmin
                ? 'Panel Admin'
                : user
                  ? isEmailVerified
                    ? 'Mis Pedidos'
                    : 'Verificar cuenta'
                  : 'Regístrate (10%)'}
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#231F20] text-[#FBF9F7] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#3A3335] transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span className="tabular-nums">Bolsa ({cartCount})</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Section 1: Editorial Split Hero */}
        <section
          id="inicio"
          className="max-w-7xl mx-auto px-4 md:px-8 pt-6 pb-10 md:py-12 space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-stretch">
            <div className="lg:col-span-5 bg-[#F8EFEA] border border-[#EAE0DA] rounded-2xl p-6 sm:p-10 flex flex-col justify-between gap-8">
              <div className="w-36 sm:w-44 rounded-xl overflow-hidden">
                <img
                  src={BRAND_INFO.logoPath}
                  alt="Logo Mía Store"
                  className="w-full h-auto object-contain mix-blend-multiply"
                />
              </div>

              <div className="space-y-4">
                <h1 className="font-display text-4xl sm:text-5xl font-medium text-[#231F20] leading-[1.08] [text-wrap:balance]">
                  {settings.heroTitle}
                </h1>
                <p className="text-sm sm:text-base text-[#574B47] leading-relaxed max-w-md">
                  {settings.heroSubtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="#coleccion"
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium inline-flex items-center gap-2.5 hover:bg-[#3A3335] transition-colors whitespace-nowrap"
                >
                  <span>Explorar colección</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="min-h-[48px] px-5 py-3 rounded-xl border border-[#D8C8BE] bg-white/70 text-[#231F20] text-sm font-medium hover:bg-white transition-colors whitespace-nowrap"
                  >
                    Panel Admin
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-[#EAE0DA] bg-[#F8EFEA] aspect-[4/3] lg:aspect-auto">
              <ResilientImage
                src={HERO_IMAGE_URL}
                alt="Editorial Mía Store — Colección femenina en seda y lino"
                fallbackLabel="Colección Mía Store"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Inline First-Order 10% Registration Banner */}
          {!user ? (
            <div className="bg-white border border-[#EAE0DA] rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <Gift className="w-5 h-5 text-[#8C5E58] shrink-0 mt-0.5 sm:mt-0" strokeWidth={1.6} />
                <p className="text-sm text-[#574B47]">
                  <strong className="text-[#231F20]">Bienvenida a Mía Store:</strong> Regístrate
                  por primera vez y recibe un <strong>10% de descuento</strong> automático en tu
                  primer pedido.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openAccountWithTab('login')}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#EAE0DA] bg-[#FBF9F7] text-[#231F20] text-xs font-medium hover:bg-[#F8EFEA] transition-colors whitespace-nowrap"
                >
                  Ingresar
                </button>
                <button
                  type="button"
                  onClick={() => openAccountWithTab('register')}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#231F20] text-[#FBF9F7] text-xs font-medium hover:bg-[#3A3335] transition-colors whitespace-nowrap"
                >
                  Registrarme · 10% OFF
                </button>
              </div>
            </div>
          ) : !isEmailVerified ? (
            <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-[#7C2D12]">
              <div className="flex items-start sm:items-center gap-3">
                <Mail className="w-5 h-5 text-[#9A3412] shrink-0 mt-0.5 sm:mt-0" strokeWidth={1.6} />
                <p className="text-xs sm:text-sm">
                  <strong>Verifica tu correo ({user.email})</strong> para activar tu 10% de
                  bienvenida y confirmar pedidos. Mientras tanto puedes armar tu bolsa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openAccountWithTab('login')}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#231F20] text-[#FBF9F7] text-xs font-medium hover:bg-[#3A3335] transition-colors whitespace-nowrap shrink-0"
              >
                Verificar correo
              </button>
            </div>
          ) : (
            isEligibleForWelcomeDiscount && (
              <div className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-2xl px-5 py-3.5 flex items-center gap-3 text-sm text-[#231F20]">
                <Gift className="w-5 h-5 text-[#8C5E58] shrink-0" strokeWidth={1.6} />
                <span>
                  Tu registro está activo: tienes <strong>10% de descuento</strong> listo para
                  aplicarse automáticamente en tu primera compra.
                </span>
              </div>
            )
          )}
        </section>

        {/* Section 2: Featured Collection & Live Catalog */}
        <section
          id="coleccion"
          className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16 border-t border-[#EAE0DA]"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="space-y-1.5">
              <p className="text-xs text-[#8C5E58] tracking-wide">Catálogo en tiempo real</p>
              <h2 className="font-display text-3xl md:text-4xl font-medium text-[#231F20]">
                Colección de Temporada
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#756661] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar prenda, tono o código..."
                  aria-label="Buscar prenda"
                  className="w-full sm:w-56 min-h-[44px] pl-10 pr-4 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                />
              </div>
            </div>
          </div>

          {/* Interactive Category Filter Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 border transition-colors ${
                    active
                      ? 'bg-[#231F20] text-[#FBF9F7] border-[#231F20]'
                      : 'bg-white text-[#574B47] border-[#EAE0DA] hover:bg-[#F8EFEA]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Product Grid */}
          {productsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="space-y-3">
                  <div className="aspect-[3/4] rounded-2xl bg-[#F8EFEA] animate-pulse" />
                  <div className="h-4 w-24 bg-[#EAE0DA] rounded animate-pulse" />
                  <div className="h-5 w-48 bg-[#EAE0DA] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white border border-[#EAE0DA] rounded-2xl p-12 text-center space-y-3">
              <Sparkles className="w-6 h-6 mx-auto text-[#8C5E58]" strokeWidth={1.5} />
              <p className="font-display text-2xl text-[#231F20]">
                No encontramos prendas con ese criterio
              </p>
              <p className="text-sm text-[#756661]">
                Prueba seleccionando otra categoría o limpiando el buscador.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('Todas');
                  setSearchTerm('');
                }}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#231F20] text-[#FBF9F7] text-xs font-medium"
              >
                Ver toda la colección
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {filteredProducts.map((product) => {
                const isSoldOut = product.stock <= 0;
                const stockHint = isSoldOut
                  ? 'Agotado'
                  : product.stock <= 3
                    ? `Últimas ${product.stock}`
                    : null;
                const gallery = getProductImages(product);
                const coverImage = gallery[0] || product.imageUrl;
                const hoverImage = gallery.length > 1 ? gallery[1] : null;

                return (
                  <article
                    key={product.id}
                    className="group flex flex-col cursor-pointer"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[#F8EFEA] border border-[#EAE0DA] mb-3.5 transition-transform duration-200 group-hover:-translate-y-0.5">
                      <ResilientImage
                        src={coverImage}
                        alt={product.name}
                        fallbackLabel={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      {hoverImage && (
                        <ResilientImage
                          src={hoverImage}
                          alt={`${product.name} — vista alternativa`}
                          fallbackLabel={product.name}
                          className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                        />
                      )}
                    </div>

                    <div className="space-y-1 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-xs text-[#756661]">
                          {product.category} <span aria-hidden="true">·</span> {product.color}
                          {stockHint ? (
                            <>
                              {' '}
                              <span aria-hidden="true">·</span>{' '}
                              <span className={isSoldOut ? 'text-[#B91C1C]' : 'text-[#8C5E58]'}>
                                {stockHint}
                              </span>
                            </>
                          ) : null}
                        </p>
                        <h3 className="text-base font-semibold text-[#231F20] mt-0.5 leading-snug">
                          {product.name}
                        </h3>
                      </div>

                      <div className="pt-2 flex items-center justify-between gap-2">
                        <p className="text-[15px] font-medium text-[#231F20] tabular-nums">
                          {formatCOP(product.price)}
                        </p>
                        <span className="text-xs text-[#574B47] group-hover:text-[#231F20] group-hover:underline underline-offset-4">
                          Elegir talla
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 3: Craftsmanship & Brand Story */}
        <section
          id="esencia"
          className="bg-[#F8EFEA] border-y border-[#EAE0DA] py-14 md:py-20 px-4 md:px-8"
        >
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-5 space-y-3">
              <p className="text-xs text-[#8C5E58] tracking-wide">Nuestra filosofía</p>
              <h2 className="font-display text-3xl md:text-4xl font-medium text-[#231F20] [text-wrap:balance]">
                Diseñada para acompañarte con ligereza y carácter
              </h2>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
              <div className="space-y-2 pt-2 border-t border-[#D8C8BE]">
                <h3 className="font-display text-xl font-semibold text-[#231F20]">
                  01. Fibras Nobles
                </h3>
                <p className="text-sm text-[#574B47] leading-relaxed">
                  Lino europeo, satén de seda y tejidos respirables pensados para climas cálidos y
                  medios.
                </p>
              </div>
              <div className="space-y-2 pt-2 border-t border-[#D8C8BE]">
                <h3 className="font-display text-xl font-semibold text-[#231F20]">
                  02. 10% Bienvenida
                </h3>
                <p className="text-sm text-[#574B47] leading-relaxed">
                  Al registrarte por primera vez recibes automáticamente 10% de descuento en tu
                  primer pedido.
                </p>
              </div>
              <div className="space-y-2 pt-2 border-t border-[#D8C8BE]">
                <h3 className="font-display text-xl font-semibold text-[#231F20]">
                  03. Pedido por WhatsApp
                </h3>
                <p className="text-sm text-[#574B47] leading-relaxed">
                  Envía tu selección directa a nuestro WhatsApp y sigue en tu cuenta cada paso:
                  pagado, enviado y entregado.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Section 4: Footer */}
      <footer id="contacto" className="bg-[#FBF9F7] border-t border-[#EAE0DA] py-12 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#F8EFEA] border border-[#EAE0DA] shrink-0">
              <img
                src={BRAND_INFO.logoPath}
                alt="Mía Store"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-1">
              <p className="font-display text-2xl font-medium text-[#231F20]">{BRAND_INFO.name}</p>
              <p className="text-xs text-[#756661]">Moda femenina atemporal</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#574B47]">
            <a
              href={BRAND_INFO.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center gap-2 hover:text-[#231F20] transition-colors"
            >
              <Instagram className="w-4 h-4" strokeWidth={1.6} />
              <span>Instagram: {BRAND_INFO.instagramHandle}</span>
            </a>

            <a
              href={BRAND_INFO.tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center gap-2 hover:text-[#231F20] transition-colors"
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
              <span>TikTok: {BRAND_INFO.tiktokHandle}</span>
            </a>

            <a
              href={BRAND_INFO.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center gap-2 hover:text-[#231F20] transition-colors"
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
              <span>Facebook: {BRAND_INFO.facebookLabel}</span>
            </a>

            <a
              href={`https://wa.me/${BRAND_INFO.whatsappDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center gap-2 hover:text-[#231F20] transition-colors"
            >
              <MessageCircle className="w-4 h-4" strokeWidth={1.6} />
              <span>WhatsApp: {BRAND_INFO.whatsappDisplay}</span>
            </a>

            <a
              href={`mailto:${BRAND_INFO.email}`}
              className="min-h-[44px] inline-flex items-center gap-2 hover:text-[#231F20] transition-colors"
            >
              <Mail className="w-4 h-4" strokeWidth={1.6} />
              <span>{BRAND_INFO.email}</span>
            </a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-[#EAE0DA] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#756661]">
          <p>© {new Date().getFullYear()} Mía Store. Todos los derechos reservados.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a href="#privacidad" className="hover:text-[#231F20] underline underline-offset-4 transition-colors">
              Política de Privacidad
            </a>
            <a href="#terminos" className="hover:text-[#231F20] underline underline-offset-4 transition-colors">
              Términos y Condiciones
            </a>
            <a href="#cambios" className="hover:text-[#231F20] underline underline-offset-4 transition-colors">
              Cambios y Retracto
            </a>
          </div>
          <button
            type="button"
            onClick={() => (isAdmin ? onOpenAdmin() : setAccountOpen(true))}
            className="hover:text-[#231F20] underline underline-offset-4 transition-colors"
          >
            {isAdmin ? 'Ir al Panel de Administración' : 'Acceso Administradora / Mis Pedidos'}
          </button>
        </div>
      </footer>

      {/* Mobile Fixed Thumb-Zone Navigation Bar (md:hidden) */}
      <nav
        aria-label="Navegación móvil"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FBF9F7]/95 backdrop-blur-md border-t border-[#EAE0DA] pb-safe"
      >
        <div className="grid grid-cols-4 h-16 items-center">
          <a
            href="#inicio"
            className="min-h-[44px] flex flex-col items-center justify-center text-[#574B47] hover:text-[#231F20]"
          >
            <Home className="w-5 h-5" strokeWidth={1.6} />
            <span className="text-[10px] font-medium mt-1">Inicio</span>
          </a>

          <a
            href="#coleccion"
            className="min-h-[44px] flex flex-col items-center justify-center text-[#574B47] hover:text-[#231F20]"
          >
            <Sparkles className="w-5 h-5" strokeWidth={1.6} />
            <span className="text-[10px] font-medium mt-1">Catálogo</span>
          </a>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="min-h-[44px] flex flex-col items-center justify-center text-[#231F20]"
          >
            <ShoppingBag className="w-5 h-5" strokeWidth={1.7} />
            <span className="text-[10px] font-medium mt-1 tabular-nums">
              Bolsa ({cartCount})
            </span>
          </button>

          <button
            type="button"
            onClick={() => (isAdmin ? onOpenAdmin() : setAccountOpen(true))}
            className="min-h-[44px] flex flex-col items-center justify-center text-[#574B47] hover:text-[#231F20]"
          >
            <UserIcon className="w-5 h-5" strokeWidth={1.6} />
            <span className="text-[10px] font-medium mt-1">
              {isAdmin ? 'Admin' : 'Cuenta'}
            </span>
          </button>
        </div>
      </nav>

      {/* Modals & Drawers */}
      <ProductDetailModal
        product={liveSelectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddedToCart={() => setCartOpen(true)}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onViewOrders={() => openAccountWithTab('login')}
        onOpenAccountModal={openAccountWithTab}
      />

      <AccountAndOrdersModal
        open={accountOpen}
        initialTab={accountInitialTab}
        onClose={() => setAccountOpen(false)}
        onOpenAdmin={onOpenAdmin}
      />
    </div>
  );
}
