import React from 'react';
import { useCommandCenter } from './hooks/useCommandCenter';
import { Sidebar, navItems } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardPage } from './pages/DashboardPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { FleetPage } from './pages/FleetPage';
import { InventoryPage } from './pages/InventoryPage';
import { DemandPage } from './pages/DemandPage';
import { OptimizationPage } from './pages/OptimizationPage';
import { DisruptionsPage } from './pages/DisruptionsPage';
import { ResiliencePage } from './pages/ResiliencePage';
import { AICopilotPage } from './pages/AICopilotPage';
import { OperationalModeProvider } from './context/OperationalModeContext';
import { ConnectivityProvider } from './context/ConnectivityContext';
import { DemoFlowProvider } from './context/DemoFlowContext';
import { OfflineNotificationBanner } from './components/OfflineNotificationBanner';
import { HackathonDemoBar } from './components/HackathonDemoBar';
import { DemoDisruptionAlertBanner } from './components/DemoDisruptionAlertBanner';
import { DemoReoptimizationStepper } from './components/DemoReoptimizationStepper';

export const App: React.FC = () => {
  const {
    activeTab,
    sidebarCollapsed,
    mobileMenuOpen,
    audioAlerts,
    selectTab,
    toggleSidebar,
    toggleMobileMenu,
    closeMobileMenu,
    toggleAudioAlerts,
  } = useCommandCenter();

  // Find active navigation item configuration
  const currentNavItem = navItems.find((item) => item.id === activeTab) || navItems[0];

  // Render active page component based on sidebar selection
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'live-map':
        return <LiveMapPage />;
      case 'fleet':
        return <FleetPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'demand':
        return <DemandPage />;
      case 'optimization':
        return <OptimizationPage />;
      case 'disruptions':
        return <DisruptionsPage />;
      case 'resilience':
        return <ResiliencePage />;
      case 'ai-copilot':
        return <AICopilotPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <ConnectivityProvider>
      <OperationalModeProvider>
        <DemoFlowProvider>
          <div className="flex h-screen w-screen overflow-hidden bg-command-bg text-slate-100 font-sans">
            {/* Sidebar Navigation */}
            <Sidebar
              activeTab={activeTab}
              onSelectTab={selectTab}
              collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebar}
              mobileOpen={mobileMenuOpen}
              onCloseMobile={closeMobileMenu}
            />

            {/* Main Command Center Shell Area */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
              {/* Top Status Bar */}
              <TopBar
                onToggleMobileMenu={toggleMobileMenu}
                audioAlerts={audioAlerts}
                onToggleAudio={toggleAudioAlerts}
                activeTabTitle={currentNavItem.label}
              />

              {/* Dynamic Main Content Viewport */}
              <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-slate-950/40 tactical-grid pb-24">
                <div className="max-w-7xl mx-auto space-y-4">
                  <OfflineNotificationBanner />
                  <DemoDisruptionAlertBanner />
                  <DemoReoptimizationStepper />
                  {renderContent()}
                </div>
              </main>

              {/* Hackathon Demo Tactical HUD Controller (BLOCK 20) */}
              <HackathonDemoBar />
            </div>
          </div>
        </DemoFlowProvider>
      </OperationalModeProvider>
    </ConnectivityProvider>
  );
};

export default App;
