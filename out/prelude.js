var exports = {} // we're cheating a whole damn lot.

window.addEventListener('message', ev => {
  var code = ev.data
  var sc = document.createElement('script')
  sc.appendChild(document.createTextNode(code))
  document.head.appendChild(sc)
})

function require(name) {
  return window[name]
}
