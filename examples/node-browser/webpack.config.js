var webpack = require('webpack');

//
// Webpack configuration
//
module.exports = {
    entry   : {index: './browser.js'},
    target  : 'web',
    devtool : 'source-map',
    node: {
      fs: 'empty'
    },
    output  : {
        path          : 'static/',
        filename      : 'bundle.js',
        library       : "demo",
        libraryTarget : 'var',
    },
    plugins : [new webpack.DefinePlugin({
        'process.env': {
            'NODE_ENV': '"debug"'
        }
    })],
    module  : {
        loaders : [
            {
                test    : /\.js$/,
                loader  : 'babel-loader',
                include : /(browser|lib|index)/,
                exclude : /node_modules/,
                query   : {
                    cacheDirectory : true,
                    presets : [ 'es2015' ],
                    plugins : [
                    ],
                }
            },
            {
                test: /\.json$/,
                loader: "json",
            }
        ]
    },
};
