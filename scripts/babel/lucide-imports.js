// Plugin de Babel: `import { BookOpen } from 'lucide-react-native'` →
// `import BookOpen from 'lucide-react-native/icons/book-open'`.
// Metro no elimina los ~4.700 iconos no usados del índice del paquete (re-exportaciones en
// espacio de nombres); importar cada icono por separado reduce el bundle web y Android.
const fs = require('node:fs');
const path = require('node:path');

const ICONS = path.join(path.dirname(require.resolve('lucide-react-native')), '..', 'esm', 'icons');
// Mantiene los dígitos con el segmento anterior separados por guion (Link2 → link-2).
const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').replace(/([a-zA-Z])(\d)/g, '$1-$2').toLowerCase();

module.exports = function lucideImports({ types: t }) {
  return {
    name: 'nebula-lucide-imports',
    visitor: {
      ImportDeclaration(p) {
        if (p.node.source.value !== 'lucide-react-native' || p.node.importKind === 'type') return;
        const keep = [];
        const replacements = [];
        for (const s of p.node.specifiers) {
          if (!t.isImportSpecifier(s) || s.importKind === 'type') { keep.push(s); continue; }
          const imported = s.imported.name ?? s.imported.value;
          const file = kebab(imported);
          if (!fs.existsSync(path.join(ICONS, `${file}.mjs`))) {
            // Exportaciones que no son iconos (tipos, utilidades) se quedan en el índice.
            if (/^[A-Z]/.test(imported) && !/^(Lucide|Icon$|createLucideIcon)/.test(imported)) throw p.buildCodeFrameError(`Icono de lucide desconocido: ${imported} (${file})`);
            keep.push(s);
            continue;
          }
          replacements.push(t.importDeclaration([t.importDefaultSpecifier(t.identifier(s.local.name))], t.stringLiteral(`lucide-react-native/icons/${file}`)));
        }
        if (!replacements.length) return;
        if (keep.length) { p.node.specifiers = keep; p.insertAfter(replacements); } else p.replaceWithMultiple(replacements);
      },
    },
  };
};
module.exports.kebab = kebab;
