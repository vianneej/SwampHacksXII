import cafeMusicUrl from '../../assets/cafemusic.mp3';

let audio = null;

// Browsers block autoplay, so the loop starts on the first click or key press.
export function startBackgroundMusic() {
  if (audio) return;
  audio = new Audio(cafeMusicUrl);
  audio.loop = true;
  audio.volume = 1;

  const events = ['pointerdown', 'keydown'];
  const tryPlay = () => {
    audio.play().then(() => {
      for (const name of events) window.removeEventListener(name, tryPlay);
    }).catch(() => {});
  };
  for (const name of events) window.addEventListener(name, tryPlay);
  tryPlay();
}

export function isMusicMuted() {
  return audio ? audio.muted : false;
}

export function toggleMusicMuted() {
  if (!audio) return false;
  audio.muted = !audio.muted;
  return audio.muted;
}
