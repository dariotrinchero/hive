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
            extensions: [ '.tsx', '.ts', '.js', '.d.ts', '.scss' ],
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    loader: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.(s(a|c)ss)$/,
                    use: [ 'style-loader', 'css-loader', 'sass-loader' ]
                }
            ],
        },
    });

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
            target: 'node',
            externals: [ nodeExternals() ],
            ...common(args),
        },
        {
            // Client webpage:
            name: 'client',
            entry: './src/client/app.tsx',
            output: {
                filename: '[name].[contenthash].js',
                path: path.resolve(__dirname, 'dist/client'),
                clean: true
            },
            plugins: [
                new HtmlWebpackPlugin({ // emit index.html with injected script tag referencing bundle
                    inject: true,
                    template: path.resolve(__dirname, 'index.html'),
                }),
            ],
            ...common(args),
        }
    ];
};