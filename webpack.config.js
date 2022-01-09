const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const host = process.env.HOST || 'localhost';

module.exports = {
    mode: 'development',
    devtool: 'inline-source-map',
    entry: './src',
    output: {
        filename: '[name].[contenthash].js',
        path: path.resolve(__dirname, 'dist'),
        clean: true
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
            },
        ],
    },
    resolve: {
        alias: { '@': path.resolve(__dirname, 'src') },
        extensions: [ '.tsx', '.ts', '.js', '.d.ts' ],
    },
    devServer: {
        static: {
            directory: path.resolve(__dirname, 'dist'),
            publicPath: '/'
        },
        compress: true,
        hot: true,
        port: 3000
    },
    plugins: [
        // Re-generate index.html with injected script tag referencing bundled TypeScript code
        new HtmlWebpackPlugin({
            inject: true,
            template: path.resolve(__dirname, 'index.html'),
        }),
    ],
};