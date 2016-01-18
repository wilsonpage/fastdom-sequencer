(function() {
/*global sequencer*/

var list = document.querySelector('.container');
var content = document.querySelector('.content');
var result = document.querySelector('.result');

sequencer.on(list, 'scroll', function() {
  var y =  list.scrollTop;
  sequencer.mutate(() => result.textContent = y);
});

setInterval(() => {
  var time = Date.now();
  sequencer.mutate(() => {
    var li = document.createElement('li');
    li.textContent = time;
    content.appendChild(li);
  });
}, 2000);

})();
