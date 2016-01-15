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

	    var data = el[symbol] || (el[symbol] = { callbacks: {}, interactions: {} });

	    // only allow one binding per event type
	    if (data.callbacks[name]) throw new Error('already listening');


	    // Q: Should we block interactions until idle?
	    // This would mean only one interaction is allowed at a time
	    data.callbacks[name] = e => {
	      debug('event', name);

	      var pending = data.interactions[name];
	      if (pending) this.fastdom.clear(pending);

	      if (this.idle.resolved) this.idle = new Deferred();

	      data.interactions[name] = this.fastdom.measure(() => {
	        delete data.interactions[name];

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

	  idle: function() {
	    return Promise.all(
	      this.interactions.map(interaction => interaction.complete)
	    );
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
	  },

	  WrappedPromise: WrappedPromise // test hook
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

	/**
	 * Wraps a Promise to provide hooks
	 * before and after the user's then/catch
	 * callback is run.
	 *
	 * This allows us to set specific state
	 * when user code is running.
	 *
	 * @private
	 * @constructor
	 * @param {Promise} promise
	 * @param {Object} options
	 * @param {Function} options.before
	 * @param {Function} options.after
	 */
	function WrappedPromise(promise, options) {
	  this.promise = Promise.resolve(promise);
	  this.before = options.before;
	  this.after = options.after;
	}

	WrappedPromise.prototype = {
	  wrap: function(callback) {
	    return arg => {
	      if (this.before) this.before();
	      var result = callback && callback(arg);
	      if (this.after) this.after();
	      return result;
	    };
	  },

	  then: function(onsuccess, onerror) {
	    return new WrappedPromise(this.promise.then(
	      this.wrap(onsuccess),
	      this.wrap(onerror)
	    ), this);
	  },

	  cancel: function() {
	    if (this.promise.cancel) return this.promise.cancel();
	  },

	  catch: function(callback) {
	    return new WrappedPromise(this.promise.catch(this.wrap(callback)), this);
	  }
	};


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
	    debug('clear', promise);
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
	      return result;
	    };
	  },

	  then: function(onsuccess, onerror) {
	    var promise = this.promise.then(
	      this.wrap(onsuccess),
	      this.wrap(onerror)
	    );

	    return new MegaPromise(promise, {
	      parent: this,
	      before: this.before,
	      after: this.after
	    });
	  },

	  catch: function(callback) {
	    var promise = this.promise.catch(this.wrap(callback));
	    return new MegaPromise(promise, {
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
	    debug('canceled', this.id);
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