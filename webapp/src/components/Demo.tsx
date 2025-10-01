import React from 'react';
import { FilePreview } from './FilePreview';

/**
 * Demo page with 2 example files (markdown and ASCII/text)
 */
export const Demo: React.FC = () => {
  const demoFiles = [
    {
      id: 'demo-architecture',
      title: 'architecture-overview.md',
      // Using blob URL from real UBS RED analysis
      url: 'https://agenticwafartifactsthkyg.blob.core.windows.net/final-artifacts/web-1759344628762/architecture-overview.md?sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2025-11-05T20:22:36Z&st=2025-10-01T11:07:36Z&spr=https&sig=bzWcMIfFLEllHp6ONjYCR9MNduV3SHNCSptagIyB6H8%3D',
      kind: 'markdown' as const,
    },
    {
      id: 'demo-diagram',
      title: 'architecture-diagram.txt',
      // Using ASCII diagram from real analysis
      url: 'https://agenticwafartifactsthkyg.blob.core.windows.net/final-artifacts/web-1759344628762/architecture-diagrams-formatted.md?sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2025-11-05T20:22:36Z&st=2025-10-01T11:07:36Z&spr=https&sig=bzWcMIfFLEllHp6ONjYCR9MNduV3SHNCSptagIyB6H8%3D',
      kind: 'ascii' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-8" style={{ fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Azure Well-Architected Framework Analysis
          </h1>
          <p className="text-gray-600">
            Real analysis from our AI agents showcasing production capabilities.
          </p>
        </div>

        {/* File Preview Component */}
        <FilePreview files={demoFiles} initialId="demo-architecture" />

        {/* Footer Info */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">💡 Demo Features</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>✅ <strong>Markdown Rendering:</strong> react-markdown + remark-gfm with DOMPurify sanitization</li>
            <li>✅ <strong>ASCII Terminal:</strong> xterm.js read-only terminal with Azure light theme (#0078D4)</li>
            <li>✅ <strong>Tabs:</strong> Preview | Raw toggle for viewing modes</li>
            <li>✅ <strong>Actions:</strong> Copy / Download / Open in new tab buttons</li>
            <li>✅ <strong>Styling:</strong> Tailwind CSS with Segoe UI font, Azure.com look</li>
            <li>✅ <strong>Optimized:</strong> xterm instance reused, content reloaded on file switch</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
