import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
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
import { DEFAULT_STORE_SETTINGS, STARTER_PRODUCTS } from '../lib/starterCatalog';
import {
  BOOTSTRAPPED_ADMIN_EMAILS,
  ORDER_LIMITS,
  PRODUCT_LIMITS,
  SETTINGS_LIMITS,
  type CartItem,
  type CustomerProfile,
  type Order,
  type OrderItem,
  type OrderStatus,
  type PaymentStatus,
  type Product,
  type ProductCategory,
  type StaffMember,
  type StoreSettings,
} from '../types/store';

const CART_STORAGE_KEY = 'mia_store_cart_v1';

interface CheckoutPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  notes?: string;
}

export interface ProductInput {
  sku?: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  color: string;
  sizes: string[];
  imageUrl: string;
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
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  welcomeDiscountAmount: number;
  shippingCost: number;
  cartTotal: number;
  loginWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
  addToCart: (product: Product, size: string, quantity?: number) => void;
  updateCartQuantity: (productId: string, size: string, quantity: number) => void;
  removeFromCart: (productId: string, size: string) => void;
  clearCart: () => void;
  placeOrder: (payload: CheckoutPayload) => Promise<Order>;
  createProduct: (input: ProductInput) => Promise<Product>;
  updateProduct: (productId: string, input: ProductInput) => Promise<void>;
  adjustProductStock: (productId: string, newStock: number) => Promise<void>;
  toggleProductActive: (productId: string, active: boolean) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateStoreSettings: (next: Omit<StoreSettings, 'updatedAt'>) => Promise<void>;
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

function sanitizeProductInput(input: ProductInput): ProductInput {
  const rawSku = input.sku?.trim() ?? '';
  const sku = rawSku.length > 0 ? normalizeSku(rawSku) : undefined;
  const name = input.name.trim().slice(0, PRODUCT_LIMITS.nameMax);
  const description = input.description.trim().slice(0, PRODUCT_LIMITS.descriptionMax);
  const color = input.color.trim().slice(0, PRODUCT_LIMITS.colorMax);
  const rawImageUrl = input.imageUrl.trim();
  const sizes = (input.sizes.length > 0 ? input.sizes : ['Única']).slice(0, PRODUCT_LIMITS.maxSizes);
  const price = Math.max(1, Math.min(PRODUCT_LIMITS.maxPrice, Math.round(Number(input.price) || 0)));
  const stock = Math.max(0, Math.min(PRODUCT_LIMITS.maxStock, Math.floor(Number(input.stock) || 0)));

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
  if (rawImageUrl.length < PRODUCT_LIMITS.imageUrlMin) {
    throw new Error('Agrega o sube una fotografía válida para la prenda.');
  }
  if (rawImageUrl.length > PRODUCT_LIMITS.imageUrlMax) {
    throw new Error('La fotografía es demasiado pesada. Sube otra imagen o usa una más ligera.');
  }
  const imageUrl = rawImageUrl;

  return {
    ...(sku ? { sku } : {}),
    name,
    description,
    price,
    category: input.category,
    color,
    sizes,
    imageUrl,
    stock,
    featured: Boolean(input.featured),
    active: Boolean(input.active),
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
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
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);

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
          await setDoc(customerRef, {
            uid: nextUser.uid,
            name: safeName,
            email: nextUser.email || email,
            welcomeDiscountUsed: false,
            ordersCount: 0,
            registeredAt: serverTimestamp(),
            lastSeenAt: serverTimestamp(),
          });
        } else {
          await updateDoc(customerRef, {
            name: safeName,
            lastSeenAt: serverTimestamp(),
          });
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

  // Subscribe to store settings
  useEffect(() => {
    const settingsRef = doc(db, 'store_settings', 'general');
    const unsub = onSnapshot(
      settingsRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as StoreSettings;
          setSettings({
            announcementText: data.announcementText ?? DEFAULT_STORE_SETTINGS.announcementText,
            freeShippingThreshold:
              typeof data.freeShippingThreshold === 'number'
                ? data.freeShippingThreshold
                : DEFAULT_STORE_SETTINGS.freeShippingThreshold,
            shippingFee:
              typeof data.shippingFee === 'number'
                ? data.shippingFee
                : DEFAULT_STORE_SETTINGS.shippingFee,
            heroTitle: data.heroTitle ?? DEFAULT_STORE_SETTINGS.heroTitle,
            heroSubtitle: data.heroSubtitle ?? DEFAULT_STORE_SETTINGS.heroSubtitle,
            updatedAt: data.updatedAt ?? null,
          });
        } else {
          setSettings(DEFAULT_STORE_SETTINGS);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'store_settings/general');
      }
    );

    return () => unsub();
  }, []);

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
          return {
            id: docSnap.id,
            sku: d.sku ? String(d.sku) : undefined,
            name: String(d.name || ''),
            description: String(d.description || ''),
            price: Number(d.price || 0),
            category: d.category as ProductCategory,
            color: String(d.color || ''),
            sizes: Array.isArray(d.sizes) ? d.sizes.map(String) : ['Única'],
            imageUrl: String(d.imageUrl || ''),
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
      },
      (error) => {
        setOrdersLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    return () => unsub();
  }, [authReady, user, isAdmin]);

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
      imageUrl: item.imageUrl,
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
        imageUrl: item.imageUrl,
        stock: item.stock,
        featured: item.featured,
        active: item.active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    const settingsRef = doc(db, 'store_settings', 'general');
    batch.set(settingsRef, {
      announcementText: DEFAULT_STORE_SETTINGS.announcementText,
      freeShippingThreshold: DEFAULT_STORE_SETTINGS.freeShippingThreshold,
      shippingFee: DEFAULT_STORE_SETTINGS.shippingFee,
      heroTitle: DEFAULT_STORE_SETTINGS.heroTitle,
      heroSubtitle: DEFAULT_STORE_SETTINGS.heroSubtitle,
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  }, [isAdmin]);

  const createProduct = useCallback(
    async (input: ProductInput): Promise<Product> => {
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
      const productId = slugifyId(clean.name);
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
        for (const item of items) {
          if (item?.productId && Number(item.quantity) > 0) {
            qtyByProduct.set(
              item.productId,
              (qtyByProduct.get(item.productId) || 0) + Number(item.quantity)
            );
          }
        }

        const isCanceling = prevStatus !== 'cancelado' && nextStatus === 'cancelado';
        const isReactivating = prevStatus === 'cancelado' && nextStatus !== 'cancelado';

        const productUpdates: Array<{ ref: ReturnType<typeof doc>; newStock: number }> = [];

        if (isCanceling || isReactivating) {
          for (const [productId, qty] of qtyByProduct.entries()) {
            const productRef = doc(db, 'products', productId);
            const prodSnap = await transaction.get(productRef);
            if (!prodSnap.exists()) continue;

            const currentStock = Number(prodSnap.data().stock || 0);
            if (isCanceling) {
              productUpdates.push({
                ref: productRef,
                newStock: Math.min(PRODUCT_LIMITS.maxStock, currentStock + qty),
              });
            } else {
              if (currentStock < qty) {
                throw new Error(
                  `No hay stock suficiente de "${prodSnap.data().name}" para reactivar este pedido.`
                );
              }
              productUpdates.push({
                ref: productRef,
                newStock: currentStock - qty,
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
          transaction.update(upd.ref, {
            stock: upd.newStock,
            updatedAt: serverTimestamp(),
          });
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
    const payload = {
      announcementText: next.announcementText.trim().slice(0, SETTINGS_LIMITS.announcementMax),
      freeShippingThreshold: Math.max(0, Math.round(Number(next.freeShippingThreshold) || 0)),
      shippingFee: Math.max(0, Math.round(Number(next.shippingFee) || 0)),
      heroTitle: next.heroTitle.trim().slice(0, SETTINGS_LIMITS.heroTitleMax),
      heroSubtitle: next.heroSubtitle.trim().slice(0, SETTINGS_LIMITS.heroSubtitleMax),
      updatedAt: serverTimestamp(),
    };
    if (payload.heroTitle.length < SETTINGS_LIMITS.heroTitleMin) {
      throw new Error('El título principal debe tener al menos 4 caracteres.');
    }
    if (payload.heroSubtitle.length < SETTINGS_LIMITS.heroSubtitleMin) {
      throw new Error('El subtítulo debe tener al menos 4 caracteres.');
    }
    try {
      await setDoc(doc(db, 'store_settings', 'general'), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
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
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.productId === product.id && item.size === size
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        const current = next[existingIdx];
        next[existingIdx] = {
          ...current,
          maxStock: product.stock,
          quantity: Math.min(product.stock, current.quantity + quantity),
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
          quantity: Math.min(product.stock, Math.max(1, quantity)),
          maxStock: product.stock,
        },
      ];
    });
  }, []);

  const updateCartQuantity = useCallback((productId: string, size: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => !(item.productId === productId && item.size === size));
      }
      return prev.map((item) =>
        item.productId === productId && item.size === size
          ? { ...item, quantity: Math.min(item.maxStock, quantity) }
          : item
      );
    });
  }, []);

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
      const orderNumber = `MIA-${Math.floor(1000 + Math.random() * 9000)}`;
      const paymentStatus: PaymentStatus = 'pendiente_pago';
      const paymentReference = `WPP-${orderNumber.slice(-4)}`;

      const uid = auth.currentUser.uid;
      const authEmail = auth.currentUser.email || customerEmail;
      const orderRef = doc(db, 'orders', orderId);
      const customerRef = doc(db, 'customers', uid);

      const qtyByProduct = new Map<string, number>();
      for (const item of cart) {
        const qty = Math.max(1, Math.floor(Number(item.quantity || 1)));
        qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + qty);
      }

      let computedSubtotal = 0;
      let appliedDiscount = 0;
      let appliedCode: string | undefined;
      let finalShipping = 0;
      let finalTotal = 0;

      try {
        await runTransaction(db, async (transaction) => {
          const customerSnap = await transaction.get(customerRef);
          const productUpdates: Array<{
            ref: ReturnType<typeof doc>;
            newStock: number;
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
            productUpdates.push({
              ref: productRef,
              newStock: Math.max(0, Math.floor(currentStock - qtyNeeded)),
            });
          }

          for (const item of cart) {
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
            transaction.update(upd.ref, {
              stock: upd.newStock,
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
              registeredAt: serverTimestamp(),
              lastSeenAt: serverTimestamp(),
            });
          } else {
            transaction.update(customerRef, {
              name: customerName,
              phone: customerPhone,
              welcomeDiscountUsed: true,
              ordersCount: prevOrdersCount + 1,
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
      return createdOrder;
    },
    [cart, clearCart, liveProducts.length, settings.freeShippingThreshold, settings.shippingFee]
  );

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
    cart,
    cartCount,
    cartSubtotal,
    welcomeDiscountAmount,
    shippingCost,
    cartTotal,
    loginWithGoogle: signInWithGoogle,
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
