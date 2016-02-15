(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("fastdom"));
	else if(typeof define === 'function' && define.amd)
		define(["fastdom"], factory);
	else if(typeof exports === 'object')
		exports["sequencer"] = factory(require("fastdom"));
	else
		root["sequencer"] = factory(root["fastdom"]);
})(this, function(__WEBPACK_EXTERNAL_MODULE_1__) {
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

	
	/**
	 * Dependencies
	 */

	var fastdom = __webpack_require__(1);

	/**
	 * Mini logger.
	 *
	 * @type {Function}
	 */
	var debug = 1 ? console.log.bind(console, '[sequencer]') : function() {};

	/**
	 * Used to store state on Elements.
	 *
	 * @type {Symbol}
	 */
	var symbol = Symbol();

	/**
	 * Intialize a new `Sequencer`
	 *
	 * @constructor
	 * @param {FastDom} fastdom
	 */
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
	    var scoped = this.scopeFn('nested', task);
	    var data = el[symbol] || (el[symbol] = {
	      callbacks: {},
	      pending: {},
	      interactions: {}
	    });

	    // only one binding per event type
	    if (data.callbacks[type]) throw new Error('already listening');

	    data.callbacks[type] = function(e) {
	      debug('event', type, this.scope);
	      var interaction = this.createInteraction(el, type);
	      var pending = data.pending[type];

	      if (pending) this.fastdom.clear(pending);

	      data.pending[type] = this.fastdom.measure(function() {
	        delete data.pending[type];
	        interaction.reset(scoped());
	      });
	    }.bind(this);

	    // attach the wrapped callback
	    on(el, type, data.callbacks[type]);
	  },

	  /**
	   * Unbind a callback from an event.
	   *
	   * If an interaciton is not 'complete'
	   * unbinding infers completion.
	   *
	   * @public
	   * @param  {HTMLElement} el
	   * @param  {String} type
	   * @param  {Function} task
	   */
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
	   * Create an `Interaction` to represent
	   * a user input and ongoing feedback
	   * that may be triggered in response.
	   *
	   * @param  {HTMLElement} el
	   * @param  {String} type
	   * @return {Interaction}
	   */
	  createInteraction: function(el, type) {
	    var interactions = el[symbol].interactions;
	    var interaction = interactions[type];
	    var self = this;

	    if (interaction) return interaction;
	    interaction = new Interaction(type);

	    var complete = interaction.complete
	      .then(function() {
	        remove(self.interactions, complete);
	        delete interactions[type];
	      });

	    this.interactions.push(complete);
	    interactions[type] = interaction;

	    debug('created interaction', el.localName, type);
	    return interaction;
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
	   * IDEA: Perhaps returning the Element would
	   * be a better way to provide the animation
	   * target?
	   *
	   * @example
	   *
	   * sequencer.animate(() => {
	   *   element.classList.add('slide-in');
	   *   return element;
	   * }).then(...)
	   *
	   * // with optional safety timeout
	   * sequencer.animate(400, () => ...)
	   *
	   * @public
	   * @param  {(Number|Object)} [safety]
	   * @param  {Function} task
	   * @param  {Object} [ctx]
	   * @return {Promise}
	   */
	  animate: function(safety, task, ctx) {
	    debug('animate (1)');
	    var self = this;
	    var arg;

	    // support optional first argument: `safety`
	    switch (typeof safety) {
	      case 'function': ctx = task, task = safety, safety = null; break;
	      case 'object':
	        arg = safety.arg;
	        ctx = safety.ctx;
	        task = arg ? safety.task.bind(ctx, arg) : safety.task;
	        safety = safety.safety;
	    }

	    return this.after([this.interactions], function() {
	      debug('animate (2)');
	      var promise = self.task('mutate', task, ctx);
	      var result;

	      var complete = promise
	        .then(function(_result) {
	          result = _result;

	          // if the task returns a
	          // Promise then use that as
	          // an indication of completion.
	          if (result instanceof HTMLElement) return animationend(result, safety);
	          else if (arg instanceof HTMLElement) return animationend(arg, safety);
	          else throw new Error('.animate() must be passed or return a target Element');
	        })

	        .then(function() {
	          remove(self.animations, complete);
	          return result;
	        });

	      self.animations.push(complete);
	      return complete;
	    });
	  },

	  task: function(type, fn, ctx) {
	    var scoped = this.scopeFn('nested', fn);
	    var task = fastdomTask('mutate', scoped, ctx);
	    return this.promise(task.promise, {
	      oncancel: function() { fastdom.clear(task.id); }
	    });
	  },

	  /**
	   * Wraps a vanilla Promise adding
	   * sequencer APIs.
	   *
	   * Useful for begining a chain from
	   * a vanilla Promise.
	   *
	   * @example
	   *
	   * sequencer.promise(Promise.resolve())
	   *   .mutate(...);
	   *
	   * @public
	   * @param  {Promise} promise
	   * @param  {Object} [options]
	   * @param  {Object} [options.oncancel]
	   * @return {SequencerPromise}
	   */
	  promise: function(promise, options) {
	    return new SequencerPromise(this, promise, {
	      wrapper: this.scopeFn.bind(this, this.scope),
	      oncancel: options && options.oncancel
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
	    return this.after([this.interactions, this.animations], function() {
	      debug('measure (2)');
	      return this.task('measure', task, ctx);
	    }.bind(this));
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
	    return this.after([this.interactions, this.animations], function() {
	      debug('mutate (2)');
	      return this.task('mutate', task, ctx);
	    }.bind(this));
	  },

	  /**
	   * Clear a pending task.
	   *
	   * @public
	   * @param  {SequencerPromise} promise
	   */
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
	  scopeFn: function(scope, fn) {
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
	    if (scope == 'nested') return done();
	    debug('waiting till after', blockers);
	    var flattened = [].concat.apply([], blockers);
	    if (!flattened.length) return done();

	    var promise = Promise.all(flattened)
	      .then(function() {
	        return new Promise(function(resolve) { setTimeout(resolve); });
	      })

	      .then(function() {
	        return this.after(blockers, done, scope);
	      }.bind(this));

	     return this.promise(promise);
	  },

	  SequencerPromise: SequencerPromise
	};


	/**
	 * Create a fastdom task wrapped in
	 * a Promise.
	 *
	 * @param  {FastDom}  fastdom
	 * @param  {String}   type - 'measure'|'muatate'
	 * @param  {Function} fn
	 * @return {Promise}
	 */
	function fastdomTask(type, fn, ctx) {
	  var id;
	  var promise = new Promise(function(resolve, reject) {
	    id = fastdom[type](function() {
	      try {
	        var result = fn.call(ctx);
	        resolve(result);
	      }
	      catch (e) { reject(e); }
	    });
	  });

	  return {
	    id: id,
	    promise: promise
	  };
	}

	/**
	 * Represents an interaction that
	 * can last a period of time.
	 *
	 * TODO: Introduce specific paths for 'scroll'
	 * and 'touchmove' events that listen to
	 * 'scrollend' amd 'touchend' respectively.
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
	    this.timeout = setTimeout(this.resolve.bind(this), 300);
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

	/**
	 * Wraps a `Promise`, providing additional
	 * functionality and hooks to wrap user
	 * defined callbacks.
	 *
	 * A `SequencerPromise` is a link in a
	 * chain of async tasks to be completed
	 * in series.
	 *
	 * NOTE: Chained syntax is optional and does
	 * not prevent users from using a familiar
	 * Promise syntax.
	 *
	 * @example
	 *
	 * // before: lots of boilerplate
	 * sequencer.mutate(...)
	 *   .then(() => sequencer.measure(...))
	 *   .then(() => sequencer.animate(...))
	 *   .then(() => sequencer.animate(...))
	 *   .then(...)
	 *
	 * // after: clean/terse
	 * sequencer
	 *   .mutate(...)
	 *   .measure(...)
	 *   .animate(...)
	 *   .animate(...)
	 *   .then(...)
	 *
	 * @example
	 *
	 * var li;
	 *
	 * sequencer
	 *   .mutate(() => {
	 *     li = document.createElement('li');
	 *     list.appendChild(li);
	 *     return li;
	 *   })
	 *
	 *   // previous return value can be used
	 *   // as target by omitting first argument
	 *   .animate(li => li.classList.add('grow'))
	 *
	 *   // or pass target as first param
	 *   .animate(li, () => li.classList.add('slide'));
	 *
	 * @constructor
	 * @param {Sequencer} sequencer
	 * @param {Promise} promise
	 * @param {Object} [options]
	 * @param {Function} [options.wrapper]
	 * @param {SequencerPromise} [options.parent]
	 * @param {Function} [options.oncancel]
	 */
	function SequencerPromise(sequencer, promise, options) {
	  options = options || {};
	  this.sequencer = sequencer;
	  this.promise = Promise.resolve(promise);
	  this.oncancel = options.oncancel;
	  this.wrapper = options.wrapper;
	  this.parent = options.parent;
	  this.canceled = false;
	  debug('created');
	}

	SequencerPromise.prototype = {
	  _wrap: function(callback) {
	    if (!callback) return;
	    var self = this;
	    callback = this.wrapper(callback);
	    return function(value) {
	      if (self.canceled) return;
	      var result = callback(value);
	      if (result && result.then) self.sibling = result;
	      return result;
	    };
	  },

	  then: function(onsuccess, onerror) {
	    return this.create(this.promise.then(
	      this._wrap(onsuccess),
	      this._wrap(onerror)
	    ));
	  },

	  create: function(promise) {
	    return this.child = new SequencerPromise(this.sequencer, promise, {
	      parent: this,
	      wrapper: this.wrapper
	    });
	  },

	  catch: function(callback) {
	    return this.create(this.promise.catch(this._wrap(callback)));
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
	    var sequencer = this.sequencer;
	    return this.then(function(result) {
	      return sequencer.measure(function() {
	        return task(result);
	      }, ctx);
	    });
	  },

	  mutate: function(task, ctx) {
	    var sequencer = this.sequencer;
	    return this.then(function(result) {
	      return sequencer.mutate(function() {
	        return task(result);
	      }, ctx);
	    });
	  },

	  animate: function(safety, task, ctx) {
	    var sequencer = this.sequencer;

	    // safety argument is optional
	    if (typeof safety === 'function') ctx = task, task = safety, safety = null;

	    return this.then(function(result) {
	      return sequencer.animate({
	        safety: safety,
	        arg: result,
	        task: task,
	        ctx: ctx
	      });
	    });
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
	  debug('animationend', el.localName, el.className);
	  var defer = new Deferred();
	  var timeout;

	  on(el, 'animationend', ended);
	  on(el, 'transitionend', ended);

	  if (safety) timeout = setTimeout(ended, safety);

	  function ended(e) {
	    if (e && e.target !== el) return;
	    debug('animation ended', el.className);
	    off(el, 'animationend', ended);
	    off(el, 'transitionend', ended);
	    clearTimeout(timeout);
	    defer.resolve();
	  }

	  return defer.promise;
	}

	/**
	 * @constructor
	 */
	function Deferred() {
	  this.promise = new Promise(function(resolve, reject) {
	    this.resolve = resolve;
	    this.reject = reject;
	  }.bind(this));
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
/***/ function(module, exports) {

	module.exports = __WEBPACK_EXTERNAL_MODULE_1__;

/***/ }
/******/ ])
});
;