const esbuild = require('esbuild');
const path = require('path');

// Plugin to replace React imports with global variables
const externalGlobalPlugin = {
  name: 'external-global',
  setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({
      path: 'react',
      namespace: 'external-global',
    }));
    build.onResolve({ filter: /^react-dom$/ }, () => ({
      path: 'react-dom',
      namespace: 'external-global',
    }));
    build.onLoad({ filter: /.*/, namespace: 'external-global' }, (args) => {
      if (args.path === 'react') {
        return { contents: 'module.exports = window.React', loader: 'js' };
      }
      if (args.path === 'react-dom') {
        return { contents: 'module.exports = window.ReactDOM', loader: 'js' };
      }
    });
  },
};

async function build() {
  try {
    await esbuild.build({
      entryPoints: ['src/filepreview-entry.tsx'],
      bundle: true,
      minify: true,
      sourcemap: true,
      format: 'iife',
      globalName: 'FilePreviewBundle',
      outfile: 'public/filepreview.bundle.js',
      jsx: 'automatic',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
      },
      plugins: [externalGlobalPlugin],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
    });

    console.log('✅ Build successful: public/filepreview.bundle.js');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
