export class DeskInteractions {
  constructor() {
    this.lampOn = true;
    this.bookTarget = 0;
    this.bookProgress = 0;
    this.quillHeld = false;
  }
  toggleLamp() { this.lampOn = !this.lampOn; return this.lampOn; }
  setBookOpen(open) {
    this.bookTarget = open ? 1 : 0;
    if (!open) this.quillHeld = false;
  }
  toggleBook() { this.setBookOpen(!this.bookTarget); }
  pickQuill() { this.setBookOpen(true); this.quillHeld = true; }
  putQuillDown() { this.quillHeld = false; }
  advance(dt, reduced = false) {
    const step = reduced ? 1 : Math.max(0, dt) / 1.8;
    const direction = Math.sign(this.bookTarget - this.bookProgress);
    this.bookProgress = direction > 0
      ? Math.min(this.bookTarget, this.bookProgress + step)
      : Math.max(this.bookTarget, this.bookProgress - step);
  }
}
