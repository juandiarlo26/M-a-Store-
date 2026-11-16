import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { configurePixels, trackAddToCart, trackLead, trackPurchase } from '../lib/analytics';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
  testConnection,
} from '../lib/firebase';
import { normalizeSku } from '../lib/skuUtils';
import {
  DEFAULT_DELIVERY_TIME_TEXT,
  DEFAULT_SIZE_GUIDE,
  DEFAULT_STORE_SETTINGS,
  getProductImages,
  STARTER_PRODUCTS,
} from '../lib/starterCatalog';
import {
  BOOTSTRAPPED_ADMIN_EMAILS,
  COLOMBIA_WHATSAPP_10_REGEX,
  COLOMBIA_WHATSAPP_NORMALIZED_REGEX,
  GA_MEASUREMENT_REGEX,
  META_PIXEL_REGEX,
  ORDER_LIMITS,
  PRODUCT_LIMITS,
  SETTINGS_LIMITS,
  WAITLIST_LIMITS,
  type CartItem,
  type CustomerProfile,
  type LaunchMode,
  type Order,
  type OrderItem,
  type OrderStatus,
  type PaymentStatus,
  type Product,
  type ProductCategory,
  type SizeGuideRow,
  type StaffMember,
  type StoreSettings,
  type WaitlistEntry,
} from '../types/store';

const CART_STORAGE_KEY = 'mia_store_cart_v1';

interface CheckoutPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  notes?: string;
  privacyAccepted?: boolean;
}

export interface ProductInput {
  sku?: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  color: string;
  sizes: string[];
  stockBySize?: Record<string, number>;
  imageUrl: string;
  images?: string[];
  stock: number;
  featured: boolean;
  active: boolean;
}

interface StoreContextValue {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  customerProfile: CustomerProfile | null;
  isEligibleForWelcomeDiscount: boolean;
  customers: CustomerProfile[];
  customersLoading: boolean;
  staffMembers: StaffMember[];
  products: Product[];
  liveCatalogCount: number;
  isUsingStarterPreview: boolean;
  productsLoading: boolean;
  orders: Order[];
  ordersLoading: boolean;
  settings: StoreSettings;
  settingsLoaded: boolean;
  waitlistEntries: WaitlistEntry[];
  waitlistLoading: boolean;
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  welcomeDiscountAmount: number;
  shippingCost: number;
  cartTotal: number;
  loginWithGoogle: (acceptedPrivacy?: boolean) => Promise<User>;
  logout: () => Promise<void>;
  addToCart: (product: Product, size: string, quantity?: number) => void;
  updateCartQuantity: (productId: string, size: string, quantity: number) => void;
  removeFromCart: (productId: string, size: string) => void;
  clearCart: () => void;
  placeOrder: (payload: CheckoutPayload) => Promise<Order>;
  createProduct: (input: ProductInput, preferredId?: string) => Promise<Product>;
  updateProduct: (productId: string, input: ProductInput) => Promise<void>;
  adjustProductStock: (productId: string, newStock: number) => Promise<void>;
  toggleProductActive: (productId: string, active: boolean) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateStoreSettings: (next: Omit<StoreSettings, 'updatedAt'>) => Promise<void>;
  submitWaitlistEntry: (
    name: string,
    phoneInput: string,
    consent: boolean
  ) => Promise<{ alreadyRegistered?: boolean }>;
  deleteWaitlistEntry: (entryId: string) => Promise<void>;
  seedStarterCatalog: () => Promise<void>;
  addStaffMember: (email: string, name: string) => Promise<void>;
  removeStaffMember: (email: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

function slugifyId(text: string): string {
  const base = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || 'prenda'}-${suffix}`;
}

function parseStockBySize(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0) return undefined;
  const result: Record<string, number> = {};
  for (const [size, val] of entries) {
    if (size) {
      result[size] = Math.max(0, Math.min(PRODUCT_LIMITS.maxStock, Math.floor(Number(val) || 0)));
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseNumericDeltas(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const qty = Math.floor(Number(v));
    if (k && qty > 0) {
      result[k] = qty;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function getAvailableStockForSize(product: Product, size: string): number {
  if (product.stockBySize && Object.keys(product.stockBySize).length > 0) {
    return Math.max(0, Math.floor(Number(product.stockBySize[size] ?? 0)));
  }
  return Math.max(0, Math.floor(Number(product.stock || 0)));
}

function formatSequentialOrderNumber(n: number): string {
  return `MIA-${String(Math.max(1, Math.floor(n))).padStart(5, '0')}`;
}

function buildFallbackOrderNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand4 = Math.floor(1000 + Math.random() * 9000);
  return `MIA-${yy}${mm}${dd}-${rand4}`;
}

function parseSizeGuide(raw: unknown): SizeGuideRow[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_SIZE_GUIDE;
  const rows: SizeGuideRow[] = [];
  for (const item of raw.slice(0, 10)) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const size = String(rec.size || '').trim().slice(0, 16);
    const bust = String(rec.bust || '').trim().slice(0, 32);
    const waist = String(rec.waist || '').trim().slice(0, 32);
    const hip = String(rec.hip || '').trim().slice(0, 32);
    if (size) {
      rows.push({ size, bust, waist, hip });
    }
  }
  return rows.length > 0 ? rows : DEFAULT_SIZE_GUIDE;
}

function sanitizeProductInput(input: ProductInput): ProductInput {
  const rawSku = input.sku?.trim() ?? '';
  const sku = rawSku.length > 0 ? normalizeSku(rawSku) : undefined;
  const name = input.name.trim().slice(0, PRODUCT_LIMITS.nameMax);
  const description = input.description.trim().slice(0, PRODUCT_LIMITS.descriptionMax);
  const color = input.color.trim().slice(0, PRODUCT_LIMITS.colorMax);
  const rawList = Array.isArray(input.images) && input.images.length > 0 ? input.images : [input.imageUrl];
  const cleanImages: string[] = [];
  for (const rawItem of rawList) {
    const trimmed = typeof rawItem === 'string' ? rawItem.trim() : '';
    if (trimmed.length >= PRODUCT_LIMITS.imageUrlMin && !cleanImages.includes(trimmed)) {
      cleanImages.push(trimmed);
    }
    if (cleanImages.length >= PRODUCT_LIMITS.maxImages) break;
  }

  const sizes = (input.sizes.length > 0 ? input.sizes : ['Única']).slice(0, PRODUCT_LIMITS.maxSizes);
  const price = Math.max(1, Math.min(PRODUCT_LIMITS.maxPrice, Math.round(Number(input.price) || 0)));

  let cleanStockBySize: Record<string, number> | undefined;
  let stock = Math.max(0, Math.min(PRODUCT_LIMITS.maxStock, Math.floor(Number(input.stock) || 0)));
  if (input.stockBySize && typeof input.stockBySize === 'object') {
    cleanStockBySize = {};
    for (const sz of sizes) {
      cleanStockBySize[sz] = Math.max(
        0,
        Math.min(PRODUCT_LIMITS.maxStock, Math.floor(Number(input.stockBySize[sz] ?? 0)))
      );
    }
    stock = Math.min(
      PRODUCT_LIMITS.maxStock,
      Object.values(cleanStockBySize).reduce((sum, n) => sum + n, 0)
    );
  }

  if (rawSku.length > 0 && (!sku || sku.length < PRODUCT_LIMITS.skuMin || sku.length > PRODUCT_LIMITS.skuMax)) {
    throw new Error(
      'El código de prenda debe tener entre 2 y 32 caracteres válidos (letras, números o guiones).'
    );
  }
  if (name.length < PRODUCT_LIMITS.nameMin) {
    throw new Error('El nombre de la prenda debe tener al menos 2 caracteres.');
  }
  if (description.length < PRODUCT_LIMITS.descriptionMin) {
    throw new Error('La descripción debe tener al menos 5 caracteres.');
  }
  if (color.length < PRODUCT_LIMITS.colorMin) {
    throw new Error('Indica el tono o color de la prenda.');
  }
  if (cleanImages.length === 0) {
    throw new Error('Agrega o sube al menos una fotografía válida para la prenda.');
  }
  for (const imgUrl of cleanImages) {
    if (imgUrl.length > PRODUCT_LIMITS.imageUrlMax) {
      throw new Error('Una de las fotografías es demasiado pesada. Sube una imagen más ligera.');
    }
  }
  const combinedLength = cleanImages.reduce((sum, u) => sum + u.length, 0);
  if (combinedLength > 850000) {
    throw new Error(
      'El peso conjunto de las fotos supera el límite de almacenamiento en línea. Reduce el número de fotos locales o habilita Firebase Storage.'
    );
  }

  const imageUrl = cleanImages[0];

  return {
    ...(sku ? { sku } : {}),
    name,
    description,
    price,
    category: input.category,
    color,
    sizes,
    ...(cleanStockBySize ? { stockBySize: cleanStockBySize } : {}),
    imageUrl,
    images: cleanImages,
    stock,
    featured: Boolean(input.featured),
    active: Boolean(input.active),
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const pendingPrivacyConsentRef = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  const [liveProducts, setLiveProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoadedOnce, setOrdersLoadedOnce] = useState(false);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    testConnection();
  }, []);

  // Auth listener + role check (owner, staff email, or admins UID) + customer registration upsert
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser || !nextUser.emailVerified) {
        setIsOwner(false);
        setIsAdmin(false);
        setCustomerProfile(null);
        setAuthReady(true);
        return;
      }

      const email = (nextUser.email || '').toLowerCase();
      const ownerMatch = BOOTSTRAPPED_ADMIN_EMAILS.includes(email);
      setIsOwner(ownerMatch);

      let adminMatch = ownerMatch;
      if (!adminMatch && email) {
        try {
          const [staffSnap, adminSnap] = await Promise.all([
            getDoc(doc(db, 'staff', email)),
            getDoc(doc(db, 'admins', nextUser.uid)),
          ]);
          adminMatch = staffSnap.exists() || adminSnap.exists();
        } catch {
          adminMatch = false;
        }
      }
      setIsAdmin(adminMatch);

      // Register or update customer profile in Firestore on login
      const customerRef = doc(db, 'customers', nextUser.uid);
      try {
        const existingSnap = await getDoc(customerRef);
        const safeName = (nextUser.displayName || email.split('@')[0] || 'Clienta')
          .trim()
          .slice(0, 100);
        if (!existingSnap.exists()) {
          const customerCreateDoc: Record<string, unknown> = {
            uid: nextUser.uid,
            name: safeName,
            email: nextUser.email || email,
            welcomeDiscountUsed: false,
            ordersCount: 0,
            registeredAt: serverTimestamp(),
            lastSeenAt: serverTimestamp(),
          };
          if (pendingPrivacyConsentRef.current) {
            customerCreateDoc.privacyConsentAt = serverTimestamp();
            pendingPrivacyConsentRef.current = false;
          }
          await setDoc(customerRef, customerCreateDoc);
        } else {
          const customerUpdateDoc: Record<string, unknown> = {
            name: safeName,
            lastSeenAt: serverTimestamp(),
          };
          if (pendingPrivacyConsentRef.current) {
            customerUpdateDoc.privacyConsentAt = serverTimestamp();
            pendingPrivacyConsentRef.current = false;
          }
          await updateDoc(customerRef, customerUpdateDoc);
        }
      } catch (err) {
        console.warn('No se pudo sincronizar el registro de la clienta:', err);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  // Live subscription to current user's customer profile (for 10% first-order discount)
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setCustomerProfile(null);
      return;
    }

    const ref = doc(db, 'customers', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setCustomerProfile({
            uid: String(d.uid || snap.id),
            name: String(d.name || ''),
            email: String(d.email || ''),
            phone: d.phone ? String(d.phone) : undefined,
            welcomeDiscountUsed: Boolean(d.welcomeDiscountUsed),
            ordersCount: Number(d.ordersCount || 0),
            privacyConsentAt: d.privacyConsentAt ?? null,
            registeredAt: d.registeredAt ?? null,
            lastSeenAt: d.lastSeenAt ?? null,
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `customers/${user.uid}`);
      }
    );

    return () => unsub();
  }, [authReady, user]);

  // Admin: live subscription to all registered customers
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified || !isAdmin) {
      setCustomers([]);
      setCustomersLoading(false);
      return;
    }

    setCustomersLoading(true);
    const unsub = onSnapshot(
      collection(db, 'customers'),
      (snapshot) => {
        const list: CustomerProfile[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            uid: String(d.uid || docSnap.id),
            name: String(d.name || ''),
            email: String(d.email || ''),
            phone: d.phone ? String(d.phone) : undefined,
            welcomeDiscountUsed: Boolean(d.welcomeDiscountUsed),
            ordersCount: Number(d.ordersCount || 0),
            privacyConsentAt: d.privacyConsentAt ?? null,
            registeredAt: d.registeredAt ?? null,
            lastSeenAt: d.lastSeenAt ?? null,
          };
        });
        list.sort((a, b) => {
          const tA = a.registeredAt?.toMillis?.() ?? 0;
          const tB = b.registeredAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        setCustomers(list);
        setCustomersLoading(false);
      },
      (error) => {
        setCustomersLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'customers');
      }
    );

    return () => unsub();
  }, [authReady, user, isAdmin]);

  // Owner: live subscription to staff employee admins
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified || !isOwner) {
      setStaffMembers([]);
      return;
    }

    const unsub = onSnapshot(
      collection(db, 'staff'),
      (snapshot) => {
        const list: StaffMember[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            email: String(d.email || docSnap.id),
            name: String(d.name || ''),
            role: 'admin',
            addedBy: String(d.addedBy || ''),
            createdAt: d.createdAt ?? null,
          };
        });
        list.sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() ?? 0;
          const tB = b.createdAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        setStaffMembers(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'staff');
      }
    );

    return () => unsub();
  }, [authReady, user, isOwner]);

  // Admin: live subscription to pre-launch waitlist
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified || !isAdmin) {
      setWaitlistEntries([]);
      setWaitlistLoading(false);
      return;
    }

    setWaitlistLoading(true);
    const unsub = onSnapshot(
      collection(db, 'waitlist'),
      (snapshot) => {
        const list: WaitlistEntry[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            name: String(d.name || ''),
            phone: String(d.phone || docSnap.id),
            consent: Boolean(d.consent),
            createdAt: d.createdAt ?? null,
          };
        });
        list.sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() ?? 0;
          const tB = b.createdAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        setWaitlistEntries(list);
        setWaitlistLoading(false);
      },
      (error) => {
        setWaitlistLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'waitlist');
      }
    );

    return () => unsub();
  }, [authReady, user, isAdmin]);

  // Subscribe to store settings
  useEffect(() => {
    const settingsRef = doc(db, 'store_settings', 'general');
    const unsub = onSnapshot(
      settingsRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          const launchMode: LaunchMode =
            data.launchMode === 'abierta' ? 'abierta' : 'proximamente';
          const launchDate =
            data.launchDate && typeof (data.launchDate as Timestamp).toDate === 'function'
              ? (data.launchDate as Timestamp)
              : null;
          const metaPixelId =
            typeof data.metaPixelId === 'string' && data.metaPixelId.trim()
              ? data.metaPixelId.trim()
              : undefined;
          const gaMeasurementId =
            typeof data.gaMeasurementId === 'string' && data.gaMeasurementId.trim()
              ? data.gaMeasurementId.trim()
              : undefined;
          const deliveryTimeText =
            typeof data.deliveryTimeText === 'string' && data.deliveryTimeText.trim()
              ? data.deliveryTimeText.trim()
              : DEFAULT_DELIVERY_TIME_TEXT;

          setSettings({
            announcementText:
              typeof data.announcementText === 'string'
                ? data.announcementText
                : DEFAULT_STORE_SETTINGS.announcementText,
            freeShippingThreshold:
              typeof data.freeShippingThreshold === 'number'
                ? data.freeShippingThreshold
                : DEFAULT_STORE_SETTINGS.freeShippingThreshold,
            shippingFee:
              typeof data.shippingFee === 'number'
                ? data.shippingFee
                : DEFAULT_STORE_SETTINGS.shippingFee,
            heroTitle:
              typeof data.heroTitle === 'string'
                ? data.heroTitle
                : DEFAULT_STORE_SETTINGS.heroTitle,
            heroSubtitle:
              typeof data.heroSubtitle === 'string'
                ? data.heroSubtitle
                : DEFAULT_STORE_SETTINGS.heroSubtitle,
            launchMode,
            launchDate,
            ...(metaPixelId ? { metaPixelId } : {}),
            ...(gaMeasurementId ? { gaMeasurementId } : {}),
            deliveryTimeText,
            sizeGuide: parseSizeGuide(data.sizeGuide),
            legalBusinessName:
              typeof data.legalBusinessName === 'string' ? data.legalBusinessName : '',
            legalDocumentId:
              typeof data.legalDocumentId === 'string' ? data.legalDocumentId : '',
            legalAddress:
              typeof data.legalAddress === 'string' ? data.legalAddress : '',
            legalCity:
              typeof data.legalCity === 'string' ? data.legalCity : '',
            legalEmail:
              typeof data.legalEmail === 'string' ? data.legalEmail : '',
            legalPhone:
              typeof data.legalPhone === 'string' ? data.legalPhone : '',
            legalUpdatedAt:
              typeof data.legalUpdatedAt === 'string' ? data.legalUpdatedAt : '',
            updatedAt: (data.updatedAt as Timestamp | null) ?? null,
          });
        } else {
          setSettings(DEFAULT_STORE_SETTINGS);
        }
        setSettingsLoaded(true);
      },
      (error) => {
        setSettingsLoaded(true);
        handleFirestoreError(error, OperationType.GET, 'store_settings/general');
      }
    );

    return () => unsub();
  }, []);

  // Configure measurement pixels dynamically whenever store settings change
  useEffect(() => {
    if (!settingsLoaded) return;
    configurePixels({
      metaPixelId: settings.metaPixelId,
      gaMeasurementId: settings.gaMeasurementId,
    });
  }, [settingsLoaded, settings.metaPixelId, settings.gaMeasurementId]);

  // Subscribe to products in real time
  useEffect(() => {
    if (!authReady) return;
    setProductsLoading(true);

    const productsQuery = isAdmin
      ? collection(db, 'products')
      : query(collection(db, 'products'), where('active', '==', true));

    const unsub = onSnapshot(
      productsQuery,
      (snapshot) => {
        const items: Product[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const stockBySize = parseStockBySize(d.stockBySize);
          const gallery = getProductImages({
            imageUrl: String(d.imageUrl || ''),
            images: Array.isArray(d.images) ? d.images.map(String) : undefined,
          });
          return {
            id: docSnap.id,
            sku: d.sku ? String(d.sku) : undefined,
            name: String(d.name || ''),
            description: String(d.description || ''),
            price: Number(d.price || 0),
            category: d.category as ProductCategory,
            color: String(d.color || ''),
            sizes: Array.isArray(d.sizes) ? d.sizes.map(String) : ['Única'],
            ...(stockBySize ? { stockBySize } : {}),
            imageUrl: gallery[0] || String(d.imageUrl || ''),
            ...(gallery.length > 0 ? { images: gallery } : {}),
            stock: Number(d.stock ?? 0),
            featured: Boolean(d.featured),
            active: Boolean(d.active),
            createdAt: d.createdAt ?? null,
            updatedAt: d.updatedAt ?? null,
          };
        });

        items.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() ?? 0;
          const timeB = b.createdAt?.toMillis?.() ?? 0;
          return timeB - timeA;
        });

        setLiveProducts(items);
        setProductsLoading(false);
      },
      (error) => {
        setProductsLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    return () => unsub();
  }, [authReady, isAdmin]);

  // Subscribe to orders only when authenticated & email verified
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setOrders([]);
      setOrdersLoading(false);
      setOrdersLoadedOnce(false);
      return;
    }

    setOrdersLoading(true);
    const ordersQuery = isAdmin
      ? collection(db, 'orders')
      : query(collection(db, 'orders'), where('userId', '==', user.uid));

    const unsub = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const list: Order[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const stockDeltas = parseNumericDeltas(d.stockDeltas);
          const sizeDeltas = parseNumericDeltas(d.sizeDeltas);
          return {
            id: docSnap.id,
            orderNumber: String(d.orderNumber || ''),
            userId: String(d.userId || ''),
            customerName: String(d.customerName || ''),
            customerEmail: String(d.customerEmail || ''),
            customerPhone: String(d.customerPhone || ''),
            shippingAddress: String(d.shippingAddress || ''),
            city: String(d.city || ''),
            notes: d.notes ? String(d.notes) : undefined,
            items: Array.isArray(d.items) ? d.items : [],
            ...(stockDeltas ? { stockDeltas } : {}),
            ...(sizeDeltas ? { sizeDeltas } : {}),
            subtotal: Number(d.subtotal || 0),
            discountAmount: Number(d.discountAmount || 0),
            discountCode: d.discountCode ? String(d.discountCode) : undefined,
            shippingCost: Number(d.shippingCost || 0),
            total: Number(d.total || 0),
            paymentMethod: 'whatsapp',
            paymentStatus: (d.paymentStatus === 'pagado' ? 'pagado' : 'pendiente_pago') as PaymentStatus,
            paymentReference: String(d.paymentReference || ''),
            status: d.status as OrderStatus,
            createdAt: d.createdAt ?? null,
            updatedAt: d.updatedAt ?? null,
          };
        });

        list.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() ?? 0;
          const timeB = b.createdAt?.toMillis?.() ?? 0;
          return timeB - timeA;
        });

        setOrders(list);
        setOrdersLoading(false);
        setOrdersLoadedOnce(true);
      },
      (error) => {
        setOrdersLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    return () => unsub();
  }, [authReady, user, isAdmin]);

  // Admin: ensure counters/orders exists once orders are loaded so shoppers get sequential MIA-00001 IDs
  useEffect(() => {
    if (!authReady || !isAdmin || !ordersLoadedOnce) return;
    const counterRef = doc(db, 'counters', 'orders');
    getDoc(counterRef)
      .then((snap) => {
        if (!snap.exists()) {
          return setDoc(counterRef, {
            next: Math.max(1, orders.length + 1),
            updatedAt: serverTimestamp(),
          });
        }
      })
      .catch((err) => {
        console.warn('No se pudo inicializar el contador de pedidos:', err);
      });
  }, [authReady, isAdmin, ordersLoadedOnce, orders.length]);

  const isUsingStarterPreview = !productsLoading && liveProducts.length === 0;

  const products: Product[] = useMemo(() => {
    if (liveProducts.length > 0) return liveProducts;
    if (productsLoading) return [];
    return STARTER_PRODUCTS.map((item) => ({
      id: item.slugId,
      sku: item.sku,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      color: item.color,
      sizes: item.sizes,
      ...(item.stockBySize ? { stockBySize: item.stockBySize } : {}),
      imageUrl: item.imageUrl,
      ...(item.images ? { images: item.images } : {}),
      stock: item.stock,
      featured: item.featured,
      active: item.active,
    }));
  }, [liveProducts, productsLoading]);

  const seedStarterCatalog = useCallback(async () => {
    if (!isAdmin) {
      throw new Error('Necesitas permisos de administradora para publicar la colección inicial.');
    }
    const batch = writeBatch(db);
    for (const item of STARTER_PRODUCTS) {
      const ref = doc(db, 'products', item.slugId);
      batch.set(ref, {
        ...(item.sku ? { sku: item.sku } : {}),
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        color: item.color,
        sizes: item.sizes,
        ...(item.stockBySize ? { stockBySize: item.stockBySize } : {}),
        imageUrl: item.imageUrl,
        ...(item.images ? { images: item.images } : {}),
        stock: item.stock,
        featured: item.featured,
        active: item.active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    const settingsRef = doc(db, 'store_settings', 'general');
    try {
      const existingSettingsSnap = await getDoc(settingsRef);
      if (!existingSettingsSnap.exists()) {
        batch.set(settingsRef, {
          announcementText: DEFAULT_STORE_SETTINGS.announcementText,
          freeShippingThreshold: DEFAULT_STORE_SETTINGS.freeShippingThreshold,
          shippingFee: DEFAULT_STORE_SETTINGS.shippingFee,
          heroTitle: DEFAULT_STORE_SETTINGS.heroTitle,
          heroSubtitle: DEFAULT_STORE_SETTINGS.heroSubtitle,
          launchMode: DEFAULT_STORE_SETTINGS.launchMode ?? 'proximamente',
          launchDate: null,
          deliveryTimeText: DEFAULT_DELIVERY_TIME_TEXT,
          sizeGuide: DEFAULT_SIZE_GUIDE,
          updatedAt: serverTimestamp(),
        });
      }

      const counterRef = doc(db, 'counters', 'orders');
      const counterSnap = await getDoc(counterRef);
      if (!counterSnap.exists()) {
        batch.set(counterRef, {
          next: Math.max(1, orders.length + 1),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  }, [isAdmin, orders.length]);

  const createProduct = useCallback(
    async (input: ProductInput, preferredId?: string): Promise<Product> => {
      const clean = sanitizeProductInput(input);
      if (clean.sku) {
        const duplicate = liveProducts.find(
          (p) => p.sku && normalizeSku(p.sku) === clean.sku
        );
        if (duplicate) {
          throw new Error(
            `El código "${clean.sku}" ya está asignado a "${duplicate.name}". Usa un código diferente.`
          );
        }
      }
      const validPreferred =
        preferredId &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(preferredId) &&
        !liveProducts.some((p) => p.id === preferredId)
          ? preferredId
          : null;
      const productId = validPreferred ?? slugifyId(clean.name);
      const path = `products/${productId}`;
      try {
        await setDoc(doc(db, 'products', productId), {
          ...clean,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
      return {
        id: productId,
        ...clean,
      };
    },
    [liveProducts]
  );

  const updateProduct = useCallback(
    async (productId: string, input: ProductInput) => {
      const clean = sanitizeProductInput(input);
      if (clean.sku) {
        const duplicate = liveProducts.find(
          (p) => p.id !== productId && p.sku && normalizeSku(p.sku) === clean.sku
        );
        if (duplicate) {
          throw new Error(
            `El código "${clean.sku}" ya está asignado a "${duplicate.name}". Usa un código diferente.`
          );
        }
      }
      const path = `products/${productId}`;
      try {
        await updateDoc(doc(db, 'products', productId), {
          ...clean,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [liveProducts]
  );

  const adjustProductStock = useCallback(async (productId: string, newStock: number) => {
    const bounded = Math.max(0, Math.min(PRODUCT_LIMITS.maxStock, Math.floor(newStock)));
    const path = `products/${productId}`;
    try {
      await updateDoc(doc(db, 'products', productId), {
        stock: bounded,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }, []);

  const toggleProductActive = useCallback(async (productId: string, active: boolean) => {
    const path = `products/${productId}`;
    try {
      await updateDoc(doc(db, 'products', productId), {
        active,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }, []);

  const deleteProduct = useCallback(async (productId: string) => {
    const path = `products/${productId}`;
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, nextStatus: OrderStatus) => {
    const path = `orders/${orderId}`;
    const orderRef = doc(db, 'orders', orderId);
    try {
      await runTransaction(db, async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) {
          throw new Error('El pedido no existe.');
        }

        const data = orderSnap.data();
        const prevStatus = String(data.status || 'pendiente') as OrderStatus;
        if (prevStatus === nextStatus) return;

        const items = Array.isArray(data.items) ? (data.items as OrderItem[]) : [];
        const qtyByProduct = new Map<string, number>();
        if (
          data.stockDeltas &&
          typeof data.stockDeltas === 'object' &&
          !Array.isArray(data.stockDeltas)
        ) {
          for (const [productId, rawQty] of Object.entries(
            data.stockDeltas as Record<string, unknown>
          )) {
            const qty = Math.floor(Number(rawQty));
            if (productId && qty > 0) {
              qtyByProduct.set(productId, qty);
            }
          }
        } else {
          for (const item of items) {
            if (item?.productId && Number(item.quantity) > 0) {
              qtyByProduct.set(
                item.productId,
                (qtyByProduct.get(item.productId) || 0) + Number(item.quantity)
              );
            }
          }
        }

        const sizeDeltasByProduct = new Map<string, Map<string, number>>();
        if (
          data.sizeDeltas &&
          typeof data.sizeDeltas === 'object' &&
          !Array.isArray(data.sizeDeltas)
        ) {
          for (const [compositeKey, rawQty] of Object.entries(
            data.sizeDeltas as Record<string, unknown>
          )) {
            const sepIdx = compositeKey.lastIndexOf('__');
            const qty = Math.floor(Number(rawQty));
            if (sepIdx > 0 && qty > 0) {
              const pid = compositeKey.slice(0, sepIdx);
              const size = compositeKey.slice(sepIdx + 2);
              if (pid && size) {
                const perSize = sizeDeltasByProduct.get(pid) ?? new Map<string, number>();
                perSize.set(size, (perSize.get(size) || 0) + qty);
                sizeDeltasByProduct.set(pid, perSize);
              }
            }
          }
        }

        const isCanceling = prevStatus !== 'cancelado' && nextStatus === 'cancelado';
        const isReactivating = prevStatus === 'cancelado' && nextStatus !== 'cancelado';

        const productUpdates: Array<{
          ref: ReturnType<typeof doc>;
          newStock: number;
          nextStockBySize?: Record<string, number>;
        }> = [];

        if (isCanceling || isReactivating) {
          const allProductIds = new Set<string>([
            ...qtyByProduct.keys(),
            ...sizeDeltasByProduct.keys(),
          ]);

          for (const productId of allProductIds) {
            const productRef = doc(db, 'products', productId);
            const prodSnap = await transaction.get(productRef);
            if (!prodSnap.exists()) continue;

            const prodData = prodSnap.data();
            const currentStock = Math.max(0, Math.floor(Number(prodData.stock || 0)));
            const currentStockBySize = parseStockBySize(prodData.stockBySize);
            const sizeDeltasForProduct = sizeDeltasByProduct.get(productId);
            const totalQty =
              qtyByProduct.get(productId) ||
              (sizeDeltasForProduct
                ? Array.from(sizeDeltasForProduct.values()).reduce((a, b) => a + b, 0)
                : 0);

            if (totalQty <= 0) continue;

            if (currentStockBySize && sizeDeltasForProduct && sizeDeltasForProduct.size > 0) {
              const nextStockBySize: Record<string, number> = { ...currentStockBySize };
              for (const [size, szQty] of sizeDeltasForProduct.entries()) {
                const currentSizeStock = Math.max(0, Math.floor(Number(nextStockBySize[size] ?? 0)));
                if (isCanceling) {
                  nextStockBySize[size] = Math.min(PRODUCT_LIMITS.maxStock, currentSizeStock + szQty);
                } else {
                  if (currentSizeStock < szQty) {
                    throw new Error(
                      `No hay stock suficiente de "${prodData.name}" en talla ${size} para reactivar este pedido.`
                    );
                  }
                  nextStockBySize[size] = currentSizeStock - szQty;
                }
              }

              const newStock = Math.min(
                PRODUCT_LIMITS.maxStock,
                Object.values(nextStockBySize).reduce((sum, n) => sum + n, 0)
              );
              productUpdates.push({
                ref: productRef,
                newStock,
                nextStockBySize,
              });
            } else if (isCanceling) {
              productUpdates.push({
                ref: productRef,
                newStock: Math.min(PRODUCT_LIMITS.maxStock, currentStock + totalQty),
              });
            } else {
              if (currentStock < totalQty) {
                throw new Error(
                  `No hay stock suficiente de "${prodData.name}" para reactivar este pedido.`
                );
              }
              productUpdates.push({
                ref: productRef,
                newStock: currentStock - totalQty,
              });
            }
          }
        }

        let nextPaymentStatus: PaymentStatus =
          data.paymentStatus === 'pagado' ? 'pagado' : 'pendiente_pago';
        if (
          nextStatus === 'pagado' ||
          nextStatus === 'preparando' ||
          nextStatus === 'enviado' ||
          nextStatus === 'entregado'
        ) {
          nextPaymentStatus = 'pagado';
        } else if (nextStatus === 'pendiente') {
          nextPaymentStatus = 'pendiente_pago';
        }

        for (const upd of productUpdates) {
          const patch: Record<string, unknown> = {
            stock: upd.newStock,
            updatedAt: serverTimestamp(),
          };
          if (upd.nextStockBySize) {
            patch.stockBySize = upd.nextStockBySize;
          }
          transaction.update(upd.ref, patch);
        }

        transaction.update(orderRef, {
          status: nextStatus,
          paymentStatus: nextPaymentStatus,
          paymentMethod: 'whatsapp',
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('No hay stock suficiente')) {
        throw error;
      }
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }, []);

  const updateStoreSettings = useCallback(async (next: Omit<StoreSettings, 'updatedAt'>) => {
    const path = 'store_settings/general';
    const cleanMeta = (next.metaPixelId || '').trim();
    const cleanGa = (next.gaMeasurementId || '').trim().toUpperCase();
    const cleanLaunchMode: LaunchMode =
      next.launchMode === 'abierta' ? 'abierta' : 'proximamente';

    if (cleanMeta && !META_PIXEL_REGEX.test(cleanMeta)) {
      throw new Error(
        'El ID del Píxel de Meta debe contener solo dígitos (entre 10 y 20 números).'
      );
    }
    if (cleanGa && !GA_MEASUREMENT_REGEX.test(cleanGa)) {
      throw new Error(
        'El ID de Google Analytics 4 debe tener el formato G-XXXXXXXX (ej. G-ABC1234567).'
      );
    }

    const payload: Record<string, unknown> = {
      announcementText: next.announcementText.trim().slice(0, SETTINGS_LIMITS.announcementMax),
      freeShippingThreshold: Math.max(0, Math.round(Number(next.freeShippingThreshold) || 0)),
      shippingFee: Math.max(0, Math.round(Number(next.shippingFee) || 0)),
      heroTitle: next.heroTitle.trim().slice(0, SETTINGS_LIMITS.heroTitleMax),
      heroSubtitle: next.heroSubtitle.trim().slice(0, SETTINGS_LIMITS.heroSubtitleMax),
      launchMode: cleanLaunchMode,
      launchDate: next.launchDate ?? null,
      deliveryTimeText: (next.deliveryTimeText ?? DEFAULT_DELIVERY_TIME_TEXT)
        .trim()
        .slice(0, SETTINGS_LIMITS.deliveryTimeMax),
      sizeGuide: parseSizeGuide(next.sizeGuide),
      legalBusinessName: (next.legalBusinessName ?? '')
        .trim()
        .slice(0, SETTINGS_LIMITS.legalBusinessNameMax),
      legalDocumentId: (next.legalDocumentId ?? '')
        .trim()
        .slice(0, SETTINGS_LIMITS.legalDocumentIdMax),
      legalAddress: (next.legalAddress ?? '').trim().slice(0, SETTINGS_LIMITS.legalAddressMax),
      legalCity: (next.legalCity ?? '').trim().slice(0, SETTINGS_LIMITS.legalCityMax),
      legalEmail: (next.legalEmail ?? '').trim().slice(0, SETTINGS_LIMITS.legalEmailMax),
      legalPhone: (next.legalPhone ?? '').trim().slice(0, SETTINGS_LIMITS.legalPhoneMax),
      legalUpdatedAt: (next.legalUpdatedAt ?? '').trim().slice(0, SETTINGS_LIMITS.legalUpdatedAtMax),
      updatedAt: serverTimestamp(),
    };
    if (cleanMeta) {
      payload.metaPixelId = cleanMeta;
    }
    if (cleanGa) {
      payload.gaMeasurementId = cleanGa;
    }

    if (String(payload.heroTitle).length < SETTINGS_LIMITS.heroTitleMin) {
      throw new Error('El título principal debe tener al menos 4 caracteres.');
    }
    if (String(payload.heroSubtitle).length < SETTINGS_LIMITS.heroSubtitleMin) {
      throw new Error('El subtítulo debe tener al menos 4 caracteres.');
    }
    try {
      await setDoc(doc(db, 'store_settings', 'general'), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }, []);

  const submitWaitlistEntry = useCallback(
    async (
      nameInput: string,
      phoneInput: string,
      consent: boolean
    ): Promise<{ alreadyRegistered?: boolean }> => {
      const cleanName = nameInput.trim().slice(0, WAITLIST_LIMITS.nameMax);
      if (cleanName.length < WAITLIST_LIMITS.nameMin) {
        throw new Error('Ingresa tu nombre completo (mínimo 2 caracteres).');
      }

      const digits = phoneInput.replace(/\D/g, '');
      let normalizedPhone = '';
      if (COLOMBIA_WHATSAPP_10_REGEX.test(digits)) {
        normalizedPhone = `57${digits}`;
      } else if (COLOMBIA_WHATSAPP_NORMALIZED_REGEX.test(digits)) {
        normalizedPhone = digits;
      } else {
        throw new Error(
          'Ingresa un número de WhatsApp colombiano válido (10 dígitos empezando por 3).'
        );
      }

      if (!consent) {
        throw new Error(
          'Debes autorizar el tratamiento de tus datos personales para unirte a la lista.'
        );
      }

      const path = `waitlist/${normalizedPhone}`;
      try {
        await setDoc(doc(db, 'waitlist', normalizedPhone), {
          name: cleanName,
          phone: normalizedPhone,
          consent: true,
          createdAt: serverTimestamp(),
        });
        trackLead();
        return { alreadyRegistered: false };
      } catch (error: unknown) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code?: unknown }).code)
            : '';
        if (code === 'permission-denied') {
          // Existing document cannot be overwritten or read by non-admins; treat duplicate smoothly
          return { alreadyRegistered: true };
        }
        handleFirestoreError(error, OperationType.CREATE, path);
        return {};
      }
    },
    []
  );

  const deleteWaitlistEntry = useCallback(async (entryId: string) => {
    const path = `waitlist/${entryId}`;
    try {
      await deleteDoc(doc(db, 'waitlist', entryId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }, []);

  const addStaffMember = useCallback(async (emailInput: string, nameInput: string) => {
    const email = emailInput.trim().toLowerCase();
    const name = nameInput.trim().slice(0, 80);
    if (!email || !email.includes('@') || email.length < 5 || email.length > 160) {
      throw new Error('Ingresa un correo electrónico válido de Google.');
    }
    if (name.length < 2) {
      throw new Error('Ingresa el nombre del trabajador.');
    }
    const path = `staff/${email}`;
    try {
      await setDoc(doc(db, 'staff', email), {
        email,
        name,
        role: 'admin',
        addedBy: auth.currentUser?.email || 'propietaria',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }, []);

  const removeStaffMember = useCallback(async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const path = `staff/${cleanEmail}`;
    try {
      await deleteDoc(doc(db, 'staff', cleanEmail));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }, []);

  const addToCart = useCallback((product: Product, size: string, quantity = 1) => {
    const sizeStock = getAvailableStockForSize(product, size);
    if (product.stock <= 0 || sizeStock <= 0) return;
    const safeQty = Math.min(sizeStock, Math.max(1, quantity));
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.productId === product.id && item.size === size
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        const current = next[existingIdx];
        next[existingIdx] = {
          ...current,
          maxStock: sizeStock,
          quantity: Math.min(sizeStock, current.quantity + safeQty),
        };
        return next;
      }
      if (prev.length >= ORDER_LIMITS.maxItems) return prev;
      return [
        ...prev,
        {
          productId: product.id,
          ...(product.sku ? { sku: product.sku } : {}),
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl.length <= 2000 ? product.imageUrl : '',
          size,
          color: product.color,
          quantity: safeQty,
          maxStock: sizeStock,
        },
      ];
    });
    trackAddToCart(product, size, safeQty);
  }, []);

  const updateCartQuantity = useCallback(
    (productId: string, size: string, quantity: number) => {
      const liveProd = products.find((p) => p.id === productId);
      setCart((prev) => {
        if (quantity <= 0) {
          return prev.filter((item) => !(item.productId === productId && item.size === size));
        }
        return prev.flatMap((item) => {
          if (!(item.productId === productId && item.size === size)) return [item];
          const liveMax = liveProd ? getAvailableStockForSize(liveProd, size) : item.maxStock;
          if (liveMax <= 0) return [];
          return [{ ...item, maxStock: liveMax, quantity: Math.min(liveMax, quantity) }];
        });
      });
    },
    [products]
  );

  const removeFromCart = useCallback((productId: string, size: string) => {
    setCart((prev) => prev.filter((item) => !(item.productId === productId && item.size === size)));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const isEligibleForWelcomeDiscount = useMemo(() => {
    if (!user || !user.emailVerified) return false;
    if (!customerProfile) return false;
    return !customerProfile.welcomeDiscountUsed && customerProfile.ordersCount === 0;
  }, [user, customerProfile]);

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const cartSubtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [cart]
  );

  const welcomeDiscountAmount = useMemo(() => {
    if (!isEligibleForWelcomeDiscount || cartSubtotal <= 0) return 0;
    return Math.round(cartSubtotal * 0.1);
  }, [isEligibleForWelcomeDiscount, cartSubtotal]);

  const shippingCost = useMemo(() => {
    const netSubtotal = Math.max(0, cartSubtotal - welcomeDiscountAmount);
    if (cartSubtotal === 0) return 0;
    return netSubtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
  }, [cartSubtotal, welcomeDiscountAmount, settings.freeShippingThreshold, settings.shippingFee]);

  const cartTotal = Math.max(0, cartSubtotal - welcomeDiscountAmount) + shippingCost;

  const placeOrder = useCallback(
    async (payload: CheckoutPayload): Promise<Order> => {
      if (!auth.currentUser || !auth.currentUser.emailVerified) {
        throw new Error('Regístrate o inicia sesión con Google para confirmar tu compra.');
      }
      if (cart.length === 0) {
        throw new Error('Tu bolsa de compras está vacía.');
      }
      if (liveProducts.length === 0) {
        throw new Error(
          'El inventario aún no ha sido activado en Firebase. Inicia sesión como administradora para publicar el catálogo inicial.'
        );
      }

      const customerName = payload.customerName.trim().slice(0, ORDER_LIMITS.customerNameMax);
      const customerEmail = payload.customerEmail.trim().slice(0, ORDER_LIMITS.customerEmailMax);
      const customerPhone = payload.customerPhone.trim().slice(0, ORDER_LIMITS.customerPhoneMax);
      const shippingAddress = payload.shippingAddress.trim().slice(0, ORDER_LIMITS.shippingAddressMax);
      const city = payload.city.trim().slice(0, ORDER_LIMITS.cityMax);
      const notes = payload.notes?.trim().slice(0, ORDER_LIMITS.notesMax);

      if (customerName.length < ORDER_LIMITS.customerNameMin) {
        throw new Error('Ingresa tu nombre completo.');
      }
      if (customerEmail.length < ORDER_LIMITS.customerEmailMin) {
        throw new Error('Ingresa un correo electrónico válido.');
      }
      if (customerPhone.length < ORDER_LIMITS.customerPhoneMin) {
        throw new Error('Ingresa un número de teléfono válido.');
      }
      if (shippingAddress.length < ORDER_LIMITS.shippingAddressMin) {
        throw new Error('Ingresa la dirección de entrega.');
      }
      if (city.length < ORDER_LIMITS.cityMin) {
        throw new Error('Ingresa la ciudad de entrega.');
      }

      const orderId = `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const paymentStatus: PaymentStatus = 'pendiente_pago';

      const uid = auth.currentUser.uid;
      const authEmail = auth.currentUser.email || customerEmail;
      const orderRef = doc(db, 'orders', orderId);
      const customerRef = doc(db, 'customers', uid);
      const counterRef = doc(db, 'counters', 'orders');

      const qtyByProduct = new Map<string, number>();
      const qtyByProductSize = new Map<string, number>();
      const sizesByProduct = new Map<string, Map<string, number>>();
      for (const item of cart.slice(0, ORDER_LIMITS.maxItems)) {
        const qty = Math.max(1, Math.floor(Number(item.quantity || 1)));
        const sz = String(item.size || 'Única');
        qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + qty);
        const compositeKey = `${item.productId}__${sz}`;
        qtyByProductSize.set(compositeKey, (qtyByProductSize.get(compositeKey) || 0) + qty);

        const perSize = sizesByProduct.get(item.productId) ?? new Map<string, number>();
        perSize.set(sz, (perSize.get(sz) || 0) + qty);
        sizesByProduct.set(item.productId, perSize);
      }

      let orderNumber = '';
      let paymentReference = '';
      let computedSubtotal = 0;
      let appliedDiscount = 0;
      let appliedCode: string | undefined;
      let finalShipping = 0;
      let finalTotal = 0;

      const stockDeltas = Object.fromEntries(qtyByProduct);
      const sizeDeltas = Object.fromEntries(qtyByProductSize);

      try {
        await runTransaction(db, async (transaction) => {
          const customerSnap = await transaction.get(customerRef);
          const counterSnap = await transaction.get(counterRef);

          const productUpdates: Array<{
            ref: ReturnType<typeof doc>;
            newStock: number;
            nextStockBySize?: Record<string, number>;
          }> = [];

          for (const [productId, qtyNeeded] of qtyByProduct.entries()) {
            const productRef = doc(db, 'products', productId);
            const snap = await transaction.get(productRef);
            if (!snap.exists()) {
              throw new Error('Una de las prendas seleccionadas ya no está disponible.');
            }
            const data = snap.data();
            if (!data.active) {
              throw new Error(`La prenda "${data.name}" ya no está publicada.`);
            }
            const currentStock = Math.floor(Number(data.stock || 0));
            if (currentStock < qtyNeeded) {
              throw new Error(
                `Stock insuficiente para "${data.name}". Disponibles: ${currentStock}.`
              );
            }

            const existingStockBySize = parseStockBySize(data.stockBySize);
            let nextStockBySize: Record<string, number> | undefined;
            if (existingStockBySize) {
              nextStockBySize = { ...existingStockBySize };
              const perSizeNeeded = sizesByProduct.get(productId);
              if (perSizeNeeded) {
                for (const [sz, szQty] of perSizeNeeded.entries()) {
                  const availForSize = Math.floor(Number(nextStockBySize[sz] ?? 0));
                  if (availForSize < szQty) {
                    throw new Error(
                      `Stock insuficiente para "${data.name}" en talla ${sz}. Disponibles: ${availForSize}.`
                    );
                  }
                  nextStockBySize[sz] = availForSize - szQty;
                }
              }
            }

            productUpdates.push({
              ref: productRef,
              newStock: Math.max(0, Math.floor(currentStock - qtyNeeded)),
              ...(nextStockBySize ? { nextStockBySize } : {}),
            });
          }

          let counterMode: 'update' | 'create' | 'none' = 'none';
          let nextCounterValue = 1;
          if (counterSnap.exists()) {
            const currentNext = Math.max(1, Math.floor(Number(counterSnap.data().next || 1)));
            orderNumber = formatSequentialOrderNumber(currentNext);
            nextCounterValue = currentNext + 1;
            counterMode = 'update';
          } else if (isAdmin) {
            const initialNext = Math.max(1, orders.length + 1);
            orderNumber = formatSequentialOrderNumber(initialNext);
            nextCounterValue = initialNext + 1;
            counterMode = 'create';
          } else {
            orderNumber = buildFallbackOrderNumber();
            counterMode = 'none';
          }
          paymentReference = `WPP-${orderNumber.replace(/^MIA-/, '')}`;

          computedSubtotal = 0;
          for (const item of cart.slice(0, ORDER_LIMITS.maxItems)) {
            const qty = Math.max(1, Math.floor(Number(item.quantity || 1)));
            const price = Math.max(0, Number(item.price || 0));
            computedSubtotal += price * qty;
          }

          const customerExists = customerSnap.exists();
          const alreadyUsedDiscount = customerExists
            ? Boolean(customerSnap.data().welcomeDiscountUsed)
            : false;
          const prevOrdersCount = customerExists
            ? Math.max(0, Math.floor(Number(customerSnap.data().ordersCount || 0)))
            : 0;

          if (!alreadyUsedDiscount && prevOrdersCount === 0) {
            appliedDiscount = Math.round(computedSubtotal * 0.1);
            appliedCode = 'BIENVENIDA10';
          } else {
            appliedDiscount = 0;
            appliedCode = undefined;
          }

          const netSubtotal = Math.max(0, computedSubtotal - appliedDiscount);
          finalShipping =
            netSubtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
          finalTotal = netSubtotal + finalShipping;

          for (const upd of productUpdates) {
            const updatePatch: Record<string, unknown> = {
              stock: upd.newStock,
              lastOrderId: orderId,
              updatedAt: serverTimestamp(),
            };
            if (upd.nextStockBySize) {
              updatePatch.stockBySize = upd.nextStockBySize;
            }
            transaction.update(upd.ref, updatePatch);
          }

          if (counterMode === 'update') {
            transaction.update(counterRef, {
              next: nextCounterValue,
              lastOrderId: orderId,
              updatedAt: serverTimestamp(),
            });
          } else if (counterMode === 'create') {
            transaction.set(counterRef, {
              next: nextCounterValue,
              lastOrderId: orderId,
              updatedAt: serverTimestamp(),
            });
          }

          if (!customerExists) {
            transaction.set(customerRef, {
              uid,
              name: customerName,
              email: authEmail,
              phone: customerPhone,
              welcomeDiscountUsed: true,
              ordersCount: 1,
              ...(payload.privacyAccepted ? { privacyConsentAt: serverTimestamp() } : {}),
              registeredAt: serverTimestamp(),
              lastSeenAt: serverTimestamp(),
            });
          } else {
            transaction.update(customerRef, {
              name: customerName,
              phone: customerPhone,
              welcomeDiscountUsed: true,
              ordersCount: prevOrdersCount + 1,
              ...(payload.privacyAccepted ? { privacyConsentAt: serverTimestamp() } : {}),
              lastSeenAt: serverTimestamp(),
            });
          }

          const orderDoc: Record<string, unknown> = {
            orderNumber,
            userId: uid,
            customerName,
            customerEmail,
            customerPhone,
            shippingAddress,
            city,
            items: cart.slice(0, ORDER_LIMITS.maxItems).map((item) => ({
              productId: String(item.productId),
              ...(item.sku ? { sku: String(item.sku) } : {}),
              name: String(item.name || 'Prenda'),
              price: Number(item.price || 0),
              size: String(item.size || 'Única'),
              color: String(item.color || ''),
              quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
              imageUrl:
                typeof item.imageUrl === 'string' && item.imageUrl.length <= 2000
                  ? item.imageUrl
                  : '',
            })),
            stockDeltas,
            sizeDeltas,
            subtotal: computedSubtotal,
            discountAmount: appliedDiscount,
            shippingCost: finalShipping,
            total: finalTotal,
            paymentMethod: 'whatsapp',
            paymentStatus,
            paymentReference,
            status: 'pendiente',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (appliedCode) {
            orderDoc.discountCode = appliedCode;
          }
          if (notes && notes.length > 0) {
            orderDoc.notes = notes;
          }

          transaction.set(orderRef, orderDoc);
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes('Stock insuficiente') ||
            error.message.includes('no está disponible') ||
            error.message.includes('no está publicada'))
        ) {
          throw error;
        }
        handleFirestoreError(error, OperationType.WRITE, `orders/${orderId}`);
      }

      const createdOrder: Order = {
        id: orderId,
        orderNumber,
        userId: uid,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        city,
        notes,
        items: cart.map((item) => ({
          productId: item.productId,
          ...(item.sku ? { sku: item.sku } : {}),
          name: item.name,
          price: item.price,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
        })),
        stockDeltas,
        sizeDeltas,
        subtotal: computedSubtotal,
        discountAmount: appliedDiscount,
        discountCode: appliedCode,
        shippingCost: finalShipping,
        total: finalTotal,
        paymentMethod: 'whatsapp',
        paymentStatus,
        paymentReference,
        status: 'pendiente',
      };

      clearCart();
      trackPurchase(createdOrder);
      return createdOrder;
    },
    [
      cart,
      clearCart,
      isAdmin,
      liveProducts.length,
      orders.length,
      settings.freeShippingThreshold,
      settings.shippingFee,
    ]
  );

  const loginWithGoogle = useCallback(async (acceptedPrivacy = false): Promise<User> => {
    if (acceptedPrivacy) {
      pendingPrivacyConsentRef.current = true;
    }
    try {
      return await signInWithGoogle();
    } catch (err) {
      pendingPrivacyConsentRef.current = false;
      throw err;
    }
  }, []);

  const value: StoreContextValue = {
    user,
    authReady,
    isAdmin,
    isOwner,
    customerProfile,
    isEligibleForWelcomeDiscount,
    customers,
    customersLoading,
    staffMembers,
    products,
    liveCatalogCount: liveProducts.length,
    isUsingStarterPreview,
    productsLoading,
    orders,
    ordersLoading,
    settings,
    settingsLoaded,
    waitlistEntries,
    waitlistLoading,
    cart,
    cartCount,
    cartSubtotal,
    welcomeDiscountAmount,
    shippingCost,
    cartTotal,
    loginWithGoogle,
    logout: signOutUser,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    placeOrder,
    createProduct,
    updateProduct,
    adjustProductStock,
    toggleProductActive,
    deleteProduct,
    updateOrderStatus,
    updateStoreSettings,
    submitWaitlistEntry,
    deleteWaitlistEntry,
    seedStarterCatalog,
    addStaffMember,
    removeStaffMember,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore debe utilizarse dentro de StoreProvider.');
  }
  return ctx;
}
