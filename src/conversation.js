export class Conversation {
  constructor() { this.messages = []; this.state = 'idle'; }
  begin(text) {
    if (this.state !== 'idle' || !text.trim()) return false;
    this.messages.push({ role: 'user', content: text.trim().slice(0, 320) });
    this.messages = this.messages.slice(-20);
    this.state = 'absorbing';
    return true;
  }
  reply(text) {
    this.messages.push({ role: 'assistant', content: text });
    this.state = 'writing';
  }
  finish() { this.state = 'idle'; }
  fail() { this.messages.pop(); this.state = 'idle'; }
  reset() { this.messages = []; this.state = 'idle'; }
}
