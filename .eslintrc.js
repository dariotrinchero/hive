module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: [ "./tsconfig.json" ],
    },
    plugins: [ "@typescript-eslint" ],
    extends: [
        "preact",
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking"
    ],
    rules: {
        "strict": 2,
        "eqeqeq": 2,
        "sort-imports": [ "error", {
            "ignoreCase": true,
            "ignoreDeclarationSort": true,
        } ],
        "sort-keys": [ "error", "asc", {
            "caseSensitive": false,
            "natural": true,
            "minKeys": 2
        } ],
        "comma-dangle": [ "error", "never" ],
        "indent": [ "error", 4, {
            "SwitchCase": 1
        } ],
        "linebreak-style": [ "error", "unix" ],
        "quotes": [ "error", "double" ],
        "semi": [ "error", "always" ],
    },
};