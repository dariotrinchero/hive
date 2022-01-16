const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'inline-source-map',
    optimization: {
        usedExports: true,
    },
    devServer: {
        static: {
            directory: path.resolve(__dirname, 'dist'),
            publicPath: '/'
        },
        compress: true,
        hot: true,
        port: 3000
    }
});