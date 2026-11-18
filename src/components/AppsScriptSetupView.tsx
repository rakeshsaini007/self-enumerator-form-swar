import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import codeJsSource from '../../code.js?raw';
import {
  GAS_WEB_APP_URL,
  getEffectiveGasUrl,
  getGasUrlOverride,
  isValidGasUrl,
  setGasUrlOverride,
} from '../config';
import { checkGasHealth } from '../services/gasService';

interface AppsScriptSetupViewProps {
  onUrlUpdated: () => void;
  isPreviewMode: boolean;
  onTogglePreviewMode: (enabled: boolean) => void;
}

export function AppsScriptSetupView({
  onUrlUpdated,
  isPreviewMode,
  onTogglePreviewMode,
}: AppsScriptSetupViewProps) {
  const [urlInput, setUrlInput] = useState(
    () => getGasUrlOverride() || (isValidGasUrl(GAS_WEB_APP_URL) ? GAS_WEB_APP_URL : '')
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const effectiveUrl = getEffectiveGasUrl();
  const hasCodeUrl = isValidGasUrl(GAS_WEB_APP_URL);
  const hasActiveUrl = isValidGasUrl(effectiveUrl);

  async function handleTestAndSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!isValidGasUrl(trimmed)) {
      setTestResult({
        ok: false,
        message:
          'Enter a valid Google Apps Script Web App URL starting with https://script.google.com/macros/s/...',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const health = await checkGasHealth(trimmed);
      if (!health.ok) {
        setTestResult({
          ok: false,
          message: health.error || 'Apps Script responded with an error.',
        });
        return;
      }

      setGasUrlOverride(trimmed);
      onTogglePreviewMode(false);
      onUrlUpdated();
      setTestResult({
        ok: true,
        message: `Connected to sheet "${health.sheetName}" (${health.totalRows ?? 0} data rows found).`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Unable to reach Google Apps Script URL.',
      });
    } finally {
      setTesting(false);
    }
  }

  function handleClearOverride() {
    setGasUrlOverride('');
    setUrlInput(hasCodeUrl ? GAS_WEB_APP_URL : '');
    setTestResult(null);
    onUrlUpdated();
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(codeJsSource);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setTestResult({
        ok: false,
        message: 'Clipboard permission denied. Select and copy the code manually.',
      });
    }
  }

  function handleDownloadCode() {
    const blob = new Blob([codeJsSource], { type: 'text/javascript;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'code.js';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Google Apps Script Setup (code.js)
        </h1>
        <p className="text-sm text-slate-600 mt-1.5 max-w-2xl">
          Deploy <span className="font-mono text-slate-800">code.js</span> as a Web App inside your{' '}
          <span className="font-semibold text-slate-800">MASTER DATA</span> Google Sheet, then paste
          the deployment URL into <span className="font-mono text-slate-800">src/config.ts</span> or
          test it directly below.
        </p>
      </div>

      {/* Section 1: Manual URL Configuration */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              1. Web App Deployment URL
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Permanent configuration lives in{' '}
              <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                src/config.ts
              </code>{' '}
              as <code className="font-mono text-slate-800">GAS_WEB_APP_URL</code>.
            </p>
          </div>
          <div className="text-xs font-medium">
            {hasActiveUrl ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                Live URL Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-700">
                <AlertCircle className="w-4 h-4" />
                Not Configured Yet
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleTestAndSave} className="space-y-4">
          <div>
            <label
              htmlFor="gas-url-input"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Google Apps Script Web App URL (ends with /exec)
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="gas-url-input"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
              <button
                type="submit"
                disabled={testing}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-800 hover:bg-blue-900 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
                {testing ? 'Testing...' : 'Test & Connect'}
              </button>
            </div>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2.5 p-3.5 rounded-lg border text-sm ${
                testResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Code constant:{' '}
                <code className="font-mono text-slate-800">
                  {hasCodeUrl ? 'Configured in src/config.ts' : 'Placeholder in src/config.ts'}
                </code>
              </span>
              {getGasUrlOverride() && (
                <button
                  type="button"
                  onClick={handleClearOverride}
                  className="text-blue-700 hover:underline font-medium"
                >
                  Reset browser URL override
                </button>
              )}
            </div>

            {!hasActiveUrl && (
              <button
                type="button"
                onClick={() => onTogglePreviewMode(!isPreviewMode)}
                className="text-blue-800 hover:text-blue-950 font-semibold underline underline-offset-2"
              >
                {isPreviewMode
                  ? 'Disable Local Preview Sheet'
                  : 'Enable Local Preview Sheet (test form before deploying)'}
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Section 2: Deployment Steps */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          2. Deployment Checklist for Google Sheets
        </h2>
        <ol className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
          <li className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <p className="font-semibold text-slate-900">01. Open Apps Script Editor</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Open your Google Sheet containing the tab named{' '}
              <span className="font-semibold">MASTER DATA</span>. Click{' '}
              <span className="font-medium">Extensions → Apps Script</span>.
            </p>
          </li>
          <li className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <p className="font-semibold text-slate-900">02. Paste code.js</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Delete any default <span className="font-mono">myFunction</span> code in{' '}
              <span className="font-mono">Code.gs</span> and paste the full{' '}
              <span className="font-mono">code.js</span> script below. Save the project.
            </p>
          </li>
          <li className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <p className="font-semibold text-slate-900">03. Deploy as Web App</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Click <span className="font-medium">Deploy → New deployment</span>. Choose type{' '}
              <span className="font-medium">Web app</span>, set{' '}
              <span className="font-medium">Execute as: Me</span>, and{' '}
              <span className="font-medium">Who has access: Anyone</span>.
            </p>
          </li>
          <li className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <p className="font-semibold text-slate-900">04. Paste /exec URL Manually</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Authorize permissions, copy the generated <span className="font-mono">/exec</span> URL,
              and paste it into <span className="font-mono">src/config.ts</span> (or test above).
            </p>
          </li>
        </ol>
      </section>

      {/* Section 3: code.js Source Viewer */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-base font-semibold text-slate-900 font-mono">code.js</h2>
            <p className="text-xs text-slate-500">
              Complete Google Apps Script server handler for MASTER DATA
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Download code.js
            </button>
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy code.js
                </>
              )}
            </button>
          </div>
        </div>
        <div className="max-h-[460px] overflow-auto bg-slate-950 p-5">
          <pre className="text-xs leading-relaxed font-mono text-slate-200 whitespace-pre">
            <code>{codeJsSource}</code>
          </pre>
        </div>
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Supports GET (?action=lookup, list, health) and POST (text/plain JSON update with LockService)
          </span>
          <a
            href="https://script.google.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium whitespace-nowrap"
          >
            Open Apps Script
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </section>
    </div>
  );
}
