// eslint-disable-next-line unicorn/prefer-module
module.exports = {
  parser: '@babel/eslint-parser',
  plugins: ['prettier', 'eslint-comments', 'jest', 'promise', 'unicorn', 'jsx-a11y', 'react-hooks'],
  extends: [
    'standard',
    'standard-jsx',
    'airbnb',
    'plugin:eslint-comments/recommended',
    'plugin:jest/recommended',
    'plugin:promise/recommended',
    'plugin:unicorn/recommended',
    'plugin:react/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:cypress/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    'arrow-body-style': ['error', 'as-needed'],
    'comma-dangle': ['error', 'only-multiline'],
    'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
    'import/no-extraneous-dependencies': [
      'error',
      { devDependencies: ['**/__tests__/**/*', 'jest.setup.js', '**/cypress/**/*'] },
    ],
    eqeqeq: ['error', 'smart'],
    'no-plusplus': 'off',
    'prettier/prettier': 'error',
    'unicorn/prevent-abbreviations': 'off',
    'import/prefer-default-export': 'off',
    'import/no-default-export': 'error',
    'jsx-quotes': ['error', 'prefer-double'],
    'react/no-unused-prop-types': [2],
    'react/jsx-sort-props': [2],
    'react/jsx-filename-extension': 'off',
    // deprecated rule
    'jsx-a11y/label-has-for': 'off',
    'jsx-a11y/label-has-associated-control': [
      2,
      {
        assert: 'either',
        depth: 3,
      },
    ],
  },
  env: {
    browser: true,
    jest: true,
    node: true,
    'cypress/globals': true,
  },
};
