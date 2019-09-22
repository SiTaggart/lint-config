module.exports = {
  extends: ['standard-jsx', 'plugin:react/recommended', 'prettier/react', 'plugin:jsx-a11y/recommended'],
  plugins: ['jsx-a11y', 'react-hooks'],
  rules: {
    'react/no-unused-prop-types': [2],
    'react/jsx-sort-props': [2],
  },
  settings: {
    react: {
      version: '16.5.2',
    },
  },
}
