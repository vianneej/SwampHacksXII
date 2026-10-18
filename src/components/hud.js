function drawIcon(ctx, frames, name, cx, cy, h, widthOverride = null) {
  const frame = frames[name];
  const width = widthOverride ?? Math.round(h * (frame.sw / frame.sh));
  ctx.drawImage(
    frame.img,
    frame.sx,
    frame.sy,
    frame.sw,
    frame.sh,
    Math.round(cx - width / 2),
    Math.round(cy - h / 2),
    width,
    h,
  );
}

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = '#3a2112';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = '#a8672c';
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 6);
  ctx.fill();
  ctx.fillStyle = '#f3dba2';
  ctx.beginPath();
  ctx.roundRect(x + 5, y + 5, w - 10, h - 10, 4);
  ctx.fill();
}

export function drawCoin(ctx, frames, coin, time) {
  const bob = Math.sin(time * 3 + coin.phase) * 3;
  const spin = Math.abs(Math.cos(time * 3.2 + coin.phase));
  const cx = Math.round(coin.x);
  const cy = Math.round(coin.y - 20 + bob);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, Math.round(coin.y), 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  drawIcon(ctx, frames, 'coin', cx, cy, 24, Math.max(5, Math.round(24 * spin)));
}

export function drawHud(ctx, frames, game, width) {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const minutes = Math.floor(game.minutes / 10) * 10;
  const hour = Math.floor(minutes / 60) % 24;
  const mm = String(minutes % 60).padStart(2, '0');
  const timeText = `${hour % 12 || 12}:${mm} ${hour < 12 ? 'AM' : 'PM'}`;
  const dayText = `${weekdays[(game.day - 1) % 7]} ${((game.day - 1) % 28) + 1}`;
  const isDay = game.minutes >= 6 * 60 && game.minutes < 19 * 60;

  const panelWidth = 268;
  const x = width - panelWidth - 14;
  drawPanel(ctx, x, 12, panelWidth, 50);
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 19px "Courier New", monospace';
  ctx.fillStyle = '#3a2112';
  ctx.textAlign = 'left';
  ctx.fillText(dayText, x + 18, 38);
  drawIcon(ctx, frames, isDay ? 'sun' : 'moon', x + 120, 37, 40);
  ctx.textAlign = 'right';
  ctx.fillText(timeText, x + panelWidth - 16, 38);

  const coinPanelWidth = 176;
  const bump = Math.round(game.coinBump * 3);
  const coinX = width - coinPanelWidth - 14;
  drawPanel(ctx, coinX, 68 - bump, coinPanelWidth, 48);
  drawIcon(ctx, frames, 'coin', coinX + 32, 92 - bump, 34);
  ctx.fillStyle = '#3a2112';
  ctx.textAlign = 'right';
  ctx.fillText(String(game.coins), coinX + coinPanelWidth - 18, 93 - bump);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

export function drawPops(ctx, pops, coinValue) {
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const pop of pops) {
    const progress = pop.t / 0.9;
    ctx.globalAlpha = 1 - progress * progress;
    ctx.fillStyle = '#3a2112';
    ctx.fillText(`+${coinValue}`, pop.x + 1, pop.y - progress * 26 + 1);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(`+${coinValue}`, pop.x, pop.y - progress * 26);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
