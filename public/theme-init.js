(function () {
  try {
    var t = localStorage.getItem('recruit-ai-theme');
    document.documentElement.classList.add(t === 'dark' ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.classList.add('light');
  }
})();
