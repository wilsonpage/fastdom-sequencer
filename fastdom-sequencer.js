(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("fastdom"));
	else if(typeof define === 'function' && define.amd)
		define(["fastdom"], factory);
	else if(typeof exports === 'object')
		exports["sequencer"] = factory(require("fastdom"));
	else
		root["sequencer"] = factory(root["fastdom"]);
})(this, function(__WEBPACK_EXTERNAL_MODULE_2__) {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	
	var promised = __webpack_require__(1);
	var fastdom = __webpack_require__(2);

	var debug = 1 ? console.log.bind(console, '[sequencer]') : function() {};
	var symbol = Symbol();


	function Sequencer(fastdom) {
	  this.fastdom = fastdom;
	  this.interactions = [];
	  this.animations = [];
	  this.scope = null;
	}

	Sequencer.prototype = {

	  /**
	   * Bind a 'protected' callback to an event.
	   *
	   * Callbacks are protected from (will delay)
	   * .measure(), .mutate(), .animate() tasks
	   * that are scheduled *after* an interaction
	   * has begun.
	   *
	   * An interaction is deemed 'complete' once
	   * the `Promise` returned from the callback
	   * resolves. If a Promise is not returned
	   * the interaction is complete after an
	   * internal debounce timeout is reached.
	   *
	   * Callbacks are run at maximum once a
	   * frame inside a `fastdom.measure()` task.
	   *
	   * @example
	   *
	   * sequencer.on('touchstart', e => {
	   *   return sequencer.animate(element, () => {
	   *     element.classList.add('grow')
	   *   });
	   * })
	   *
	   * sequencer.on('touchend', e => {
	   *   return sequencer.animate(element, () => {
	   *     element.classList.remove('grow')
	   *   });
	   * })
	   *
	   * @public
	   * @param  {HTMLElement} el
	   * @param  {String} type
	   * @param  {Function} task
	   */
	  on: function(el, type, task) {
	    debug('on', el.localName, type);

	    var scoped = this.scopeFn(task, 'interaction');
	    var data = el[symbol] || (el[symbol] = {
	      callbacks: {},
	      pending: {},
	      interactions: {}
	    });

	    // only allow one binding per event type
	    if (data.callbacks[type]) throw new Error('already listening');

	    data.callbacks[type] = e => {
	      debug('event', type, this.scope);
	      var interaction = this.createInteraction(el, type);
	      var pending = data.pending[type];

	      if (pending) this.fastdom.clear(pending);

	      data.pending[type] = this.fastdom.measure(() => {
	        delete data.pending[type];
	        interaction.reset(scoped());
	      });
	    };

	    on(el, type, data.callbacks[type]);
	  },

	  createInteraction: function(el, type) {
	    var interactions = el[symbol].interactions;
	    var interaction = interactions[type];

	    if (interaction) return interaction;
	    interaction = new Interaction(type);

	    var complete = interaction.complete
	      .then(() => {
	        remove(this.interactions, complete);
	        delete interactions[type];
	      });

	    this.interactions.push(complete);
	    interactions[type] = interaction;

	    debug('created interaction', el.localName, type);
	    return interaction;
	  },

	  off: function(el, type, task) {
	    var data = el[symbol];
	    var callback = data.callbacks && data.callbacks[type];
	    if (!callback) return;

	    var interaction = data.interactions[type];
	    interaction.resolve();

	    off(el, type, callback);
	    delete data.callbacks[type];
	  },

	  /**
	   * Schedule a task that triggers a CSS animation
	   * or transition on an element.
	   *
	   * The returned `Promise` resolves once
	   * the animation/transition has ended.
	   *
	   * Animation tasks are postponed by incomplete:
	   *   - interactions
	   *
	   * @example
	   *
	   * sequencer.animate(element, () => {
	   *   return element.classList.add('slide-in');
	   * }).then(...)
	   *
	   * @public
	   * @param  {HTMLElement} el
	   * @param  {Number}      [safety]
	   * @param  {Function}    task
	   * @return {Promise}
	   */
	  animate: function(el, safety, task) {
	    debug('animate', el.localName, this.scope);

	    // support optional second argument
	    if (typeof safety == 'function') task = safety, safety = null;

	    return this.after([this.interactions], () => {
	      debug('animate (2)', el.localName);
	      var scoped = this.scopeFn(task, this.scope, el).bind(this, el);
	      var fdTask = fastdomTask('mutate', scoped);
	      var result;

	      var spromise = new SequencerPromise(this, fdTask.promise, {
	        wrapper: this.promiseScoper(this.scope),
	        oncancel: () => fastdom.clear(fdTask.task)
	      });

	      var complete = spromise
	        .then(_result => {
	          result = _result;
	          return animationend(el, safety);
	        })

	        .then(() => {
	          remove(this.animations, complete);
	          return result;
	        });

	      this.animations.push(complete);
	      return complete;
	    });
	  },

	  /**
	   * Schedule a task that measures the
	   * size/position of an element.
	   *
	   * Measure tasks are postponed by incomplete:
	   *   - interactions
	   *   - animations
	   *
	   * @example
	   *
	   * sequencer.measure(() => {
	   *   return element.clientWidth;
	   * }).then(result => ...)
	   *
	   * @public
	   * @param  {Function} task
	   * @param  {*}        [ctx]
	   * @return {Promise}
	   */
	  measure: function(task, ctx) {
	    debug('measure (1)');
	    return this.after([this.interactions, this.animations], () => {
	      debug('measure (2)');
	      var scoped = this.scopeFn(task, this.scope);
	      var fdTask = fastdomTask('measure', scoped);
	      return new SequencerPromise(this, fdTask.promise, {
	        wrapper: this.promiseScoper(this.scope),
	        oncancel: () => fastdom.clear(fdTask.task)
	      });
	    });
	  },

	  /**
	   * Schedule a task that mutates (changes) the DOM.
	   *
	   * Mutation tasks are postponed by incomplete
	   * interactions or animations.
	   *
	   * @example
	   *
	   * sequencer.mutate(() => {
	   *   element.innerHTML = 'foo'
	   * }).then(...)
	   *
	   * @public
	   * @param  {Function} task
	   * @param  {*}        [ctx]
	   * @return {Promise}
	   */
	  mutate: function(task, ctx) {
	    debug('mutate (1)');
	    return this.after([this.interactions, this.animations], () => {
	      debug('mutate (2)');
	      var scoped = this.scopeFn(task, this.scope);
	      var fdTask = fastdomTask('mutate', scoped);
	      return new SequencerPromise(this, fdTask.promise, {
	        wrapper: this.promiseScoper(this.scope),
	        oncancel: () => fastdom.clear(fdTask.task)
	      });
	    });
	  },

	  clear: function(promise) {
	    debug('clear');
	    if (promise.cancel) promise.cancel();
	  },

	  /**
	   * 'Scope' a function.
	   *
	   * @private
	   * @param  {Function} fn
	   * @param  {String}   scope
	   * @return {Function}
	   */
	  scopeFn: function(fn, scope) {
	    var self = this;
	    return function() {
	      var previous = self.scope;
	      var result;
	      var error;

	      self.scope = scope;
	      debug('set scope', self.scope);

	      try { result = fn.apply(this, arguments); }
	      catch (e) { error = e; }

	      self.scope = previous;
	      debug('restored scope', self.scope);
	      if (error) throw error;

	      return result;
	    };
	  },

	  promiseScoper: function(scope) {
	    var self = this;
	    return function(callback, args) {
	      var previous = self.scope;
	      var result;
	      var error;

	      self.scope = scope;
	      debug('set scope', self.scope);

	      try { result = callback.apply(this, args); }
	      catch (e) { error = e; }

	      self.scope = previous;
	      debug('restored scope', self.scope);
	      if (error) throw error;

	      return result;
	    };
	  },

	  /**
	   * Calls the callback once the given
	   * 'blockers' lists have resolved.
	   *
	   * Onces all promises are resolved we wait
	   * one turn of the event loop and check
	   * again, this gives the user chance to
	   * schedule another task via `.then()`.
	   *
	   * For example, when chaining animate() tasks,
	   * we don't want a queued `.mutate()` task
	   * to be run between stages.
	   *
	   * @private
	   * @param  {Array}     blockers
	   * @param  {Function}  done
	   * @param  {String}    [scope]
	   * @return {Promise|*}
	   */
	  after: function(blockers, done, scope) {
	    scope = scope || this.scope;
	    if (scope == 'interaction') return done();
	    debug('waiting till after', blockers);
	    var flattened = [].concat.apply([], blockers);
	    if (!flattened.length) return done();
	    return Promise.all(flattened)
	      .then(() => new Promise(resolve => setTimeout(resolve)))
	      .then(() => this.after(blockers, done, scope));
	  },

	  SequencerPromise: SequencerPromise
	};

	/**
	 * Create a fastdom task wrapped in
	 * a 'cancellable' Promise.
	 *
	 * @param  {FastDom}  fastdom
	 * @param  {String}   type - 'measure'|'muatate'
	 * @param  {Function} fn
	 * @return {Promise}
	 */
	function fastdomTask(type, fn, ctx) {
	  var task;
	  var promise = new Promise((resolve, reject) => {
	    task = fastdom[type](function() {
	      try { resolve(fn()); }
	      catch (e) { reject(e); }
	    }, ctx);
	  });

	  return {
	    task: task,
	    promise: promise
	  };
	}

	/**
	 * Represents an interaction that
	 * can last a period of time.
	 *
	 * @constructor
	 * @param {Srting} type
	 */
	function Interaction(type) {
	  this.type = type;
	  this.defer = new Deferred();
	  this.complete = this.defer.promise;
	}

	Interaction.prototype = {
	  BUFFER: 300,

	  /**
	   * Define when the interaction should
	   * be deemed 'resolved'.
	   *
	   * @example
	   *
	   * // each call extends the debounce timer
	   * interaction.reset();
	   * interaction.reset();
	   * interaction.reset();
	   * interaction.reset();
	   *
	   * @example
	   *
	   * // no timer is installed, the interaction
	   * // will resolve once the promise resolves
	   * interaction.reset(promise)
	   *
	   * @private
	   * @param  {Promise} [promise]
	   */
	  reset: function(promise) {
	    debug('reset interaction');
	    var self = this;

	    clearTimeout(this.timeout);

	    // redefine the completed promise
	    this.promise = promise;

	    // if a promise was given then
	    // we use that to determine when
	    // the interaction is complete
	    if (promise && promise.then) {
	      debug('interaction promise');
	      return promise.then(done, done);
	    }

	    function done(result) {
	      if (self.promise !== promise) return;
	      self.resolve(result);
	    }

	    // when no Promise is given we use a
	    // debounce approach to judge completion
	    this.timeout = setTimeout(() => this.resolve(), this.BUFFER);
	  },

	  /**
	   * Mark the interaction 'complete'.
	   *
	   * @param  {*} result
	   */
	  resolve: function(result) {
	    debug('interaction complete');
	    this.defer.resolve(result);
	  }
	};

	var id = 0;

	function SequencerPromise(sequencer, promise, options) {
	  options = options || {};
	  this.sequencer = sequencer;
	  this.promise = Promise.resolve(promise);
	  this.oncancel = options.oncancel;
	  this.parent = options.parent;
	  this.wrapper = options.wrapper;
	  this.canceled = false;
	  this.id = ++id;
	  debug('created', this.id);
	}

	SequencerPromise.prototype = {
	  wrap: function(callback) {
	    if (!callback) return;
	    var self = this;
	    return function() {
	      if (self.canceled) return;
	      var result = self.wrapper(callback, arguments);
	      if (result && result.then) self.sibling = result;
	      return result;
	    };
	  },

	  then: function(onsuccess, onerror) {
	    var promise = this.promise.then(
	      this.wrap(onsuccess),
	      this.wrap(onerror)
	    );

	    return this.create(promise);
	  },

	  create: function(promise) {
	    return this.child = new SequencerPromise(this.sequencer, promise, {
	      parent: this,
	      wrapper: this.wrapper
	    });
	  },

	  catch: function(callback) {
	    var promise = this.promise.catch(this.wrap(callback));
	    return this.create(promise);
	  },

	  cancel: function() {
	    if (this.canceled) return;
	    this.canceled = true;
	    if (this.oncancel) this.oncancel();
	    if (this.parent) this.parent.cancel();
	    if (this.child) this.child.cancel();
	    if (this.sibling) this.sibling.cancel();
	    debug('canceled', this.id);
	  },

	  measure: function(task, ctx) {
	    var promise = this.promise.then(() => this.sequencer.measure(task, ctx));
	    return this.create(promise);
	  },

	  mutate: function(task, ctx) {
	    var promise = this.promise.then(() => this.sequencer.mutate(task, ctx));
	    return this.create(promise);
	  },

	  animate: function(el, safety, task) {

	    // support various argument patterns
	    if (typeof el == 'number') task = safety, safety = el, el = null;
	    else if (typeof el == 'function') task = el, safety = el = null;

	    return this.create(this.promise.then(result => {
	      return this.sequencer.animate(el || result, safety, task);
	    }));
	  }
	};

	/**
	 * Exports
	 */

	module.exports = new Sequencer(fastdom);

	/**
	 * Utils
	 */

	function on(el, name, fn) { el.addEventListener(name, fn); }
	function off(el, name, fn) { el.removeEventListener(name, fn); }

	/**
	 * Returns a Promise that resolves
	 * after the first `animationend` or
	 * `transitionend` event fires on
	 * the given Element.
	 *
	 * The are cases when this event cannot
	 * be trusted to fire. Passing a `safety`
	 * timeout ensures the Promise resolves
	 * even if the event never fires.
	 *
	 * @param  {HTMLElement}  el
	 * @param  {Number}  [safety]
	 * @return {Promise}
	 */
	function animationend(el, safety) {
	  debug('animationend', el.localName);
	  var defer = new Deferred();
	  var timeout;

	  on(el, 'animationend', ended);
	  on(el, 'transitionend', ended);

	  if (safety) timeout = setTimeout(ended, safety);

	  function ended(e) {
	    if (e && e.target !== el) return;
	    debug('animation ended');
	    off(el, 'animationend', ended);
	    off(el, 'transitionend', ended);
	    clearTimeout(timeout);
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

	/**
	 * Remove an item from an Array.
	 *
	 * @param  {Array} array
	 * @param  {*} item
	 * @return {Boolean}
	 */
	function remove(array, item) {
	  var index = array.indexOf(item);
	  return !!~index && !!array.splice(index, 1);
	}


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_RESULT__;!(function() {

	var debug = 0 ? console.log.bind(console, '[fastdom-promised]') : function() {};

	/**
	 * Wraps fastdom in a Promise API
	 * for improved control-flow.
	 *
	 * @example
	 *
	 * // returning a result
	 * fastdom.measure(() => el.clientWidth)
	 *   .then(result => ...);
	 *
	 * // returning promises from tasks
	 * fastdom.measure(() => {
	 *   var w = el1.clientWidth;
	 *   return fastdom.mutate(() => el2.style.width = w + 'px');
	 * }).then(() => console.log('all done'));
	 *
	 * // clearing pending tasks
	 * var promise = fastdom.measure(...)
	 * fastdom.clear(promise);
	 *
	 * @type {Object}
	 */
	var exports = {
	  mutate: function(fn, ctx) {
	    return create(this.fastdom, 'mutate', fn, ctx);
	  },

	  measure: function(fn, ctx) {
	    return create(this.fastdom, 'measure', fn, ctx);
	  },

	  clear: function(promise) {
	    debug('clear', !!promise);
	    if (promise.cancel) promise.cancel();
	  },

	  MegaPromise: MegaPromise
	};

	/**
	 * Create a fastdom task wrapped in
	 * a 'cancellable' Promise.
	 *
	 * @param  {FastDom}  fastdom
	 * @param  {String}   type - 'measure'|'muatate'
	 * @param  {Function} fn
	 * @return {Promise}
	 */
	function create(fastdom, type, fn, ctx) {
	  var task;

	  var promise = new Promise(function(resolve, reject) {
	    task = fastdom[type](function() {
	      try { resolve(fn()); }
	      catch (e) { reject(e); }
	    }, ctx);
	  });

	  var cancelable = new MegaPromise(promise, {
	    oncancel: function() {
	      fastdom.clear(task);
	    }
	  });

	  return cancelable;
	}

	var id = 0;

	function MegaPromise(promise, options) {
	  options = options || {};
	  this.promise = Promise.resolve(promise);
	  this.oncancel = options.oncancel;
	  this.parent = options.parent;
	  this.before = options.before;
	  this.after = options.after;
	  this.canceled = false;
	  this.id = ++id;
	  debug('created', this.id);
	}

	MegaPromise.prototype = {
	  wrap: function(callback) {
	    return arg => {
	      if (this.canceled) return;
	      if (this.before) this.before();
	      var result = callback && callback(arg);
	      if (this.after) this.after();
	      if (result && result.then) this.sibling = result;
	      return result;
	    };
	  },

	  then: function(onsuccess, onerror) {
	    var promise = this.promise.then(
	      this.wrap(onsuccess),
	      this.wrap(onerror)
	    );

	    return this.child = new MegaPromise(promise, {
	      parent: this,
	      before: this.before,
	      after: this.after
	    });
	  },

	  catch: function(callback) {
	    var promise = this.promise.catch(this.wrap(callback));
	    return this.child = new MegaPromise(promise, {
	      parent: this,
	      before: this.before,
	      after: this.after
	    });
	  },

	  cancel: function() {
	    if (this.canceled) return;
	    this.canceled = true;
	    if (this.oncancel) this.oncancel();
	    if (this.parent) this.parent.cancel();
	    if (this.child) this.child.cancel();
	    if (this.sibling) this.sibling.cancel();
	    debug('canceled', this.id);
	  },

	  mixin: function(props) {
	    Object.assign(this, props);
	  }
	};

	// Expose to CJS, AMD or global
	if (("function")[0] == 'f') !(__WEBPACK_AMD_DEFINE_RESULT__ = function() { return exports; }.call(exports, __webpack_require__, exports, module), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	else if ((typeof module)[0] == 'o') module.exports = exports;
	else window.fastdomPromised = exports;

	})();

/***/ },
/* 2 */
/***/ function(module, exports) {

	module.exports = __WEBPACK_EXTERNAL_MODULE_2__;

/***/ }
/******/ ])
});
;