module.exports = {
  extends: ['@sitaggart/eslint-config'],
  plugins: ['prettier', 'eslint-comments', 'promise', 'unicorn'],
  extends: [
    'standard',
    'standard-jsx',
    'airbnb',
    'plugin:eslint-comments/recommended',
    'plugin:promise/recommended',
    'plugin:unicorn/recommended',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      configFile: './.babelrc',
    },
  },
};
