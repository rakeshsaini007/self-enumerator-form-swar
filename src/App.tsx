import { useState } from 'react';
import { getEffectiveGasUrl, isValidGasUrl } from './config';
import { PREVIEW_MASTER_ROWS } from './data/previewSheet';
import { MasterRecord } from './types/masterData';
import { Sidebar, WorkspaceTab } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { EntryFormView } from './components/EntryFormView';
import { MasterSheetView } from './components/MasterSheetView';
import { AppsScriptSetupView } from './components/AppsScriptSetupView';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('entry');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [urlVersion, setUrlVersion] = useState(0);
  const effectiveUrl = getEffectiveGasUrl();
  const isLiveConnected = isValidGasUrl(effectiveUrl);

  // Local Preview Mode defaults to false if live URL is configured, and can be toggled when unconfigured
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewRows, setPreviewRows] = useState<MasterRecord[]>(PREVIEW_MASTER_ROWS);

  const [preselectedRecord, setPreselectedRecord] = useState<MasterRecord | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [createSignal, setCreateSignal] = useState(0);

  // Reference urlVersion to keep state reactive after URL override changes
  void urlVersion;

  function handleUrlUpdated() {
    setUrlVersion((v) => v + 1);
  }

  function handleUpdatePreviewRow(updated: MasterRecord) {
    setPreviewRows((prev) =>
      prev.map((row) =>
        row.rowIndex === updated.rowIndex || row.mobile === updated.mobile
          ? {
              ...row,
              fatherHusbandName: updated.fatherHusbandName,
              ehrmsCode: updated.ehrmsCode,
              village: updated.village,
              seId: updated.seId,
              seDate: updated.seDate,
              doneBy: updated.doneBy,
              submittedAt: updated.submittedAt,
            }
          : row
      )
    );
  }

  function handleAddPreviewRow(created: Omit<MasterRecord, 'rowIndex'>): MasterRecord {
    const nextRowIndex =
      previewRows.reduce((max, row) => Math.max(max, row.rowIndex), 1) + 1;
    const newRecord: MasterRecord = {
      rowIndex: nextRowIndex,
      ...created,
    };
    setPreviewRows((prev) => [...prev, newRecord]);
    return newRecord;
  }

  function handleEditRecordFromSheet(record: MasterRecord) {
    setPreselectedRecord(record);
    setActiveTab('entry');
  }

  function handleStartCreateEntry() {
    setPreselectedRecord(null);
    setCreateSignal((n) => n + 1);
    setActiveTab('entry');
  }

  function handleResetLookup() {
    setPreselectedRecord(null);
    setResetSignal((n) => n + 1);
    setActiveTab('entry');
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isLiveConnected={isLiveConnected}
        isPreviewMode={!isLiveConnected && isPreviewMode}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onResetAction={handleResetLookup}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-8">
          {activeTab === 'entry' && (
            <EntryFormView
              isLiveConnected={isLiveConnected}
              isPreviewMode={!isLiveConnected && isPreviewMode}
              previewRows={previewRows}
              onUpdatePreviewRow={handleUpdatePreviewRow}
              onAddPreviewRow={handleAddPreviewRow}
              onGoToSetup={() => setActiveTab('setup')}
              onEnablePreviewMode={() => setIsPreviewMode(true)}
              preselectedRecord={preselectedRecord}
              resetSignal={resetSignal}
              createSignal={createSignal}
            />
          )}

          {activeTab === 'sheet' && (
            <MasterSheetView
              isLiveConnected={isLiveConnected}
              isPreviewMode={!isLiveConnected && isPreviewMode}
              previewRows={previewRows}
              onEditRecord={handleEditRecordFromSheet}
              onCreateNewEntry={handleStartCreateEntry}
              onGoToSetup={() => setActiveTab('setup')}
              onEnablePreviewMode={() => setIsPreviewMode(true)}
            />
          )}

          {activeTab === 'setup' && (
            <AppsScriptSetupView
              onUrlUpdated={handleUrlUpdated}
              isPreviewMode={isPreviewMode}
              onTogglePreviewMode={setIsPreviewMode}
            />
          )}
        </main>
      </div>
    </div>
  );
}
