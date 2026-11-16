import {
  GA_MEASUREMENT_REGEX,
  META_PIXEL_REGEX,
  type CartItem,
  type Order,
  type Product,
} from '../types/store';

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const initializedMetaIds = new Set<string>();
const initializedGaIds = new Set<string>();

let currentMetaId: string | null = null;
let currentGaId: string | null = null;

function ensureMetaPixelScript(pixelId: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!META_PIXEL_REGEX.test(pixelId)) return;

  if (!window.fbq) {
    const fbqShim: FbqFn = function (...args: unknown[]) {
      if (fbqShim.callMethod) {
        fbqShim.callMethod(...args);
      } else {
        fbqShim.queue?.push(args);
      }
    };
    fbqShim.push = fbqShim;
    fbqShim.loaded = true;
    fbqShim.version = '2.0';
    fbqShim.queue = [];
    window.fbq = fbqShim;
    if (!window._fbq) window._fbq = fbqShim;
  }

  if (!document.querySelector('script[data-mia-meta-pixel="true"]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.setAttribute('data-mia-meta-pixel', 'true');
    document.head.appendChild(script);
  }

  if (!initializedMetaIds.has(pixelId)) {
    initializedMetaIds.add(pixelId);
    window.fbq('init', pixelId);
  }
}

function ensureGa4Script(measurementId: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!GA_MEASUREMENT_REGEX.test(measurementId)) return;

  if (!window.dataLayer) {
    window.dataLayer = [];
  }
  let gtagFn = window.gtag;
  if (typeof gtagFn !== 'function') {
    gtagFn = function (...args: unknown[]) {
      window.dataLayer?.push(args);
    };
    window.gtag = gtagFn;
    gtagFn('js', new Date());
  }

  const existingScript = document.querySelector(
    `script[data-mia-ga4="${measurementId}"]`
  );
  if (!existingScript) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.setAttribute('data-mia-ga4', measurementId);
    document.head.appendChild(script);
  }

  if (!initializedGaIds.has(measurementId)) {
    initializedGaIds.add(measurementId);
    gtagFn('config', measurementId, { send_page_view: false });
  }
}

export function configurePixels(options: {
  metaPixelId?: string;
  gaMeasurementId?: string;
}): void {
  const cleanMeta = (options.metaPixelId || '').trim();
  const cleanGa = (options.gaMeasurementId || '').trim().toUpperCase();

  if (cleanMeta && META_PIXEL_REGEX.test(cleanMeta)) {
    currentMetaId = cleanMeta;
    ensureMetaPixelScript(cleanMeta);
  } else {
    currentMetaId = null;
  }

  if (cleanGa && GA_MEASUREMENT_REGEX.test(cleanGa)) {
    currentGaId = cleanGa;
    ensureGa4Script(cleanGa);
  } else {
    currentGaId = null;
  }
}

export function trackPageView(pageTitle?: string, pagePath?: string): void {
  if (typeof window === 'undefined') return;
  if (currentMetaId && window.fbq) {
    window.fbq('track', 'PageView');
  }
  if (currentGaId && window.gtag) {
    window.gtag('event', 'page_view', {
      page_title: pageTitle || document.title,
      page_path: pagePath || window.location.pathname + window.location.hash,
      send_to: currentGaId,
    });
  }
}

export function trackViewContent(product: Product): void {
  if (typeof window === 'undefined') return;
  if (currentMetaId && window.fbq) {
    window.fbq('track', 'ViewContent', {
      content_ids: [product.id],
      content_name: product.name,
      content_category: product.category,
      content_type: 'product',
      value: product.price,
      currency: 'COP',
    });
  }
  if (currentGaId && window.gtag) {
    window.gtag('event', 'view_item', {
      currency: 'COP',
      value: product.price,
      items: [
        {
          item_id: product.sku || product.id,
          item_name: product.name,
          item_category: product.category,
          item_variant: product.color,
          price: product.price,
        },
      ],
    });
  }
}

export function trackAddToCart(product: Product, size: string, quantity: number): void {
  if (typeof window === 'undefined') return;
  const value = product.price * quantity;
  if (currentMetaId && window.fbq) {
    window.fbq('track', 'AddToCart', {
      content_ids: [product.id],
      content_name: product.name,
      content_category: product.category,
      content_type: 'product',
      value,
      currency: 'COP',
    });
  }
  if (currentGaId && window.gtag) {
    window.gtag('event', 'add_to_cart', {
      currency: 'COP',
      value,
      items: [
        {
          item_id: product.sku || product.id,
          item_name: product.name,
          item_category: product.category,
          item_variant: `${size} · ${product.color}`,
          price: product.price,
          quantity,
        },
      ],
    });
  }
}

export function trackInitiateCheckout(cart: CartItem[], total: number): void {
  if (typeof window === 'undefined') return;
  const numItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (currentMetaId && window.fbq) {
    window.fbq('track', 'InitiateCheckout', {
      content_ids: cart.map((item) => item.productId),
      content_type: 'product',
      num_items: numItems,
      value: total,
      currency: 'COP',
    });
  }
  if (currentGaId && window.gtag) {
    window.gtag('event', 'begin_checkout', {
      currency: 'COP',
      value: total,
      items: cart.map((item) => ({
        item_id: item.sku || item.productId,
        item_name: item.name,
        item_variant: `${item.size} · ${item.color}`,
        price: item.price,
        quantity: item.quantity,
      })),
    });
  }
}

export function trackPurchase(order: Order): void {
  if (typeof window === 'undefined') return;
  const numItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  if (currentMetaId && window.fbq) {
    window.fbq('track', 'Purchase', {
      value: order.total,
      currency: 'COP',
      content_ids: order.items.map((item) => item.productId),
      content_type: 'product',
      num_items: numItems,
    });
  }
  if (currentGaId && window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: order.orderNumber,
      value: order.total,
      shipping: order.shippingCost,
      currency: 'COP',
      items: order.items.map((item) => ({
        item_id: item.sku || item.productId,
        item_name: item.name,
        item_variant: `${item.size} · ${item.color}`,
        price: item.price,
        quantity: item.quantity,
      })),
    });
  }
}

export function trackLead(): void {
  if (typeof window === 'undefined') return;
  if (currentMetaId && window.fbq) {
    window.fbq('track', 'Lead', {
      content_name: 'Lista de espera lanzamiento',
    });
  }
  if (currentGaId && window.gtag) {
    window.gtag('event', 'generate_lead', {
      event_category: 'waitlist',
      event_label: 'proximamente',
    });
  }
}
