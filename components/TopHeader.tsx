'use client';

import React from 'react';
import { BookOpen, Cloud, ListTree, Sparkles, Files, Menu } from 'lucide-react';

export type WorkspaceTab = 'reader' | 'toc' | 'batch' | 'compiled';

interface TopHeaderProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  onOpenDriveModal: () => void;
  onOpenMobileToc?: () => void;
  translatedCount: number;
  totalPages: number;
  driveConnected: boolean;
}

export function TopHeader({
  activeTab,
  onTabChange,
  onOpenDriveModal,
  onOpenMobileToc,
  translatedCount,
  totalPages,
  driveConnected,
}: TopHeaderProps) {
  const navItems: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
    { id: 'reader', label: 'Ընթերցիչ', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'toc', label: 'Բովանդակություն', icon: <ListTree className="w-4 h-4" /> },
    { id: 'batch', label: 'Թարգմանել գիրքը', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'compiled', label: 'Ամբողջական գիրք', icon: <Files className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 no-print">
      <div className="h-14 px-4 lg:px-6 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onOpenMobileToc && (
            <button
              type="button"
              onClick={onOpenMobileToc}
              aria-label="Բացել բովանդակության վահանակը"
              className="lg:hidden p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-baseline gap-2.5 whitespace-nowrap shrink-0">
            <span className="font-editorial text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Հանրահաշիվ 8–9
            </span>
            <span className="hidden sm:inline text-xs text-slate-500 font-mono-tabular">
              {translatedCount} / {totalPages} էջ
            </span>
          </div>
        </div>

        {/* Zone 2 (Desktop): Navigation Links */}
        <nav
          aria-label="Հիմնական բաժիններ"
          className="hidden md:flex items-center gap-2"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenDriveModal}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium whitespace-nowrap shrink-0 bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-xs"
          >
            <Cloud className="w-4 h-4" />
            <span className="hidden sm:inline">
              {driveConnected ? 'Google Drive · Միացված' : 'Google Drive'}
            </span>
            <span className="sm:hidden">Drive</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Bar (prevents overlap with wordmark on 390px screens) */}
      <nav
        aria-label="Բջջային բաժիններ"
        className="md:hidden border-t border-slate-100 px-3 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={`mobile-${item.id}`}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
