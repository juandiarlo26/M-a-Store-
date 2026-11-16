import type { Timestamp } from 'firebase/firestore';

export type ProductCategory =
  | 'Vestidos'
  | 'Blusas'
  | 'Blazers'
  | 'Conjuntos'
  | 'Faldas'
  | 'Pantalones'
  | 'Accesorios';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Vestidos',
  'Blusas',
  'Blazers',
  'Conjuntos',
  'Faldas',
  'Pantalones',
  'Accesorios',
];

export const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'Única'] as const;

export type PaymentMethod = 'whatsapp';
export type PaymentStatus = 'pendiente_pago' | 'pagado';
export type OrderStatus =
  | 'pendiente'
  | 'pagado'
  | 'preparando'
  | 'enviado'
  | 'entregado'
  | 'cancelado';

export const PRODUCT_LIMITS = {
  skuMin: 2,
  skuMax: 32,
  nameMin: 2,
  nameMax: 120,
  descriptionMin: 5,
  descriptionMax: 1200,
  colorMin: 2,
  colorMax: 40,
  imageUrlMin: 4,
  imageUrlMax: 450000,
  maxSizes: 10,
  maxStock: 100000,
  maxPrice: 100000000,
} as const;

export const ORDER_LIMITS = {
  customerNameMin: 2,
  customerNameMax: 100,
  customerEmailMin: 5,
  customerEmailMax: 160,
  customerPhoneMin: 7,
  customerPhoneMax: 30,
  shippingAddressMin: 5,
  shippingAddressMax: 250,
  cityMin: 2,
  cityMax: 80,
  notesMax: 300,
  maxItems: 20,
} as const;

export const SETTINGS_LIMITS = {
  announcementMax: 140,
  heroTitleMin: 4,
  heroTitleMax: 100,
  heroSubtitleMin: 4,
  heroSubtitleMax: 240,
} as const;

export interface Product {
  id: string;
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
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CartItem {
  productId: string;
  sku?: string;
  name: string;
  price: number;
  imageUrl: string;
  size: string;
  color: string;
  quantity: number;
  maxStock: number;
}

export interface OrderItem {
  productId: string;
  sku?: string;
  name: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
  imageUrl: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  notes?: string;
  items: OrderItem[];
  stockDeltas?: Record<string, number>;
  subtotal: number;
  discountAmount: number;
  discountCode?: string;
  shippingCost: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  status: OrderStatus;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CustomerProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  welcomeDiscountUsed: boolean;
  ordersCount: number;
  registeredAt?: Timestamp | null;
  lastSeenAt?: Timestamp | null;
}

export interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: 'admin';
  addedBy: string;
  createdAt?: Timestamp | null;
}

export interface StoreSettings {
  announcementText: string;
  freeShippingThreshold: number;
  shippingFee: number;
  heroTitle: string;
  heroSubtitle: string;
  updatedAt?: Timestamp | null;
}

export const BOOTSTRAPPED_ADMIN_EMAILS = [
  'juandiegooardilalopez@gmail.com',
  'miastore0527@gmail.com',
];

export const BRAND_INFO = {
  name: 'Mía Store',
  email: 'miastore0527@gmail.com',
  whatsappDigits: '573103120040',
  whatsappDisplay: '310 312 0040',
  instagramHandle: '@mia__store____',
  instagramUrl:
    'https://www.instagram.com/mia__store____?vrfl=Z216aWZhYnMxdng4&utm_source=qr',
  tiktokHandle: '@mia_store___',
  tiktokUrl: 'https://www.tiktok.com/@mia_store___?_r=1&_t=ZS-9BR2xkLrQfN',
  facebookLabel: 'Mía Store',
  facebookUrl: 'https://www.facebook.com/profile.php?id=61595861173652&mibextid=wwXIfr',
  logoPath: '/assets/aistudio/image_ec8fe8e3.png',
} as const;
