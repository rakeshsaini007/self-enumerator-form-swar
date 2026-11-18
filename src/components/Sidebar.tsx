import { FileCode2, FileSpreadsheet, SearchCheck, X } from 'lucide-react';

export type WorkspaceTab = 'entry' | 'sheet' | 'setup';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  isLiveConnected: boolean;
  isPreviewMode: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: WorkspaceTab; label: string; sublabel: string; icon: typeof SearchCheck }[] = [
  {
    id: 'entry',
    label: 'Entry Form',
    sublabel: 'Lookup & Enumeration',
    icon: SearchCheck,
  },
  {
    id: 'sheet',
    label: 'Master Sheet',
    sublabel: 'MASTER DATA Records',
    icon: FileSpreadsheet,
  },
  {
    id: 'setup',
    label: 'Apps Script (code.js)',
    sublabel: 'Deployment & URL',
    icon: FileCode2,
  },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  isLiveConnected,
  isPreviewMode,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const connectionLabel = isLiveConnected
    ? 'Live Apps Script URL'
    : isPreviewMode
      ? 'Local Preview Sheet'
      : 'Setup Required';

  const connectionColor = isLiveConnected
    ? 'text-emerald-700'
    : isPreviewMode
      ? 'text-amber-700'
      : 'text-slate-600';

  const content = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200">
      <div>
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-200">
          <div>
            <p className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              MASTER DATA
            </p>
            <p className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">
              Basic Education Portal
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="p-3 space-y-1" aria-label="Workspace navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-blue-700' : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-sm whitespace-nowrap truncate">
                    {item.label}
                  </div>
                  <div className="text-xs font-normal text-slate-500 whitespace-nowrap truncate">
                    {item.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200 space-y-3">
        <div>
          <p className="text-xs font-medium text-slate-500">Data Source</p>
          <p className={`text-xs font-semibold mt-0.5 ${connectionColor}`}>
            {connectionLabel}
          </p>
        </div>
        <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-700">Input Rules</p>
          <p>Uppercase English A-Z only</p>
          <p className="font-mono text-[11px] text-slate-600 tabular-nums">
            SE ID: P + 11 digits
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-64 max-w-[80vw] h-full">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
