const webpack = require("webpack");
const playwright = require('playwright');
const os = require("os");
const path = require("path");

process.env.CHROME_BIN = playwright.chromium.executablePath();
process.env.FIREFOX_BIN = playwright.firefox.executablePath();

const output = {
  path:
    path.join(os.tmpdir(), "_karma_webpack_") +
    Math.floor(Math.random() * 1000000),
};

module.exports = function (config) {
  config.set({
    frameworks: ["webpack", "mocha"],
    customHeaders: [{
      match: '\\.wasm$',
      name: 'Content-Type',
      value: 'application/wasm'
    }],
    files: [
      "src/**/!(node).spec.ts",
      {
        pattern: `${output.path}/**/*`,
        watched: false,
        included: false,
        served: true,
      },
      { pattern: 'bundle/**/*.wasm', included: false, served: true, type: 'wasm' }
    ],
    preprocessors: {
      "src/**/!(node).spec.ts": ["webpack"]
    },
    envPreprocessor: ["CI"],
    reporters: ["progress"],
    browsers: ["ChromeHeadless", "FirefoxHeadless"],
    singleRun: true,
    client: {
      mocha: {
        timeout: 6000 // Default is 2s
      }
    },
    webpack: {
      mode: "development",
      module: {
        rules: [{
          test: /\.wasm$/,
          type: "asset/resource",
        }, { test: /\.([cm]?ts|tsx)$/, loader: "ts-loader" }]
      },
      output,
      plugins: [
        new webpack.DefinePlugin({
          "process.env.CI": process.env.CI || false,
          "process.env.DISPLAY": "Browser",
        }),
        new webpack.ProvidePlugin({
          process: "process/browser.js"
        })
      ],
      resolve: {
        extensions: [".ts", ".tsx", ".js"],
        extensionAlias: {
          ".js": [".js", ".ts"],
          ".cjs": [".cjs", ".cts"],
          ".mjs": [".mjs", ".mts"]
        }
      },
      stats: { warnings: false },
      devtool: "inline-source-map"
    }
  });
};