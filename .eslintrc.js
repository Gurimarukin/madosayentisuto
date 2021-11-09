module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['functional', 'fp-ts'],
  extends: [
    'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    'plugin:functional/recommended',
    'plugin:fp-ts/all',
    'prettier/@typescript-eslint', // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
  ],
  reportUnusedDisableDirectives: true,
  rules: {
    '@typescript-eslint/array-type': ['warn', { default: 'array', readonly: 'generic' }],
    '@typescript-eslint/consistent-type-definitions': 'off', // use functional/prefer-type-literal, it's better
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      { prefer: 'type-imports', disallowTypeAnnotations: false },
    ],
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
      },
    ],
    '@typescript-eslint/no-base-to-string': [
      'error',
      {
        ignoredTypeNames: [
          'APIInteractionDataResolvedChannel',
          'APIRole',
          'GuildChannel',
          'Role',
          'ThreadChannel',
        ],
      },
    ],
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-namespace': 'warn',
    '@typescript-eslint/no-restricted-imports': [
      'warn',
      {
        patterns: [{ group: ['./*'] }, { group: ['../*'] }],
      },
    ],
    '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'warn',
    '@typescript-eslint/no-unnecessary-condition': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/strict-boolean-expressions': [
      'warn',
      {
        allowString: false,
        allowNumber: false,
        allowNullableObject: false,
      },
    ],
    'arrow-parens': ['warn', 'as-needed'],
    'arrow-body-style': ['warn', 'as-needed'],
    'array-callback-return': 'off',
    'comma-dangle': [
      'warn',
      {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'always-multiline',
      },
    ],
    eqeqeq: ['error', 'always'],
    'fp-ts/no-module-imports': ['warn', { allowTypes: true }],
    'functional/functional-parameters': [
      'error',
      {
        allowRestParameter: true,
        enforceParameterCount: false,
      },
    ],
    'functional/no-conditional-statement': 'off', // switch aren't bad :/
    'functional/no-expression-statement': [
      'error',
      {
        ignorePattern: [
          '^afterEach\\(',
          '^beforeEach\\(',
          '^console\\.',
          '^describe(\\.only)?\\(',
          '^expect(\\.only)?\\(',
          '^it(\\.only)?\\(',
        ],
      },
    ],
    'functional/no-mixed-type': 'off',
    'functional/no-promise-reject': 'error',
    'max-len': [
      'warn',
      {
        code: 100,
        tabWidth: 2,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreComments: true,
      },
    ],
    'no-console': 'off',
    'no-empty-function': 'off',
    'no-inner-declarations': 'off',
    'no-multiple-empty-lines': ['warn', { max: 1 }],
    'no-multi-spaces': 'warn',
    'no-redeclare': 'off',
    'no-restricted-imports': 'off',
    'no-shadow': ['warn', { builtinGlobals: true, hoist: 'functions' }],
    'no-undef': 'off',
    'no-unneeded-ternary': 'warn',
    'no-use-before-define': 'off',
    'no-useless-computed-key': 'warn',
    'no-useless-rename': 'warn',
    'object-shorthand': 'warn',
    'prettier/prettier': 'off',
    quotes: ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
    'sort-imports': [
      'warn',
      {
        ignoreCase: false,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        allowSeparatedGroups: true,
      },
    ],
    'space-in-parens': ['warn', 'never'],
    strict: 'warn',
  },
}
