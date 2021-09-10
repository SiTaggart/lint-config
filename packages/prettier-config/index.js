// eslint-disable-next-line unicorn/prefer-module
module.exports = {
  printWidth: 100,
  trailingComma: 'es5',
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  bracketSameLine: false,
  overrides: [
    {
      files: '**/*.scss',
      options: {
        singleQuote: false,
      },
    },
    {
      files: '*.yml',
      options: {
        parser: 'yaml',
        singleQuote: false,
      },
    },
  ],
};
