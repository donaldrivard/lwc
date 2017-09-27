const babel = require('babel-core');
const unpad = require('./unpad');

const test = it;

const baseConfig = {
    babelrc: false,
    filename: 'test.js',
    parserOpts: {
        plugins: ['*'],
    },
};

function transform(plugin, opts = {}) {
    const testConfig = Object.assign({}, baseConfig, {
        plugins: [plugin]
    }, opts);

    return function(source) {
        return babel.transform(unpad(source), testConfig);
    }
}

function makeTest(plugin, opts = {}) {
    const testTransform = transform(plugin, opts);

    const pluginTest = function(name, source, expectedSource, expectedError) {
        test(name, () => {
            let res;
            let err;

            try {
                res = testTransform(source);
            } catch (error) {
                err = error;
            }

            if (err) {
                /* istanbul ignore next */
                if (!expectedError) {
                    throw err;
                }

                expect(err).toMatchObject(expectedError);
            } else {
                expect(res.code).toBe(unpad(expectedSource));
            }
        });
    }

    /* istanbul ignore next */
    pluginTest.skip = (name) => test.skip(name);

    return pluginTest;
}

module.exports.test = makeTest;
module.exports.transform = transform;