// Broadcast-quality Web Audio API Synthesizer for CricBid Live Auction
// Zero external mp3 dependencies: zero 404s, zero network latency, instant sub-5ms playback

class AuctionAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cricbid_auction_muted');
        this.isMuted = stored === 'true';
      } catch (e) {}
    }
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('cricbid_auction_muted', String(this.isMuted));
    } catch (e) {}
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('cricbid_auction_muted', String(muted));
    } catch (e) {}
  }

  /**
   * Bid Increment Chime: Crystal dual-tone chime (F#5 -> C#6)
   */
  public playBidChime() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Note 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(740, now); // F#5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2 (Ascending harmonic)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1108.73, now + 0.08); // C#6
      gain2.gain.setValueAtTime(0.35, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.55);
    } catch (err) {}
  }

  /**
   * Countdown warning tick: Short high-impact warning blip (Going Once / Going Twice)
   */
  public playCountdownTick(secondsLeft: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = secondsLeft <= 3 ? 1200 : 880;
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (err) {}
  }

  /**
   * Final Gavel / Hammer Drop: Deep wooden resonance + sub-bass slam + triumphant shimmer
   */
  public playSoldHammer() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. Sub-bass hammer impact (Wooden thud)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.4);

      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);

      // 2. High snap click of the gavel head hitting base
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(2400, now);
      clickOsc.frequency.exponentialRampToValueAtTime(300, now + 0.06);

      clickGain.gain.setValueAtTime(0.4, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start(now);
      clickOsc.stop(now + 0.07);

      // 3. Triumphant victory brass fan-fare flourish
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const fanOsc = ctx.createOscillator();
        const fanGain = ctx.createGain();
        const start = now + 0.15 + idx * 0.09;

        fanOsc.type = 'sawtooth';
        fanOsc.frequency.setValueAtTime(freq, start);

        fanGain.gain.setValueAtTime(0.2, start);
        fanGain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

        fanOsc.connect(fanGain);
        fanGain.connect(ctx.destination);
        fanOsc.start(start);
        fanOsc.stop(start + 0.45);
      });
    } catch (err) {}
  }

  /**
   * Unsold Buzzer: Dual low warning tone
   */
  public playUnsoldBuzzer() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.setValueAtTime(196, now + 0.15); // G3

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (err) {}
  }
}

export const auctionAudio = new AuctionAudioSynthesizer();
