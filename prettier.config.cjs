module.exports = {
  endOfLine: 'lf',
  printWidth: 100,
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'avoid',
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  importOrder: [
    '<THIRD_PARTY_MODULES>',
    '^(\\.?\\.\\/)+(src/)?shared/(.*)$',
    '^(\\.?\\.\\/)+(src/)?client/(.*)$',
    '^(\\.?\\.\\/)+(src/)?server/(.*)$',
    '^[./]',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
}
