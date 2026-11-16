import type { Timestamp } from 'firebase/firestore';

export type ProductCategory =
  | 'Vestidos'
  | 'Blusas'
  | 'Shorts'
  | 'Pantalones'
  | 'Faldas'
  | 'Conjuntos'
  | 'Blazers'
  | 'Calzado'
  | 'Bolsos'
  | 'Accesorios';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Vestidos',
  'Blusas',
  'Shorts',
  'Pantalones',
  'Faldas',
  'Conjuntos',
  'Blazers',
  'Calzado',
  'Bolsos',
  'Accesorios',
];

export const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;
export const SHOE_SIZES = ['34', '35', '36', '37', '38', '39', '40', '41'] as const;
export const ONE_SIZE_ONLY = ['Única'] as const;

export const AVAILABLE_SIZES = [
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'Única',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
] as const;

export function getSizesForCategory(category: ProductCategory): readonly string[] {
  if (category === 'Calzado') return SHOE_SIZES;
  if (category === 'Bolsos' || category === 'Accesorios') return ONE_SIZE_ONLY;
  return CLOTHING_SIZES;
}

export function getDefaultSizesForCategory(category: ProductCategory): string[] {
  if (category === 'Calzado') return ['36', '37', '38', '39'];
  if (category === 'Bolsos' || category === 'Accesorios') return ['Única'];
  return ['XS', 'S', 'M', 'L'];
}

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
  dimensionsMax: 80,
  colorMin: 2,
  colorMax: 40,
  imageUrlMin: 4,
  imageUrlMax: 450000,
  maxImages: 6,
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
  deliveryTimeMax: 160,
  legalBusinessNameMax: 140,
  legalDocumentIdMax: 40,
  legalAddressMax: 180,
  legalCityMax: 80,
  legalEmailMax: 160,
  legalPhoneMax: 30,
  legalUpdatedAtMax: 40,
} as const;

export const WAITLIST_LIMITS = {
  nameMin: 2,
  nameMax: 80,
} as const;

export const META_PIXEL_REGEX = /^[0-9]{10,20}$/;
export const GA_MEASUREMENT_REGEX = /^G-[A-Z0-9]{6,16}$/;
export const COLOMBIA_WHATSAPP_10_REGEX = /^3[0-9]{9}$/;
export const COLOMBIA_WHATSAPP_NORMALIZED_REGEX = /^573[0-9]{9}$/;

export type LaunchMode = 'proximamente' | 'abierta';

export interface SizeGuideRow {
  size: string;
  bust: string;
  waist: string;
  hip: string;
}

export interface ShoeSizeGuideRow {
  size: string;
  footLength: string;
}

export interface Product {
  id: string;
  sku?: string;
  name: string;
  description: string;
  dimensions?: string;
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
  sizeDeltas?: Record<string, number>;
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
  privacyConsentAt?: Timestamp | null;
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
  launchMode?: LaunchMode;
  launchDate?: Timestamp | null;
  metaPixelId?: string;
  gaMeasurementId?: string;
  deliveryTimeText?: string;
  sizeGuide?: SizeGuideRow[];
  shoeSizeGuide?: ShoeSizeGuideRow[];
  legalBusinessName?: string;
  legalDocumentId?: string;
  legalAddress?: string;
  legalCity?: string;
  legalEmail?: string;
  legalPhone?: string;
  legalUpdatedAt?: string;
  updatedAt?: Timestamp | null;
}

export interface WaitlistEntry {
  id: string;
  name: string;
  phone: string;
  consent: boolean;
  createdAt?: Timestamp | null;
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
