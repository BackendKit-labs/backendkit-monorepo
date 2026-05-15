const KEYWORDS = new Set([
  'import', 'export', 'from', 'default', 'const', 'let', 'var',
  'async', 'await', 'return', 'if', 'else', 'new', 'class', 'extends',
  'implements', 'interface', 'type', 'function', 'void', 'private',
  'public', 'protected', 'readonly', 'static', 'abstract', 'this',
  'super', 'null', 'undefined', 'true', 'false', 'throw', 'try',
  'catch', 'finally', 'for', 'while', 'of', 'in', 'delete', 'typeof',
  'as', 'keyof', 'infer', 'constructor', 'override',
]);

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlight(code: string): string {
  let result = '';
  let i = 0;

  while (i < code.length) {
    const ch = code[i];

    // Block comment: /* ... */ and JSDoc /** ... */
    if (ch === '/' && code[i + 1] === '*') {
      let j = i + 2;
      while (j < code.length - 1 && !(code[j] === '*' && code[j + 1] === '/')) j++;
      j += 2; // step past the closing */
      result += `<span class="text-[#8b949e] italic">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    // Single-line comment
    if (ch === '/' && code[i + 1] === '/') {
      let j = i;
      while (j < code.length && code[j] !== '\n') j++;
      result += `<span class="text-[#8b949e] italic">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    // Decorator: @Identifier
    if (ch === '@' && i + 1 < code.length && /[a-zA-Z_$]/.test(code[i + 1])) {
      let j = i + 1;
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j])) j++;
      result += `<span class="text-[#d2a8ff]">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    // Template literal — handle ${...} inside
    if (ch === '`') {
      let j = i + 1;
      let inner = '`';
      while (j < code.length) {
        if (code[j] === '\\') { inner += esc(code.slice(j, j + 2)); j += 2; continue; }
        if (code[j] === '`') { inner += '`'; j++; break; }
        if (code[j] === '$' && code[j + 1] === '{') {
          // close the string span, open interpolation
          inner += `<span class="text-[#8b949e]">\${</span>`;
          j += 2;
          let depth = 1;
          let expr = '';
          while (j < code.length && depth > 0) {
            if (code[j] === '{') depth++;
            else if (code[j] === '}') { depth--; if (depth === 0) { j++; break; } }
            expr += code[j++];
          }
          inner += highlight(expr);
          inner += `<span class="text-[#8b949e]">}</span>`;
          continue;
        }
        inner += esc(code[j]);
        j++;
      }
      result += `<span class="text-[#a5d6ff]">${inner}</span>`;
      i = j;
      continue;
    }

    // String literal: single or double quote
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < code.length) {
        if (code[j] === '\\') { j += 2; continue; }
        if (code[j] === ch) { j++; break; }
        j++;
      }
      result += `<span class="text-[#a5d6ff]">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    // Number (including 10_000, 0.5, 0xff)
    if (ch >= '0' && ch <= '9') {
      let j = i;
      // hex prefix
      if (code[j] === '0' && (code[j + 1] === 'x' || code[j + 1] === 'X')) {
        j += 2;
        while (j < code.length && /[0-9a-fA-F_]/.test(code[j])) j++;
      } else {
        while (j < code.length && /[\d_.]/.test(code[j])) j++;
      }
      result += `<span class="text-[#f2cc60]">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    // Identifier
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j])) j++;
      const word = code.slice(i, j);

      if (KEYWORDS.has(word)) {
        result += `<span class="text-[#ff7b72]">${esc(word)}</span>`;
      } else if (/^[A-Z]/.test(word)) {
        // PascalCase → type/class
        result += `<span class="text-[#79c0ff]">${esc(word)}</span>`;
      } else {
        result += esc(word);
      }
      i = j;
      continue;
    }

    result += esc(ch);
    i++;
  }

  return result;
}
