import heroEditorialImg from '../assets/images/hero_mia_collection_1794775250769.jpg';
import dressSedaImg from '../assets/images/dress_seda_marfil_1794775250658.jpg';
import blazerLinoImg from '../assets/images/blazer_lino_arena_1794775250646.jpg';
import setPuntoImg from '../assets/images/set_punto_rosa_1794775251604.jpg';
import blusaOrganzaImg from '../assets/images/blusa_organza_perla_1794775252208.jpg';
import {
  BRAND_INFO,
  PRODUCT_LIMITS,
  type Order,
  type Product,
  type ShoeSizeGuideRow,
  type SizeGuideRow,
  type StoreSettings,
} from '../types/store';

export const HERO_IMAGE_URL = heroEditorialImg;

export const STUDIO_GALLERY_PRESETS = [
  { label: 'Vestido Seda Marfil', url: dressSedaImg },
  { label: 'Blazer Lino Arena', url: blazerLinoImg },
  { label: 'Conjunto Punto Rosa', url: setPuntoImg },
  { label: 'Blusa Organza Perla', url: blusaOrganzaImg },
];

export const DEFAULT_DELIVERY_TIME_TEXT =
  'Bogotá 1-2 días hábiles; resto del país 3-5 días hábiles';

export const DEFAULT_SIZE_GUIDE: SizeGuideRow[] = [
  { size: 'XS', bust: '82 - 86 cm', waist: '62 - 66 cm', hip: '88 - 92 cm' },
  { size: 'S', bust: '87 - 91 cm', waist: '67 - 71 cm', hip: '93 - 97 cm' },
  { size: 'M', bust: '92 - 96 cm', waist: '72 - 76 cm', hip: '98 - 102 cm' },
  { size: 'L', bust: '97 - 102 cm', waist: '77 - 82 cm', hip: '103 - 108 cm' },
  { size: 'XL', bust: '103 - 108 cm', waist: '83 - 88 cm', hip: '109 - 114 cm' },
];

export const DEFAULT_SHOE_SIZE_GUIDE: ShoeSizeGuideRow[] = [
  { size: '34', footLength: '21.5 cm' },
  { size: '35', footLength: '22.2 cm' },
  { size: '36', footLength: '22.8 cm' },
  { size: '37', footLength: '23.5 cm' },
  { size: '38', footLength: '24.2 cm' },
  { size: '39', footLength: '24.8 cm' },
  { size: '40', footLength: '25.5 cm' },
  { size: '41', footLength: '26.2 cm' },
];

export function getProductImages(product: Pick<Product, 'imageUrl' | 'images'>): string[] {
  const rawList = Array.isArray(product.images) ? product.images : [];
  const merged = [...rawList, product.imageUrl]
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter((u) => u.length >= PRODUCT_LIMITS.imageUrlMin);

  const unique: string[] = [];
  for (const url of merged) {
    if (!unique.includes(url)) {
      unique.push(url);
    }
    if (unique.length >= PRODUCT_LIMITS.maxImages) break;
  }
  return unique;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  announcementText:
    'Regístrate por primera vez y obtén 10% de descuento en tu primer pedido · Envío gratis desde $280.000',
  freeShippingThreshold: 280000,
  shippingFee: 18000,
  heroTitle: 'Elegancia sutil en cada silueta',
  heroSubtitle:
    'Prendas femeninas atemporales confeccionadas en seda fluida, lino natural y tejidos delicados para acompañarte todos los días.',
  launchMode: 'proximamente',
  launchDate: null,
  deliveryTimeText: DEFAULT_DELIVERY_TIME_TEXT,
  sizeGuide: DEFAULT_SIZE_GUIDE,
  shoeSizeGuide: DEFAULT_SHOE_SIZE_GUIDE,
};

export type StarterProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & {
  slugId: string;
};

export const STARTER_PRODUCTS: StarterProductInput[] = [
  {
    slugId: 'vestido-midi-seda-marfil',
    sku: 'MIA-VES-001',
    name: 'Vestido Midi Seda Marfil',
    description:
      'Corte al bies de caída fluida en satén de seda suave con escote drapeado y tirantes ajustables. Pensado para eventos de día o veladas cálidas.',
    price: 265000,
    category: 'Vestidos',
    color: 'Marfil',
    sizes: ['XS', 'S', 'M', 'L'],
    stockBySize: { XS: 2, S: 3, M: 2, L: 2 },
    imageUrl: dressSedaImg,
    images: [dressSedaImg],
    stock: 9,
    featured: true,
    active: true,
  },
  {
    slugId: 'blazer-sastre-lino-arena',
    sku: 'MIA-BLZ-002',
    name: 'Blazer Sastre Lino Arena',
    description:
      'Silueta estructurada y ligera en mezcla de lino europeo transpirable, con botones en nácar natural y forro interior en algodón.',
    price: 310000,
    category: 'Blazers',
    color: 'Arena',
    sizes: ['XS', 'S', 'M', 'L'],
    stockBySize: { XS: 1, S: 2, M: 2, L: 2 },
    imageUrl: blazerLinoImg,
    images: [blazerLinoImg],
    stock: 7,
    featured: true,
    active: true,
  },
  {
    slugId: 'conjunto-punto-rosa-empolvado',
    sku: 'MIA-CNJ-003',
    name: 'Conjunto Punto Rosa Empolvado',
    description:
      'Cárdigan fino de tacto cachemira combinado con falda midi de movimiento acampanado en tono rosa palo. Comodidad y distinción en dos piezas.',
    price: 289000,
    category: 'Conjuntos',
    color: 'Rosa Empolvado',
    sizes: ['S', 'M', 'L'],
    stockBySize: { S: 2, M: 2, L: 1 },
    imageUrl: setPuntoImg,
    images: [setPuntoImg],
    stock: 5,
    featured: true,
    active: true,
  },
  {
    slugId: 'blusa-organza-cuello-lazo',
    sku: 'MIA-BLU-004',
    name: 'Blusa Organza Perla',
    description:
      'Mangas abullonadas translúcidas con puños elásticos y delicado lazo en el cuello. Incluye camisola interior suave al tono.',
    price: 185000,
    category: 'Blusas',
    color: 'Blanco Perla',
    sizes: ['XS', 'S', 'M', 'L'],
    stockBySize: { XS: 3, S: 3, M: 3, L: 3 },
    imageUrl: blusaOrganzaImg,
    images: [blusaOrganzaImg],
    stock: 12,
    featured: true,
    active: true,
  },
];

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildOrderWhatsappMessage(order: Order): string {
  const lines: string[] = [
    `*SOLICITUD DE PEDIDO MÍA STORE — ${order.orderNumber}*`,
    '',
    'Hola Mía Store, quiero solicitar este pedido:',
    '',
    `*Clienta:* ${order.customerName}`,
    `*Teléfono:* ${order.customerPhone}`,
    `*Correo:* ${order.customerEmail}`,
    `*Ciudad:* ${order.city}`,
    `*Dirección:* ${order.shippingAddress}`,
  ];

  if (order.notes) {
    lines.push(`*Notas:* ${order.notes}`);
  }

  lines.push('', '*Prendas seleccionadas:*');
  for (const item of order.items) {
    const skuPart = item.sku ? `Cód. ${item.sku} · ` : '';
    lines.push(
      `• ${item.quantity}x ${item.name} (${skuPart}Talla ${item.size} · ${item.color}) — ${formatCOP(item.price * item.quantity)}`
    );
  }

  lines.push('', '*Valores del pedido:*');
  lines.push(`Subtotal prendas: ${formatCOP(order.subtotal)}`);
  if (order.discountAmount > 0) {
    lines.push(`Descuento 10% primera compra: -${formatCOP(order.discountAmount)}`);
  }
  lines.push(
    `Envío: ${order.shippingCost === 0 ? 'Gratis' : formatCOP(order.shippingCost)}`
  );
  lines.push(`*TOTAL A PAGAR: ${formatCOP(order.total)}*`);
  lines.push(`Referencia de pedido: ${order.paymentReference}`);
  lines.push('', 'Quedo atenta para coordinar el pago y el envío.');

  return lines.join('\n');
}

export function buildOrderWhatsappUrl(order: Order): string {
  const text = encodeURIComponent(buildOrderWhatsappMessage(order));
  return `https://wa.me/${BRAND_INFO.whatsappDigits}?text=${text}`;
}
