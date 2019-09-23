module.exports = {
  parser: 'babel-eslint',
  plugins: ['prettier', 'cypress', 'eslint-comments', 'jest', 'promise', 'unicorn'],
  extends: [
    'standard',
    'airbnb-base',
    'prettier',
    'prettier/standard',
    'plugin:eslint-comments/recommended',
    'plugin:jest/recommended',
    'plugin:promise/recommended',
    'plugin:unicorn/recommended',
  ],
  rules: {
    'arrow-parens': [
      'error',
      'as-needed',
      {
        requireForBlockBody: false,
      },
    ],
    'comma-dangle': ['error', 'only-multiline'],
    'prettier/prettier': 'error',
    'unicorn/prevent-abbreviations': 'off',
  },
  env: {
    browser: true,
    jest: true,
    node: true,
    'cypress/globals': true,
  },
};
