/**
 * @class DeleteTune
 * @classdesc Editor's default tune that moves up selected block
 *
 * @copyright <CodeX Team> 2018
 */
import { API, BlockTune } from '../../../types';
import $ from '../dom';

/**
 *
 */
export default class DeleteTune implements BlockTune {
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
   */
  private CSS = {
    button: 'ce-settings__button',
    buttonDelete: 'ce-settings__button--delete',
    buttonConfirm: 'ce-settings__button--confirm',
  };

  /**
   * Delete confirmation
   */
  private needConfirmation: boolean;

  /**
   * set false confirmation state
   */
  private readonly resetConfirmation: () => void;

  /**
   * Tune nodes
   */
  private nodes: {button: HTMLElement} = {
    button: null,
  };

  /**
   * DeleteTune constructor
   *
   * @param {API} api - Editor's API
   */
  constructor({ api }) {
    this.api = api;

    this.resetConfirmation = (): void => {
      this.setConfirmation(false);
    };
  }

  /**
   * Create "Delete" button and add click event listener
   *
   * @returns {HTMLElement}
   */
  public render(): HTMLElement {
    this.nodes.button = $.make('div', [this.CSS.button, this.CSS.buttonDelete], {});
    // this.nodes.button.appendChild($.svg('cross', 12, 12));
    this.nodes.button.innerHTML = '<svg width="12" height="16" viewBox="0 0 12 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.999959 13.8333C0.999959 14.75 1.74996 15.5 2.66663 15.5H9.33329C10.25 15.5 11 14.75 11 13.8333V5.5C11 4.58333 10.25 3.83333 9.33329 3.83333H2.66663C1.74996 3.83333 0.999959 4.58333 0.999959 5.5V13.8333ZM3.49996 5.5H8.49996C8.95829 5.5 9.33329 5.875 9.33329 6.33333V13C9.33329 13.4583 8.95829 13.8333 8.49996 13.8333H3.49996C3.04163 13.8333 2.66663 13.4583 2.66663 13V6.33333C2.66663 5.875 3.04163 5.5 3.49996 5.5ZM8.91663 1.33333L8.32496 0.741667C8.17496 0.591667 7.95829 0.5 7.74163 0.5H4.25829C4.04163 0.5 3.82496 0.591667 3.67496 0.741667L3.08329 1.33333H0.999959C0.541626 1.33333 0.166626 1.70833 0.166626 2.16667C0.166626 2.625 0.541626 3 0.999959 3H11C11.4583 3 11.8333 2.625 11.8333 2.16667C11.8333 1.70833 11.4583 1.33333 11 1.33333H8.91663Z" fill="#04003D"/></svg>';
    this.api.listeners.on(this.nodes.button, 'click', (event: MouseEvent) => this.handleClick(event), false);

    /**
     * Enable tooltip module
     */
    this.api.tooltip.onHover(this.nodes.button, this.api.i18n.t('Delete'), {
      hidingDelay: 300,
    });

    return this.nodes.button;
  }

  /**
   * Delete block conditions passed
   *
   * @param {MouseEvent} event - click event
   */
  public handleClick(event: MouseEvent): void {
    /**
     * if block is not waiting the confirmation, subscribe on block-settings-closing event to reset
     * otherwise delete block
     */
    if (!this.needConfirmation) {
      this.setConfirmation(true);

      /**
       * Subscribe on event.
       * When toolbar block settings is closed but block deletion is not confirmed,
       * then reset confirmation state
       */
      this.api.events.on('block-settings-closed', this.resetConfirmation);
    } else {
      /**
       * Unsubscribe from block-settings closing event
       */
      this.api.events.off('block-settings-closed', this.resetConfirmation);

      this.api.blocks.delete();
      this.api.toolbar.close();
      this.api.tooltip.hide();

      /**
       * Prevent firing ui~documentClicked that can drop currentBlock pointer
       */
      event.stopPropagation();
    }
  }

  /**
   * change tune state
   *
   * @param {boolean} state - delete confirmation state
   */
  private setConfirmation(state: boolean): void {
    this.needConfirmation = state;
    this.nodes.button.classList.add(this.CSS.buttonConfirm);
  }
}
