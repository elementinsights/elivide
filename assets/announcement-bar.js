import { Component } from '@theme/component';

/**
 * Sliding announcement bar (right -> left).
 * Infinite loop in BOTH directions:
 * - Clones last slide at the beginning (leading clone)
 * - Clones first slide at the end (trailing clone)
 * Adds drag/swipe on mobile via Pointer Events.
 *
 * Track index mapping:
 *   0            = lastClone
 *   1..n         = real slides (n = realCount)
 *   n+1 (maxIdx) = firstClone
 */
export class AnnouncementBar extends Component {
  #initialized = false;

  #currentIndex = 1; // start on first REAL slide (index 1)
  #realCount = 0;
  #maxIndex = 0; // = realCount + 1
  #lastRealIndex = 0; // = realCount

  #intervalId = undefined;

  // drag state
  #isDown = false;
  #startX = 0;
  #startIndex = 0;
  #userInteracting = false;

  connectedCallback() {
    super.connectedCallback();
    if (this.#initialized) return;
    this.#initialized = true;

    this.addEventListener('mouseenter', this.#onMouseEnter);
    this.addEventListener('mouseleave', this.#onMouseLeave);
    document.addEventListener('visibilitychange', this.#handleVisibilityChange);

    this.#setup();
    this.play();
  }

  disconnectedCallback() {
    this.suspend();
    document.removeEventListener('visibilitychange', this.#handleVisibilityChange);
    super.disconnectedCallback?.();
  }

  #setup() {
    const track = this.refs.track;
    const viewport = this.refs.viewport;
    if (!track || !viewport) return;

    const realSlides = Array.from(track.querySelectorAll('.announcement-bar__slide'));
    this.#realCount = realSlides.length;

    if (this.#realCount <= 1) {
      this.#setActive(1);
      return;
    }

    // --- Infinite loop both directions: clone first & last ---
    const firstClone = realSlides[0].cloneNode(true);
    firstClone.dataset.clone = 'first';

    const lastClone = realSlides[realSlides.length - 1].cloneNode(true);
    lastClone.dataset.clone = 'last';

    // 0 = lastClone, 1..n = real slides, n+1 = firstClone
    track.insertBefore(lastClone, realSlides[0]);
    track.appendChild(firstClone);

    this.#lastRealIndex = this.#realCount; // n
    this.#maxIndex = this.#realCount + 1; // n+1

    // Start on first REAL slide
    this.#goTo(1, { animated: false });

    // Normalize when we land on clones
    track.addEventListener('transitionend', (e) => {
      if (e.propertyName !== 'transform') return;

      if (this.#currentIndex === this.#maxIndex) {
        // trailing clone (first) -> first real
        this.#goTo(1, { animated: false });
      } else if (this.#currentIndex === 0) {
        // leading clone (last) -> last real
        this.#goTo(this.#lastRealIndex, { animated: false });
      }
    });

    // Enable touch drag without scroll-jank
    viewport.style.touchAction = 'pan-y';
    this.style.touchAction = 'pan-y';

    // Pointer drag handlers
    track.addEventListener('pointerdown', this.#onPointerDown);
    track.addEventListener('pointermove', this.#onPointerMove);
    track.addEventListener('pointerup', this.#onPointerUp);
    track.addEventListener('pointercancel', this.#onPointerUp);
    track.addEventListener('pointerleave', this.#onPointerLeave);
  }

  next() {
    // Always move forward (slides left)
    this.#goTo(this.#currentIndex + 1, { animated: true });
  }

  previous() {
    // Allow true backwards swipe (slides right)
    this.#goTo(this.#currentIndex - 1, { animated: true });
  }

  play(interval = this.autoplayInterval) {
    if (!this.autoplay) return;

    this.paused = false;
    this.suspend();

    this.#intervalId = window.setInterval(() => {
      if (this.matches(':hover') || document.hidden) return;
      if (this.#userInteracting) return;
      this.next();
    }, interval);
  }

  pause() {
    this.paused = true;
    this.suspend();
  }

  suspend = () => {
    if (this.#intervalId) window.clearInterval(this.#intervalId);
    this.#intervalId = undefined;
  };

  resume = () => {
    if (!this.autoplay || this.paused) return;
    if (this.#userInteracting) return;
    this.pause();
    this.play();
  };

  get paused() {
    return this.hasAttribute('paused');
  }

  set paused(paused) {
    this.toggleAttribute('paused', paused);
  }

  get autoplay() {
    return Boolean(this.autoplayInterval);
  }

  get autoplayInterval() {
    const interval = this.getAttribute('autoplay');
    const value = parseInt(`${interval}`, 10);
    if (Number.isNaN(value)) return undefined;
    return value * 1000;
  }

  #goTo(index, { animated = true } = {}) {
    const track = this.refs.track;
    if (!track) return;

    // Clamp to [0..maxIndex] (maxIndex is trailing clone)
    if (index < 0) index = 0;
    if (index > this.#maxIndex) index = this.#maxIndex;

    this.#currentIndex = index;

    track.style.transition = animated ? '' : 'none';
    track.style.transform = `translateX(${-100 * this.#currentIndex}%)`;

    this.#setActive(this.#currentIndex);
  }

  #setActive(trackIndex) {
    const track = this.refs.track;
    if (!track) return;

    const slides = Array.from(track.querySelectorAll('.announcement-bar__slide'));
    if (!slides.length) return;

    // trackIndex 0 = lastClone -> real last
    // trackIndex maxIndex = firstClone -> real first
    // trackIndex 1..n -> real index = trackIndex - 1
    let activeReal;
    if (trackIndex === 0) activeReal = this.#realCount - 1;
    else if (trackIndex === this.#maxIndex) activeReal = 0;
    else activeReal = trackIndex - 1;

    slides.forEach((slide, i) => {
      let realIndex;
      if (i === 0) realIndex = this.#realCount - 1;
      else if (i === this.#maxIndex) realIndex = 0;
      else realIndex = i - 1;

      const isActive = realIndex === activeReal;
      slide.setAttribute('aria-hidden', String(!isActive));

      const link = slide.querySelector('.announcement-bar__link');
      if (link) link.tabIndex = isActive ? 0 : -1;
    });
  }

  // ---------- Drag / Swipe ----------
  #onPointerDown = (e) => {
    const track = this.refs.track;
    const viewport = this.refs.viewport;
    if (!track || !viewport) return;

    this.#isDown = true;
    this.#userInteracting = true;
    this.suspend();

    this.#startX = e.clientX;
    this.#startIndex = this.#currentIndex;

    // disable transition while dragging
    track.style.transition = 'none';

    try {
      track.setPointerCapture(e.pointerId);
    } catch (err) {}
  };

  #onPointerMove = (e) => {
    if (!this.#isDown) return;

    const track = this.refs.track;
    const viewport = this.refs.viewport;
    if (!track || !viewport) return;

    const dx = e.clientX - this.#startX;
    const width = viewport.clientWidth || 1;

    // dx>0 drag right => track moves right => tempIndex decreases
    const deltaSlides = dx / width;
    const tempIndex = this.#startIndex - deltaSlides;

    track.style.transform = `translateX(${-100 * tempIndex}%)`;
  };

  #finishDrag = (e) => {
    if (!this.#isDown) return;

    const track = this.refs.track;
    const viewport = this.refs.viewport;
    if (!track || !viewport) return;

    this.#isDown = false;

    try {
      track.releasePointerCapture(e.pointerId);
    } catch (err) {}

    const dx = e.clientX - this.#startX;
    const width = viewport.clientWidth || 1;
    const threshold = width * 0.2; // 20% swipe

    // re-enable transition for snap
    track.style.transition = '';

    if (Math.abs(dx) > threshold) {
      if (dx > 0) {
        // swipe right => previous slide
        this.previous();
      } else {
        // swipe left => next slide
        this.next();
      }
    } else {
      // snap back
      this.#goTo(this.#currentIndex, { animated: true });
    }

    this.#userInteracting = false;
    window.setTimeout(() => this.resume(), this.autoplayInterval || 2000);
  };

  #onPointerUp = (e) => this.#finishDrag(e);

  #onPointerLeave = (e) => {
    if (!this.#isDown) return;
    this.#finishDrag(e);
  };

  // ---------- Hover pause ----------
  #onMouseEnter = () => {
    this.#userInteracting = true;
    this.suspend();
  };

  #onMouseLeave = () => {
    this.#userInteracting = false;
    this.resume();
  };

  // Pause the slideshow when the page is hidden.
  #handleVisibilityChange = () => (document.hidden ? this.pause() : this.resume());
}

if (!customElements.get('announcement-bar-component')) {
  customElements.define('announcement-bar-component', AnnouncementBar);
}
