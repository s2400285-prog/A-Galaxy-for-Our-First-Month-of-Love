'use strict';

const byId = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const planetLinks = [...document.querySelectorAll('[data-planet]')];
const planets = planetLinks.map((link) => link.dataset.planet);
const scenes = new Map([...document.querySelectorAll('main > .scene')].map((scene) => [scene.id, scene]));
const visited = new Set();
const openedSecrets = new Set();
let currentScene = 'gate';
let accessGranted = false;
let entering = false;

/* Entrance and five-second warp */
const gateForm = byId('gate-form');
const password = byId('password');
const passwordError = byId('password-error');
const warp = byId('warp');
const warpMessage = byId('warp-message');
const warpLines = [
  'Preparing a universe...',
  'Gathering all the stars...',
  'Collecting every little memory...',
  'Opening a world made entirely for you...',
  'Welcome to my universe, Julie.'
];

function typeWelcome() {
  if (reducedMotion.matches) return;
  const welcome = byId('welcome-typing');
  const message = welcome.textContent;
  const startsAt = performance.now() + 280;
  welcome.textContent = '';
  welcome.classList.add('typing-caret');

  function write(now) {
    const length = Math.min(message.length, Math.max(0, Math.floor((now - startsAt) / 46)));
    welcome.textContent = message.slice(0, length);
    if (length < message.length && !entering && !reducedMotion.matches) {
      requestAnimationFrame(write);
    } else {
      welcome.textContent = message;
      welcome.classList.remove('typing-caret');
    }
  }
  requestAnimationFrame(write);
}

gateForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (entering || accessGranted) return;

  if (password.value.trim().toUpperCase() !== 'JULIE') {
    password.setAttribute('aria-invalid', 'true');
    passwordError.textContent = "Hmm, that's not the secret, baby. Try again!";
    password.focus();
    password.select();
    return;
  }

  entering = true;
  byId('enter-button').disabled = true;
  if (!musicManuallyControlled) playSong();
  byId('universe').inert = true;
  byId('site-header').inert = true;
  document.body.dataset.scene = 'warp';
  warp.hidden = false;
  warpMessage.textContent = warpLines[0];
  byId('warp-title').focus({ preventScroll: true });

  warpLines.slice(1).forEach((line, index) => {
    window.setTimeout(() => { warpMessage.textContent = line; }, (index + 1) * 1000);
  });
  window.setTimeout(() => {
    warp.hidden = true;
    byId('universe').inert = false;
    byId('site-header').inert = false;
    byId('journey-nav').hidden = false;
    byId('edition').hidden = true;
    accessGranted = true;
    entering = false;
    showScene('map');
  }, 5000);
});

password.addEventListener('input', () => {
  password.removeAttribute('aria-invalid');
  passwordError.textContent = '';
});

/* Route between scenes without replacing the audio player. */
const navMap = document.querySelector('.nav-map');
const progressMarkers = [...document.querySelectorAll('.nav-progress i')];
const endingLink = document.querySelector('.ending-link');
const jump = byId('jump');
const jumpStyles = { month: 'rose', letter: 'letter', thanks: 'thanks', secrets: 'secrets', next: 'next', map: 'map', ending: 'ending' };

function updateProgress() {
  const count = visited.size;
  const finished = count === planets.length;
  byId('flight-count').textContent = `${count} / ${planets.length} planets explored`;
  byId('flight-progress').value = count;
  byId('header-progress').textContent = `${count} of ${planets.length} planets explored.`;
  planetLinks.forEach((link, index) => {
    const seen = visited.has(planets[index]);
    const label = link.querySelector('strong').textContent;
    link.classList.toggle('is-visited', seen);
    link.setAttribute('aria-label', seen ? `${label}, explored` : label);
    progressMarkers[index].classList.toggle('is-visited', seen);
  });
  endingLink.disabled = !finished;
  if (finished) byId('flight-hint').textContent = 'All five planets explored. One last message is waiting.';
}

function prepareNextButton(scene) {
  const button = scene.querySelector('[data-continue]');
  if (!button) return;
  const index = planets.indexOf(scene.id);
  const remaining = [...planets.slice(index + 1), ...planets.slice(0, index)];
  const destination = remaining.find((planet) => !visited.has(planet));
  button.dataset.go = destination || 'ending';
  button.querySelector('span').textContent = destination ? 'Next planet' : 'Until we meet again';
  const nextLink = planetLinks.find((link) => link.dataset.planet === destination);
  if (nextLink) {
    button.setAttribute('aria-label', `Next planet: ${nextLink.querySelector('strong').textContent}`);
  } else {
    button.removeAttribute('aria-label');
  }
}

function showScene(id) {
  const scene = scenes.get(id);
  if (!accessGranted || !scene || id === 'gate' || id === currentScene) return;
  if (id === 'ending' && visited.size < planets.length) return;

  if (currentScene === 'letter') finishLetterBeforeLeaving();
  if (currentScene === 'ending') clearClosingTimers();

  const previous = scenes.get(currentScene);
  previous.classList.remove('is-entering');
  previous.hidden = true;
  currentScene = id;
  document.body.dataset.scene = id;
  scene.hidden = false;

  if (planets.includes(id)) visited.add(id);
  updateProgress();
  prepareNextButton(scene);
  if (id === 'map') {
    navMap.setAttribute('aria-current', 'page');
  } else {
    navMap.removeAttribute('aria-current');
  }

  if (!reducedMotion.matches) {
    jump.className = 'jump';
    jump.getBoundingClientRect();
    jump.classList.add(`${jumpStyles[id]}-jump`);
    scene.classList.add('is-entering');
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  scene.querySelector('h2').focus({ preventScroll: true });
  if (id === 'ending') startClosing();
  drawStars();
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('button[data-go]');
  if (link && !link.disabled) showScene(link.dataset.go);
});

/* The letter stays open when Julie revisits its planet. */
const envelope = byId('envelope');
const openLetterButton = byId('open-letter');
const letterSheet = byId('letter-sheet');
const skipTyping = byId('skip-typing');
let letterOpened = false;
let letterRevealTimer;
let letterFrame;

function stopTypingLetter() {
  cancelAnimationFrame(letterFrame);
  letterSheet.classList.remove('is-typing');
  letterSheet.querySelectorAll('.typing-ink').forEach((ink) => ink.remove());
  if (document.activeElement === skipTyping) byId('sheet-title').focus({ preventScroll: true });
  skipTyping.hidden = true;
}

function typeLetter() {
  const paragraphs = [...letterSheet.querySelectorAll('[data-type]')];
  const pauseBetween = 9;
  const rows = paragraphs.map((paragraph) => {
    const text = paragraph.querySelector('.typing-source').textContent;
    const ink = document.createElement('span');
    ink.className = 'typing-ink';
    ink.setAttribute('aria-hidden', 'true');
    paragraph.append(ink);
    return { text, ink, length: -1 };
  });
  const total = rows.reduce((length, row) => length + row.text.length + pauseBetween, 0);
  const startsAt = performance.now() + 270;
  letterSheet.classList.add('is-typing');
  skipTyping.hidden = false;

  function write(now) {
    const typed = Math.max(0, Math.floor((now - startsAt) * .098));
    let available = typed;
    for (const row of rows) {
      const length = Math.max(0, Math.min(available, row.text.length));
      if (length !== row.length) {
        row.ink.textContent = row.text.slice(0, length);
        row.length = length;
      }
      row.ink.classList.toggle('typing-caret', available >= 0 && available < row.text.length);
      available -= row.text.length + pauseBetween;
    }
    if (typed < total && !reducedMotion.matches) {
      letterFrame = requestAnimationFrame(write);
    } else {
      stopTypingLetter();
    }
  }
  letterFrame = requestAnimationFrame(write);
}

function revealLetter(focusLetter) {
  openLetterButton.hidden = true;
  letterSheet.hidden = false;
  if (!focusLetter) return;
  if (!reducedMotion.matches) typeLetter();
  byId('sheet-title').focus({ preventScroll: true });
  letterSheet.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
}

function finishLetterBeforeLeaving() {
  if (letterOpened && letterSheet.hidden) {
    clearTimeout(letterRevealTimer);
    revealLetter(false);
  }
  stopTypingLetter();
}

openLetterButton.addEventListener('click', () => {
  if (letterOpened) return;
  letterOpened = true;
  openLetterButton.setAttribute('aria-expanded', 'true');
  openLetterButton.disabled = true;
  envelope.classList.add('is-open');
  burstAt(envelope, 22);
  if (reducedMotion.matches) {
    revealLetter(true);
  } else {
    letterRevealTimer = window.setTimeout(() => revealLetter(true), 650);
  }
});
skipTyping.addEventListener('click', stopTypingLetter);

/* Personal photo and clickable stars */
const photo = byId('our-photo');
photo.addEventListener('error', () => { photo.hidden = true; });
if (photo.complete && photo.naturalWidth === 0) photo.hidden = true;

const thanksNotes = [
  'Thank you for the time you share with me. I always look forward to getting to know you a little more.',
  'Thank you for the way your kindness reaches the people I care about, too.',
  'Thank you for all the little moments that make us laugh. I love how easy it is to smile around you.',
  'Thank you for the thought you put into the things you do for me. I notice it, baby.',
  'Thank you for being exactly who you are, Julie. I’m so glad I get to know you.'
];
const thankStars = [...document.querySelectorAll('[data-thanks]')];
thankStars.forEach((star) => {
  star.addEventListener('click', () => {
    thankStars.forEach((other) => other.setAttribute('aria-pressed', String(other === star)));
    byId('thank-note').textContent = thanksNotes[Number(star.dataset.thanks)];
    burstAt(star, 7);
  });
});

const secretMessages = [
  'Sometimes, I smile at my screen just because I see your name. You have no idea how easily you make me happy.',
  'One of my favorite dreams is having a future where I can call you my wife and thank God every day for bringing you into my life.',
  'Even when we are not together, there is always a little part of my heart wishing you were beside me.',
  'I promise to keep learning how to love you better. Not just through words, but through patience, respect, loyalty, and actions.',
  'Out of all the worlds I could explore, I would still choose yours. And out of all the people I could meet, I am thankful that I met you.'
];
const secretDialog = byId('secret-dialog');
const bonus = byId('bonus-secret');

function showSecret(index, title, message) {
  byId('secret-dialog-index').textContent = index;
  byId('secret-dialog-title').textContent = title;
  byId('secret-dialog-message').textContent = message;
  secretDialog.showModal();
}

document.querySelectorAll('[data-secret]').forEach((star) => {
  star.addEventListener('click', () => {
    const index = Number(star.dataset.secret);
    openedSecrets.add(index);
    star.classList.add('is-open');
    star.querySelector('.secret-state').textContent = 'Opened';
    star.querySelector('use').setAttribute('href', '#i-check');
    byId('secret-progress').textContent = `${openedSecrets.size} / ${secretMessages.length} stars opened`;
    if (openedSecrets.size === secretMessages.length) {
      bonus.hidden = false;
      byId('bonus-hint').textContent = 'You found every star. There’s one more message just for you.';
    }
    showSecret(star.querySelector('.secret-number').textContent, star.querySelector('strong').textContent, secretMessages[index]);
  });
});

bonus.addEventListener('click', () => {
  if (openedSecrets.size !== secretMessages.length) return;
  showSecret('BONUS TRANSMISSION', 'One Last Secret', 'P.S. Baby, if you are smiling right now, then mission accomplished. I made this entire universe just to remind you how special you are to me.');
});

const milestone = byId('milestone');
milestone.addEventListener('click', () => {
  const open = milestone.getAttribute('aria-expanded') !== 'true';
  milestone.setAttribute('aria-expanded', String(open));
  byId('milestone-note').hidden = !open;
  byId('milestone-cue').firstChild.textContent = open ? 'The next orbit is glowing ' : 'Touch to light up the next orbit ';
  if (open) burstAt(milestone.querySelector('.milestone-digits'), 10);
});

/* The closing transmission follows the five planets. */
const closingLines = byId('closing-lines');
const closingPhrases = [...closingLines.querySelectorAll('p')];
const closingMessage = byId('closing-message');
let closingTimers = [];
let closingSeen = false;

function clearClosingTimers() {
  closingTimers.forEach((timer) => clearTimeout(timer));
  closingTimers = [];
}

function showClosingMessage(keepPhrasesVisible) {
  closingSeen = true;
  closingPhrases.forEach((phrase) => { phrase.hidden = false; });
  closingLines.classList.toggle('sr-only', !keepPhrasesVisible);
  closingMessage.hidden = false;
  if (scenes.get('ending').contains(document.activeElement)) byId('final-title').focus({ preventScroll: true });
}

function startClosing() {
  if (reducedMotion.matches || closingSeen) {
    showClosingMessage(reducedMotion.matches);
    return;
  }
  closingPhrases.forEach((phrase) => { phrase.hidden = true; });
  const arrivalTimes = [450, 2200, 3800, 6100, 8900];
  closingPhrases.forEach((phrase, index) => {
    closingTimers.push(window.setTimeout(() => { phrase.hidden = false; }, arrivalTimes[index]));
  });
  closingTimers.push(window.setTimeout(() => showClosingMessage(false), 13900));
}

/* Playback begins directly in a click or password-submit handler. */
const audio = byId('soundtrack');
const player = byId('music-player');
const playButton = byId('play-button');
const playIcon = byId('play-icon');
const musicStatus = byId('music-status');
const musicSettings = byId('music-settings');
const musicControls = byId('music-controls');
const seek = byId('seek');
const volume = byId('volume');
let musicManuallyControlled = false;
let audioContext;
let gain;
audio.volume = Number(volume.value);

function timeLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function updateTime() {
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const canSeek = duration > 0 && !audio.error;
  seek.disabled = !canSeek;
  seek.max = canSeek ? String(duration) : '100';
  seek.value = canSeek ? String(audio.currentTime) : '0';
  const currentLabel = timeLabel(audio.currentTime);
  const durationLabel = timeLabel(duration);
  seek.setAttribute('aria-valuetext', `${currentLabel} of ${durationLabel}`);
  byId('current-time').textContent = currentLabel;
  byId('duration').textContent = durationLabel;
}

function setMusicState(label, active = false, playing = false) {
  musicStatus.textContent = label;
  playButton.setAttribute('aria-label', active ? 'Pause music' : 'Play music');
  playIcon.setAttribute('href', active ? '#i-pause' : '#i-play');
  player.classList.toggle('is-playing', playing);
}

function useMobileVolume() {
  const level = Number(volume.value);
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext || Math.abs(audio.volume - level) < .01) return;
  try {
    if (!audioContext) {
      const context = new AudioContext();
      const volumeGain = context.createGain();
      volumeGain.gain.value = level;
      volumeGain.connect(context.destination);
      context.createMediaElementSource(audio).connect(volumeGain);
      audioContext = context;
      gain = volumeGain;
    }
    if (audioContext.state !== 'running') audioContext.resume().catch(() => {});
  } catch {
    // Leave the native player available when a browser blocks Web Audio.
  }
}

function playSong() {
  if (!audio.hasAttribute('src') || audio.error) audio.src = audio.dataset.src;
  setMusicState('LOADING SONG…', true);
  useMobileVolume();
  audio.play().catch((error) => {
    if (error.name === 'AbortError') return;
    if (error.name === 'NotAllowedError') {
      setMusicState('TAP TO PLAY');
    } else {
      setMusicState('ADD MUSIC.MP3 TO PLAY');
      updateTime();
    }
  });
}

playButton.addEventListener('click', () => {
  musicManuallyControlled = true;
  if (audio.paused || audio.error) {
    playSong();
  } else {
    audio.pause();
  }
});
audio.addEventListener('playing', () => setMusicState('NOW PLAYING', true, true));
audio.addEventListener('pause', () => {
  if (audio.paused && !audio.error) setMusicState('PAUSED');
});
audio.addEventListener('error', () => {
  setMusicState('ADD MUSIC.MP3 TO PLAY');
  updateTime();
});
['loadedmetadata', 'durationchange', 'timeupdate', 'emptied'].forEach((name) => audio.addEventListener(name, updateTime));

function toggleMusicControls(open) {
  musicControls.hidden = !open;
  musicSettings.setAttribute('aria-expanded', String(open));
}

musicSettings.addEventListener('click', () => toggleMusicControls(musicControls.hidden));
player.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !musicControls.hidden) {
    toggleMusicControls(false);
    musicSettings.focus();
  }
});
seek.addEventListener('input', () => {
  if (seek.disabled) return;
  audio.currentTime = Number(seek.value);
  updateTime();
});
volume.addEventListener('input', () => {
  const level = Number(volume.value);
  if (gain) {
    gain.gain.value = level;
  } else {
    audio.volume = level;
    if (!audio.paused) useMobileVolume();
  }
});

/* Lightweight sky effects. The canvas is painted only on resize and scene change. */
const starfield = byId('starfield');
const starContext = starfield.getContext('2d');
const burstLayer = byId('spark-bursts');
let resizeFrame;

function drawStars() {
  if (!starContext) return;
  const width = starfield.clientWidth;
  const height = starfield.clientHeight;
  if (!width || !height) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  starfield.width = Math.round(width * ratio);
  starfield.height = Math.round(height * ratio);
  starContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  const count = currentScene === 'ending' ? 2140 : Math.min(440, Math.round(width * height / 2600));
  const shades = ['#fff5fc', '#ffa5d8', '#d6b7ff', '#e8e4ff'];
  let seed = 47241;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = 0; index < count; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const size = .44 + random() ** 4 * 1.24;
    starContext.fillStyle = shades[index % shades.length];
    starContext.globalAlpha = .12 + random() ** 1.3 * .65;
    starContext.fillRect(x, y, size, size);
    if (size > 1.56) {
      starContext.globalAlpha *= .35;
      starContext.fillRect(x - 2.4, y + .35, size + 4.8, .6);
      starContext.fillRect(x + .35, y - 2.4, .6, size + 4.8);
    }
  }
  starContext.globalAlpha = 1;
}

function makeTwinkles() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 21; index += 1) {
    const star = document.createElement('i');
    star.className = 'twinkle';
    star.style.setProperty('--x', `${Math.random() * 100}%`);
    star.style.setProperty('--y', `${Math.random() * 100}%`);
    star.style.setProperty('--size', `${1 + Math.random() * 2.3}px`);
    star.style.setProperty('--duration', `${2.4 + Math.random() * 4}s`);
    star.style.setProperty('--delay', `${-Math.random() * 4}s`);
    fragment.append(star);
  }
  byId('twinkles').append(fragment);
}

function burstAt(anchor, count) {
  if (reducedMotion.matches) return;
  const bounds = anchor.getBoundingClientRect();
  const fragment = document.createDocumentFragment();
  const particles = [];
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement('i');
    const angle = index / count * Math.PI * 2;
    const distance = 38 + Math.random() * 114;
    particle.className = 'burst-particle';
    particle.textContent = index % 3 === 0 ? '♡' : '✦';
    particle.style.setProperty('--x', `${bounds.left + bounds.width / 2}px`);
    particle.style.setProperty('--y', `${bounds.top + bounds.height * .45}px`);
    particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--dy', `${Math.sin(angle) * distance - 33}px`);
    particle.style.setProperty('--turn', `${Math.random() * 140 - 70}deg`);
    particle.style.setProperty('--size', `${13 + Math.random() * 17}px`);
    particles.push(particle);
    fragment.append(particle);
  }
  burstLayer.append(fragment);
  window.setTimeout(() => particles.forEach((particle) => particle.remove()), 1450);
}

window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(drawStars);
});

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let parallaxFrame;
window.addEventListener('pointermove', (event) => {
  if (!finePointer.matches || reducedMotion.matches) return;
  const x = (event.clientX / window.innerWidth - .5) * 19;
  const y = (event.clientY / window.innerHeight - .5) * 14;
  cancelAnimationFrame(parallaxFrame);
  parallaxFrame = requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--parallax-x', `${x}px`);
    document.documentElement.style.setProperty('--parallax-y', `${y}px`);
  });
}, { passive: true });

document.addEventListener('pointerleave', () => {
  cancelAnimationFrame(parallaxFrame);
  document.documentElement.style.removeProperty('--parallax-x');
  document.documentElement.style.removeProperty('--parallax-y');
});

if ('IntersectionObserver' in window) {
  document.documentElement.classList.add('motion-ready');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: .08 });
  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
}

typeWelcome();
updateProgress();
drawStars();
makeTwinkles();
