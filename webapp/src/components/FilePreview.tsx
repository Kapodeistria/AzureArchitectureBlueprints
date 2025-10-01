import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Terminal } from 'xterm';
import DOMPurify from 'dompurify';
import 'xterm/css/xterm.css';

interface FileItem {
  id: string;
  title: string;
  url: string;
  kind: 'markdown' | 'ascii';
}

interface FilePreviewProps {
  files: FileItem[];
  initialId?: string;
}

type TabMode = 'preview' | 'raw';

export const FilePreview: React.FC<FilePreviewProps> = ({ files, initialId }) => {
  const [currentFileId, setCurrentFileId] = useState<string>(initialId || files[0]?.id);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tabMode, setTabMode] = useState<TabMode>('preview');
  const [copied, setCopied] = useState<boolean>(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const previousFileId = useRef<string | null>(null);

  const currentFile = files.find(f => f.id === currentFileId);

  // Fetch file content
  useEffect(() => {
    if (!currentFile) return;

    const fetchContent = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(currentFile.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const text = await response.text();

        // Sanitize content if it's markdown
        const sanitizedContent = currentFile.kind === 'markdown'
          ? DOMPurify.sanitize(text, {
              ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img'],
              ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class']
            })
          : text;

        setContent(sanitizedContent);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
        setContent('');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [currentFile]);

  // Initialize or update terminal for ASCII files
  useEffect(() => {
    if (currentFile?.kind !== 'ascii' || tabMode !== 'preview' || !terminalRef.current || !content) {
      return;
    }

    // Initialize terminal once if not exists
    if (!terminalInstance.current) {
      const term = new Terminal({
        fontFamily: '"Cascadia Code", "Consolas", "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.4,
        theme: {
          background: '#ffffff',
          foreground: '#323130',
          cursor: '#0078d4',
          cursorAccent: '#ffffff',
          selectionBackground: '#add6ff',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#0078d4',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#323130',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#605e5c',
        },
        cursorBlink: false,
        disableStdin: true,
        allowProposedApi: true,
        convertEol: true,
      });

      term.open(terminalRef.current);
      terminalInstance.current = term;
    }

    // Update content if file changed
    if (previousFileId.current !== currentFileId && terminalInstance.current) {
      terminalInstance.current.reset();
      terminalInstance.current.write(content);
      previousFileId.current = currentFileId;
    }

    return () => {
      // Don't dispose terminal on cleanup - keep it for reuse
    };
  }, [currentFile, content, tabMode, currentFileId]);

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Download file
  const handleDownload = () => {
    if (!currentFile) return;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Open in new tab
  const handleOpenNewTab = () => {
    if (!currentFile) return;
    window.open(currentFile.url, '_blank');
  };

  if (!currentFile) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow-lg border border-gray-200">
        <p className="text-gray-500">File not found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden" style={{ fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      {/* File Tabs */}
      {files.length > 1 && (
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex overflow-x-auto">
            {files.map(file => (
              <button
                key={file.id}
                onClick={() => setCurrentFileId(file.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  currentFileId === file.id
                    ? 'bg-white text-[#0078d4] border-b-2 border-[#0078d4]'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {file.kind === 'markdown' ? '📝' : '📐'} {file.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Header with Tabs and Actions */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        {/* Tab Mode */}
        <div className="flex gap-2">
          <button
            onClick={() => setTabMode('preview')}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              tabMode === 'preview'
                ? 'bg-[#0078d4] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            👁️ Preview
          </button>
          <button
            onClick={() => setTabMode('raw')}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              tabMode === 'raw'
                ? 'bg-[#0078d4] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            📄 Raw
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            disabled={loading || !!error}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Copy to clipboard"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
          <button
            onClick={handleDownload}
            disabled={loading || !!error}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Download file"
          >
            ⬇️ Download
          </button>
          <button
            onClick={handleOpenNewTab}
            className="px-3 py-1.5 text-sm font-medium text-[#0078d4] bg-white border border-[#0078d4] rounded hover:bg-blue-50 transition-colors"
            title="Open in new tab"
          >
            🔗 Open
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6 overflow-auto bg-white" style={{ maxHeight: '70vh' }}>
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0078d4]"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-semibold mb-2">Failed to load file</h3>
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={handleOpenNewTab}
              className="mt-3 text-[#0078d4] hover:underline text-sm"
            >
              Try opening in new tab →
            </button>
          </div>
        )}

        {!loading && !error && content && (
          <>
            {/* Markdown Preview */}
            {currentFile.kind === 'markdown' && tabMode === 'preview' && (
              <div className="prose prose-azure max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-3xl font-semibold text-gray-900 mb-4 mt-6 pb-2 border-b border-gray-200">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-2xl font-semibold text-gray-900 mb-3 mt-5 pb-2 border-b border-gray-200">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-xl font-semibold text-gray-900 mb-2 mt-4">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-gray-700 mb-4 leading-relaxed">{children}</p>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        className="text-[#0078d4] hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),
                    code: ({ inline, children }: any) =>
                      inline ? (
                        <code className="px-1.5 py-0.5 bg-gray-100 text-[#d73a49] rounded text-sm font-mono">
                          {children}
                        </code>
                      ) : (
                        <code className="block bg-gray-50 border border-gray-200 rounded p-4 overflow-x-auto text-sm font-mono text-gray-800">
                          {children}
                        </code>
                      ),
                    pre: ({ children }) => (
                      <pre className="bg-gray-50 border border-gray-200 rounded p-4 overflow-x-auto mb-4">
                        {children}
                      </pre>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto mb-4">
                        <table className="min-w-full border border-gray-300 rounded">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-gray-100">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900 border-b border-gray-300">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
                        {children}
                      </td>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-4 space-y-2 text-gray-700">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-4 space-y-2 text-gray-700">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="ml-4">{children}</li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-[#0078d4] pl-4 py-2 mb-4 italic text-gray-600 bg-blue-50">
                        {children}
                      </blockquote>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-gray-900">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic text-gray-700">{children}</em>
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}

            {/* ASCII Terminal Preview (Azure Light Theme) */}
            {currentFile.kind === 'ascii' && tabMode === 'preview' && (
              <div
                ref={terminalRef}
                className="bg-white rounded border border-gray-200 overflow-hidden"
                style={{ minHeight: '400px' }}
              />
            )}

            {/* Raw View */}
            {tabMode === 'raw' && (
              <pre className="bg-gray-50 border border-gray-200 rounded p-4 overflow-auto text-sm font-mono text-gray-800 whitespace-pre-wrap">
                {content}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
};
