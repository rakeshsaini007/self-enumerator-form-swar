export type WorkspaceTab = 'entry' | 'sheet' | 'setup';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onResetAction: () => void;
  onOpenMobileMenu: () => void;
}

const TAB_TITLES: Record<WorkspaceTab, string> = {
  entry: 'Self-Enumeration Entry',
  sheet: 'Master Data Sheet',
  setup: 'Apps Script Setup',
};

export function TopBar({
  activeTab,
  onSelectTab,
  onResetAction,
  onOpenMobileMenu,
}: TopBarProps) {
  void onSelectTab;
  void onResetAction;
  void onOpenMobileMenu;

  return (
    <header className="bg-white border-b border-slate-200 px-3.5 sm:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-semibold text-slate-900 whitespace-nowrap truncate">
          MASTER DATA / {TAB_TITLES[activeTab]}
        </span>
      </div>
    </header>
  );
}
