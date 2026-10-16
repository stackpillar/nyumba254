(() => {
  'use strict';

  const STORAGE_KEY = 'nk-notification-sound-enabled';
  const EVENT_NAME = 'nk-notification-sound-change';
  let audio = null;
  let unlocked = false;
  let unlocking = null;

  function enabled() {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch (error) {
      console.warn('Could not read notification sound preference:', error);
      return true;
    }
  }

  function getAudio() {
    if (!audio) {
      audio = document.getElementById('scw-notify-sound') || new Audio('/assets/notify.mp3');
      audio.preload = 'auto';
      audio.volume = 0.65;
    }
    return audio;
  }

  function announce() {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { enabled: enabled(), unlocked } }));
  }

  async function unlock() {
    if (unlocked) return true;
    if (unlocking) return unlocking;
    const player = getAudio();
    unlocking = (async () => {
      const previousVolume = player.volume;
      player.volume = 0;
      try {
        await player.play();
        player.pause();
        player.currentTime = 0;
        player.volume = previousVolume;
        unlocked = true;
        document.removeEventListener('pointerdown', onUserGesture, true);
        document.removeEventListener('keydown', onUserGesture, true);
        document.removeEventListener('touchstart', onUserGesture, true);
        announce();
        return true;
      } catch {
        player.volume = previousVolume;
        return false;
      }
    })();
    try {
      return await unlocking;
    } finally {
      unlocking = null;
    }
  }

  function onUserGesture() {
    unlock();
  }

  async function play() {
    if (!enabled()) return false;
    if (!unlocked && !await unlock()) return false;
    const player = getAudio();
    try {
      player.currentTime = 0;
      await player.play();
      return true;
    } catch {
      unlocked = false;
      announce();
      return false;
    }
  }

  async function setEnabled(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    } catch (error) {
      console.warn('Could not save notification sound preference:', error);
    }
    if (!value) {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      announce();
      return true;
    }
    const ready = await unlock();
    announce();
    if (ready) await play();
    return ready;
  }

  document.addEventListener('pointerdown', onUserGesture, true);
  document.addEventListener('keydown', onUserGesture, true);
  document.addEventListener('touchstart', onUserGesture, { capture: true, passive: true });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) announce();
  });

  window.NKNotificationSound = { enabled, play, setEnabled, unlocked: () => unlocked, eventName: EVENT_NAME };
})();
