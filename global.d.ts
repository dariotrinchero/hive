// we load the following file extensions as type 'asset/resource',
// which exports the file URL as string:
// https://webpack.js.org/guides/asset-modules/

declare module "*.mp3" {
    const value: string;
    export default value;
}

declare module "*.json" {
    const value: string;
    export default value;
}
