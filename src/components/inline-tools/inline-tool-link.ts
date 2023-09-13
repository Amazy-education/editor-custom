import SelectionUtils from '../selection';
import * as _ from '../utils';
import { API, InlineTool, SanitizerConfig } from '../../../types';
import { I18n, InlineToolbar, Tooltip, Toolbar } from '../../../types/api';
import { IconLink, IconUnlink } from '@codexteam/icons';

/**
 * Link Tool
 *
 * Inline Toolbar Tool
 *
 * Wrap selected text with <a> tag
 */
export default class LinkInlineTool implements InlineTool {
  /**
   * Specifies Tool as Inline Toolbar Tool
   *
   * @returns {boolean}
   */
  public static isInline = true;

  /**
   * Title for hover-tooltip
   */
  public static title = 'Link';

  /**
   * Sanitizer Rule
   * Leave <a> tags
   *
   * @returns {object}
   */
  public static get sanitize(): SanitizerConfig {
    return {
      a: {
        href: true,
        target: '_blank',
        rel: true,
      },
    } as SanitizerConfig;
  }

  /**
   * Native Document's commands for link/unlink
   */
  private readonly commandLink: string = 'createLink';
  private readonly commandUnlink: string = 'unlink';

  /**
   * Enter key code
   */
  private readonly ENTER_KEY: number = 13;

  /**
   * Styles
   */
  private readonly CSS = {
    button: 'ce-inline-tool',
    buttonActive: 'ce-inline-tool--active',
    buttonModifier: 'ce-inline-tool--link',
    buttonUnlink: 'ce-inline-tool--unlink',
    buttonHover: 'ce-inline-tool--hover',
    input: 'ce-inline-tool-input',
    label: 'ce-inline-tool-label',
    labelShowed: 'ce-inline-tool-label--showed',
    cleanButton: 'ce-inline-tool-input-clean--showed',
  };

  /**
   * Elements
   */
  private nodes: {
    button: HTMLButtonElement;
    input: HTMLInputElement;
    label: HTMLLabelElement;
    cleanButton: HTMLSpanElement;
    confirmButton: HTMLSpanElement;
  } = {
    button: null,
    input: null,
    label: null,
    cleanButton: null,
    confirmButton: null,
  };

  /**
   * SelectionUtils instance
   */
  private selection: SelectionUtils;

  /**
   * Input opening state
   */
  private inputOpened = false;

  /**
   * Available Toolbar methods (open/close)
   */
  private toolbar: Toolbar;

  /**
   * Available inline toolbar methods (open/close)
   */
  private inlineToolbar: InlineToolbar;

  /**
   * Tooltip API methods
   */
  private tooltip: Tooltip;

  /**
   * I18n API
   */
  private i18n: I18n;

  /**
   * @param api - Editor.js API
   */
  // TODO Check notifier & tooltip
  constructor({ api }: { api: API }) {
    this.toolbar = api.toolbar;
    this.inlineToolbar = api.inlineToolbar;
    this.tooltip = api.tooltip;
    this.i18n = api.i18n;
    this.selection = new SelectionUtils();
  }

  /**
   * Create button for Inline Toolbar
   */
  public render(): HTMLElement {
    this.nodes.button = document.createElement('button') as HTMLButtonElement;
    this.nodes.button.type = 'button';
    this.nodes.button.classList.add(this.CSS.button, this.CSS.buttonModifier);
    // TODO fix icon
    this.nodes.button.innerHTML = IconLink;

    return this.nodes.button;
  }

  /**
   * Input for the link
   */
  public renderActions(): HTMLElement {
    this.nodes.label = document.createElement('label') as HTMLLabelElement;
    this.nodes.label.classList.add(this.CSS.label);
    this.nodes.input = document.createElement('input') as HTMLInputElement;
    this.nodes.input.placeholder = this.i18n.t('Paste a link');
    this.nodes.input.type = 'text';
    this.nodes.input.classList.add(this.CSS.input);
    this.nodes.label.appendChild(this.nodes.input);
    this.nodes.confirmButton = document.createElement('span') as HTMLSpanElement;
    this.nodes.cleanButton = document.createElement('span') as HTMLSpanElement;
    this.nodes.cleanButton.appendChild($.svg('close', 24, 24));
    this.nodes.confirmButton.appendChild($.svg('tick-big', 24, 24));

    this.nodes.label.appendChild(this.nodes.cleanButton);
    this.nodes.label.appendChild(this.nodes.confirmButton);
    this.nodes.confirmButton.classList.add(this.CSS.cleanButton);
    this.nodes.input.addEventListener('keyup', (event: KeyboardEvent) => {
      if (this.nodes.input.value.length > 0) {
        this.nodes.cleanButton.classList.add(this.CSS.cleanButton);
      } else {
        this.nodes.cleanButton.classList.remove(this.CSS.cleanButton);
      }
      if (event.keyCode === this.ENTER_KEY) {
        this.enterPressed(event);
      }
    });

    this.nodes.confirmButton.addEventListener('mousedown', (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      this.enterPressed(event);
    });

    this.nodes.cleanButton.addEventListener('mousedown', (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      this.nodes.input.value = '';
      this.unlink();
      this.nodes.button.classList.remove(this.CSS.buttonUnlink);
      this.nodes.button.classList.remove(this.CSS.buttonActive);
      this.nodes.cleanButton.classList.remove(this.CSS.cleanButton);
    });

    document.addEventListener('click', (event: Event) => {
      const { target } = event;
      const currentTarget = (target as Element).closest(`.${this.CSS.button}`);

      if (currentTarget) {
        this.selection.restore();
        if (currentTarget !== this.nodes.button && this.inputOpened) {
          this.closeActions();
        }
      }
    });

    return this.nodes.label;
  }

  /**
   * Handle clicks on the Inline Toolbar icon
   *
   * @param {Range} range - range to wrap with link
   */
  public surround(range: Range): void {
    /**
     * Range will be null when user makes second click on the 'link icon' to close opened input
     */
    if (range) {
      /**
       * Save selection before change focus to the input
       */
      if (!this.inputOpened) {
        /** Create blue background instead of selection */
        this.selection.setFakeBackground();

        this.selection.save();
      } else {
        this.selection.restore();
        this.selection.removeFakeBackground();
      }
      const parentAnchor = this.selection.findParentTag('A');

      /**
       * Unlink icon pressed
       */
      if (parentAnchor) {
        this.selection.expandToTag(parentAnchor);
        this.unlink();
        this.closeActions();
        this.checkState();
        this.toolbar.close();

        return;
      }
    }

    this.toggleActions();
  }

  /**
   * Check selection and set activated state to button if there are <a> tag
   */
  public checkState(): boolean {
    const anchorTag = this.selection.findParentTag('A');

    if (anchorTag) {
      this.nodes.button.innerHTML = IconUnlink;
      this.nodes.button.classList.add(this.CSS.buttonUnlink);
      this.nodes.button.classList.add(this.CSS.buttonActive);
      this.openActions(true);

      /**
       * Fill input value with link href
       */
      const hrefAttr = anchorTag.getAttribute('href');

      if (hrefAttr !== 'null') {
        this.nodes.cleanButton.classList.add(this.CSS.cleanButton);
        this.nodes.confirmButton.classList.add(this.CSS.cleanButton);
        this.nodes.input.value = hrefAttr;
      } else {
        this.nodes.input.value = '';
      }

      this.selection.save();
    } else {
      this.nodes.button.innerHTML = IconLink;
      this.nodes.button.classList.remove(this.CSS.buttonUnlink);
      this.nodes.button.classList.remove(this.CSS.buttonActive);
    }

    return !!anchorTag;
  }

  /**
   * Function called with Inline Toolbar closing
   */
  public clear(): void {
    this.closeActions();
  }

  /**
   * Set a shortcut
   */
  public get shortcut(): string {
    return 'CMD+K';
  }

  /**
   * Show/close link input
   */
  private toggleActions(): void {
    if (!this.inputOpened) {
      this.openActions(true);
    } else {
      this.closeActions(false);
    }
  }

  /**
   * @param {boolean} needFocus - on link creation we need to focus input. On editing - nope.
   */
  private openActions(needFocus = false): void {
    this.nodes.button.classList.add(this.CSS.buttonHover);
    this.nodes.label.classList.add(this.CSS.labelShowed);
    if (needFocus) {
      setTimeout(() => {
        this.nodes.label.focus();
      });
    }
    this.inputOpened = true;
  }

  /**
   * Close input
   *
   * @param {boolean} clearSavedSelection — we don't need to clear saved selection
   *                                        on toggle-clicks on the icon of opened Toolbar
   */
  private closeActions(clearSavedSelection = true): void {
    if (this.selection.isFakeBackgroundEnabled) {
      // if actions is broken by other selection We need to save new selection
      const currentSelection = new SelectionUtils();

      currentSelection.save();

      this.selection.restore();
      this.selection.removeFakeBackground();

      // and recover new selection after removing fake background
      currentSelection.restore();
    }

    this.nodes.label.classList.remove(this.CSS.labelShowed);
    this.nodes.input.value = '';
    if (clearSavedSelection) {
      this.selection.clearSaved();
    }
    this.inputOpened = false;
    this.nodes.button.classList.remove(this.CSS.buttonHover);
  }

  /**
   * Enter pressed on input
   *
   * @param {KeyboardEvent} event - enter keydown event
   */
  private enterPressed(event: KeyboardEvent | MouseEvent): void {
    let value = this.nodes.input.value || '';

    if (!value.trim()) {
      this.selection.restore();
      this.unlink();
      event.preventDefault();
      this.closeActions();

      return;
    }

    if (!this.validateURL(value)) {
      this.tooltip.show(this.nodes.input, 'The URL is not valid.', {
        placement: 'top',
      });
      setTimeout(() => {
        this.tooltip.hide();
      }, 1000);

      _.log('Incorrect Link pasted', 'warn', value);

      return;
    }

    value = this.prepareLink(value);

    this.selection.restore();
    this.selection.removeFakeBackground();
    this.insertLink(value);

    /**
     * Preventing events that will be able to happen
     */
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.selection.collapseToEnd();
    this.inlineToolbar.close();
  }

  /**
   * Detects if passed string is URL
   *
   * @param {string} str - string to validate
   * @returns {boolean}
   */
  private validateURL(str: string): boolean {
    /**
     * Don't allow spaces
     */
    const pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator

    return !!pattern.test(str);
  }

  /**
   * Process link before injection
   * - sanitize
   * - add protocol for links like 'google.com'
   *
   * @param {string} link - raw user input
   */
  private prepareLink(link: string): string {
    link = link.trim();
    link = this.addProtocol(link);

    return link;
  }

  /**
   * Add 'http' protocol to the links like 'vc.ru', 'google.com'
   *
   * @param {string} link - string to process
   */
  private addProtocol(link: string): string {
    /**
     * If protocol already exists, do nothing
     */
    if (/^(\w+):(\/\/)?/.test(link)) {
      return link;
    }

    /**
     * We need to add missed HTTP protocol to the link, but skip 2 cases:
     *     1) Internal links like "/general"
     *     2) Anchors looks like "#results"
     *     3) Protocol-relative URLs like "//google.com"
     */
    const isInternal = /^\/[^/\s]/.test(link),
        isAnchor = link.substring(0, 1) === '#',
        isProtocolRelative = /^\/\/[^/\s]/.test(link);

    if (!isInternal && !isAnchor && !isProtocolRelative) {
      link = 'https://' + link;
    }

    return link;
  }

  /**
   * Inserts <a> tag with "href"
   *
   * @param {string} link - "href" value
   */
  private insertLink(link: string): void {
    /**
     * Edit all link, not selected part
     */
    let anchorTag = this.selection.findParentTag('A');

    if (anchorTag) {
      this.selection.expandToTag(anchorTag);
    }
    document.execCommand(this.commandLink, false, link);
    anchorTag = this.selection.findParentTag('A');
    anchorTag['target'] = '_blank';
    anchorTag['rel'] = 'noopener noreferrer';
  }

  /**
   * Removes <a> tag
   */
  private unlink(): void {
    document.execCommand(this.commandUnlink);
  }
}
