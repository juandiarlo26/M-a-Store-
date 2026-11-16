import { ArrowLeft, Mail, MessageCircle, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { DEFAULT_DELIVERY_TIME_TEXT, formatCOP } from '../lib/starterCatalog';
import { BRAND_INFO } from '../types/store';

export type LegalDocType = 'privacidad' | 'terminos' | 'cambios';

interface LegalPageProps {
  docType: LegalDocType;
  onClose: () => void;
}

const DOC_TABS: Array<{ id: LegalDocType; hash: string; label: string }> = [
  { id: 'privacidad', hash: '#privacidad', label: 'Política de Privacidad' },
  { id: 'terminos', hash: '#terminos', label: 'Términos y Condiciones' },
  { id: 'cambios', hash: '#cambios', label: 'Cambios y Retracto' },
];

function legalFieldOrPending(value?: string): string {
  const clean = value?.trim() ?? '';
  return clean.length > 0 ? clean : '[Pendiente por completar]';
}

export function LegalPage({ docType, onClose }: LegalPageProps) {
  const { settings } = useStore();

  const businessName = legalFieldOrPending(settings.legalBusinessName);
  const documentId = legalFieldOrPending(settings.legalDocumentId);
  const address = legalFieldOrPending(settings.legalAddress);
  const city = legalFieldOrPending(settings.legalCity);
  const legalEmail = legalFieldOrPending(settings.legalEmail);
  const legalPhone = legalFieldOrPending(settings.legalPhone);
  const legalUpdatedAt = legalFieldOrPending(settings.legalUpdatedAt);
  const deliveryTime = settings.deliveryTimeText?.trim() || DEFAULT_DELIVERY_TIME_TEXT;

  const contactEmailHref =
    settings.legalEmail?.trim() ? `mailto:${settings.legalEmail.trim()}` : `mailto:${BRAND_INFO.email}`;

  return (
    <div className="min-h-screen bg-[#FBF9F7] text-[#231F20]">
      {/* Minimal Editorial Header */}
      <header className="sticky top-0 z-30 h-16 bg-[#FBF9F7]/95 backdrop-blur-md border-b border-[#EAE0DA]">
        <div className="max-w-4xl mx-auto h-full px-4 md:px-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#EAE0DA] bg-white text-xs font-medium text-[#231F20] inline-flex items-center gap-2 hover:bg-[#F8EFEA] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.6} />
            <span>Volver</span>
          </button>

          <span className="font-display text-xl sm:text-2xl font-semibold text-[#231F20]">
            {BRAND_INFO.name}
          </span>

          <div className="w-20 hidden sm:block" aria-hidden="true" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        {/* Document Switcher */}
        <nav aria-label="Documentos legales" className="flex flex-wrap gap-2">
          {DOC_TABS.map((item) => {
            const active = item.id === docType;
            return (
              <a
                key={item.id}
                href={item.hash}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-medium inline-flex items-center border transition-colors ${
                  active
                    ? 'bg-[#231F20] text-[#FBF9F7] border-[#231F20]'
                    : 'bg-white text-[#574B47] border-[#EAE0DA] hover:bg-[#F8EFEA]'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Responsable / Legal Entity Identification Card */}
        <section className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[#8C5E58]">
            <ShieldCheck className="w-4 h-4" strokeWidth={1.6} />
            <span>Identificación del titular y responsable · Colombia</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-[#574B47]">
            <p>
              <strong className="text-[#231F20]">Razón social / Titular:</strong> {businessName}
            </p>
            <p>
              <strong className="text-[#231F20]">NIT / Cédula:</strong> {documentId}
            </p>
            <p>
              <strong className="text-[#231F20]">Dirección:</strong> {address}
            </p>
            <p>
              <strong className="text-[#231F20]">Ciudad:</strong> {city}
            </p>
            <p>
              <strong className="text-[#231F20]">Correo de atención:</strong> {legalEmail}
            </p>
            <p>
              <strong className="text-[#231F20]">Teléfono / WhatsApp de atención:</strong>{' '}
              {legalPhone}
            </p>
          </div>
          <p className="text-[11px] text-[#756661] pt-1 border-t border-[#EAE0DA]">
            Última actualización del documento: <strong className="text-[#231F20]">{legalUpdatedAt}</strong>
          </p>
        </section>

        {/* Legal Document Content */}
        {docType === 'privacidad' && (
          <article className="bg-white border border-[#EAE0DA] rounded-2xl p-6 sm:p-10 space-y-6">
            <header className="space-y-2 border-b border-[#EAE0DA] pb-5">
              <p className="text-xs text-[#8C5E58] tracking-wide">
                Ley 1581 de 2012 · Decreto 1377 de 2013
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-medium text-[#231F20]">
                Política de Tratamiento de Datos Personales
              </h1>
            </header>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                1. Responsable del tratamiento
              </h2>
              <p>
                El responsable del tratamiento de los datos personales recolectados a través del
                sitio web de <strong>{BRAND_INFO.name}</strong> y sus canales digitales asociados es{' '}
                <strong>{businessName}</strong>, identificado(a) con NIT/cédula{' '}
                <strong>{documentId}</strong>, con domicilio en <strong>{address}</strong>,{' '}
                <strong>{city}</strong>, correo electrónico <strong>{legalEmail}</strong> y teléfono
                de contacto <strong>{legalPhone}</strong>.
              </p>
            </section>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                2. Datos personales que recopilamos
              </h2>
              <p>
                De acuerdo con la relación comercial o de pre-registro que mantengas con{' '}
                {BRAND_INFO.name}, podremos recopilar y almacenar de forma segura los siguientes datos:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Nombre completo.</li>
                <li>Correo electrónico (incluyendo verificación mediante inicio de sesión con Google).</li>
                <li>Número de teléfono celular / WhatsApp.</li>
                <li>Dirección física de entrega, barrio o indicaciones adicionales y ciudad.</li>
                <li>Historial de pedidos, tallas elegidas, referencias y estado de pagos o envíos.</li>
              </ul>
            </section>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                3. Finalidades del tratamiento
              </h2>
              <p>
                Tus datos personales serán tratados con estricta confidencialidad para las siguientes
                finalidades:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Gestionar el procesamiento de pedidos, reserva de inventario, facturación,
                  alistamiento y envío a la dirección indicada.
                </li>
                <li>
                  Establecer contacto directo a través de WhatsApp para coordinar confirmaciones de
                  pago, entregas, cambios o garantías.
                </li>
                <li>
                  Administrar la lista de espera de lanzamiento y enviar avisos de apertura a quienes
                  lo autoricen expresamente.
                </li>
                <li>
                  Validar y otorgar por única vez el descuento de bienvenida del 10% en tu primera
                  compra registrada.
                </li>
                <li>
                  Realizar pauta publicitaria y medición estadística de audiencias y conversiones
                  mediante herramientas como Meta Pixel y Google Analytics, cuando estén activadas.
                </li>
              </ul>
            </section>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                4. Derechos de las personas titulares
              </h2>
              <p>
                Conforme al artículo 8 de la Ley 1581 de 2012, como titular de tus datos personales
                tienes derecho a:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Conocer, actualizar y rectificar</strong> tus datos personales frente al
                  responsable.
                </li>
                <li>
                  <strong>Solicitar prueba</strong> de la autorización otorgada para el tratamiento.
                </li>
                <li>
                  <strong>Ser informada(o)</strong> respecto del uso que se ha dado a tus datos.
                </li>
                <li>
                  <strong>Revocar la autorización y/o solicitar la supresión</strong> del dato cuando
                  no exista un deber legal o contractual que impida eliminarlo.
                </li>
                <li>
                  <strong>Presentar quejas</strong> ante la Superintendencia de Industria y Comercio
                  (SIC) por infracciones a la ley, previo agotamiento del trámite de reclamo ante el
                  responsable.
                </li>
              </ul>
            </section>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                5. Canales de atención y plazos legales de respuesta
              </h2>
              <p>
                Para ejercer tus derechos de consultas, actualización, rectificación o supresión de
                datos, puedes escribirnos en cualquier momento a través de nuestro correo de atención{' '}
                <strong>{legalEmail}</strong> o vía WhatsApp al <strong>{legalPhone}</strong> (línea
                comercial adicional: {BRAND_INFO.whatsappDisplay}).
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Consultas (art. 14, Ley 1581 de 2012):</strong> Serán atendidas en un
                  término máximo de <strong>diez (10) días hábiles</strong> contados a partir de la
                  fecha de recibo. Si no fuere posible atenderla dentro de dicho término, se te
                  informará el motivo de la demora y la nueva fecha de respuesta (sin superar 5 días
                  hábiles adicionales).
                </li>
                <li>
                  <strong>Reclamos (art. 15, Ley 1581 de 2012):</strong> El término máximo para
                  atender un reclamo será de <strong>quince (15) días hábiles</strong> contados
                  desde el día siguiente a la fecha de recibo completo. Si no fuere posible
                  resolverlo en ese plazo, se informarán los motivos antes del vencimiento y se dará
                  respuesta definitiva dentro de los 8 días hábiles siguientes.
                </li>
              </ul>
            </section>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">6. Vigencia</h2>
              <p>
                La presente Política rige a partir del <strong>{legalUpdatedAt}</strong>. Las bases de
                datos en las que reposan los datos personales tendrán vigencia durante el tiempo que
                sea razonable y necesario de acuerdo con las finalidades que justifican su
                tratamiento y las obligaciones legales contables o de garantía vigentes en Colombia.
              </p>
            </section>
          </article>
        )}

        {docType === 'terminos' && (
          <article className="bg-white border border-[#EAE0DA] rounded-2xl p-6 sm:p-10 space-y-6">
            <header className="space-y-2 border-b border-[#EAE0DA] pb-5">
              <p className="text-xs text-[#8C5E58] tracking-wide">
                Condiciones Generales de Venta · Colombia
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-medium text-[#231F20]">
                Términos y Condiciones
              </h1>
            </header>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                1. Proceso de compra por WhatsApp
              </h2>
              <p>
                Al confirmar un pedido en <strong>{BRAND_INFO.name}</strong> (operado por{' '}
                <strong>{businessName}</strong>, NIT/cédula <strong>{documentId}</strong>), la
                plataforma registra tu solicitud en estado <em>Pendiente de pago</em>, reserva
                temporalmente las unidades de la talla elegida y genera un mensaje detallado hacia
                nuestro canal oficial de WhatsApp ({BRAND_INFO.whatsappDisplay}). El pedido solo se
                considera confirmado para alistamiento una vez verificado el pago por los medios
                acordados en la conversación.
              </p>
            </section>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                2. Precios, moneda e impuestos
              </h2>
              <p>
                Todos los precios publicados en el catálogo se expresan en{' '}
                <strong>pesos colombianos (COP)</strong> e incluyen el IVA cuando el régimen
                tributario del responsable así lo exija. El costo de envío se calcula y muestra de
                forma transparente antes de confirmar el pedido; actualmente el envío es gratuito en
                compras iguales o superiores a{' '}
                <strong>{formatCOP(settings.freeShippingThreshold)}</strong> (tarifa estándar:{' '}
                <strong>{formatCOP(settings.shippingFee)}</strong> para montos inferiores).
              </p>
            </section>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                3. Disponibilidad de inventario
              </h2>
              <p>
                Todas las prendas y tallas están sujetas a disponibilidad de inventario en tiempo
                real tanto en tienda física como en el canal digital. En caso excepcional de
                desfase o falta de existencias posterior a la solicitud, te contactaremos de
                inmediato por WhatsApp para ofrecerte cambio de talla/referencia o la cancelación sin
                costo alguno.
              </p>
            </section>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                4. Envíos y tiempos de entrega
              </h2>
              <p>
                Realizamos despachos a todo el territorio colombiano a través de transportadoras
                aliadas. Los tiempos estimados de entrega son: <strong>{deliveryTime}</strong>,
                contados en días hábiles a partir de la confirmación del pago y el despacho del
                paquete. Eventos de fuerza mayor o novedades viales atribuibles a la transportadora
                podrán extender los plazos informados.
              </p>
            </section>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                5. Descuento de bienvenida (10% primera compra)
              </h2>
              <p>
                Las clientas que se registran por primera vez con su cuenta verificada reciben un
                descuento único del <strong>10%</strong> sobre el subtotal de las prendas en su primer
                pedido. Este beneficio es personal, no acumulable con otras promociones y válido por
                una sola compra por cuenta y persona.
              </p>
            </section>
          </article>
        )}

        {docType === 'cambios' && (
          <article className="bg-white border border-[#EAE0DA] rounded-2xl p-6 sm:p-10 space-y-6">
            <header className="space-y-2 border-b border-[#EAE0DA] pb-5">
              <p className="text-xs text-[#8C5E58] tracking-wide">
                Ley 1480 de 2011 · Estatuto del Consumidor
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-medium text-[#231F20]">
                Cambios, Devoluciones y Derecho de Retracto
              </h1>
            </header>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                1. Derecho de retracto (art. 47, Ley 1480 de 2011)
              </h2>
              <p>
                Para compras realizadas a distancia o por medios electrónicos en{' '}
                <strong>{BRAND_INFO.name}</strong>, tienes derecho a retractarte dentro de los{' '}
                <strong>cinco (5) días hábiles</strong> siguientes a la fecha de entrega de la
                prenda.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  La prenda debe devolverse por los mismos medios y en las mismas condiciones en que
                  fue recibida: <strong>sin uso, sin lavar, sin olores ni manchas, y con todas sus
                  etiquetas y empaques originales intactos</strong>.
                </li>
                <li>
                  Conforme a la ley, los costos de transporte y demás gastos que conlleve la
                  devolución de la prenda serán cubiertos por la consumidora.
                </li>
                <li>
                  Una vez recibida y verificada la prenda en perfecto estado,{' '}
                  <strong>{businessName}</strong> realizará la devolución total de las sumas
                  pagadas sin descuentos ni retenciones dentro de un plazo máximo de{' '}
                  <strong>treinta (30) días calendario</strong> desde el momento en que ejerciste el
                  retracto.
                </li>
              </ul>
            </section>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                2. Cambios de talla o referencia
              </h2>
              <p>
                Si deseas cambiar la talla o referencia de una prenda comprada, puedes solicitarlo
                dentro de los <strong>15 días calendario</strong> siguientes a la entrega escribiendo
                a nuestro WhatsApp ({legalPhone}) o al correo ({legalEmail}) indicando tu número de
                pedido. La prenda debe estar completamente nueva, sin uso y con etiquetas
                originales. Los cambios quedan sujetos a disponibilidad de inventario.
              </p>
            </section>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                3. Garantía legal por calidad o idoneidad
              </h2>
              <p>
                Nuestras prendas cuentan con garantía legal conforme a la Ley 1480 de 2011 frente a
                defectos de confección, costuras o materiales no atribuibles a mal uso o lavado
                inadecuado. Para solicitar efectividad de la garantía, contáctanos adjuntando tu
                número de pedido y fotografías del defecto encontrado; tras la revisión técnica
                procederemos con la reparación gratuita, el cambio de prenda o la devolución del
                dinero según corresponda legalmente.
              </p>
            </section>

            <section className="space-y-2 text-sm text-[#574B47] leading-relaxed">
              <h2 className="font-display text-2xl text-[#231F20]">
                4. Reversión del pago (art. 51, Ley 1480 de 2011)
              </h2>
              <p>
                Cuando la adquisición se haya efectuado mediante mecanismos de comercio electrónico y
                el pago se haya realizado con tarjeta de crédito, débito u otro instrumento de pago
                electrónico, podrás solicitar la reversión del pago cuando seas objeto de fraude,
                corresponda a una operación no solicitada, el producto adquirido no sea recibido, el
                producto entregado no corresponda a lo solicitado o resulte defectuoso. La solicitud
                deberá presentarse ante <strong>{businessName}</strong> dentro de los{' '}
                <strong>cinco (5) días hábiles</strong> siguientes a la fecha en que tuviste
                conocimiento de la situación, y notificarse en paralelo al emisor del instrumento de
                pago conforme al Decreto 587 de 2016.
              </p>
            </section>
          </article>
        )}

        {/* Contact & Legal Base Disclaimer */}
        <footer className="bg-[#F8EFEA] border border-[#EAE0DA] rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#574B47]">
              <a
                href={contactEmailHref}
                className="inline-flex items-center gap-1.5 hover:text-[#231F20] underline underline-offset-4"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{legalEmail}</span>
              </a>
              <a
                href={`https://wa.me/${BRAND_INFO.whatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-[#231F20] underline underline-offset-4"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp: {BRAND_INFO.whatsappDisplay}</span>
              </a>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#231F20] text-[#FBF9F7] text-xs font-medium hover:bg-[#3A3335]"
            >
              Volver a {BRAND_INFO.name}
            </button>
          </div>
          <p className="text-xs text-[#756661] border-t border-[#EAE0DA] pt-3">
            Este texto es una guía base; revísalo con un asesor legal.
          </p>
        </footer>
      </main>
    </div>
  );
}
