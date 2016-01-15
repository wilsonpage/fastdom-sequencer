(function() {
/*global sequencer*/

var list = document.querySelector('.container');
var content = document.querySelector('.content');
var result = document.querySelector('.result');

window.scrolls = 0;
window.mutations = 0;

sequencer.on(list, 'scroll', function() {
  // debugger;
  return sequencer.measure(() => {
    var y =  list.scrollTop;
    return sequencer.mutate(() => {
      // console.log('scrolls', window.scrolls);
      // console.log('mutations', ++window.mutations);
      result.textContent = y;
    });
  });
});

// setInterval(() => {
//   sequencer.mutate(() => {
//     var li = document.createElement('li');
//     li.textContent = Date.now();
//     content.appendChild(li);
//   });
// }, 2000);

})();
