/**
 * @class MoveUpTune
 * @classdesc Editor's default tune that moves up selected block
 *
 * @copyright <CodeX Team> 2018
 */
import $ from '../dom';
import { API, BlockTune } from '../../../types';

/**
 *
 */
export default class MoveUpTune implements BlockTune {
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
    wrapper: 'ce-tune-move-up',
    animation: 'wobble',
  };

  /**
   * MoveUpTune constructor
   *
   * @param {API} api - Editor's API
   */
  constructor({ api }) {
    this.api = api;
  }

  /**
   * Create "MoveUp" button and add click event listener
   *
   * @returns {HTMLElement}
   */
  public render(): HTMLElement {
    const moveUpButton = $.make('div', [this.CSS.button, this.CSS.wrapper], {});

    // moveUpButton.appendChild($.svg('arrow-up', 14, 14));
    moveUpButton.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.83339 12.8333V3.52493L11.9001 7.5916C12.2251 7.9166 12.7584 7.9166 13.0834 7.5916C13.4084 7.2666 13.4084 6.7416 13.0834 6.4166L7.59172 0.924933C7.26672 0.599933 6.74172 0.599933 6.41672 0.924933L0.916724 6.40827C0.591724 6.73327 0.591724 7.25827 0.916724 7.58327C1.24172 7.90827 1.76672 7.90827 2.09172 7.58327L6.16672 3.52493V12.8333C6.16672 13.2916 6.54172 13.6666 7.00006 13.6666C7.45839 13.6666 7.83339 13.2916 7.83339 12.8333Z" fill="#04003D"/></svg>';
    this.api.listeners.on(
      moveUpButton,
      'click',
      (event) => this.handleClick(event as MouseEvent, moveUpButton),
      false
    );

    /**
     * Enable tooltip module on button
     */
    this.api.tooltip.onHover(moveUpButton, this.api.i18n.t('Move up'));

    return moveUpButton;
  }

  /**
   * Move current block up
   *
   * @param {MouseEvent} event - click event
   * @param {HTMLElement} button - clicked button
   */
  public handleClick(event: MouseEvent, button: HTMLElement): void {
    const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();
    const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
    const previousBlock = this.api.blocks.getBlockByIndex(currentBlockIndex - 1);

    if (currentBlockIndex === 0 || !currentBlock || !previousBlock) {
      button.classList.add(this.CSS.animation);

      window.setTimeout(() => {
        button.classList.remove(this.CSS.animation);
      }, 500);

      return;
    }

    const currentBlockElement = currentBlock.holder;
    const previousBlockElement = previousBlock.holder;

    /**
     * Here is two cases:
     *  - when previous block has negative offset and part of it is visible on window, then we scroll
     *  by window's height and add offset which is mathematically difference between two blocks
     *
     *  - when previous block is visible and has offset from the window,
     *      than we scroll window to the difference between this offsets.
     */
    const currentBlockCoords = currentBlockElement.getBoundingClientRect(),
        previousBlockCoords = previousBlockElement.getBoundingClientRect();

    let scrollUpOffset;

    if (previousBlockCoords.top > 0) {
      scrollUpOffset = Math.abs(currentBlockCoords.top) - Math.abs(previousBlockCoords.top);
    } else {
      scrollUpOffset = window.innerHeight - Math.abs(currentBlockCoords.top) + Math.abs(previousBlockCoords.top);
    }

    window.scrollBy(0, -1 * scrollUpOffset);

    /** Change blocks positions */
    this.api.blocks.move(currentBlockIndex - 1);

    /** Hide the Tooltip */
    this.api.tooltip.hide();
  }
}
