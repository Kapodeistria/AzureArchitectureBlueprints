# FilePreview Component

React TypeScript component for rendering Markdown and ASCII files with Azure.com Light Theme styling.

## Features

✨ **Dual File Type Support**
- 📝 **Markdown**: Full GFM support with links, tables, code blocks
- 📐 **ASCII**: Read-only terminal display with xterm.js

🎨 **Azure.com Light Theme**
- Segoe UI font family
- White background (#FFFFFF)
- Azure brand blue (#0078D4)
- Professional Microsoft design language

🔧 **Built-in Actions**
- 👁️ Preview / Raw tabs
- 📋 Copy to clipboard
- ⬇️ Download file
- 🔗 Open in new tab

📱 **Responsive Design**
- Tailwind CSS utility classes
- Horizontal scrolling tabs
- Maximum 70vh content area
- Overflow auto for long content

## Installation

### 1. Install Dependencies

```bash
npm install react-markdown remark-gfm xterm
npm install --save-dev @types/react @types/react-dom
```

### 2. Configure Tailwind CSS

Add to `tailwind.config.js`:

```js
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        'azure-blue': '#0078d4',
      },
      typography: {
        azure: {
          css: {
            '--tw-prose-body': '#323130',
            '--tw-prose-headings': '#323130',
            '--tw-prose-links': '#0078d4',
            '--tw-prose-bold': '#323130',
            '--tw-prose-code': '#d73a49',
            '--tw-prose-quotes': '#605e5c',
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
```

### 3. Install Tailwind Typography Plugin

```bash
npm install @tailwindcss/typography
```

### 4. Import xterm CSS

In your main `index.tsx` or `App.tsx`:

```tsx
import 'xterm/css/xterm.css';
```

## Usage

### Basic Example

```tsx
import { FilePreview } from './components/FilePreview';

function App() {
  const files = [
    {
      id: 'doc1',
      title: 'architecture-overview.md',
      url: 'https://example.com/file.md',
      kind: 'markdown'
    },
    {
      id: 'doc2',
      title: 'architecture-diagram.md',
      url: 'https://example.com/diagram.md',
      kind: 'ascii'
    }
  ];

  return <FilePreview files={files} initialId="doc1" />;
}
```

### With Azure Blob Storage

```tsx
const files = [
  {
    id: 'arch-overview',
    title: 'architecture-overview.md',
    url: 'https://storage.blob.core.windows.net/container/file.md?sv=...',
    kind: 'markdown'
  }
];

<FilePreview files={files} initialId="arch-overview" />
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `files` | `FileItem[]` | Array of file objects to display |
| `initialId` | `string` | ID of the file to show initially |

### FileItem Interface

```typescript
interface FileItem {
  id: string;           // Unique identifier
  title: string;        // Display name (shown in tab)
  url: string;          // Blob storage URL or HTTP endpoint
  kind: 'markdown' | 'ascii';  // File type
}
```

## Styling

The component uses Tailwind CSS for all styling with Azure design tokens:

- **Font**: Segoe UI (system fallback: system-ui, sans-serif)
- **Background**: White (#FFFFFF)
- **Brand Color**: Azure Blue (#0078D4)
- **Text Colors**: Gray scale (#323130, #605e5c, etc.)
- **Borders**: Gray-200 (#e5e7eb)

### Markdown Rendering

Markdown elements are styled with Azure.com light theme:

- **Headings**: Border bottom, semibold weight
- **Links**: Azure blue, hover underline
- **Code**: Inline (pink bg) and block (gray bg) styles
- **Tables**: Bordered with header background
- **Blockquotes**: Blue left border with light blue background

### ASCII Terminal

ASCII files render in xterm.js with Azure dark theme:

- **Background**: #1e1e1e
- **Foreground**: #d4d4d4
- **Cursor**: Azure blue (#0078d4)
- **Font**: Cascadia Code, monospace
- **Read-only**: No input, display only

## Component Structure

```
FilePreview
├── File Tabs (horizontal scroll)
├── Action Bar
│   ├── Preview/Raw toggle
│   └── Action buttons (Copy, Download, Open)
└── Content Area
    ├── Markdown Preview (react-markdown + remark-gfm)
    ├── ASCII Terminal (xterm.js)
    └── Raw Text View
```

## Error Handling

- Network errors show error banner with retry option
- Empty files display message
- Missing files show "File not found"
- CORS errors provide fallback "Open in new tab" link

## TypeScript

Full TypeScript support with strict typing:

```tsx
import { FilePreview } from './components/FilePreview';
import type { FileItem } from './components/FilePreview';
```

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires ES6+ support
- CSS Grid and Flexbox
- Clipboard API for copy functionality

## License

MIT
