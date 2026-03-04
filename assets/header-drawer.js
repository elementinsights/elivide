import { Component } from '@theme/component';
import { trapFocus, removeTrapFocus } from '@theme/focus';
import { onAnimationEnd } from '@theme/utilities';

/**
 * A custom element that manages the main menu drawer.
 *
 * @typedef {object} Refs
 * @property {HTMLDetailsElement} details - The details element.
 *
 * @extends {Component<Refs>}
 */
class HeaderDrawer extends Component {
  requiredRefs = ['details'];

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('keyup', this.#onKeyUp);
    this.#setupAnimatedElementListeners();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keyup', this.#onKeyUp);
  }

  /**
   * Compute the current "bottom" of the visible header stack in the viewport and
   * store it in a CSS variable so the drawer can sit directly beneath it.
   *
   * This avoids gaps when the announcement bar scrolls away but the header is sticky.
   */
  #setDrawerTopOffset = () => {
    const header = document.querySelector('#header-component');
    if (!header || !(header instanceof HTMLElement)) return;

    // bottom edge of what’s currently visible (sticky header, or header+announcements at top)
    const bottom = Math.max(0, Math.round(header.getBoundingClientRect().bottom));
    document.documentElement.style.setProperty('--drawer-top-offset', `${bottom}px`);
  };

  /**
   * Close the main menu drawer when the Escape key is pressed
   * @param {KeyboardEvent} event
   */
  #onKeyUp = (event) => {
    if (event.key !== 'Escape') return;
    this.#close(this.#getDetailsElement(event));
  };

  /**
   * @returns {boolean} Whether the main menu drawer is open
   */
  get isOpen() {
    return this.refs.details.hasAttribute('open');
  }

  /**
   * Get the closest details element to the event target
   * @param {Event | undefined} event
   * @returns {HTMLDetailsElement}
   */
  #getDetailsElement(event) {
    if (!(event?.target instanceof Element)) return this.refs.details;
    return event.target.closest('details') ?? this.refs.details;
  }

  /**
   * Toggle the main menu drawer
   * IMPORTANT: Prevent native <details>/<summary> toggling so our close() path
   * always runs (which resets nested open <details>).
   * @param {Event} [event]
   */
  toggle(event) {
    if (event?.cancelable) event.preventDefault();
    event?.stopPropagation?.();

    const details = this.#getDetailsElement(event);

    // If we're about to open, compute the correct offset first
    if (!details.hasAttribute('open')) {
      this.#setDrawerTopOffset();
    }

    return details.hasAttribute('open') ? this.#close(details) : this.open(event);
  }

  /**
   * Open the closest drawer or the main menu drawer
   * @param {Event} [event]
   */
  open(event) {
    if (event?.cancelable) event.preventDefault();
    event?.stopPropagation?.();

    // ✅ Ensure drawer is positioned directly below the *current* visible header area
    this.#setDrawerTopOffset();

    const details = this.#getDetailsElement(event);
    const summary = details.querySelector('summary');
    if (!summary) return;

    // Ensure it actually opens even when we prevent default on <summary>
    details.setAttribute('open', '');

    summary.setAttribute('aria-expanded', 'true');

    this.preventInitialAccordionAnimations(details);
    requestAnimationFrame(() => {
      details.classList.add('menu-open');
      setTimeout(() => {
        trapFocus(details);
      }, 0);
    });
  }

  /**
   * Go back or close the main menu drawer
   * @param {Event} [event]
   */
  back(event) {
    if (event?.cancelable) event.preventDefault();
    event?.stopPropagation?.();

    this.#close(this.#getDetailsElement(event));
  }

  /**
   * Close the main menu drawer
   */
  close() {
    this.#close(this.refs.details);
  }

  /**
   * Close the closest menu or submenu that is open
   *
   * @param {HTMLDetailsElement} details
   */
  #close(details) {
    const summary = details.querySelector('summary');
    if (!summary) return;

    summary.setAttribute('aria-expanded', 'false');
    details.classList.remove('menu-open');

    onAnimationEnd(details, () => {
      reset(details);

      if (details === this.refs.details) {
        removeTrapFocus();

        // Reset any nested open details so reopening starts from top
        const openDetails = this.querySelectorAll('details[open]:not(accordion-custom > details)');
        openDetails.forEach(reset);
      } else {
        setTimeout(() => {
          trapFocus(this.refs.details);
        }, 0);
      }
    });
  }

  /**
   * Attach animationend event listeners to all animated elements to remove will-change after animation
   * to remove the stacking context and allow submenus to be positioned correctly
   */
  #setupAnimatedElementListeners() {
    function removeWillChangeOnAnimationEnd(event) {
      const target = event.target;
      if (target && target instanceof HTMLElement) {
        target.style.setProperty('will-change', 'unset');
        target.removeEventListener('animationend', removeWillChangeOnAnimationEnd);
      }
    }
  }

  /**
   * Temporarily disables accordion animations to prevent unwanted transitions when the drawer opens.
   * @param {HTMLDetailsElement} details - The details element containing the accordions
   */
  preventInitialAccordionAnimations(details) {
    const content = details.querySelectorAll('accordion-custom .details-content');

    content.forEach((element) => {
      if (element instanceof HTMLElement) {
        element.classList.add('details-content--no-animation');
      }
    });

    setTimeout(() => {
      content.forEach((element) => {
        if (element instanceof HTMLElement) {
          element.classList.remove('details-content--no-animation');
        }
      });
    }, 100);
  }
}

if (!customElements.get('header-drawer')) {
  customElements.define('header-drawer', HeaderDrawer);
}

/**
 * Reset an open details element to its original state
 *
 * @param {HTMLDetailsElement} element
 */
function reset(element) {
  element.classList.remove('menu-open');
  element.removeAttribute('open');
  element.querySelector('summary')?.setAttribute('aria-expanded', 'false');
}
