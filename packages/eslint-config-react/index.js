module.exports = {
  extends: [
    'standard-jsx',
    'airbnb',
    'plugin:react/recommended',
    'prettier/react',
    'plugin:jsx-a11y/recommended',
  ],
  plugins: ['jsx-a11y', 'react-hooks'],
  rules: {
    'arrow-parens': [
      'error',
      'as-needed',
      {
        requireForBlockBody: false,
      },
    ],
    'comma-dangle': ['error', 'only-multiline'],
    'jsx-quotes': ['error', 'prefer-double'],
    'react/no-unused-prop-types': [2],
    'react/jsx-sort-props': [2],
  },
  settings: {
    react: {
      version: '16.5.2',
    },
  },
};
