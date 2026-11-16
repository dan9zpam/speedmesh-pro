(function() {
  const RealDate = Date;
  
  // Чтение даты из синхронного localStorage страницы
  let spoofedDateStr = window.localStorage.getItem('__mesh_spoofed_date');

  // Слушатель для обновления даты из расширения
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.type !== 'SET_MESH_DATE') return;
    window.localStorage.setItem('__mesh_spoofed_date', event.data.value);
  });

  if (!spoofedDateStr) return;

  const targetDate = new RealDate(spoofedDateStr + 'T10:00:00');
  if (Number.isNaN(targetDate.getTime())) return;
  const timeOffset = targetDate.getTime() - RealDate.now();

  function MockDate(...args) {
    if (!(this instanceof MockDate)) {
      return new RealDate(RealDate.now() + timeOffset).toString();
    }
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