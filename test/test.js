/*jshint maxlen:false*/
/*global suite, setup, teardown, test, assert, sinon, sequencer*/

suite('fastdom', function() {
  var SequencerPromise = sequencer.SequencerPromise;
  var dom;
  var el;

  document.body.style.margin = 0;

  setup(function(done) {
    dom = document.createElement('div');
    el = document.createElement('div');
    el.style.height = el.style.width = '100px';
    el.style.transition = 'transform 300ms';
    el.style.background = 'red';
    el.style.overflowY = 'scroll';
    var scrollContent = document.createElement('div');
    scrollContent.style.height = '1000%';
    el.appendChild(scrollContent);
    dom.appendChild(el);

    document.body.appendChild(dom);

    // wait for layout before animating
    setTimeout(done, 100);
  });

  teardown(function() {
    dom.remove();
  });

  suite('.on()', function() {
    test('it can bind events', function(done) {
      var spy = sinon.spy();
      sequencer.on(el, 'click', spy);
      el.dispatchEvent(new CustomEvent('click'));

      requestAnimationFrame(() => {
        sinon.assert.calledOnce(spy);
        done();
      });
    });

    test('nested `.animate()`s are not blocked', function(done) {
      var start = Date.now();

      sequencer.on(el, 'click', function() {
        return sequencer.animate(el, function() {
          el.style.transform = 'translateY(100%)';
          assert.isAtMost(Date.now() - start, 100);
        }).then(done);
      });

      el.dispatchEvent(new CustomEvent('click'));
    });

    test('it does not run more than 1 callback per frame', function(done) {
      var scroll = sinon.spy();
      var mutation = sinon.spy();

      el.addEventListener('scroll', scroll);

      sequencer.on(el, 'scroll', e => {
        return sequencer.mutate(mutation);
      });

      el.dispatchEvent(new CustomEvent('scroll'));
      el.dispatchEvent(new CustomEvent('scroll'));
      el.dispatchEvent(new CustomEvent('scroll'));

      requestAnimationFrame(() => {
        sinon.assert.calledThrice(scroll);
        sinon.assert.calledOnce(mutation);
        done();
      });
    });

    test('scope is restored when a callback throws', function(done) {
      var spy = sinon.spy();

      sequencer.on(el, 'click', function() {
        return sequencer.mutate(function() {
          spy();
          throw new Error('ahhh');
        });
      });

      el.dispatchEvent(new CustomEvent('click'));

      requestAnimationFrame(() => {
        sinon.assert.calledOnce(spy);
        assert.equal(sequencer.scope, null);
        done();
      });
    });
  });

  suite('.off()', function() {
    test('callback no longer fires', function(done) {
      var spy = sinon.spy();

      sequencer.on(el, 'click', spy);
      el.dispatchEvent(new CustomEvent('click'));
      sequencer.off(el, 'click', spy);
      el.dispatchEvent(new CustomEvent('click'));

      requestAnimationFrame(() => {
        sinon.assert.calledOnce(spy);
        done();
      });
    });

    test('queued tasks are immediately run', function(done) {
      var callback = sinon.spy();
      var start = Date.now();

      sequencer.on(el, 'touchmove', callback);

      el.dispatchEvent(new CustomEvent('touchmove'));

      sequencer.mutate(() => {
        var elapsed = Date.now() - start;
        assert.isAtMost(elapsed, 100);
        done();
      });

      sequencer.off(el, 'touchmove', callback);
    });
  });

  suite('.animate()', function() {
    test('it resolves when the animation ends', function() {
      var start = Date.now();

      return sequencer.animate(el, () => {
        el.style.transform = 'translateY(100%)';
      })

      .then(() => {
        var elapsed = Date.now() - start;
        assert.isAtLeast(elapsed, 300);
      });
    });

    test('are blocked by pending interactions', function(done) {
      var interaction = 300;
      var animation = 300;
      var expected = interaction + animation;

      sequencer.on(el, 'click', e => {
        return new Promise(resolve => {
          setTimeout(resolve, interaction);
        });
      });

      el.dispatchEvent(new CustomEvent('click'));

      var start = Date.now();

      sequencer.animate(el, () => {
        el.style.transform = 'translateY(100%)';
      })

      .then(() => {
        var elapsed = Date.now() - start;
        assert.isAtLeast(elapsed, expected);
      })

      .then(done)
      .catch(done);
    });

    test('it resolves after the (optional) safety timeout when `...end` does not fire', function() {
      var start;

      return sequencer.animate(el, 100, () => {
          start = Date.now();
          // do nothing ...
        })

        .then(() => {
          var elapsed = Date.now() - start;
          assert.isAtMost(elapsed, 150);
        });
    });
  });

  suite('.mutate()', function() {
    test('its run instantly when no unfinished interactions', function(done) {
      var spy = sinon.spy();

      sequencer.mutate(spy);

      requestAnimationFrame(() => {
        sinon.assert.calledOnce(spy);
        done();
      });
    });

    test('is blocked by pending interactions', function() {
      var interaction = 300;
      var expected = interaction;

      sequencer.on(el, 'click', e => {
        return new Promise(resolve => {
          setTimeout(resolve, interaction);
        });
      });

      el.dispatchEvent(new CustomEvent('click'));

      var start = Date.now();

      return sequencer.mutate(() => {})

      .then(() => {
        var elapsed = Date.now() - start;
        assert.isAtLeast(elapsed, expected);
      });
    });

    test('blocked by ongoing animation', function() {
      var mutationTask = sinon.spy();
      var animationEnded = sinon.spy();

      var animation = sequencer.animate(el, () => {
        el.style.transform = 'translateY(100%)';
      })

      .then(() => sequencer.animate(el, () => {
        el.style.transform = 'translateY(0%)';
      }))

      .then(animationEnded);

      var mutation = sequencer.mutate(mutationTask);

      return Promise.all([
        animation,
        mutation
      ])

      .then(() => {
        assert.isTrue(mutationTask.calledAfter(animationEnded));
      });
    });
  });

  suite('.clear()', function() {
    test('mutate', function(done) {
      var spy = sinon.spy();
      var task = sequencer.mutate(spy);

      sequencer.clear(task);

      requestAnimationFrame(() => {
        sinon.assert.notCalled(spy);
        done();
      });
    });

    test('mutate (queued)', function(done) {
      var defer = new Deferred();
      var onmutation = sinon.spy();
      var onclick = sinon.spy();

      sequencer.on(el, 'click', e => {
        onclick();
        return defer.promise;
      });

      el.dispatchEvent(new CustomEvent('click'));

      var task = sequencer.mutate(onmutation);
      sequencer.clear(task);

      defer.resolve();

      requestAnimationFrame(() => {
        Promise.resolve().then(() => {
          sinon.assert.calledOnce(onclick);
          sinon.assert.notCalled(onmutation);
          done();
        });
      });
    });
  });

  suite('chaining', function() {
    test('tasks are called once the previous one completes', function() {
      var spys = [sinon.spy(), sinon.spy(), sinon.spy()];

      return sequencer
        .mutate(() => {
          el.style.height = '50px';
          el.style.background = 'red';
          el.style.transition = 'transform 200ms';
          spys[0]();
          return el;
        })

        .animate(el, () => {
          el.style.transform = 'translateY(100%)';
          spys[1]();
          return el;
        })

        .animate(400, el => {
          var rects = el.getBoundingClientRect();
          assert.equal(rects.top, 50);
          el.style.transform = 'translateY(0%)';
          spys[2]();
        });
    });

    test('return values are passed on', function() {
      var start;

      return sequencer
        .measure(() => el.clientHeight)
        .mutate(value => el.style.height = (value * 2) + 'px')
        .measure(px => {
          assert.equal(px, '200px');
          assert.equal(el.clientHeight, 200);
        })

        .animate(() => {
          start = Date.now();
          el.style.transform = 'scale(2)';
          return el;
        })

        .animate(el => el.style.transform = 'scale(1)')

        .then(result => {
          assert.equal(result, 'scale(1)');
          var elapsed = Date.now() - start;
          assert.isAtLeast(elapsed, 600);
        });
    });
  });

  suite('SequencerPromise', function() {
    var wrapper = callback => arg => callback(arg);

    test('chained .then()s are all wrapped', function() {
      var defer = new Deferred();
      var state = 'not-running';

      var wrapped = new sequencer.SequencerPromise(sequencer, defer.promise, {
        wrapper: callback => {
          return value => {
            state = 'running';
            var result = callback(value);
            state = 'not-running';
            return result;
          };
        }
      });

      defer.resolve();

      return wrapped.then(() => {
        assert.equal(state, 'running');
      })

      .then(() => {
        assert.equal(state, 'running');
      });
    });

    test('catch() is wrapped', function() {
      var defer = new Deferred();
      var state = 'not-running';

      var wrapped = new sequencer.SequencerPromise(sequencer, defer.promise, {
        wrapper: callback => {
          return value => {
            state = 'running';
            var result = callback(value);
            state = 'not-running';
            return result;
          };
        }
      });

      defer.reject('boo');

      return wrapped.then(() => {
        throw new Error('should not resolve');
      })

      .catch(() => {
        assert.equal(state, 'running');
      });
    });

    test('throwing inside .then() hits .catch()', function() {
      var defer = new Deferred();

      var wrapped = new sequencer.SequencerPromise(sequencer, defer.promise, {
        wrapper: wrapper
      });

      defer.resolve('foo');

      return wrapped.then(() => {
        throw new Error('boo');
      })

      .catch(err => {
        assert.equal(err.message, 'boo');
      });
    });

    test('.then() recieves arguments', function() {
      var defer = new Deferred();
      var wrapped = new SequencerPromise(sequencer, defer.promise, {
        wrapper: wrapper
      });

      defer.resolve('foo');

      return wrapped.then(result => {
        assert.equal(result, 'foo');
        return 'bar';
      })

      .then(result => {
        assert.equal(result, 'bar');
      });
    });

    test('calling .cancel() prevents ancestors running', function() {
      var spys = [sinon.spy(), sinon.spy(), sinon.spy()];
      var defer = new Deferred();
      var first = new SequencerPromise(sequencer, defer.promise, {
        wrapper: wrapper
      });

      var last = first
        .then(spys[0])
        .then(spys[1])
        .then(spys[2]);

      last.cancel();
      defer.resolve();

      return defer.promise.then(() => {
        sinon.assert.notCalled(spys[0]);
        sinon.assert.notCalled(spys[1]);
        sinon.assert.notCalled(spys[2]);
      });
    });

    test('calling .cancel() prevents descendants running', function() {
      var spys = [sinon.spy(), sinon.spy(), sinon.spy()];
      var defer = new Deferred();
      var first = new SequencerPromise(sequencer, defer.promise, {
        wrapper: wrapper
      });

      first
        .then(spys[0])
        .then(spys[1])
        .then(spys[2]);

      first.cancel();
      defer.resolve();

      return defer.promise.then(() => {
        sinon.assert.notCalled(spys[0]);
        sinon.assert.notCalled(spys[1]);
        sinon.assert.notCalled(spys[2]);
      });
    });

    test('calling .cancel() prevents siblings running', function() {
      var spy = sinon.spy();

      create(Promise.resolve())
        .then(() => create(Promise.resolve()).then(spy));

      return wait()
        .then(() => {
          sinon.assert.calledOnce(spy);
          spy.reset();

          var spromise = create(Promise.resolve()).then(() => {
            return create(Promise.resolve()).then(spy);
          });

          spromise.cancel();
          return wait();
        })

        .then(() => {
          sinon.assert.notCalled(spy);
        });

      function create(promise) {
        return new SequencerPromise(sequencer, promise, { wrapper: wrapper });
      }
    });
  });

  /**
   * Utils
   */

  function Deferred() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
