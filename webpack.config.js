const path = require('path');

const nodeExternals = require('webpack-node-externals');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const { DefinePlugin } = require("webpack");

module.exports = (env, args) => {
    // check if running in production mode
    const inProd = () => args.mode !== "development";

    // Config shared by client & server:
    const common = {
        mode: args.mode, // "development" | "production"
        devtool: inProd() ? undefined : 'inline-source-map',
        optimization: {
            usedExports: true,
            minimizer: [ `...`, new CssMinimizerPlugin() ]
        },
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
                    use: [ MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader' ]
                },
                {
                    test: /\.(png|svg|jpg|jpeg|json|gif|ogg|mp3|wav)$/i,
                    type: 'asset/resource'
                }
            ],
        },
    };

    // Dev-server config:
    const publicPath = inProd() ? undefined : `/game/${env.GAME_ID}/`;
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
            port: env.DEV_PORT,
            open: publicPath,
            proxy: {
                '/socket.io': {
                    target: `http://localhost:${env.PORT}`,
                    ws: true,
                },
            },
        },
    };
    const injectEnv = inProd() ? [] : [
        new DefinePlugin({ // inject environment variable into webpage process.env
            "process.env.AUTOKILL": JSON.stringify(env.AUTOKILL)
        })
    ];

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
                assetModuleFilename: 'assets/[name].[contenthash][ext]',
                clean: true,
                publicPath
            },
            plugins: [
                new HtmlWebpackPlugin({ // emit index.html with injected script tag referencing bundle
                    inject: true,
                    template: path.resolve(__dirname, 'index.html'),
                }),
                new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' }),
                ...injectEnv
            ],
            ...common,
            ...devServer
        }
    ];
};