import { useEffect, useMemo, useState } from 'react';
import { Check, Download, Minus, Plus, Printer, Tag, X } from 'lucide-react';
import { encodeCode39Bars } from '../lib/skuUtils';
import { formatCOP } from '../lib/starterCatalog';
import { BRAND_INFO, type Product } from '../types/store';

type TagFormat = 'rotulo' | 'colgante';

interface PrintableTagModalProps {
  open: boolean;
  products: Product[];
  initialSingleProduct?: Product | null;
  onClose: () => void;
}

function BarcodeSvg({ code, height = 34 }: { code: string; height?: number }) {
  const { bars, totalWidth } = useMemo(() => encodeCode39Bars(code), [code]);
  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${height}`}
      className="w-full max-w-[210px] h-auto mx-auto block"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Código de barras ${code}`}
    >
      <rect x="0" y="0" width={totalWidth} height={height} fill="#FFFFFF" />
      {bars.map((bar, idx) => (
        <rect
          key={idx}
          x={bar.x}
          y={0}
          width={bar.width}
          height={height}
          fill="#231F20"
        />
      ))}
    </svg>
  );
}

function renderTagPngDataUrl(product: Product, format: TagFormat): string {
  const scale = 2;
  const width = format === 'colgante' ? 360 : 540;
  const height = format === 'colgante' ? 540 : 324;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Outer dashed cut guide
  ctx.strokeStyle = '#C9B9AF';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(8, 8, width - 16, height - 16);
  ctx.setLineDash([]);

  const codeText = product.sku || product.id.slice(0, 10).toUpperCase();
  const { bars, totalWidth } = encodeCode39Bars(codeText);

  if (format === 'colgante') {
    // Punch hole circle
    ctx.beginPath();
    ctx.arc(width / 2, 30, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#9E8F8A';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Brand
    ctx.fillStyle = '#231F20';
    ctx.textAlign = 'center';
    ctx.font = '600 28px Georgia, serif';
    ctx.fillText('Mía Store', width / 2, 76);

    ctx.fillStyle = '#756661';
    ctx.font = '500 12px sans-serif';
    ctx.fillText(`${product.category} · ${product.color}`, width / 2, 104);

    // Hairline
    ctx.strokeStyle = '#EAE0DA';
    ctx.beginPath();
    ctx.moveTo(36, 124);
    ctx.lineTo(width - 36, 124);
    ctx.stroke();

    // Product Name (2 lines max)
    ctx.fillStyle = '#231F20';
    ctx.font = '600 18px sans-serif';
    const words = product.name.split(' ');
    let line1 = '';
    let line2 = '';
    for (const w of words) {
      const candidate = line1 ? `${line1} ${w}` : w;
      if (ctx.measureText(candidate).width <= width - 64) {
        line1 = candidate;
      } else {
        line2 = line2 ? `${line2} ${w}` : w;
      }
    }
    ctx.fillText(line1, width / 2, 160);
    if (line2) {
      ctx.fillText(line2.slice(0, 28), width / 2, 186);
    }

    // Sizes
    ctx.fillStyle = '#574B47';
    ctx.font = '500 13px sans-serif';
    ctx.fillText(`Tallas: ${product.sizes.join('  /  ')}`, width / 2, 224);

    // Price
    ctx.fillStyle = '#231F20';
    ctx.font = '700 28px sans-serif';
    ctx.fillText(formatCOP(product.price), width / 2, 280);

    // Barcode
    const barBoxWidth = 240;
    const barHeight = 64;
    const startX = (width - barBoxWidth) / 2;
    const startY = 334;
    const barScale = barBoxWidth / totalWidth;
    ctx.fillStyle = '#231F20';
    for (const b of bars) {
      ctx.fillRect(startX + b.x * barScale, startY, b.width * barScale, barHeight);
    }

    ctx.font = '700 16px monospace';
    ctx.fillText(codeText, width / 2, 424);

    ctx.fillStyle = '#756661';
    ctx.font = '400 11px sans-serif';
    ctx.fillText(`IG ${BRAND_INFO.instagramHandle} · WA ${BRAND_INFO.whatsappDisplay}`, width / 2, 496);
  } else {
    // Horizontal rack / shelf locator label
    ctx.fillStyle = '#231F20';
    ctx.textAlign = 'left';
    ctx.font = '600 24px Georgia, serif';
    ctx.fillText('Mía Store', 28, 48);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#756661';
    ctx.font = '500 12px sans-serif';
    ctx.fillText(`${product.category} · ${product.color}`, width - 28, 46);

    ctx.strokeStyle = '#EAE0DA';
    ctx.beginPath();
    ctx.moveTo(28, 64);
    ctx.lineTo(width - 28, 64);
    ctx.stroke();

    // Product Name + Price
    ctx.textAlign = 'left';
    ctx.fillStyle = '#231F20';
    ctx.font = '600 20px sans-serif';
    ctx.fillText(product.name.slice(0, 34), 28, 102);

    ctx.fillStyle = '#574B47';
    ctx.font = '500 13px sans-serif';
    ctx.fillText(`Tallas disponibles: ${product.sizes.join(' · ')}`, 28, 130);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#231F20';
    ctx.font = '700 24px sans-serif';
    ctx.fillText(formatCOP(product.price), width - 28, 108);

    // Prominent code & barcode box
    ctx.fillStyle = '#F8EFEA';
    ctx.fillRect(28, 160, width - 56, 126);
    ctx.strokeStyle = '#EAE0DA';
    ctx.strokeRect(28, 160, width - 56, 126);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#756661';
    ctx.font = '500 11px sans-serif';
    ctx.fillText('CÓDIGO DE UBICACIÓN EN TIENDA', width / 2, 182);

    ctx.fillStyle = '#231F20';
    ctx.font = '700 22px monospace';
    ctx.fillText(codeText, width / 2, 210);

    const barBoxWidth = 260;
    const barHeight = 46;
    const startX = (width - barBoxWidth) / 2;
    const startY = 224;
    const barScale = barBoxWidth / totalWidth;
    ctx.fillStyle = '#231F20';
    for (const b of bars) {
      ctx.fillRect(startX + b.x * barScale, startY, b.width * barScale, barHeight);
    }
  }

  return canvas.toDataURL('image/png');
}

export function PrintableTagModal({
  open,
  products,
  initialSingleProduct = null,
  onClose,
}: PrintableTagModalProps) {
  const [format, setFormat] = useState<TagFormat>('rotulo');
  const [copies, setCopies] = useState<number>(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadedNotice, setDownloadedNotice] = useState(false);

  const isSingleMode = Boolean(initialSingleProduct);

  useEffect(() => {
    if (!open) return;
    setDownloadedNotice(false);
    if (initialSingleProduct) {
      setCopies(1);
      setSelectedIds([initialSingleProduct.id]);
    } else {
      const coded = products.filter((p) => Boolean(p.sku));
      setSelectedIds(coded.map((p) => p.id));
    }
  }, [open, initialSingleProduct, products]);

  if (!open) return null;

  const tagsToRender: Product[] = isSingleMode && initialSingleProduct
    ? Array.from({ length: copies }, () => initialSingleProduct)
    : products.filter((p) => selectedIds.includes(p.id));

  const toggleProductSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPng = (target: Product) => {
    const dataUrl = renderTagPngDataUrl(target, format);
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    const safeSku = (target.sku || target.id).replace(/[^a-zA-Z0-9_-]/g, '');
    link.download = `etiqueta-mia-${safeSku}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadedNotice(true);
    setTimeout(() => setDownloadedNotice(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[#231F20]/50 backdrop-blur-xs p-0 md:p-6 print-only-container"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Imprimir etiqueta para tienda física"
    >
      <div
        className="w-full md:max-w-5xl max-h-[94vh] overflow-y-auto bg-[#FBF9F7] rounded-t-3xl md:rounded-2xl border border-[#EAE0DA] shadow-2xl print-only-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header (hidden on print) */}
        <div className="no-print px-6 py-4 border-b border-[#EAE0DA] flex items-center justify-between gap-4 sticky top-0 bg-[#FBF9F7] z-20">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-medium text-[#231F20] truncate">
              {isSingleMode && initialSingleProduct
                ? `Etiqueta física · ${initialSingleProduct.name}`
                : 'Imprimir etiquetas para tienda física'}
            </h2>
            <p className="text-xs text-[#756661]">
              Imprime en sitio para colocar el código directamente en la prenda o en su lugar del
              exhibidor.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista de impresión"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-[#F8EFEA] shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 print-only-container">
          {/* Print Controls Toolbar (hidden on print) */}
          <div className="no-print bg-white border border-[#EAE0DA] rounded-2xl p-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Format Switch */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[#756661] block">
                  Formato para tienda física
                </span>
                <div className="inline-flex p-1 bg-[#F8EFEA] border border-[#EAE0DA] rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setFormat('rotulo')}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      format === 'rotulo'
                        ? 'bg-[#231F20] text-[#FBF9F7]'
                        : 'text-[#574B47] hover:text-[#231F20]'
                    }`}
                  >
                    Rótulo de espacio / perchero (10 × 6 cm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('colgante')}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      format === 'colgante'
                        ? 'bg-[#231F20] text-[#FBF9F7]'
                        : 'text-[#574B47] hover:text-[#231F20]'
                    }`}
                  >
                    Etiqueta colgante de prenda (6 × 9 cm)
                  </button>
                </div>
              </div>

              {/* Single copy stepper */}
              {isSingleMode && initialSingleProduct && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-[#756661] block">
                    Copias a imprimir
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center border border-[#EAE0DA] rounded-xl bg-[#FBF9F7]">
                      <button
                        type="button"
                        onClick={() => setCopies((c) => Math.max(1, c - 1))}
                        aria-label="Menos copias"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center hover:bg-[#F8EFEA] rounded-l-xl"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-xs font-semibold tabular-nums min-w-[44px] text-center">
                        {copies}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCopies((c) => Math.min(24, c + 1))}
                        aria-label="Más copias"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center hover:bg-[#F8EFEA] rounded-r-xl"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {initialSingleProduct.stock > 1 && (
                      <button
                        type="button"
                        onClick={() => setCopies(Math.min(24, initialSingleProduct.stock))}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#EAE0DA] bg-[#FBF9F7] text-xs font-medium text-[#574B47] hover:bg-[#F8EFEA] whitespace-nowrap"
                      >
                        Igual al stock ({initialSingleProduct.stock})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Print / Download CTAs */}
              <div className="flex flex-wrap items-center gap-2 lg:self-end">
                {isSingleMode && initialSingleProduct && (
                  <button
                    type="button"
                    onClick={() => handleDownloadPng(initialSingleProduct)}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-[#EAE0DA] bg-white text-xs font-medium text-[#231F20] inline-flex items-center gap-2 hover:bg-[#F8EFEA] whitespace-nowrap"
                  >
                    {downloadedNotice ? (
                      <>
                        <Check className="w-4 h-4 text-[#065F46]" />
                        <span>PNG descargado</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Descargar PNG</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  disabled={tagsToRender.length === 0}
                  onClick={handlePrint}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#231F20] text-[#FBF9F7] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#3A3335] disabled:opacity-40 whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    Imprimir en sitio ({tagsToRender.length}{' '}
                    {tagsToRender.length === 1 ? 'etiqueta' : 'etiquetas'})
                  </span>
                </button>
              </div>
            </div>

            {/* Batch selector when opened from Inventory toolbar */}
            {!isSingleMode && (
              <div className="pt-3 border-t border-[#EAE0DA] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#231F20]">
                    Prendas incluidas en la hoja ({selectedIds.length} de {products.length})
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedIds(products.map((p) => p.id))}
                      className="text-[#8C5E58] font-medium hover:underline"
                    >
                      Seleccionar todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="text-[#756661] hover:underline"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                  {products.map((p) => {
                    const checked = selectedIds.includes(p.id);
                    const displaySku = p.sku || p.id.slice(0, 8).toUpperCase();
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-[#F8EFEA] border-[#D8C8BE] text-[#231F20]'
                            : 'bg-[#FBF9F7] border-[#EAE0DA] text-[#574B47]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProductSelection(p.id)}
                          className="w-4 h-4 accent-[#231F20]"
                        />
                        <span className="font-mono text-[11px] font-semibold shrink-0">
                          {displaySku}
                        </span>
                        <span className="truncate">{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Printable Preview Sheet */}
          {tagsToRender.length === 0 ? (
            <div className="no-print bg-white border border-[#EAE0DA] rounded-2xl p-10 text-center space-y-2">
              <Tag className="w-6 h-6 mx-auto text-[#8C5E58]" strokeWidth={1.5} />
              <p className="font-display text-2xl text-[#231F20]">
                Selecciona al menos una prenda
              </p>
              <p className="text-xs text-[#756661]">
                Marca las prendas que deseas imprimir para organizar tu tienda física.
              </p>
            </div>
          ) : (
            <div
              className={
                format === 'colgante'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 justify-items-center print:grid-cols-3 print:gap-3'
                  : 'grid grid-cols-1 md:grid-cols-2 gap-5 justify-items-center print:grid-cols-2 print:gap-3'
              }
            >
              {tagsToRender.map((product, index) => {
                const code = product.sku || product.id.slice(0, 10).toUpperCase();
                if (format === 'colgante') {
                  return (
                    <div
                      key={`${product.id}-hang-${index}`}
                      className="print-tag-card w-[240px] min-h-[360px] bg-white border border-dashed border-[#B9A79D] rounded-xl p-4 flex flex-col justify-between text-center shadow-xs print:shadow-none"
                    >
                      {/* Top hang hole indicator */}
                      <div className="space-y-2">
                        <div className="w-3.5 h-3.5 mx-auto rounded-full border border-[#9E8F8A]" />
                        <p className="font-display text-2xl font-semibold tracking-tight text-[#231F20]">
                          {BRAND_INFO.name}
                        </p>
                        <p className="text-[11px] text-[#756661]">
                          {product.category} · {product.color}
                        </p>
                      </div>

                      <div className="border-y border-[#EAE0DA] py-3 my-2 space-y-1.5">
                        <p className="text-sm font-semibold text-[#231F20] leading-snug">
                          {product.name}
                        </p>
                        <p className="text-[11px] text-[#574B47]">
                          Tallas: {product.sizes.join(' / ')}
                        </p>
                        <p className="text-xl font-bold text-[#231F20] tabular-nums pt-1">
                          {formatCOP(product.price)}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <BarcodeSvg code={code} height={44} />
                        <p className="font-mono text-xs font-bold tracking-wider text-[#231F20]">
                          {code}
                        </p>
                        <p className="text-[10px] text-[#756661]">
                          {BRAND_INFO.instagramHandle} · WA {BRAND_INFO.whatsappDisplay}
                        </p>
                      </div>
                    </div>
                  );
                }

                // Horizontal shelf / rack locator card (Rótulo de espacio)
                return (
                  <div
                    key={`${product.id}-rack-${index}`}
                    className="print-tag-card w-full max-w-[380px] min-h-[224px] bg-white border border-dashed border-[#B9A79D] rounded-xl p-4 flex flex-col justify-between shadow-xs print:shadow-none"
                  >
                    <div className="flex items-baseline justify-between gap-2 pb-2 border-b border-[#EAE0DA]">
                      <span className="font-display text-xl font-semibold text-[#231F20]">
                        {BRAND_INFO.name}
                      </span>
                      <span className="text-[11px] text-[#756661] truncate">
                        {product.category} · {product.color}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-semibold text-[#231F20] leading-snug">
                          {product.name}
                        </p>
                        <p className="text-[11px] text-[#574B47]">
                          Tallas: {product.sizes.join(' · ')}
                        </p>
                      </div>
                      <p className="text-base font-bold text-[#231F20] tabular-nums shrink-0">
                        {formatCOP(product.price)}
                      </p>
                    </div>

                    <div className="bg-[#F8EFEA] print:bg-[#FBF9F7] border border-[#EAE0DA] rounded-lg px-3 py-2 text-center space-y-1">
                      <p className="text-[10px] font-medium text-[#756661] tracking-wide">
                        Código de lugar en tienda
                      </p>
                      <p className="font-mono text-base font-bold tracking-wider text-[#231F20]">
                        {code}
                      </p>
                      <BarcodeSvg code={code} height={30} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
