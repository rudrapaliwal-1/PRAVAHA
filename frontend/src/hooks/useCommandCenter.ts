import { useState, useCallback, useEffect } from 'react';
import { NavigationTab, DEFCONLevel } from '../types';

export function useCommandCenter() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [defconLevel, setDefconLevel] = useState<DEFCONLevel>(2);
  const [audioAlerts, setAudioAlerts] = useState<boolean>(true);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const selectTab = useCallback((tab: NavigationTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  }, []);

  // Listen to navigation events from anywhere in the application
  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (e.detail) {
        selectTab(e.detail);
      }
    };
    window.addEventListener('missionpath:navigate', handleNavigate);
    return () => window.removeEventListener('missionpath:navigate', handleNavigate);
  }, [selectTab]);

  const toggleAudioAlerts = useCallback(() => {
    setAudioAlerts((prev) => !prev);
  }, []);

  return {
    activeTab,
    sidebarCollapsed,
    mobileMenuOpen,
    defconLevel,
    audioAlerts,
    selectTab,
    toggleSidebar,
    toggleMobileMenu,
    closeMobileMenu,
    setDefconLevel,
    toggleAudioAlerts,
  };
}
