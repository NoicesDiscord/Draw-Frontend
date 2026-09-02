class SoundManager {
  constructor() {
    this.sounds = {
      join: new Audio('/sounds/join.mp3'),
      leave: new Audio('/sounds/leave.mp3'),
      close: new Audio('/sounds/close.mp3'),
      alert: new Audio('/sounds/alert.mp3'),
      success: new Audio('/sounds/success.mp3'),
      like: new Audio('/sounds/like.mp3'),
      dislike: new Audio('/sounds/dislike.mp3'),
      summary: new Audio('/sounds/summary.mp3'),
      win: new Audio('/sounds/win.mp3'),
      select: new Audio('/sounds/select.mp3'),
      start: new Audio('/sounds/start.mp3'),
      tick: new Audio('/sounds/tick.mp3')
    };
 
    // Pre-configure volumes
    this.sounds.join.volume = 0.4;
    this.sounds.leave.volume = 0.4;
    this.sounds.close.volume = 0.5;
    this.sounds.alert.volume = 0.6;
    this.sounds.success.volume = 0.5;
    this.sounds.like.volume = 0.5;
    this.sounds.dislike.volume = 0.5;
    this.sounds.summary.volume = 0.6;
    this.sounds.win.volume = 0.7;
    this.sounds.select.volume = 0.6;
    this.sounds.start.volume = 0.6;
    this.sounds.tick.volume = 0.5;

    this.enabled = true; // Global toggle for future mute buttons
  }

  play(name) {
    if (!this.enabled || !this.sounds[name]) return;
    const sound = this.sounds[name];
    sound.currentTime = 0;
    sound.play().catch(e => console.log(`Audio [${name}] blocked by browser policy:`, e));
  }

  stop(name) {
    if (!this.sounds[name]) return;
    this.sounds[name].pause();
    this.sounds[name].currentTime = 0;
  }
}

export const soundManager = new SoundManager(); 