(function() {
  const RealDate = Date;
  
  // Чтение даты из синхронного localStorage страницы
  let spoofedDateStr = window.localStorage.getItem('__mesh_spoofed_date');

  // Слушатель для обновления даты из расширения
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'SET_MESH_DATE') {
      window.localStorage.setItem('__mesh_spoofed_date', event.data.value);
    }
  });

  if (!spoofedDateStr) return;

  const targetDate = new RealDate(spoofedDateStr + 'T10:00:00');
  const timeOffset = targetDate.getTime() - RealDate.now();

  function MockDate(...args) {
    if (args.length === 0) {
      return new RealDate(RealDate.now() + timeOffset);
    }
    return new RealDate(...args);
  }

  MockDate.prototype = RealDate.prototype;
  MockDate.now = function() {
    return RealDate.now() + timeOffset;
  };
  MockDate.UTC = RealDate.UTC;
  MockDate.parse = RealDate.parse;

  window.Date = MockDate;
})();