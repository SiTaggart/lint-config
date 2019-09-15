module.exports = {
  parser: 'babel-eslint',
  plugins: ['prettier', 'cypress', 'eslint-comments', 'jest', 'promise', 'unicorn'],
  extends: [
    'standard',
    'standard-jsx',
    'prettier',
    'prettier/standard',
    'plugin:eslint-comments/recommended',
    'plugin:jest/recommended',
    'plugin:promise/recommended',
    'plugin:unicorn/recommended',
  ],
  rules: {
    'prettier/prettier': 'error',
  },
  env: {
    browser: true,
    jest: true,
    node: true,
    'cypress/globals': true,
  },
}
