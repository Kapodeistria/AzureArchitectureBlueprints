import React from 'react';
import { FilePreview } from './FilePreview';

/**
 * Example usage of FilePreview component
 */
export const FilePreviewExample: React.FC = () => {
  const sampleFiles = [
    {
      id: 'arch-overview',
      title: 'architecture-overview.md',
      url: 'https://agenticwafartifactsthkyg.blob.core.windows.net/final-artifacts/web-1759344628762/architecture-overview.md?sv=...',
      kind: 'markdown' as const,
    },
    {
      id: 'security-analysis',
      title: 'security-analysis.md',
      url: 'https://agenticwafartifactsthkyg.blob.core.windows.net/final-artifacts/web-1759344628762/security-analysis.md?sv=...',
      kind: 'markdown' as const,
    },
    {
      id: 'architecture-diagram',
      title: 'architecture-diagrams-formatted.md',
      url: 'https://agenticwafartifactsthkyg.blob.core.windows.net/final-artifacts/web-1759344628762/architecture-diagrams-formatted.md?sv=...',
      kind: 'ascii' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-semibold text-gray-900 mb-6" style={{ fontFamily: 'Segoe UI, sans-serif' }}>
          Azure Well-Architected Framework Analysis
        </h1>

        <FilePreview files={sampleFiles} initialId="arch-overview" />
      </div>
    </div>
  );
};
