module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    project: './tsconfig.json'
  },
  extends: [
    'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    'prettier/@typescript-eslint', // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
    'plugin:prettier/recommended' // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
  ],
  reportUnusedDisableDirectives: true,
  rules: {
    '@typescript-eslint/array-type': [
      'error',
      {
        default: 'array',
        readonly: 'array'
      }
    ],
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_'
      }
    ],
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    'arrow-body-style': ['error', 'as-needed'],
    'array-callback-return': 'off',
    'comma-dangle': [
      'error',
      {
        arrays: 'never',
        objects: 'never',
        imports: 'never',
        exports: 'never',
        functions: 'never'
      }
    ],
    'max-len': [
      'error',
      {
        code: 100,
        tabWidth: 2
      }
    ],
    'no-console': 'off',
    'no-empty-function': 'off',
    'no-inner-declarations': 'off',
    'no-multiple-empty-lines': [
      'error',
      {
        max: 1
      }
    ],
    'no-multi-spaces': 'error',
    'no-redeclare': 'off',
    'no-shadow': 'off',
    'no-undef': 'off',
    'prettier/prettier': 'off',
    quotes: ['error', 'single'],
    'sort-imports': 'off',
    'space-in-parens': ['error', 'never'],
    strict: 'error'
  }
}
