import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Edit3, Plus, RefreshCw, Search } from 'lucide-react';
import { MasterRecord } from '../types/masterData';
import { listMasterRecords } from '../services/gasService';

interface MasterSheetViewProps {
  isLiveConnected: boolean;
  isPreviewMode: boolean;
  previewRows: MasterRecord[];
  onEditRecord: (record: MasterRecord) => void;
  onCreateNewEntry: () => void;
  onGoToSetup: () => void;
  onEnablePreviewMode: () => void;
}

type StatusFilter = 'all' | 'completed' | 'pending';

export function MasterSheetView({
  isLiveConnected,
  isPreviewMode,
  previewRows,
  onEditRecord,
  onCreateNewEntry,
  onGoToSetup,
  onEnablePreviewMode,
}: MasterSheetViewProps) {
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  async function loadSheetRows() {
    if (isLiveConnected) {
      setLoading(true);
      setError(null);
      try {
        const res = await listMasterRecords('', 300);
        if (!res.ok) {
          setError(res.error || 'Failed to load MASTER DATA rows.');
          return;
        }
        setRecords(res.records || []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to fetch records from Google Apps Script.'
        );
      } finally {
        setLoading(false);
      }
    } else if (isPreviewMode) {
      setError(null);
      setRecords(previewRows);
    } else {
      setRecords([]);
    }
  }

  useEffect(() => {
    void loadSheetRows();
  }, [isLiveConnected, isPreviewMode, previewRows]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return records.filter((rec) => {
      const hasSeId = Boolean(rec.seId && rec.seId.trim());
      if (statusFilter === 'completed' && !hasSeId) return false;
      if (statusFilter === 'pending' && hasSeId) return false;

      if (!q) return true;
      const haystack = [
        rec.employeeName,
        rec.fatherHusbandName,
        rec.mobile,
        rec.ehrmsCode,
        rec.designation,
        rec.officeName,
        rec.village,
        rec.seId,
        rec.doneBy,
      ]
        .join(' ')
        .toUpperCase();
      return haystack.includes(q);
    });
  }, [records, searchQuery, statusFilter]);

  const completedCount = useMemo(
    () => records.filter((r) => Boolean(r.seId && r.seId.trim())).length,
    [records]
  );

  if (!isLiveConnected && !isPreviewMode) {
    return (
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
        <h1 className="text-xl font-bold text-slate-900">
          Connect MASTER DATA Sheet
        </h1>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          Configure your deployed Google Apps Script Web App URL to browse and filter all rows
          from your Google Sheet, or enable Local Preview to inspect sample records.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onEnablePreviewMode}
            className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Enable Local Preview
          </button>
          <button
            type="button"
            onClick={onGoToSetup}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors"
          >
            Setup Apps Script URL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Summary Strip */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            MASTER DATA Records
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Click <span className="font-medium text-slate-800">Fill / Edit</span> on any row to
            open it in the Entry Form.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4 text-xs text-slate-600 font-mono tabular-nums">
            <span>Total: {records.length}</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-700 font-semibold">
              Completed: {completedCount}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-700 font-semibold">
              Pending: {records.length - completedCount}
            </span>
          </div>
          <button
            type="button"
            onClick={onCreateNewEntry}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Create New Entry
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
            aria-label="Search records"
            className="w-full pl-9 pr-3 py-2 text-xs uppercase bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'All Rows' },
                { id: 'completed', label: 'SE ID Filled' },
                { id: 'pending', label: 'Pending' },
              ] as { id: StatusFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLiveConnected && (
            <button
              type="button"
              onClick={() => void loadSheetRows()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
          <span>{error}</span>
        </div>
      )}

      {/* High-Density Data Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-3 whitespace-nowrap">Row</th>
                <th className="py-3 px-3 whitespace-nowrap">कार्मिक का नाम</th>
                <th className="py-3 px-3 whitespace-nowrap">पिता/पति का नाम</th>
                <th className="py-3 px-3 whitespace-nowrap">मोबाइल नंबर</th>
                <th className="py-3 px-3 whitespace-nowrap">EHRMS CODE</th>
                <th className="py-3 px-3 whitespace-nowrap">लिंग</th>
                <th className="py-3 px-3 whitespace-nowrap">पदनाम</th>
                <th className="py-3 px-3 whitespace-nowrap">कार्यालय का नाम</th>
                <th className="py-3 px-3 whitespace-nowrap">स्व गणना स्थल/ ग्राम</th>
                <th className="py-3 px-3 whitespace-nowrap">स्व गणना आइडी(SE ID)</th>
                <th className="py-3 px-3 whitespace-nowrap">दिनांक</th>
                <th className="py-3 px-3 whitespace-nowrap">Timestamp</th>
                <th className="py-3 px-3 whitespace-nowrap text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="h-11">
                    <td colSpan={13} className="px-3 py-2">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 px-4 text-center text-slate-500">
                    No matching employee rows found in MASTER DATA.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr
                    key={rec.rowIndex}
                    className="h-10 hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {rec.rowIndex}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900 whitespace-nowrap">
                      {rec.employeeName}
                    </td>
                    <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                      {rec.fatherHusbandName || '—'}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      {rec.mobile}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {rec.ehrmsCode || '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                      {rec.gender}
                    </td>
                    <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                      {rec.designation}
                    </td>
                    <td className="py-2 px-3 text-slate-700 max-w-[240px] truncate">
                      {rec.officeName}
                    </td>
                    <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                      {rec.village || '—'}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                      {rec.seId ? (
                        <span className="font-semibold text-emerald-700">
                          {rec.seId}
                        </span>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {rec.seDate || '—'}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {rec.submittedAt || '—'}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onEditRecord(rec)}
                        className="inline-flex items-center gap-1 text-blue-800 hover:text-blue-950 font-semibold"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Fill / Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
