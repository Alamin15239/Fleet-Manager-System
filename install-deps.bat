@echo off
echo Installing document management dependencies...
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
npm install react-data-grid xlsx puppeteer react-pdf
npm install @types/puppeteer
echo Dependencies installed successfully!
pause