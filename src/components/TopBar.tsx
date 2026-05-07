'use client';

import { useTheme } from './ThemeProvider';

export default function TopBar({ title }: { title?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 border-b border-card-border flex items-center justify-between px-6 bg-sidebar">
      <div className="flex items-center gap-4">
        {title && (
          <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">
            {title}
          </h1>
        )}
      </div>
      <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-card transition-colors text-muted hover:text-foreground"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
        {/* Notification bell */}
        <button className="p-2 rounded-lg hover:bg-card transition-colors text-muted hover:text-foreground relative">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full"></span>
        </button>
      </div>
    </header>
  );
}
