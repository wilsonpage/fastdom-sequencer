/*jshint maxlen:false*/
/*global suite, setup, teardown, test, assert, sinon, sequencer*/

suite('fastdom', function() {
  var dom;
  var el;

  setup(function() {
    // sequencer = fastdom.extend(fastdomSequence);
    dom = document.createElement('div');

    // el = document.createElement('div');
    // el.style.width = el.style.height = '100px';
    // el.style.transition = 'transform 300ms';
    //
    el = document.createElement('div');
    el.style.height = el.style.width = '100px';
    el.style.overflowY = 'scroll';
    var scrollContent = document.createElement('div');
    scrollContent.style.height = '1000%';
    el.appendChild(scrollContent);
    dom.appendChild(el);

    document.body.appendChild(dom);
  });

  teardown(function() {
    // dom.remove();
  });

  suite('.on()', function() {
    test('it can bind events', function() {
      var spy = sinon.spy();
      sequencer.on(el, 'click', spy);
      el.dispatchEvent(new CustomEvent('click'));
      sinon.assert.calledOnce(spy);
    });

    test('nested `.animate()`s are not blocked', function(done) {
      var start = Date.now();

      sequencer.on(el, 'click', function() {
        return sequencer.animate(el, function() {
          el.style.transform = 'translateY(100%)';
          assert.isAtMost(Date.now() - start, 100);
          done();
        });
      });

      el.dispatchEvent(new CustomEvent('click'));
    });

    test.only('it does not run more than 1 callback per frame', function(done) {
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

    test.only('it does not run more than 1 callback per frame', function(done) {
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
  });

  suite('.animate()', function() {
    setup(function() {
      el.style.transition = 'transform 300ms';
    });

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

    test('are blocked by pending interactions', function() {
      var interaction = 300;
      var animation = 300;
      var buffer = sequencer.BUFFER;
      var expected = interaction + animation + buffer;

      sequencer.on(el, 'click', e => {
        return new Promise(resolve => {
          setTimeout(resolve, interaction);
        });
      });

      el.dispatchEvent(new CustomEvent('click'));

      var start = Date.now();

      return sequencer.animate(el, () => {
        el.style.transform = 'translateY(100%)';
      })

      .then(() => {
        var elapsed = Date.now() - start;
        assert.isAtLeast(elapsed, expected);
      });
    });
  });

  suite.skip('wrappedpromise', function() {
    test('chained .then()s are all wrapped', function() {
      var defer = new Deferred();
      var state = 'not-running';

      var wrapped = new sequencer.WrappedPromise(defer.promise, {
        before: () => state = 'running',
        after: () => state = 'not-running'
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

      var wrapped = new sequencer.WrappedPromise(defer.promise, {
        before: () => state = 'running',
        after: () => state = 'not-running'
      });

      defer.reject('boo');

      return wrapped.then(() => {
        throw new Error('should not resolve');
      })

      .catch(() => {
        console.log('2');
        assert.equal(state, 'running');
      });
    });

    test('throwing inside .then() hits .catch()', function() {
      var defer = new Deferred();
      var state = 'not-running';

      var wrapped = new sequencer.WrappedPromise(defer.promise, {
        before: () => state = 'running',
        after: () => state = 'not-running'
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
      var state = 'not-running';

      var wrapped = new sequencer.WrappedPromise(defer.promise, {
        before: () => state = 'running',
        after: () => state = 'not-running'
      });

      defer.resolve('foo');

      return wrapped.then(result => {
        assert.equal(result, 'foo');
        assert.equal(state, 'running');
        return 'bar';
      })

      .then(result => {
        assert.equal(state, 'running');
        assert.equal(result, 'bar');
      });
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
});
