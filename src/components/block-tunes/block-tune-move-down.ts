/**
 * @class MoveDownTune
 * @classdesc Editor's default tune - Moves down highlighted block
 *
 * @copyright <CodeX Team> 2018
 */

import $ from '../dom';
import { API, BlockTune } from '../../../types';

/**
 *
 */
export default class MoveDownTune implements BlockTune {
  /**
   * Set Tool is Tune
   */
  public static readonly isTune = true;

  /**
   * Property that contains Editor.js API methods
   *
   * @see {@link docs/api.md}
   */
  private readonly api: API;

  /**
   * Styles
   *
   * @type {{wrapper: string}}
   */
  private CSS = {
    button: 'ce-settings__button',
    wrapper: 'ce-tune-move-down',
    animation: 'wobble',
  };

  /**
   * MoveDownTune constructor
   *
   * @param {API} api — Editor's API
   */
  constructor({ api }) {
    this.api = api;
  }

  /**
   * Return 'move down' button
   *
   * @returns {HTMLElement}
   */
  public render(): HTMLElement {
    const moveDownButton = $.make('div', [this.CSS.button, this.CSS.wrapper], {});

    // moveDownButton.appendChild($.svg('arrow-down', 14, 14));
    moveDownButton.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.83339 1.16673V10.4751L11.9001 6.4084C12.2251 6.0834 12.7584 6.0834 13.0834 6.4084C13.4084 6.7334 13.4084 7.2584 13.0834 7.5834L7.59172 13.0751C7.26672 13.4001 6.74172 13.4001 6.41672 13.0751L0.916724 7.59173C0.591724 7.26673 0.591724 6.74173 0.916724 6.41673C1.24172 6.09173 1.76672 6.09173 2.09172 6.41673L6.16672 10.4751V1.16673C6.16672 0.7084 6.54172 0.3334 7.00006 0.3334C7.45839 0.3334 7.83339 0.7084 7.83339 1.16673Z" fill="#04003D"/></svg>';
    this.api.listeners.on(
      moveDownButton,
      'click',
      (event) => this.handleClick(event as MouseEvent, moveDownButton),
      false
    );

    /**
     * Enable tooltip module on button
     */
    this.api.tooltip.onHover(moveDownButton, this.api.i18n.t('Move down'));

    return moveDownButton;
  }

  /**
   * Handle clicks on 'move down' button
   *
   * @param {MouseEvent} event - click event
   * @param {HTMLElement} button - clicked button
   */
  public handleClick(event: MouseEvent, button: HTMLElement): void {
    const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();
    const nextBlock = this.api.blocks.getBlockByIndex(currentBlockIndex + 1);

    // If Block is last do nothing
    if (!nextBlock) {
      button.classList.add(this.CSS.animation);

      window.setTimeout(() => {
        button.classList.remove(this.CSS.animation);
      }, 500);

      return;
    }

    const nextBlockElement = nextBlock.holder;
    const nextBlockCoords = nextBlockElement.getBoundingClientRect();

    let scrollOffset = Math.abs(window.innerHeight - nextBlockElement.offsetHeight);

    /**
     * Next block ends on screen.
     * Increment scroll by next block's height to save element onscreen-position
     */
    if (nextBlockCoords.top < window.innerHeight) {
      scrollOffset = window.scrollY + nextBlockElement.offsetHeight;
    }

    window.scrollTo(0, scrollOffset);

    /** Change blocks positions */
    this.api.blocks.move(currentBlockIndex + 1);

    /** Hide the Tooltip */
    this.api.tooltip.hide();
  }
}
