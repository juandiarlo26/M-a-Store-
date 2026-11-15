import React, { useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { AdminDashboard } from './components/AdminDashboard';
import { Storefront } from './components/Storefront';

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
  const { isAdmin } = useStore();
  const [view, setView] = useState<'store' | 'admin'>('store');

  if (view === 'admin' && isAdmin) {
    return <AdminDashboard onBackToStore={() => setView('store')} />;
  }

  return <Storefront onOpenAdmin={() => setView('admin')} />;
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
