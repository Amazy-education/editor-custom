import $ from '../dom';
import { InlineTool, SanitizerConfig } from '../../../types';

/**
 * Strikethrough Tool
 *
 * Inline Toolbar Tool
 *
 * Style selected text with italic
 */
export default class StrikeInlineTool implements InlineTool {
  /**
   * Specifies Tool as Inline Toolbar Tool
   *
   * @returns {boolean}
   */
  public static isInline = true;

  /**
   * Title for hover-tooltip
   */
  public static title = 'Strikethrough';

  /**
   * Sanitizer Rule
   * Leave <s> tags
   *
   * @returns {object}
   */
  public static get sanitize(): SanitizerConfig {
    return {
      strike: {},
    } as SanitizerConfig;
  }

  /**
   * Native Document's command that uses for Strikethrough
   */
  private readonly commandName: string = 'strikethrough';

  /**
   * Styles
   */
  private readonly CSS = {
    button: 'ce-inline-tool',
    buttonActive: 'ce-inline-tool--active',
    buttonModifier: 'ce-inline-tool--strikethrough',
  };

  /**
   * Elements
   */
  private nodes: {button: HTMLButtonElement} = {
    button: null,
  };

  /**
   * Create button for Inline Toolbar
   */
  public render(): HTMLElement {
    this.nodes.button = document.createElement('button') as HTMLButtonElement;
    this.nodes.button.type = 'button';
    this.nodes.button.classList.add(this.CSS.button, this.CSS.buttonModifier);
    this.nodes.button.appendChild($.svg('strikethrough', 24, 24));

    return this.nodes.button;
  }

  /**
   * Wrap range with <s> tag
   *
   * @param {Range} range - range to wrap
   */
  public surround(range: Range): void {
    document.execCommand(this.commandName);
  }

  /**
   * Check selection and set activated state to button if there are <s> tag
   *
   * @param {Selection} selection - selection to check
   */
  public checkState(selection: Selection): boolean {
    const isActive = document.queryCommandState(this.commandName);

    this.nodes.button.classList.toggle(this.CSS.buttonActive, isActive);

    return isActive;
  }

  /**
   * Set a shortcut
   */
  public get shortcut(): string {
    return 'CMD+SHIFT+5';
  }
}
