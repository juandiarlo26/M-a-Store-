import heroEditorialImg from '../assets/images/hero_mia_collection_1794775250769.jpg';
import dressSedaImg from '../assets/images/dress_seda_marfil_1794775250658.jpg';
import blazerLinoImg from '../assets/images/blazer_lino_arena_1794775250646.jpg';
import setPuntoImg from '../assets/images/set_punto_rosa_1794775251604.jpg';
import blusaOrganzaImg from '../assets/images/blusa_organza_perla_1794775252208.jpg';
import {
  BRAND_INFO,
  type Order,
  type Product,
  type StoreSettings,
} from '../types/store';

export const HERO_IMAGE_URL = heroEditorialImg;

export const STUDIO_GALLERY_PRESETS = [
  { label: 'Vestido Seda Marfil', url: dressSedaImg },
  { label: 'Blazer Lino Arena', url: blazerLinoImg },
  { label: 'Conjunto Punto Rosa', url: setPuntoImg },
  { label: 'Blusa Organza Perla', url: blusaOrganzaImg },
];

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  announcementText:
    'Regístrate por primera vez y obtén 10% de descuento en tu primer pedido · Envío gratis desde $280.000',
  freeShippingThreshold: 280000,
  shippingFee: 18000,
  heroTitle: 'Elegancia sutil en cada silueta',
  heroSubtitle:
    'Prendas femeninas atemporales confeccionadas en seda fluida, lino natural y tejidos delicados para acompañarte todos los días.',
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
    imageUrl: dressSedaImg,
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
    imageUrl: blazerLinoImg,
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
    imageUrl: setPuntoImg,
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
    imageUrl: blusaOrganzaImg,
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
