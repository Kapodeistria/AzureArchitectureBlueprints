import { DocViewer } from './components/DocViewer';

// Export to window for global access
declare global {
  interface Window {
    DocViewer: typeof DocViewer;
  }
}

window.DocViewer = DocViewer;