# sequencer

## API

### sequencer#interaction()

Indicates a high-priority interaction that should defer any `.animation()`s or `.mutation()`s that are executed elsewhere in the app. This protects any interaction related UI changes from jank.

```js
sequencer.interaction(element, 'scroll', function(e) {
  sequencer.mutate(function() {
    // ...
  });
});
```

```js
sequencer.interaction(element, 'click', function(e) {
  return sequencer.animation(element, function() {
    element.classList.add('grow');
  });
});
```

```js
sequencer.on(element, 'click', function(e) {
  return sequencer.animation(element, function() {
    element.classList.add('grow');
  });
});
```

```js
sequencer.on(element, 'click', function(e) {
  return sequencer.animation(element, function() {
    element.classList.add('grow');
  }).then(function() {
    return sequencer.animation(element, function() {
      element.classList.add('shrink');
    });
  });
});
```

```js
sequencer.off(element, 'click', callback);
```

- `.animation()` or `.mutate()` tasks inside the `.interaction()` callbacks are run instantly and not deferred.

### sequencer#animation()

Should contain any animation/transition code.

```js
sequencer.animation(element, function() {
  element.style.transform = 'translateY(100%)';
}).then(function() {
  // transition/animation end
});
```

- Is deferred by any incomplete `.interactions()`
- Run instantly if no `.interactions()` are happening
- Internally run inside `sequencer.mutate()` as DOM changes will be required to trigger animation

### sequencer#mutate()

Should contain any code that is likely to cause document reflow/layout.

```js
sequencer.mutate(element, function() {
  var li = document.createElement('li');
  list.appendChild(li);
});
```

- Is deferred by any incomplete `.interactions()`
- Run instantly if no `.interactions()` are happening
- Internally run inside `sequencer.mutate()` as DOM changes will be required to trigger animation
