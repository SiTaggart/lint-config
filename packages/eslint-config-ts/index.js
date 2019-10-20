module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'airbnb-typescript',
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
  ],
  rules: {
    'arrow-parens': [
      'error',
      'as-needed',
      {
        requireForBlockBody: false,
      },
    ],
    'arrow-body-style': ['error', 'as-needed'],
    'comma-dangle': ['error', 'only-multiline'],
    'prettier/prettier': ['error', { parser: 'typescript' }],
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
  },
};
