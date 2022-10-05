declare module "*.mp3" {
    // we load mp3's as type 'asset/resource', which exports the file URL as string:
    // https://webpack.js.org/guides/asset-modules/
    const value: string;
    export default value;
  }
  