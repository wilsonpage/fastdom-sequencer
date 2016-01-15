'use strict';

module.exports = function(config) {
  config.set({
    basePath: '..',

    browsers: [
      // 'chrome',
      'Firefox'
    ],

    frameworks: [
      'mocha',
      'chai-sinon'
    ],

    reporters: [
      'mocha'
      // 'coverage'
    ],

    // coverageReporter: {
    //    type : 'lcov',
    //    dir : 'test/',
    //    subdir: 'coverage'
    //  },

    // preprocessors: {
    //   'fastdom.js': ['coverage'],
    //   'extensions/*.js': ['coverage']
    // },

    client: {
      captureConsole: true,
      mocha: { ui: 'tdd' }
    },

    customLaunchers: {
      chrome: {
        base: 'Chrome',
        flags: ['--no-sandbox']
      }
    },

    files: [
      'node_modules/fastdom/extensions/fastdom-promised.js',
      'node_modules/fastdom/fastdom.js',
      'fastdom-sequencer.js',
      'test/test.js'
    ]
  });
};
