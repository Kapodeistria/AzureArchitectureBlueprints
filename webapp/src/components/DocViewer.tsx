import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Terminal } from 'xterm';
import DOMPurify from 'dompurify';
import 'xterm/css/xterm.css';

interface FileItem {
  id: string;
  name: string;
  url: string;
  size?: number;
}

interface DocViewerProps {
  files: FileItem[];
  initialId?: string;
}

export const DocViewer: React.FC<DocViewerProps> = ({ files, initialId }) => {
  const [activeFileId, setActiveFileId] = useState<string>(initialId || files[0]?.id);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const previousFileId = useRef<string | null>(null);

  const activeFile = files.find(f => f.id === activeFileId);

  // Determine file type from extension
  const getFileType = (filename: string): 'markdown' | 'ascii' | 'raw' => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'md') return 'markdown';
    if (ext === 'txt' || ext === 'ascii' || filename.includes('ascii')) return 'ascii';
    return 'raw';
  };

  const fileType = activeFile ? getFileType(activeFile.name) : 'raw';

  // Fetch file content
  useEffect(() => {
    if (!activeFile) return;

    const fetchContent = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(activeFile.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const text = await response.text();

        // Sanitize markdown content
        const sanitizedContent = fileType === 'markdown'
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
  }, [activeFile, fileType]);

  // Cleanup terminal on unmount
  useEffect(() => {
    return () => {
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
        terminalInstance.current = null;
      }
    };
  }, []);

  // Initialize or update terminal for ASCII files
  useEffect(() => {
    if (fileType !== 'ascii' || !terminalRef.current || !content) {
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
    if (previousFileId.current !== activeFileId && terminalInstance.current) {
      terminalInstance.current.reset();
      terminalInstance.current.write(content);
      previousFileId.current = activeFileId;
    }
  }, [fileType, content, activeFileId]);

  // Get file icon
  const getFileIcon = (filename: string): string => {
    if (filename.includes('architecture')) return '📝';
    if (filename.includes('security')) return '🔒';
    if (filename.includes('reliability')) return '⚡';
    if (filename.includes('performance')) return '🚀';
    if (filename.includes('cost')) return '💰';
    if (filename.includes('operational')) return '⚙️';
    if (filename.includes('diagram')) return '📐';
    if (filename.endsWith('.md')) return '📄';
    if (filename.endsWith('.txt')) return '📋';
    return '📎';
  };

  if (!files || files.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No files available</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden" style={{ fontFamily: 'Segoe UI, system-ui, sans-serif', minHeight: '600px' }}>
      {/* Left Sidebar - File List */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h3 className="font-semibold text-gray-900">Generated Files</h3>
          <p className="text-xs text-gray-600 mt-1">{files.length} files</p>
        </div>
        <div className="p-2">
          {files.map(file => (
            <button
              key={file.id}
              onClick={() => setActiveFileId(file.id)}
              className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors ${
                activeFileId === file.id
                  ? 'bg-[#0078d4] text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">{getFileIcon(file.name)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{file.name}</div>
                  {file.size && (
                    <div className="text-xs opacity-75 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Panel - File Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{activeFile && getFileIcon(activeFile.name)}</span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {activeFile?.name || 'No file selected'}
                </h2>
                <p className="text-sm text-gray-600">
                  {fileType === 'markdown' && '📝 Markdown Document'}
                  {fileType === 'ascii' && '📐 ASCII Art / Terminal Output'}
                  {fileType === 'raw' && '📄 Plain Text'}
                </p>
              </div>
            </div>
            {activeFile && (
              <div className="flex gap-2">
                <a
                  href={activeFile.url}
                  download={activeFile.name}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  ⬇️ Download
                </a>
                <a
                  href={activeFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-sm font-medium text-[#0078d4] bg-white border border-[#0078d4] rounded hover:bg-blue-50 transition-colors"
                >
                  🔗 Open
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0078d4]"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-red-800 font-semibold mb-2">Failed to load file</h3>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && content && (
            <>
              {/* Markdown Preview */}
              {fileType === 'markdown' && (
                <div className="prose prose-azure max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ node, children, ...props }) => (
                        <h1 className="text-3xl font-semibold text-gray-900 mb-4 mt-6 pb-2 border-b border-gray-200" {...props}>
                          {children}
                        </h1>
                      ),
                      h2: ({ node, children, ...props }) => (
                        <h2 className="text-2xl font-semibold text-gray-900 mb-3 mt-5 pb-2 border-b border-gray-200" {...props}>
                          {children}
                        </h2>
                      ),
                      h3: ({ node, children, ...props }) => (
                        <h3 className="text-xl font-semibold text-gray-900 mb-2 mt-4" {...props}>
                          {children}
                        </h3>
                      ),
                      p: ({ node, children, ...props }) => (
                        <p className="text-gray-700 mb-4 leading-relaxed" {...props}>{children}</p>
                      ),
                      a: ({ node, href, children, ...props }) => (
                        <a
                          href={href}
                          className="text-[#0078d4] hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                          {...props}
                        >
                          {children}
                        </a>
                      ),
                      code: ({ node, inline, className, children, ...props }) => {
                        const codeContent = typeof children === 'string' ? children : String(children);
                        return inline ? (
                          <code className="px-1.5 py-0.5 bg-gray-100 text-[#d73a49] rounded text-sm font-mono" {...props}>
                            {codeContent}
                          </code>
                        ) : (
                          <code className="block bg-gray-50 border border-gray-200 rounded p-4 overflow-x-auto text-sm font-mono text-gray-800" {...props}>
                            {children}
                          </code>
                        );
                      },
                      pre: ({ node, children, ...props }) => (
                        <pre className="bg-gray-50 border border-gray-200 rounded p-4 overflow-x-auto mb-4" {...props}>
                          {children}
                        </pre>
                      ),
                      table: ({ node, children, ...props }) => (
                        <div className="overflow-x-auto mb-4">
                          <table className="min-w-full border border-gray-300 rounded" {...props}>
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ node, children, ...props }) => (
                        <thead className="bg-gray-100" {...props}>{children}</thead>
                      ),
                      th: ({ node, children, ...props }) => (
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900 border-b border-gray-300" {...props}>
                          {children}
                        </th>
                      ),
                      td: ({ node, children, ...props }) => (
                        <td className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200" {...props}>
                          {children}
                        </td>
                      ),
                      ul: ({ node, children, ...props }) => (
                        <ul className="list-disc list-inside mb-4 space-y-2 text-gray-700" {...props}>
                          {children}
                        </ul>
                      ),
                      ol: ({ node, children, ...props }) => (
                        <ol className="list-decimal list-inside mb-4 space-y-2 text-gray-700" {...props}>
                          {children}
                        </ol>
                      ),
                      li: ({ node, children, ...props }) => (
                        <li className="ml-4" {...props}>{children}</li>
                      ),
                      blockquote: ({ node, children, ...props }) => (
                        <blockquote className="border-l-4 border-[#0078d4] pl-4 py-2 mb-4 italic text-gray-600 bg-blue-50" {...props}>
                          {children}
                        </blockquote>
                      ),
                      strong: ({ node, children, ...props }) => (
                        <strong className="font-semibold text-gray-900" {...props}>{children}</strong>
                      ),
                      em: ({ node, children, ...props }) => (
                        <em className="italic text-gray-700" {...props}>{children}</em>
                      ),
                    } as Components}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              )}

              {/* ASCII Terminal Preview */}
              {fileType === 'ascii' && (
                <div
                  ref={terminalRef}
                  className="bg-white rounded border border-gray-200 overflow-hidden"
                  style={{ minHeight: '500px' }}
                />
              )}

              {/* Raw Text Preview */}
              {fileType === 'raw' && (
                <pre className="bg-gray-50 border border-gray-200 rounded p-4 overflow-auto text-sm font-mono text-gray-800 whitespace-pre-wrap">
                  {content}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
