import React from 'react';
import ReactDOM from 'react-dom/client';
import { FilePreview } from './FilePreview';
import { DocViewer } from './DocViewer';

interface FileItem {
  id: string;
  title: string;
  url: string;
  kind: 'markdown' | 'ascii';
}

// Global function to show file preview modal
declare global {
  interface Window {
    showFilePreviewModal: (files: FileItem[], initialId: string) => void;
    closeFilePreviewModal: () => void;
    DocViewer: typeof DocViewer;
  }
}

let root: ReactDOM.Root | null = null;
let modalContainer: HTMLDivElement | null = null;

// Initialize modal container
function initModalContainer() {
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'react-file-preview-modal';
    modalContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 10000;
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;
    document.body.appendChild(modalContainer);

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalContainer && modalContainer.style.display === 'flex') {
        window.closeFilePreviewModal();
      }
    });

    // Close on click outside
    modalContainer.addEventListener('click', (e) => {
      if (e.target === modalContainer) {
        window.closeFilePreviewModal();
      }
    });
  }

  return modalContainer;
}

// Show modal
window.showFilePreviewModal = (files: FileItem[], initialId: string) => {
  const container = initModalContainer();

  if (!root) {
    root = ReactDOM.createRoot(container);
  }

  root.render(
    <div style={{ maxWidth: '1200px', width: '100%', maxHeight: '90vh' }}>
      <FilePreview files={files} initialId={initialId} />
    </div>
  );

  container.style.display = 'flex';
};

// Close modal
window.closeFilePreviewModal = () => {
  if (modalContainer) {
    modalContainer.style.display = 'none';
  }
};

// Expose DocViewer as global
window.DocViewer = DocViewer;

// Export for module usage (optional)
export { initModalContainer };
