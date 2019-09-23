module.exports = {
  printWidth: 100,
  trailingComma: 'es5',
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  jsxBracketSameLine: false,
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
