(function () {
  try {
    var t = localStorage.getItem('recruit-ai-theme');
    document.documentElement.classList.add(t === 'light' ? 'light' : 'dark');
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
