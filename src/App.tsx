import React, { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { trackPageView } from './lib/analytics';
import { BRAND_INFO } from './types/store';
import { AdminDashboard } from './components/AdminDashboard';
import { ComingSoonPage } from './components/ComingSoonPage';
import { LegalPage, type LegalDocType } from './components/LegalPage';
import { Storefront } from './components/Storefront';

function parseLegalHash(hash: string): LegalDocType | null {
  const clean = hash.replace(/^#/, '').trim().toLowerCase();
  if (clean === 'privacidad' || clean === 'terminos' || clean === 'cambios') {
    return clean;
  }
  return null;
}

class StoreErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FBF9F7] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#EAE0DA] rounded-2xl p-8 text-center space-y-4">
            <h1 className="font-display text-3xl text-[#231F20]">Algo ocurrió al conectar</h1>
            <p className="text-sm text-[#574B47]">
              No pudimos completar la operación con la base de datos. Intenta recargar la página.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#231F20] text-[#FBF9F7] text-sm font-medium"
            >
              Recargar tienda
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MiaStoreRoot() {
  const { authReady, settingsLoaded, isAdmin, settings } = useStore();
  const [view, setView] = useState<'store' | 'admin'>('store');
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(() =>
    parseLegalHash(window.location.hash)
  );

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseLegalHash(window.location.hash);
      setLegalDoc(parsed);
      if (parsed) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleCloseLegal = () => {
    setLegalDoc(null);
    if (parseLegalHash(window.location.hash)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    window.scrollTo({ top: 0 });
  };

  const isComingSoon = (settings.launchMode ?? 'proximamente') === 'proximamente';

  useEffect(() => {
    if (!authReady || !settingsLoaded) return;
    if (legalDoc) {
      const titles: Record<LegalDocType, string> = {
        privacidad: 'Política de Privacidad',
        terminos: 'Términos y Condiciones',
        cambios: 'Cambios y Retracto',
      };
      trackPageView(`Mía Store — ${titles[legalDoc]}`, `/#${legalDoc}`);
    } else if (isComingSoon && !isAdmin) {
      trackPageView('Mía Store — Próximamente', '/proximamente');
    } else if (view === 'admin' && isAdmin) {
      trackPageView('Mía Store — Panel Admin', '/admin');
    } else {
      trackPageView('Mía Store — Colección', '/');
    }
  }, [
    authReady,
    settingsLoaded,
    isComingSoon,
    isAdmin,
    view,
    legalDoc,
    settings.metaPixelId,
    settings.gaMeasurementId,
  ]);

  if (!authReady || !settingsLoaded) {
    return (
      <div className="min-h-screen bg-[#F7EFEA] flex items-center justify-center p-6">
        <div className="w-32 opacity-75 animate-pulse">
          <img
            src={BRAND_INFO.logoPath}
            alt="Mía Store"
            className="w-full h-auto object-contain mix-blend-multiply"
          />
        </div>
      </div>
    );
  }

  if (legalDoc) {
    return <LegalPage docType={legalDoc} onClose={handleCloseLegal} />;
  }

  if (isComingSoon && !isAdmin) {
    return <ComingSoonPage />;
  }

  if (view === 'admin' && isAdmin) {
    return <AdminDashboard onBackToStore={() => setView('store')} />;
  }

  return (
    <Storefront
      onOpenAdmin={() => setView('admin')}
      isComingSoonPreview={isComingSoon && isAdmin}
    />
  );
}

export default function App() {
  return (
    <StoreErrorBoundary>
      <StoreProvider>
        <MiaStoreRoot />
      </StoreProvider>
    </StoreErrorBoundary>
  );
}
