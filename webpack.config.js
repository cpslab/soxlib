// @flow
'use strict'
const path = require('path')

module.exports = {
  devtool: 'inline-source-map',
  entry: ['./examples/index.js'],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      }
    ]
  }
}
