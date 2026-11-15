import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Check,
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  Link2,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useStore, type ProductInput } from '../context/StoreContext';
import { compressImageFileForCatalog } from '../lib/imageUpload';
import { generateSuggestedSku, normalizeSku } from '../lib/skuUtils';
import { formatCOP, STUDIO_GALLERY_PRESETS } from '../lib/starterCatalog';
import {
  AVAILABLE_SIZES,
  PRODUCT_CATEGORIES,
  PRODUCT_LIMITS,
  type OrderStatus,
  type Product,
  type ProductCategory,
} from '../types/store';
import { PrintableTagModal } from './PrintableTagModal';
import { ResilientImage } from './ResilientImage';

interface AdminDashboardProps {
  onBackToStore: () => void;
}

type AdminTab = 'resumen' | 'inventario' | 'pedidos' | 'clientas' | 'equipo' | 'tienda';

const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'pagado', label: 'Pagado' },
  { value: 'preparando', label: 'Preparando' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
];

function formatCustomerWhatsappHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  const full = digits.length === 10 ? `57${digits}` : digits;
  return `https://wa.me/${full}`;
}

function formatDateTime(ts?: { toDate?: () => Date } | null): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Reciente';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts.toDate());
}

export function AdminDashboard({ onBackToStore }: AdminDashboardProps) {
  const {
    user,
    isOwner,
    products,
    isUsingStarterPreview,
    orders,
    customers,
    customersLoading,
    staffMembers,
    settings,
    seedStarterCatalog,
    createProduct,
    updateProduct,
    adjustProductStock,
    toggleProductActive,
    deleteProduct,
    updateOrderStatus,
    updateStoreSettings,
    addStaffMember,
    removeStaffMember,
  } = useStore();

  const [tab, setTab] = useState<AdminTab>('resumen');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('todos');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  // Staff invite form
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');

  // Product modal state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [productModalError, setProductModalError] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadedSizeKb, setUploadedSizeKb] = useState<number | null>(null);
  const [showUrlField, setShowUrlField] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Printable tag modal state
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagSingleProduct, setTagSingleProduct] = useState<Product | null>(null);

  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ProductCategory>('Vestidos');
  const [formPrice, setFormPrice] = useState('220000');
  const [formColor, setFormColor] = useState('');
  const [formStock, setFormStock] = useState('8');
  const [formSizes, setFormSizes] = useState<string[]>(['S', 'M', 'L']);
  const [formImageUrl, setFormImageUrl] = useState<string>(STUDIO_GALLERY_PRESETS[0].url);
  const [formDescription, setFormDescription] = useState('');
  const [formFeatured, setFormFeatured] = useState(true);
  const [formActive, setFormActive] = useState(true);

  // Settings form state
  const [setAnnouncement, setSetAnnouncement] = useState(settings.announcementText);
  const [setHeroTitle, setSetHeroTitle] = useState(settings.heroTitle);
  const [setHeroSubtitle, setSetHeroSubtitle] = useState(settings.heroSubtitle);
  const [setFreeThreshold, setSetFreeThreshold] = useState(
    String(settings.freeShippingThreshold)
  );
  const [setShippingFee, setSetShippingFee] = useState(String(settings.shippingFee));

  useEffect(() => {
    setSetAnnouncement(settings.announcementText);
    setSetHeroTitle(settings.heroTitle);
    setSetHeroSubtitle(settings.heroSubtitle);
    setSetFreeThreshold(String(settings.freeShippingThreshold));
    setSetShippingFee(String(settings.shippingFee));
  }, [settings]);

  const showNotice = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setProductModalError(null);
    setUploadedSizeKb(null);
    setShowUrlField(false);
    setFormSku(generateSuggestedSku('Vestidos', products.map((p) => p.sku)));
    setFormName('');
    setFormCategory('Vestidos');
    setFormPrice('220000');
    setFormColor('Marfil');
    setFormStock('10');
    setFormSizes(['XS', 'S', 'M', 'L']);
    setFormImageUrl(STUDIO_GALLERY_PRESETS[0].url);
    setFormDescription('');
    setFormFeatured(true);
    setFormActive(true);
    setProductModalOpen(true);
  };

  const openEditModal = (p: Product, suggestSkuIfMissing = false) => {
    setEditingProduct(p);
    setProductModalError(null);
    setUploadedSizeKb(null);
    setShowUrlField(!p.imageUrl.startsWith('data:'));
    setFormSku(
      p.sku ||
        (suggestSkuIfMissing
          ? generateSuggestedSku(p.category, products.map((item) => item.sku))
          : '')
    );
    setFormName(p.name);
    setFormCategory(p.category);
    setFormPrice(String(p.price));
    setFormColor(p.color);
    setFormStock(String(p.stock));
    setFormSizes(p.sizes);
    setFormImageUrl(p.imageUrl);
    setFormDescription(p.description);
    setFormFeatured(p.featured);
    setFormActive(p.active);
    setProductModalOpen(true);
  };

  const processSelectedImageFile = async (file: File) => {
    setProductModalError(null);
    setImageUploading(true);
    try {
      const { dataUrl, sizeKb } = await compressImageFileForCatalog(file);
      setFormImageUrl(dataUrl);
      setUploadedSizeKb(sizeKb);
      setShowUrlField(false);
    } catch (err) {
      setProductModalError(
        err instanceof Error ? err.message : 'No pudimos cargar la imagen seleccionada.'
      );
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleSize = (size: string) => {
    setFormSizes((prev) => {
      if (prev.includes(size)) {
        return prev.length > 1 ? prev.filter((s) => s !== size) : prev;
      }
      return [...prev, size];
    });
  };

  const saveProductAndMaybePrint = async (openTagAfterSave: boolean) => {
    setProductModalError(null);
    const cleanedSku = normalizeSku(formSku);
    if (cleanedSku.length < PRODUCT_LIMITS.skuMin) {
      setProductModalError(
        'Asigna un código a la prenda (mínimo 2 caracteres) para organizarla en tienda física.'
      );
      return;
    }

    setBusyAction(true);
    try {
      const payload: ProductInput = {
        sku: cleanedSku,
        name: formName,
        category: formCategory,
        price: Number(formPrice),
        color: formColor,
        stock: Number(formStock),
        sizes: formSizes,
        imageUrl: formImageUrl,
        description: formDescription,
        featured: formFeatured,
        active: formActive,
      };
      let savedProduct: Product;
      if (editingProduct && !isUsingStarterPreview) {
        await updateProduct(editingProduct.id, payload);
        savedProduct = { ...editingProduct, ...payload };
        showNotice('ok', `Prenda ${cleanedSku} actualizada en tiempo real.`);
      } else {
        savedProduct = await createProduct(payload);
        showNotice('ok', `Prenda ${cleanedSku} publicada en Firebase.`);
      }
      setProductModalOpen(false);
      if (openTagAfterSave) {
        setTagSingleProduct(savedProduct);
        setTagModalOpen(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No pudimos guardar la prenda.';
      setProductModalError(msg);
      showNotice('err', msg);
    } finally {
      setBusyAction(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProductAndMaybePrint(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyAction(true);
    try {
      await deleteProduct(deleteTarget.id);
      showNotice('ok', `"${deleteTarget.name}" eliminada del catálogo.`);
      setDeleteTarget(null);
    } catch (err) {
      showNotice(
        'err',
        err instanceof Error ? err.message : 'Error al eliminar la prenda.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleSeedCatalog = async () => {
    setBusyAction(true);
    try {
      await seedStarterCatalog();
      showNotice('ok', 'Colección inicial publicada en Firebase correctamente.');
    } catch (err) {
      showNotice(
        'err',
        err instanceof Error ? err.message : 'Error al publicar la colección.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction(true);
    try {
      await updateStoreSettings({
        announcementText: setAnnouncement,
        heroTitle: setHeroTitle,
        heroSubtitle: setHeroSubtitle,
        freeShippingThreshold: Number(setFreeThreshold),
        shippingFee: Number(setShippingFee),
      });
      showNotice('ok', 'Configuración de tienda actualizada en vivo.');
    } catch (err) {
      showNotice(
        'err',
        err instanceof Error ? err.message : 'No pudimos guardar la configuración.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction(true);
    try {
      await addStaffMember(staffEmail, staffName);
      setStaffEmail('');
      setStaffName('');
      showNotice('ok', 'Trabajador autorizado como administrador.');
    } catch (err) {
      showNotice(
        'err',
        err instanceof Error ? err.message : 'No pudimos autorizar al trabajador.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleChangeOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setBusyAction(true);
    try {
      await updateOrderStatus(orderId, nextStatus);
      const label =
        ORDER_STATUS_OPTIONS.find((opt) => opt.value === nextStatus)?.label ?? nextStatus;
      if (nextStatus === 'cancelado') {
        showNotice('ok', 'Pedido cancelado y unidades devueltas al inventario.');
      } else {
        showNotice('ok', `Pedido actualizado a "${label}". La clienta ya lo ve en su cuenta.`);
      }
    } catch (err) {
      showNotice(
        'err',
        err instanceof Error ? err.message : 'No pudimos actualizar el estado del pedido.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const stats = useMemo(() => {
    const nonCanceledOrders = orders.filter((o) => o.status !== 'cancelado');
    const paidOrders = orders.filter(
      (o) =>
        o.paymentStatus === 'pagado' ||
        o.status === 'pagado' ||
        o.status === 'preparando' ||
        o.status === 'enviado' ||
        o.status === 'entregado'
    );
    const pendingPaymentOrders = orders.filter((o) => o.status === 'pendiente');

    const confirmedRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const pendingRevenue = pendingPaymentOrders.reduce((sum, o) => sum + o.total, 0);
    const totalOrderVolume = nonCanceledOrders.reduce((sum, o) => sum + o.total, 0);
    const averageTicket =
      nonCanceledOrders.length > 0 ? Math.round(totalOrderVolume / nonCanceledOrders.length) : 0;

    const totalUnitsSold = nonCanceledOrders.reduce(
      (sum, o) => sum + o.items.reduce((itemSum, it) => itemSum + it.quantity, 0),
      0
    );

    const statusBreakdown = ORDER_STATUS_OPTIONS.map((opt) => {
      const count = orders.filter((o) => o.status === opt.value).length;
      const pct = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0;
      return { status: opt.value, label: opt.label, count, pct };
    });

    const productSalesMap = new Map<
      string,
      { name: string; unitsSold: number; revenue: number }
    >();
    for (const order of nonCanceledOrders) {
      for (const item of order.items) {
        const key = item.productId || item.name;
        const current = productSalesMap.get(key) || {
          name: item.name,
          unitsSold: 0,
          revenue: 0,
        };
        current.unitsSold += item.quantity;
        current.revenue += item.price * item.quantity;
        productSalesMap.set(key, current);
      }
    }
    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
      .slice(0, 5);

    const activeCount = products.filter((p) => p.active).length;
    const totalUnitsInStock = products.reduce((sum, p) => sum + Math.max(0, p.stock), 0);
    const inventoryRetailValue = products.reduce(
      (sum, p) => sum + Math.max(0, p.stock) * p.price,
      0
    );
    const outOfStock = products.filter((p) => p.stock <= 0);
    const lowStock = products.filter((p) => p.stock <= 3);
    const availableCoupons = customers.filter((c) => !c.welcomeDiscountUsed).length;
    const usedCoupons = customers.filter((c) => c.welcomeDiscountUsed).length;

    return {
      confirmedRevenue,
      paidOrdersCount: paidOrders.length,
      pendingRevenue,
      pendingPaymentCount: pendingPaymentOrders.length,
      averageTicket,
      totalUnitsSold,
      nonCanceledCount: nonCanceledOrders.length,
      statusBreakdown,
      topProducts,
      activeCount,
      totalUnitsInStock,
      inventoryRetailValue,
      outOfStock,
      lowStock,
      availableCoupons,
      usedCoupons,
    };
  }, [orders, products, customers]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = categoryFilter === 'Todas' || p.category === categoryFilter;
      const matchText =
        !q ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        p.name.toLowerCase().includes(q) ||
        p.color.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchCat && matchText;
    });
  }, [products, searchQuery, categoryFilter]);

  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === 'todos') return orders;
    return orders.filter((o) => o.status === orderStatusFilter);
  }, [orders, orderStatusFilter]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  const navItems: Array<{ id: AdminTab; label: string; icon: typeof BarChart3 }> = [
    { id: 'resumen', label: 'Estadísticas', icon: BarChart3 },
    { id: 'inventario', label: 'Inventario', icon: ShoppingBag },
    { id: 'pedidos', label: 'Pedidos', icon: Package },
    { id: 'clientas', label: 'Clientas', icon: Users },
    ...(isOwner ? [{ id: 'equipo' as const, label: 'Equipo', icon: ShieldCheck }] : []),
    { id: 'tienda', label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#FBF9F7] text-[#231F20]">
      {/* Top Admin Header */}
      <header className="no-print sticky top-0 z-30 bg-[#FBF9F7]/95 backdrop-blur-md border-b border-[#EAE0DA] px-4 md:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToStore}
            className="min-h-[44px] px-3 rounded-xl border border-[#EAE0DA] bg-white text-xs font-medium inline-flex items-center gap-2 hover:bg-[#F8EFEA] shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ver tienda</span>
          </button>
          <div className="min-w-0">
            <p className="font-display text-xl font-medium truncate">
              Panel de Control · Mía Store
            </p>
            <p className="text-xs text-[#756661] truncate hidden sm:block">
              {isOwner ? 'Propietaria' : 'Equipo Admin'}: {user?.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#231F20] text-[#FBF9F7] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#3A3335] shrink-0 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Prenda</span>
        </button>
      </header>

      <div className="no-print max-w-7xl mx-auto flex flex-col lg:flex-row">
        {/* Sidebar (Desktop) / Horizontal Nav (Mobile) */}
        <aside className="lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-[#EAE0DA] px-4 py-3 lg:py-6 flex lg:flex-col gap-1.5 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[#231F20] text-[#FBF9F7]'
                    : 'text-[#574B47] hover:bg-[#F8EFEA] hover:text-[#231F20]'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={1.6} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 p-4 md:p-8 space-y-6">
          {feedback && (
            <div
              className={`rounded-xl px-4 py-3 text-xs font-medium border flex items-center justify-between ${
                feedback.type === 'ok'
                  ? 'bg-[#F8EFEA] border-[#D8C8BE] text-[#231F20]'
                  : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
              }`}
            >
              <span>{feedback.text}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="Cerrar notificación"
                className="p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {isUsingStarterPreview && (
            <div className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#231F20]">
                  Activa tu catálogo en Firebase
                </p>
                <p className="text-xs text-[#574B47]">
                  Tu base de datos Firestore aún está vacía. Publica las 4 prendas editoriales
                  iniciales o crea tu primera prenda desde cero.
                </p>
              </div>
              <button
                type="button"
                disabled={busyAction}
                onClick={handleSeedCatalog}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#231F20] text-[#FBF9F7] text-xs font-medium inline-flex items-center justify-center gap-2 hover:bg-[#3A3335] shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                <span>Publicar colección inicial</span>
              </button>
            </div>
          )}

          {/* TAB: ESTADÍSTICAS Y RESUMEN */}
          {tab === 'resumen' && (
            <div className="space-y-8">
              {/* Primary Financial & Store KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 space-y-1.5">
                  <p className="text-xs text-[#756661]">Ingresos confirmados</p>
                  <p className="text-2xl font-semibold text-[#231F20] tabular-nums">
                    {formatCOP(stats.confirmedRevenue)}
                  </p>
                  <p className="text-[11px] text-[#065F46] font-medium tabular-nums">
                    {stats.paidOrdersCount}{' '}
                    {stats.paidOrdersCount === 1 ? 'pedido pagado' : 'pedidos pagados'}
                  </p>
                </div>

                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 space-y-1.5">
                  <p className="text-xs text-[#756661]">Pendiente por cobrar</p>
                  <p className="text-2xl font-semibold text-[#231F20] tabular-nums">
                    {formatCOP(stats.pendingRevenue)}
                  </p>
                  <p className="text-[11px] text-[#9A3412] font-medium tabular-nums">
                    {stats.pendingPaymentCount}{' '}
                    {stats.pendingPaymentCount === 1
                      ? 'solicitud por WhatsApp'
                      : 'solicitudes por WhatsApp'}
                  </p>
                </div>

                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 space-y-1.5">
                  <p className="text-xs text-[#756661]">Ticket promedio</p>
                  <p className="text-2xl font-semibold text-[#231F20] tabular-nums">
                    {formatCOP(stats.averageTicket)}
                  </p>
                  <p className="text-[11px] text-[#756661] tabular-nums">
                    {stats.totalUnitsSold} prendas vendidas en {stats.nonCanceledCount} pedidos
                  </p>
                </div>

                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 space-y-1.5">
                  <p className="text-xs text-[#756661]">Clientas registradas</p>
                  <p className="text-2xl font-semibold text-[#231F20] tabular-nums">
                    {customers.length}
                  </p>
                  <p className="text-[11px] text-[#8C5E58] font-medium tabular-nums">
                    {stats.usedCoupons} redimieron 10% · {stats.availableCoupons} disponibles
                  </p>
                </div>
              </div>

              {/* Order Status Breakdown & Inventory Health */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-2xl text-[#231F20]">Estado de pedidos</h2>
                    <span className="text-xs text-[#756661] tabular-nums">
                      {orders.length} totales
                    </span>
                  </div>
                  <div className="space-y-3">
                    {stats.statusBreakdown.map((item) => (
                      <div key={item.status} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#231F20]">{item.label}</span>
                          <span className="text-[#756661] tabular-nums">
                            {item.count} ({item.pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#F8EFEA] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              item.status === 'cancelado'
                                ? 'bg-[#D97777]'
                                : item.status === 'entregado' || item.status === 'pagado'
                                  ? 'bg-[#231F20]'
                                  : 'bg-[#8C5E58]'
                            }`}
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-2xl text-[#231F20]">Salud del inventario</h2>
                    <button
                      type="button"
                      onClick={() => setTab('inventario')}
                      className="text-xs font-medium text-[#8C5E58] hover:underline"
                    >
                      Gestionar stock
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#FBF9F7] border border-[#EAE0DA] rounded-xl p-3 space-y-0.5">
                      <p className="text-[11px] text-[#756661]">Unidades totales</p>
                      <p className="text-lg font-semibold text-[#231F20] tabular-nums">
                        {stats.totalUnitsInStock}
                      </p>
                    </div>
                    <div className="bg-[#FBF9F7] border border-[#EAE0DA] rounded-xl p-3 space-y-0.5">
                      <p className="text-[11px] text-[#756661]">Activas</p>
                      <p className="text-lg font-semibold text-[#231F20] tabular-nums">
                        {stats.activeCount} / {products.length}
                      </p>
                    </div>
                    <div className="bg-[#FBF9F7] border border-[#EAE0DA] rounded-xl p-3 space-y-0.5">
                      <p className="text-[11px] text-[#756661]">Stock bajo</p>
                      <p className="text-lg font-semibold text-[#8C5E58] tabular-nums">
                        {stats.lowStock.length}
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-[#574B47]">Valor total en inventario</span>
                    <span className="text-sm font-semibold text-[#231F20] tabular-nums">
                      {formatCOP(stats.inventoryRetailValue)}
                    </span>
                  </div>

                  {stats.lowStock.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-[#756661]">
                        Alertas de reposición ({stats.outOfStock.length} agotadas):
                      </p>
                      <div className="divide-y divide-[#EAE0DA]">
                        {stats.lowStock.slice(0, 4).map((p) => (
                          <div
                            key={p.id}
                            className="py-2 flex items-center justify-between text-xs"
                          >
                            <span className="text-[#231F20] truncate pr-2">{p.name}</span>
                            <span
                              className={`font-medium tabular-nums shrink-0 ${
                                p.stock === 0 ? 'text-[#B91C1C]' : 'text-[#8C5E58]'
                              }`}
                            >
                              {p.stock === 0 ? 'Agotado' : `${p.stock} uds`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#065F46]">
                      Todo el inventario tiene disponibilidad saludable (más de 3 unidades por
                      prenda).
                    </p>
                  )}
                </div>
              </div>

              {/* Top Selling Garments & Recent Orders */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-2xl text-[#231F20] flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-[#8C5E58]" strokeWidth={1.6} />
                      <span>Prendas más vendidas</span>
                    </h2>
                  </div>
                  {stats.topProducts.length === 0 ? (
                    <p className="text-sm text-[#756661] py-6 text-center">
                      Cuando ingresen pedidos activos verás aquí el ranking de prendas más pedidas.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#EAE0DA]">
                      {stats.topProducts.map((item, idx) => (
                        <div
                          key={item.name}
                          className="py-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-[#F8EFEA] border border-[#EAE0DA] text-[11px] font-semibold text-[#231F20] flex items-center justify-center shrink-0 tabular-nums">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#231F20] truncate">
                                {item.name}
                              </p>
                              <p className="text-xs text-[#756661] tabular-nums">
                                {item.unitsSold}{' '}
                                {item.unitsSold === 1 ? 'unidad vendida' : 'unidades vendidas'}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-[#231F20] tabular-nums shrink-0">
                            {formatCOP(item.revenue)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-2xl text-[#231F20]">Últimos pedidos</h2>
                    <button
                      type="button"
                      onClick={() => setTab('pedidos')}
                      className="text-xs font-medium text-[#8C5E58] hover:underline"
                    >
                      Gestionar todos
                    </button>
                  </div>
                  {orders.length === 0 ? (
                    <p className="text-sm text-[#756661] py-6 text-center">
                      Aún no han ingresado pedidos de clientas.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#EAE0DA]">
                      {orders.slice(0, 5).map((order) => (
                        <div
                          key={order.id}
                          className="py-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#231F20] truncate">
                              {order.customerName}
                            </p>
                            <p className="text-xs text-[#756661] font-mono tabular-nums">
                              {order.orderNumber} ·{' '}
                              {ORDER_STATUS_OPTIONS.find((o) => o.value === order.status)?.label ??
                                order.status}
                            </p>
                          </div>
                          <p className="text-sm font-semibold tabular-nums shrink-0">
                            {formatCOP(order.total)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: INVENTARIO */}
          {tab === 'inventario' && (
            <div className="space-y-5">
              <div className="flex flex-col md:flex-row gap-3 justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[#756661] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por código, nombre, tono o categoría..."
                    className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    aria-label="Filtrar por categoría"
                    className="min-h-[44px] px-3.5 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                  >
                    <option value="Todas">Todas las categorías</option>
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={filteredProducts.length === 0}
                    onClick={() => {
                      setTagSingleProduct(null);
                      setTagModalOpen(true);
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-[#EAE0DA] bg-white text-xs font-medium text-[#231F20] inline-flex items-center gap-2 hover:bg-[#F8EFEA] disabled:opacity-40 whitespace-nowrap"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir etiquetas</span>
                  </button>
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-10 text-center space-y-3">
                  <p className="font-display text-2xl text-[#231F20]">Sin prendas encontradas</p>
                  <p className="text-sm text-[#756661]">
                    Ajusta los filtros o agrega una nueva prenda al catálogo.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-[#EAE0DA] rounded-2xl overflow-hidden divide-y divide-[#EAE0DA]">
                  {filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FBF9F7] transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-16 h-20 rounded-xl overflow-hidden bg-[#F8EFEA] border border-[#EAE0DA] shrink-0">
                          <ResilientImage
                            src={p.imageUrl}
                            alt={p.name}
                            fallbackLabel={p.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-mono text-[#8C5E58]">
                            {p.sku ? `Cód. ${p.sku}` : 'Sin código asignado'}
                          </p>
                          <p className="text-sm font-semibold text-[#231F20] truncate">
                            {p.name}
                          </p>
                          <p className="text-xs text-[#756661]">
                            {p.category} · {p.color} · Tallas: {p.sizes.join(', ')}
                          </p>
                          <p className="text-sm font-medium text-[#231F20] tabular-nums">
                            {formatCOP(p.price)}{' '}
                            <span className="text-xs font-normal text-[#756661]">
                              · {p.active ? 'Publicada' : 'Oculta'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 shrink-0">
                        <div className="inline-flex items-center border border-[#EAE0DA] rounded-xl bg-white">
                          <button
                            type="button"
                            disabled={isUsingStarterPreview || p.stock <= 0}
                            onClick={() => adjustProductStock(p.id, p.stock - 1)}
                            aria-label={`Reducir stock de ${p.name}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#231F20] hover:bg-[#F8EFEA] disabled:opacity-40 rounded-l-xl"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 text-xs font-medium tabular-nums min-w-[64px] text-center">
                            {p.stock} uds
                          </span>
                          <button
                            type="button"
                            disabled={isUsingStarterPreview}
                            onClick={() => adjustProductStock(p.id, p.stock + 1)}
                            aria-label={`Aumentar stock de ${p.name}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#231F20] hover:bg-[#F8EFEA] disabled:opacity-40 rounded-r-xl"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (!p.sku && !isUsingStarterPreview) {
                                openEditModal(p, true);
                                return;
                              }
                              setTagSingleProduct(p);
                              setTagModalOpen(true);
                            }}
                            title={
                              p.sku
                                ? 'Imprimir etiqueta para tienda física'
                                : 'Asignar código e imprimir etiqueta'
                            }
                            aria-label={`Imprimir etiqueta de ${p.name}`}
                            className="min-h-[44px] px-3 rounded-xl border border-[#EAE0DA] bg-white text-xs font-medium text-[#231F20] inline-flex items-center gap-1.5 hover:bg-[#F8EFEA]"
                          >
                            <Printer className="w-4 h-4" />
                            <span className="hidden sm:inline">
                              {p.sku ? 'Etiqueta' : 'Asignar cód.'}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={isUsingStarterPreview}
                            onClick={() => toggleProductActive(p.id, !p.active)}
                            title={p.active ? 'Ocultar prenda' : 'Publicar prenda'}
                            aria-label={p.active ? 'Ocultar prenda' : 'Publicar prenda'}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#EAE0DA] bg-white text-[#574B47] hover:bg-[#F8EFEA] disabled:opacity-40"
                          >
                            {p.active ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            title="Editar prenda"
                            aria-label={`Editar ${p.name}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#EAE0DA] bg-white text-[#231F20] hover:bg-[#F8EFEA]"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {!isUsingStarterPreview && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(p)}
                              title="Eliminar prenda"
                              aria-label={`Eliminar ${p.name}`}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#EAE0DA] bg-white text-[#B91C1C] hover:bg-[#FEF2F2]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: PEDIDOS */}
          {tab === 'pedidos' && (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {[{ value: 'todos', label: 'Todos' }, ...ORDER_STATUS_OPTIONS].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOrderStatusFilter(opt.value)}
                    className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      orderStatusFilter === opt.value
                        ? 'bg-[#231F20] text-[#FBF9F7] border-[#231F20]'
                        : 'bg-white text-[#574B47] border-[#EAE0DA] hover:bg-[#F8EFEA]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-10 text-center space-y-2">
                  <Package className="w-6 h-6 mx-auto text-[#8C5E58]" strokeWidth={1.5} />
                  <p className="font-display text-2xl text-[#231F20]">Sin pedidos en esta vista</p>
                  <p className="text-sm text-[#756661]">
                    Los pedidos solicitados por WhatsApp aparecerán automáticamente aquí en tiempo
                    real.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => {
                    const waClientHref = formatCustomerWhatsappHref(order.customerPhone);
                    const isPaid =
                      order.paymentStatus === 'pagado' ||
                      order.status === 'pagado' ||
                      order.status === 'preparando' ||
                      order.status === 'enviado' ||
                      order.status === 'entregado';

                    return (
                      <div
                        key={order.id}
                        className="bg-white border border-[#EAE0DA] rounded-2xl p-5 space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[#EAE0DA]">
                          <div className="space-y-1">
                            <p className="font-mono text-sm font-semibold text-[#231F20] tabular-nums">
                              {order.orderNumber} · {order.customerName}
                            </p>
                            <p className="text-xs text-[#756661]">
                              {order.customerPhone} · {order.customerEmail} ·{' '}
                              {formatDateTime(order.createdAt)}
                            </p>
                            <p className="text-xs text-[#574B47]">
                              {order.city} — {order.shippingAddress}
                            </p>
                            {order.notes && (
                              <p className="text-xs text-[#8C5E58] pt-1">Nota: {order.notes}</p>
                            )}
                            {waClientHref && (
                              <div className="pt-1">
                                <a
                                  href={waClientHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#231F20] underline underline-offset-4 hover:text-[#8C5E58]"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>Escribir a la clienta por WhatsApp</span>
                                </a>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                            <p className="text-lg font-semibold text-[#231F20] tabular-nums">
                              {formatCOP(order.total)}
                            </p>
                            <span
                              className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-medium ${
                                order.status === 'cancelado'
                                  ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                                  : isPaid
                                    ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
                                    : 'bg-[#FFF7ED] text-[#9A3412] border-[#FED7AA]'
                              }`}
                            >
                              {order.status === 'cancelado'
                                ? 'Cancelado (stock devuelto)'
                                : isPaid
                                  ? 'Pago confirmado'
                                  : 'Pendiente de pago'}
                            </span>
                            {order.discountAmount > 0 && (
                              <p className="text-xs text-[#8C5E58]">
                                Incluye -10% primera compra (-{formatCOP(order.discountAmount)})
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          {order.items.map((item, idx) => (
                            <div
                              key={`${order.id}-item-${idx}`}
                              className="flex justify-between text-xs text-[#574B47]"
                            >
                              <span>
                                {item.quantity}× {item.name} · Talla {item.size} ({item.color})
                              </span>
                              <span className="tabular-nums">
                                {formatCOP(item.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-3 border-t border-[#EAE0DA] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <span className="text-xs font-medium text-[#756661] block">
                              Actualizar estado (visible al instante en la cuenta de la clienta):
                            </span>
                            <span className="text-[11px] text-[#9E8F8A] block">
                              Si cancelas el pedido, las unidades regresan automáticamente al
                              inventario.
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ORDER_STATUS_OPTIONS.map((opt) => {
                              const active = order.status === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  disabled={busyAction}
                                  onClick={() => handleChangeOrderStatus(order.id, opt.value)}
                                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                    active
                                      ? 'bg-[#231F20] text-[#FBF9F7] border-[#231F20]'
                                      : 'bg-[#FBF9F7] text-[#574B47] border-[#EAE0DA] hover:bg-[#F8EFEA]'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: CLIENTAS REGISTRADAS */}
          {tab === 'clientas' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 space-y-1">
                  <p className="text-xs text-[#756661]">Total registradas</p>
                  <p className="text-2xl font-semibold text-[#231F20] tabular-nums">
                    {customers.length}
                  </p>
                </div>
                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 space-y-1">
                  <p className="text-xs text-[#756661]">10% bienvenida disponible</p>
                  <p className="text-2xl font-semibold text-[#8C5E58] tabular-nums">
                    {stats.availableCoupons}
                  </p>
                </div>
                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-5 space-y-1">
                  <p className="text-xs text-[#756661]">10% ya redimido</p>
                  <p className="text-2xl font-semibold text-[#231F20] tabular-nums">
                    {stats.usedCoupons}
                  </p>
                </div>
              </div>

              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-[#756661] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Buscar clienta por nombre, correo o teléfono..."
                  className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                />
              </div>

              {customersLoading ? (
                <div className="space-y-3">
                  <div className="h-20 rounded-2xl bg-[#F8EFEA] animate-pulse" />
                  <div className="h-20 rounded-2xl bg-[#F8EFEA] animate-pulse" />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="bg-white border border-[#EAE0DA] rounded-2xl p-10 text-center space-y-2">
                  <Users className="w-6 h-6 mx-auto text-[#8C5E58]" strokeWidth={1.5} />
                  <p className="font-display text-2xl text-[#231F20]">
                    Sin clientas registradas aún
                  </p>
                  <p className="text-sm text-[#756661]">
                    Cada persona que ingrese y se registre por el 10% aparecerá aquí al instante.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-[#EAE0DA] rounded-2xl overflow-hidden divide-y divide-[#EAE0DA]">
                  {filteredCustomers.map((c) => (
                    <div
                      key={c.uid}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-semibold text-[#231F20] truncate">
                          {c.name}
                        </p>
                        <p className="text-xs text-[#574B47] truncate">
                          {c.email}
                          {c.phone ? ` · Tel: ${c.phone}` : ''}
                        </p>
                        <p className="text-xs text-[#756661]">
                          Registro: {formatDateTime(c.registeredAt)} · Último ingreso:{' '}
                          {formatDateTime(c.lastSeenAt)}
                        </p>
                      </div>

                      <div className="flex sm:flex-col sm:items-end justify-between gap-1 shrink-0">
                        <span className="text-xs font-medium text-[#231F20] tabular-nums">
                          {c.ordersCount} {c.ordersCount === 1 ? 'pedido' : 'pedidos'}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            c.welcomeDiscountUsed ? 'text-[#756661]' : 'text-[#8C5E58]'
                          }`}
                        >
                          {c.welcomeDiscountUsed
                            ? '10% primera compra usado'
                            : '10% primera compra disponible'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: EQUIPO (MULTI-ADMIN) */}
          {tab === 'equipo' && isOwner && (
            <div className="space-y-6 max-w-2xl">
              <form
                onSubmit={handleAddStaff}
                className="bg-white border border-[#EAE0DA] rounded-2xl p-6 space-y-4"
              >
                <div className="space-y-1">
                  <h2 className="font-display text-2xl text-[#231F20]">
                    Autorizar Trabajador como Administrador
                  </h2>
                  <p className="text-xs text-[#574B47]">
                    Agrega el correo de Google de tus colaboradores para que puedan entrar al
                    Panel Admin, agregar prendas al catálogo, editar stock y gestionar pedidos.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#231F20]" htmlFor="staff-name">
                      Nombre del trabajador
                    </label>
                    <input
                      id="staff-name"
                      type="text"
                      required
                      maxLength={80}
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="Laura Martínez"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#231F20]" htmlFor="staff-email">
                      Correo electrónico (Google)
                    </label>
                    <input
                      id="staff-email"
                      type="email"
                      required
                      maxLength={160}
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      placeholder="asesora@gmail.com"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busyAction}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#231F20] text-[#FBF9F7] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#3A3335] disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Autorizar acceso administrador</span>
                </button>
              </form>

              <div className="bg-white border border-[#EAE0DA] rounded-2xl p-6 space-y-4">
                <h3 className="font-display text-2xl text-[#231F20]">Equipo autorizado</h3>
                {staffMembers.length === 0 ? (
                  <p className="text-sm text-[#756661]">
                    Todavía no has agregado trabajadores adicionales. Solo las cuentas propietarias
                    tienen acceso en este momento.
                  </p>
                ) : (
                  <div className="divide-y divide-[#EAE0DA]">
                    {staffMembers.map((member) => (
                      <div
                        key={member.id}
                        className="py-3.5 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#231F20] truncate">
                            {member.name}
                          </p>
                          <p className="text-xs text-[#756661] truncate">
                            {member.email} · Administrador
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStaffMember(member.email)}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-[#EAE0DA] text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2] shrink-0"
                        >
                          Revocar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: CONFIGURACIÓN DE TIENDA */}
          {tab === 'tienda' && (
            <form
              onSubmit={handleSaveSettings}
              className="bg-white border border-[#EAE0DA] rounded-2xl p-6 max-w-2xl space-y-5"
            >
              <div className="space-y-1">
                <h2 className="font-display text-2xl text-[#231F20]">
                  Portada y Reglas de Envío
                </h2>
                <p className="text-xs text-[#756661]">
                  Actualiza los textos principales y tarifas sin modificar el código.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#231F20]" htmlFor="set-ann">
                  Barra de anuncio superior
                </label>
                <input
                  id="set-ann"
                  type="text"
                  maxLength={140}
                  value={setAnnouncement}
                  onChange={(e) => setSetAnnouncement(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#231F20]" htmlFor="set-hero-title">
                  Titular principal de portada
                </label>
                <input
                  id="set-hero-title"
                  type="text"
                  required
                  maxLength={100}
                  value={setHeroTitle}
                  onChange={(e) => setSetHeroTitle(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#231F20]" htmlFor="set-hero-sub">
                  Subtítulo editorial
                </label>
                <textarea
                  id="set-hero-sub"
                  rows={3}
                  required
                  maxLength={240}
                  value={setHeroSubtitle}
                  onChange={(e) => setSetHeroSubtitle(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#231F20]" htmlFor="set-free">
                    Envío gratis desde (COP)
                  </label>
                  <input
                    id="set-free"
                    type="number"
                    min={0}
                    required
                    value={setFreeThreshold}
                    onChange={(e) => setSetFreeThreshold(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] font-mono text-sm focus:outline-none focus:border-[#231F20]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#231F20]" htmlFor="set-fee">
                    Tarifa estándar de envío (COP)
                  </label>
                  <input
                    id="set-fee"
                    type="number"
                    min={0}
                    required
                    value={setShippingFee}
                    onChange={(e) => setSetShippingFee(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] font-mono text-sm focus:outline-none focus:border-[#231F20]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busyAction}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium inline-flex items-center gap-2 hover:bg-[#3A3335] disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Guardar cambios en Firebase</span>
              </button>
            </form>
          )}
        </main>
      </div>

      {/* Create / Edit Product Modal */}
      {productModalOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[#231F20]/45 backdrop-blur-xs p-0 md:p-6"
          onClick={() => setProductModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={editingProduct ? 'Editar prenda' : 'Nueva prenda'}
        >
          <div
            className="w-full md:max-w-2xl max-h-[92vh] overflow-y-auto bg-[#FBF9F7] rounded-t-3xl md:rounded-2xl border border-[#EAE0DA] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#EAE0DA] flex items-center justify-between sticky top-0 bg-[#FBF9F7] z-10">
              <h2 className="font-display text-2xl font-medium text-[#231F20]">
                {editingProduct ? 'Editar Prenda' : 'Agregar Nueva Prenda'}
              </h2>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                aria-label="Cerrar formulario"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-[#F8EFEA]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-[#231F20]" htmlFor="prod-name">
                    Nombre de la prenda
                  </label>
                  <input
                    id="prod-name"
                    type="text"
                    required
                    maxLength={PRODUCT_LIMITS.nameMax}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Vestido Lino Sol"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-[#231F20]" htmlFor="prod-sku">
                    Código de prenda (tienda física e inventario)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="prod-sku"
                      type="text"
                      required
                      maxLength={PRODUCT_LIMITS.skuMax}
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                      placeholder="MIA-VES-001"
                      className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-white border border-[#EAE0DA] font-mono text-sm uppercase focus:outline-none focus:border-[#231F20]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormSku(
                          generateSuggestedSku(
                            formCategory,
                            products
                              .filter((p) => p.id !== editingProduct?.id)
                              .map((p) => p.sku)
                          )
                        )
                      }
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#EAE0DA] bg-[#F8EFEA] text-xs font-medium text-[#231F20] inline-flex items-center gap-1.5 hover:bg-[#EAE0DA] whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Generar código</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#756661]">
                    Usa letras, números y guiones. Este código aparecerá en la etiqueta impresa de
                    la prenda.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#231F20]" htmlFor="prod-cat">
                    Categoría
                  </label>
                  <select
                    id="prod-cat"
                    value={formCategory}
                    onChange={(e) => {
                      const nextCat = e.target.value as ProductCategory;
                      setFormCategory(nextCat);
                      if (!editingProduct && /^MIA-[A-Z]{3}-\d{3}$/.test(formSku)) {
                        setFormSku(
                          generateSuggestedSku(
                            nextCat,
                            products.map((p) => p.sku)
                          )
                        );
                      }
                    }}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#231F20]" htmlFor="prod-color">
                    Tono / Color
                  </label>
                  <input
                    id="prod-color"
                    type="text"
                    required
                    maxLength={PRODUCT_LIMITS.colorMax}
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    placeholder="Rosa Palo, Marfil, Arena..."
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#231F20]" htmlFor="prod-price">
                    Precio (COP)
                  </label>
                  <input
                    id="prod-price"
                    type="number"
                    min={1}
                    max={PRODUCT_LIMITS.maxPrice}
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#EAE0DA] font-mono text-sm focus:outline-none focus:border-[#231F20]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#231F20]" htmlFor="prod-stock">
                    Unidades en inventario
                  </label>
                  <input
                    id="prod-stock"
                    type="number"
                    min={0}
                    max={PRODUCT_LIMITS.maxStock}
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#EAE0DA] font-mono text-sm focus:outline-none focus:border-[#231F20]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-[#231F20] block">Tallas disponibles</span>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_SIZES.map((sz) => {
                    const selected = formSizes.includes(sz);
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => toggleSize(sz)}
                        className={`min-h-[44px] min-w-[48px] px-3.5 rounded-xl text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-[#231F20] text-[#FBF9F7] border-[#231F20]'
                            : 'bg-white text-[#574B47] border-[#EAE0DA]'
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <span className="text-xs font-medium text-[#231F20] block">
                  Fotografía de la prenda
                </span>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) processSelectedImageFile(file);
                  }}
                  className="bg-white border border-dashed border-[#D8C8BE] rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center"
                >
                  <div className="w-20 h-26 rounded-xl overflow-hidden bg-[#F8EFEA] border border-[#EAE0DA] shrink-0">
                    <ResilientImage
                      src={formImageUrl}
                      alt="Vista previa de prenda"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-2.5 w-full">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) processSelectedImageFile(file);
                      }}
                      className="hidden"
                      aria-label="Seleccionar foto desde tu ordenador"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={imageUploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-[#231F20] text-[#FBF9F7] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#3A3335] disabled:opacity-50 transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        <span>
                          {imageUploading
                            ? 'Optimizando foto...'
                            : 'Subir foto de mi ordenador'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowUrlField((v) => !v)}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#EAE0DA] bg-[#FBF9F7] text-xs font-medium text-[#574B47] inline-flex items-center gap-1.5 hover:bg-[#F8EFEA]"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>{showUrlField ? 'Ocultar enlace URL' : 'Usar enlace URL'}</span>
                      </button>
                    </div>

                    {formImageUrl.startsWith('data:') ? (
                      <p className="text-xs text-[#065F46] flex items-center gap-1.5">
                        <ImagePlus className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Foto cargada desde tu equipo
                          {uploadedSizeKb ? ` (${uploadedSizeKb} KB)` : ''}. Al guardar, todas tus
                          clientas la verán al instante.
                        </span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#756661]">
                        Selecciona o arrastra una foto JPG, PNG o WebP desde tu ordenador o celular.
                      </p>
                    )}

                    {showUrlField && (
                      <input
                        id="prod-img"
                        type="text"
                        maxLength={PRODUCT_LIMITS.imageUrlMax}
                        value={formImageUrl.startsWith('data:') ? '' : formImageUrl}
                        onChange={(e) => {
                          setUploadedSizeKb(null);
                          setFormImageUrl(e.target.value);
                        }}
                        placeholder="https://... pega aquí el enlace de la fotografía"
                        className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FBF9F7] border border-[#EAE0DA] text-xs focus:outline-none focus:border-[#231F20]"
                      />
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {STUDIO_GALLERY_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setUploadedSizeKb(null);
                            setFormImageUrl(preset.url);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#F8EFEA] text-[11px] text-[#574B47] hover:bg-[#EAE0DA] transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#231F20]" htmlFor="prod-desc">
                  Descripción editorial
                </label>
                <textarea
                  id="prod-desc"
                  rows={3}
                  required
                  maxLength={PRODUCT_LIMITS.descriptionMax}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe los materiales, el corte y ocasiones de uso..."
                  className="w-full p-3.5 rounded-xl bg-white border border-[#EAE0DA] text-sm focus:outline-none focus:border-[#231F20]"
                />
              </div>

              <div className="flex flex-wrap gap-6 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#231F20] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 accent-[#231F20]"
                  />
                  <span>Publicada en tienda</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#231F20] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFeatured}
                    onChange={(e) => setFormFeatured(e.target.checked)}
                    className="w-4 h-4 accent-[#231F20]"
                  />
                  <span>Destacar en colección</span>
                </label>
              </div>

              {productModalError && (
                <div className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3">
                  {productModalError}
                </div>
              )}

              <div className="pt-3 border-t border-[#EAE0DA] flex flex-wrap justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="min-h-[44px] px-5 py-2 rounded-xl border border-[#EAE0DA] bg-white text-sm font-medium text-[#574B47]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busyAction || imageUploading}
                  onClick={() => saveProductAndMaybePrint(true)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#D8C8BE] bg-[#F8EFEA] text-sm font-medium text-[#231F20] inline-flex items-center gap-2 hover:bg-[#EAE0DA] disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  <span>Guardar e imprimir etiqueta</span>
                </button>
                <button
                  type="submit"
                  disabled={busyAction || imageUploading}
                  className="min-h-[44px] px-6 py-2 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium hover:bg-[#3A3335] disabled:opacity-50"
                >
                  {busyAction ? 'Publicando...' : 'Guardar en Firebase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#231F20]/45 backdrop-blur-xs p-4"
          onClick={() => setDeleteTarget(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm bg-[#FBF9F7] rounded-2xl border border-[#EAE0DA] p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-2xl text-[#231F20]">Eliminar prenda</h3>
            <p className="text-sm text-[#574B47]">
              ¿Seguro que deseas eliminar &ldquo;{deleteTarget.name}&rdquo; del catálogo? Esta
              acción se sincroniza de inmediato.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#EAE0DA] bg-white text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={handleConfirmDelete}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#B91C1C] text-white text-xs font-medium hover:bg-[#991B1B]"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Physical Tag & Shelf Label Modal */}
      <PrintableTagModal
        open={tagModalOpen}
        products={filteredProducts}
        initialSingleProduct={tagSingleProduct}
        onClose={() => {
          setTagModalOpen(false);
          setTagSingleProduct(null);
        }}
      />
    </div>
  );
}
