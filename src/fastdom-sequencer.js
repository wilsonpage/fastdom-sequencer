
var promised = require('fastdom/extensions/fastdom-promised');
var fastdom = require('fastdom');

var debug = 1 ? console.log.bind(console, '[sequencer]') : function() {};
var symbol = Symbol();

var sequencer = {
  BUFFER: 300,

  initialize: function() {
    this.scope = null;
    this.idle = {
      promise: Promise.resolve(),
      resolved: true
    };
  },

  // TODO: need some debouncing for
  // rapid events like 'scroll'
  on: function(el, name, task) {
    debug('on', el.className, name);

    var data = el[symbol] || (el[symbol] = { callbacks: {}, pending: {} });

    // only allow one binding per event type
    if (data.callbacks[name]) throw new Error('already listening');

    // Q: Should we block interactions until idle?
    // This would mean only one interaction is allowed at a time,
    // although we can't 'block' scrolling, we just wouldn't
    // respond, which could be bad.
    data.callbacks[name] = e => {
      debug('event', name);

      var pending = data.pending[name];
      if (pending) this.fastdom.clear(pending);

      if (this.idle.resolved) this.idle = new Deferred();

      data.pending[name] = this.fastdom.measure(() => {
        delete data.pending[name];

        // run the user's task
        this.scope = 'interaction';
        var promise = Promise.resolve(task());
        this.scope = null;

        this.setIdle(promise);
      });
    };

    on(el, name, data.callbacks[name]);
  },

  setIdle: function(promise) {
    debug('set idle', promise);

    clearTimeout(this.idle.timeout);

    if (this.idle.resolved) this.idle = new Deferred();
    this.idle.awaiting = promise;

    promise.then(() => {
      debug('interaction complete');
      if (promise !== this.idle.awaiting) return;
      this.idle.timeout = setTimeout(() => {
        this.idle.resolved = true;
        this.idle.resolve();
      }, 360);
    });
  },

  off: function(el, name, task) {
    var data = el[symbol];
    var callback = data.callbacks && data.callbacks[name];
    if (!callback) return;

    off(el, name, callback);
    delete data.callbacks[name];
  },

  animate: function(el, task) {
    debug('animate');

    if (this.scope !== 'interaction') {
      debug('blocked until idle ...');
      return this.idle.promise
        .then(() => this.fastdom.mutate(task))
        .then(() => animationend(el));
    }

    var megaPromise = this.fastdom.mutate(task);
    megaPromise.before = () => this.scope = 'interaction';
    megaPromise.after = () => this.scope = null;
    megaPromise.then(() => animationend(el));

    return megaPromise;
  },

  measure: function(task, ctx) {
    debug('measure');
    if (this.scope != 'interaction') {
      return this.fastdom.measure(task, ctx);
    }

    var megaPromise = this.fastdom.measure(() => {
      this.scope = 'interaction';
      var result = task();
      this.scope = null;
      return result;
    });

    megaPromise.before = () => this.scope = 'interaction';
    megaPromise.after = () => this.scope = null;

    return megaPromise;
  },

  mutate: function(task, ctx) {
    debug('mutate', this.scope);

    if (this.scope !== 'interaction') {
      return this.idle
        .then(() => this.fastdom.mutate(task, ctx));
    }

    var megaPromise = this.fastdom.mutate(() => {
      this.scope = 'interaction';
      var result = task();
      this.scope = null;
      return result;
    });

    megaPromise.before = () => this.scope = 'interaction';
    megaPromise.after = () => this.scope = null;

    return megaPromise;
  }
};

function Interaction() {
  this.defer = new Deferred();
  this.complete = this.defer.promise;
}

Interaction.prototype = {
  await: function(task) {
    debug('await', task);
    this.task = task;
    Promise.resolve(task)
      .then(() => wait(300))
      .then(() => {
        if (task !== this.task) return;
        this.defer.resolve();
      });
  }
};

/**
 * Exports
 */

module.exports = fastdom
  .extend(promised)
  .extend(sequencer);

/**
 * Utils
 */

function on(el, name, fn) { el.addEventListener(name, fn); }
function off(el, name, fn) { el.removeEventListener(name, fn); }

function animationend(el) {
  var defer = new Deferred();

  on(el, 'animationend', ended);
  on(el, 'transitionend', ended);

  function ended(e) {
    if (e.target !== el) return;
    off(el, 'animationend', ended);
    off(el, 'transitionend', ended);
    defer.resolve();
  }

  return defer.promise;
}

function Deferred() {
  this.promise = new Promise((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
}

function wait(ms) {
  var defer = new Deferred();
  setTimeout(defer.resolve, ms);
  return defer.promise;
}
