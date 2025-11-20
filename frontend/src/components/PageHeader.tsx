import React from 'react';

type PageHeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode; // SVG or any React node
  actions?: React.ReactNode; // Right-side buttons
  className?: string; // Extra classes for outer wrapper spacing
  variant?: 'default' | 'compact';
};

/**
 * PageHeader: unified "header pill" used across pages
 * Size system (fluid):
 * - Height: py-2.5 (sm), py-3 (md+)
 * - Icon container: 44/52/60px circle; icon 20/24/28px
 * - Title: text-2xl md:text-3xl; Subtitle: text-xs md:text-sm
 * - Colors: white pill, slate border, teal icon background
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  className = '',
  variant = 'default',
}) => {
  const isCompact = variant === 'compact';

  return (
    <div className={className}>
      <div className="p-1.5 bg-white rounded-full shadow-lg border border-slate-200/60 backdrop-blur-sm">
        <div className={`flex items-center gap-4 px-5 ${isCompact ? 'py-2' : 'py-3'}`}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`shrink-0 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white ring-4 ring-teal-50 shadow-md shadow-teal-500/30 ${
                isCompact
                  ? 'w-11 h-11'
                  : 'w-12 h-12 md:w-14 md:h-14'
              } flex items-center justify-center`}
            >
              {/* Icon slot with fluid sizing and centered alignment */}
              {icon ? (
                <div className={`flex items-center justify-center ${isCompact ? 'w-5 h-5' : 'w-6 h-6 md:w-7 md:h-7'}`}>{icon}</div>
              ) : (
                <svg className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6 md:w-7 md:h-7'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-4a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <h1 className={`truncate font-extrabold tracking-tight text-slate-900 ${isCompact ? 'text-xl' : 'text-2xl md:text-3xl'}`}>{title}</h1>
              {subtitle && (
                <div className={`text-slate-600 ${isCompact ? 'text-xs' : 'text-xs md:text-sm'}`}>{subtitle}</div>
              )}
            </div>
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
