/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  semi: true,
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  singleAttributePerLine: true,
  trailingComma: 'all',

  plugins: ['@ianvs/prettier-plugin-sort-imports'],

  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  importOrderTypeScriptVersion: '5.9.2',
  importOrder: [
    '<TYPES>^node:',
    '<TYPES>^@kaira/',
    '<TYPES>^@/',
    '<TYPES>^[.]',
    '<TYPES>',
    '',

    // Built-in and third-party modules
    '^node:',
    '<BUILTIN_MODULES>',
    '<THIRD_PARTY_MODULES>',
    '',

    // Kaira packages
    '^@kaira/chat-core',
    '^@kaira/',
    '',

    '^@/',
    '',

    '^[./]',
  ],
};

export default config;
