/* Звуки без файлов: синтезируются в браузере. Включение запоминается. */
const Sound = (() => {
  let ctx, on = true;
  try { on = localStorage.getItem("sound") !== "off"; } catch (e) {}
  const ac = () => (ctx = ctx || new (window.AudioContext || window.webkitAudioContext)());
  function tone(f, at = 0, dur = 0.15, type = "sine", vol = 0.12, slideTo) {
    if (!on) return;
    try {
      const c = ac(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  const seq = (n, step, dur, type, vol) => n.forEach((f, i) => tone(f, i * step, dur, type, vol));
  return {
    get on() { return on; },
    toggle() { on = !on; try { localStorage.setItem("sound", on ? "on" : "off"); } catch (e) {} if (on) this.click(); return on; },
    click()  { tone(620, 0, 0.07, "triangle", 0.09); },
    select() { tone(520, 0, 0.09, "sine", 0.1); tone(780, 0.06, 0.12, "sine", 0.08); },
    next()   { tone(440, 0, 0.06, "triangle", 0.06); },
    login()  { seq([523, 659, 784], 0.09, 0.22, "sine", 0.1); },
    result(mood) {
      if (mood === "good") seq([523, 659, 784, 1047], 0.12, 0.35, "sine", 0.11);
      else if (mood === "mid") seq([440, 392, 440], 0.2, 0.4, "triangle", 0.1);
      else { tone(110, 0, 1.2, "sawtooth", 0.07, 70); tone(165, 0.05, 1.1, "sawtooth", 0.05, 100); tone(82, 0.5, 1.2, "sine", 0.12); }
    }
  };
})();
