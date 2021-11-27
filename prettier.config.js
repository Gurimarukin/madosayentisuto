module.exports = {
  endOfLine: 'lf',
  printWidth: 100,
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'avoid',
  importOrder: [
    '<THIRD_PARTY_MODULES>',
    '^(\\.?\\.\\/)+(src/)?shared/(.*)$',
    '^(\\.?\\.\\/)+(src/)?bot/(.*)$',
    '^[./]',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
}
