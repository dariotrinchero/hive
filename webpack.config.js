const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

module.exports = (env, args) => {
    // check if running in production mode
    const inProd = () => args.mode !== "development";

    // Config shared by client & server:
    const common = {
        mode: args.mode, // "development" | "production"
        devtool: inProd() ? undefined : 'inline-source-map',
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
    };

    // Dev-server config:
    const publicPath = inProd() ? "" : `/game/${env.gameId}/`;
    const devServer = inProd() ? {} : {
        devServer: {
            static: { directory: path.resolve(__dirname, 'dist/client') },
            devMiddleware: {
                // write (only) server files to disk to trigger nodemon refresh
                writeToDisk: (filePath) => /server\.js$/.test(filePath)
            },
            compress: true,
            hot: false,
            liveReload: true,
            port: 8080,
            open: publicPath,
            proxy: {
                '/socket.io': {
                    target: `http://localhost:${env.port}`,
                    ws: true,
                },
            },
        },
    };

    const fixedPublicPath = inProd() ? {} : { publicPath };
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
            ...common,
        },
        {
            // Client webpage:
            name: 'client',
            entry: './src/client/app.tsx',
            output: {
                filename: '[name].[contenthash].js',
                path: path.resolve(__dirname, 'dist/client'),
                clean: true,
                ...fixedPublicPath
            },
            plugins: [
                new HtmlWebpackPlugin({ // emit index.html with injected script tag referencing bundle
                    inject: true,
                    template: path.resolve(__dirname, 'index.html'),
                }),
            ],
            ...common,
            ...devServer
        }
    ];
};