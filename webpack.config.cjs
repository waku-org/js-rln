const path = require('path');

module.exports = {
  entry: "./dist/index.js",
  output: {
    path: path.resolve(__dirname, "bundle"),
    filename: "index.js",
  },
  mode: "production",
  experiments: {
    asyncWebAssembly: true
  },
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: "webassembly/async",
      },
    ]
  }
};
