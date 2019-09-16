#! /bin/bash

echo "Authenticating with Registry..."
npm config set registry //registry.npmjs.org/:_authToken=$NPM_TOKEN -q

echo "Adding Git Remote..."
git remote rm origin
git remote add origin "https://$GH_USER_NAME:$GH_TOKEN@github.com/SiTaggart/lint-config.git"
git fetch

echo "Configuring CI Git User..."
git config --global user.email octobot@github.com
git config --global user.name GitHub Actions

echo "Publishing Packages..."
yarn release
