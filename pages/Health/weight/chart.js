const { DAY_MS, formatDate } = require('./utils.js');

function drawTrendChart(page) {
  const { records, today, trendDays, hideNumbers } = page.data;
  const query = wx.createSelectorQuery().in(page);

  query.select('#trendChart').fields({ node: true, size: true }).exec(result => {
    if (!result || !result[0]) return;

    const { node: canvas, width, height } = result[0];
    const context = canvas.getContext('2d');
    const pixelRatio = 2;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    context.scale(pixelRatio, pixelRatio);
    context.clearRect(0, 0, width, height);

    const endDate = new Date(today);
    const startDate = new Date(endDate.getTime() - (trendDays - 1) * DAY_MS);
    const recordMap = new Map(records.map(record => [record.date, record.weight]));
    const points = [];

    for (let index = 0; index < trendDays; index++) {
      const date = formatDate(new Date(startDate.getTime() + index * DAY_MS));
      points.push({
        date,
        weight: recordMap.has(date) ? recordMap.get(date) : null
      });
    }

    const values = points
      .filter(point => point.weight !== null)
      .map(point => point.weight);
    if (!values.length) return;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const yMin = min - 0.5;
    const yMax = max + 0.5;
    const toX = index => 20 + index * (width - 40) / (trendDays - 1);
    const toY = value => height - 20 - (value - yMin) / (yMax - yMin) * (height - 40);

    context.lineWidth = 2;
    context.strokeStyle = '#6b5cff';
    context.beginPath();
    let started = false;

    points.forEach((point, index) => {
      if (point.weight === null) return;
      const x = toX(index);
      const y = toY(point.weight);
      if (!started) {
        context.moveTo(x, y);
        started = true;
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();

    if (!hideNumbers) {
      context.fillStyle = '#666';
      context.font = '12px sans-serif';
      context.textAlign = 'left';
      context.fillText(`范围 ${min}~${max} kg`, 20, 20);
    }
  });
}

module.exports = {
  drawTrendChart
};
