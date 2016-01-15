module.exports = [
  {
    entry: './src/fastdom-sequencer.js',
    output: {
      filename: 'fastdom-sequencer.js',
      library: 'sequencer',
      libraryTarget: 'umd'
    },

    externals: {
      'fastdom': 'fastdom'
    }
  }
];
