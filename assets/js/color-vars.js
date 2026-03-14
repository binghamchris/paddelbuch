(function () {
  var el = document.getElementById('paddelbuch-colors');
  if (el) {
    window.PaddelbuchColors = JSON.parse(el.textContent);
  }
})();
