import { CanvasTexture, SRGBColorSpace } from 'three';

export function wrapLines(text, measure, width) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (let word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && measure(line + ' ' + word) > width) { lines.push(line); line = ''; }
      while (measure(word) > width) {
        if (line) { lines.push(line); line = ''; }
        let end = 1;
        while (end < word.length && measure(word.slice(0, end + 1)) <= width) end++;
        lines.push(word.slice(0, end)); word = word.slice(end);
      }
      if (word) line += (line ? ' ' : '') + word;
    }
    if (line || !paragraph.trim()) lines.push(line);
  }
  return lines;
}

export function inkTip(lines, progress) {
  let current = null;
  for (const line of lines) {
    if (progress < line.start) break;
    current = { x: line.x + Math.min(line.width, Math.max(0, progress - line.start)), y: line.y - 14 };
  }
  return current;
}

export class InkPage {
  constructor(image, side) {
    this.side = side;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024; this.canvas.height = 1536;
    this.ctx = this.canvas.getContext('2d');
    this.ink = document.createElement('canvas');
    this.ink.width = 1024; this.ink.height = 1536;
    this.inkCtx = this.ink.getContext('2d');
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.image = image; this.lines = []; this.total = 0;
    this.setText(''); this.render(0, 1);
  }
  setText(text) {
    const ctx = this.inkCtx;
    ctx.clearRect(0, 0, 1024, 1536);
    let size = this.side === 'left' ? 49 : 78;
    const family = this.side === 'left' ? 'Cedarville Cursive' : 'Pinyon Script';
    let lines;
    do {
      ctx.font = `${size}px "${family}"`;
      lines = wrapLines(text, s => ctx.measureText(s).width, 780);
      if (lines.length <= 11) break;
      size -= 2;
    } while (size > 34);
    this.lineHeight = this.side === 'left' ? size * 1.7 : size * 1.15;
    ctx.fillStyle = this.side === 'left' ? '#32251d' : '#201e1b';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = '#271f1c40'; ctx.shadowBlur = .8;
    this.lines = []; let offset = 0;
    for (const [i, line] of lines.entries()) {
      const width = ctx.measureText(line).width;
      const x = 122 + Math.sin(i * 3.7) * 3;
      const y = 335 + i * this.lineHeight;
      ctx.fillText(line, x, y);
      this.lines.push({ x, y, width, start: offset });
      offset += width + 55;
    }
    this.total = Math.max(0, offset - 55);
  }
  render(progress, opacity = 1, dissolve = 0) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 1024, 1536);
    ctx.drawImage(this.image, 0, 0, 1024, 1536);
    // Shading belongs to the paper, not a UI panel.
    const gutter = ctx.createLinearGradient(0, 0, 1024, 0);
    if (this.side === 'left') {
      gutter.addColorStop(0, '#402b120a'); gutter.addColorStop(.84, '#402b1200'); gutter.addColorStop(1, '#30200f5e');
    } else {
      gutter.addColorStop(0, '#30200f5e'); gutter.addColorStop(.16, '#402b1200'); gutter.addColorStop(1, '#402b120a');
    }
    ctx.fillStyle = gutter; ctx.fillRect(0, 0, 1024, 1536);
    ctx.fillStyle = '#55412a80'; ctx.font = '25px "IM FELL English"'; ctx.textAlign = 'center';
    ctx.fillText(this.side === 'left' ? '1 3   J U N E' : '1 9 4 3', 512, 153);
    ctx.strokeStyle = '#6e4e2f30'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(430, 181); ctx.lineTo(594, 181); ctx.stroke();
    ctx.font = '20px "IM FELL English"';
    ctx.fillStyle = '#5d442d55'; ctx.fillText(this.side === 'left' ? '—  1  —' : '—  2  —', 512, 1447);
    ctx.textAlign = 'left';
    ctx.save();
    ctx.globalAlpha = Math.max(0, opacity * (1 - dissolve));
    if (dissolve > 0) ctx.filter = `blur(${dissolve * 2.5}px)`;
    let tip = null;
    for (const line of this.lines) {
      const shown = Math.max(0, Math.min(line.width + 12, progress - line.start));
      if (shown <= 0) continue;
      ctx.drawImage(this.ink, line.x - 10, line.y - 100, shown + 10, this.lineHeight + 20,
        line.x - 10, line.y - 100, shown + 10, this.lineHeight + 20);
      if (shown < line.width + 12) tip = { x: line.x + shown, y: line.y - 14 + Math.sin(shown * .11) * 13 };
    }
    ctx.restore(); this.texture.needsUpdate = true;
    return tip;
  }
}
