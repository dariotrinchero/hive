const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

module.exports = (_env, args) => {
    // Config shared by client & server:
    const common = args => ({
        mode: args.mode, // "development" | "production"
        devtool: 'inline-source-map',
        optimization: { usedExports: true },
        resolve: {
            alias: { '@': path.resolve(__dirname, 'src') },
            extensions: [ '.tsx', '.ts', '.js', '.d.ts' ],
        },
    });
    const tsRule = {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
    };

    // Dev-server config:
    const devServer = args => args.mode !== "development" ? {} : {
        devServer: {
            static: {
                directory: path.resolve(__dirname, 'dist/client'),
                publicPath: '/'
            },
            compress: true,
            hot: false,
            port: 3000,
            proxy: {
                '/api': {
                    target: 'ws://localhost:3001',
                    ws: true,
                    secure: false
                },
            },
        },
    };

    return [
        {
            // Node server:
            name: 'server',
            entry: './src/server/index.ts',
            output: {
                filename: 'server.js',
                path: path.resolve(__dirname, 'dist/server'),
                clean: true
            },
            module: { rules: [ tsRule ], },
            target: 'node',
            externals: [ nodeExternals() ],
            ...common(args),
        },
        {
            // Client webpage:
            name: 'client',
            entry: './src/client/index.ts',
            output: {
                filename: '[name].[contenthash].js',
                path: path.resolve(__dirname, 'dist/client'),
                clean: true
            },
            module: {
                rules: [
                    tsRule,
                    {
                        test: /\.(png|svg|jpg|jpeg|gif)$/i,
                        type: 'asset/resource',
                    },
                ],
            },
            plugins: [
                new HtmlWebpackPlugin({ // emit index.html with injected script tag referencing bundle
                    inject: true,
                    template: path.resolve(__dirname, 'index.html'),
                }),
            ],
            ...devServer(args),
            ...common(args),
        }
    ];
};