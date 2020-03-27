const path = require('path')

module.exports = {
  mode: 'development',
  entry: {
    index: './src/index.js'
  },
  devtool: 'inline-source-map',
  output: {
    path: path.resolve(__dirname, 'public/js'),
    filename: '[name].bundle.js'
  }
}
