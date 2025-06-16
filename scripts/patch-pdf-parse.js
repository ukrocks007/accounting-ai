#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const pdfParseIndexPath = path.join(__dirname, '..', 'node_modules', 'pdf-parse', 'index.js');

if (fs.existsSync(pdfParseIndexPath)) {
  let content = fs.readFileSync(pdfParseIndexPath, 'utf8');
  
  // Replace the problematic debug mode line
  content = content.replace(
    'let isDebugMode = !module.parent;',
    'let isDebugMode = false; // Disabled debug mode to prevent file not found errors'
  );
  
  fs.writeFileSync(pdfParseIndexPath, content);
  console.log('✅ pdf-parse patched successfully');
} else {
  console.log('⚠️  pdf-parse not found, skipping patch');
}
