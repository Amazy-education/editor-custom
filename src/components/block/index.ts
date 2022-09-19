import {
  BlockAPI as BlockAPIInterface,
  BlockTool as IBlockTool,
  BlockToolData,
  BlockTune as IBlockTune,
  SanitizerConfig,
  ToolConfig,
  ToolboxConfigEntry
} from '../../../types';

import { SavedData } from '../../../types/data-formats';
import $ from '../dom';
import * as _ from '../utils';
import ApiModules from '../modules/api';
import BlockAPI from './api';
import SelectionUtils from '../selection';
import BlockTool from '../tools/block';

import BlockTune from '../tools/tune';
import { BlockTuneData } from '../../../types/block-tunes/block-tune-data';
import ToolsCollection from '../tools/collection';
import EventsDispatcher from '../utils/events';

import {isNumber} from '../utils';

type AddBlockButtonClickInterface = ( index: number ) => void;
type OnFocusBlockInterface = ( index: number, unfocusCallback: object) => void;

/**
 * Interface describes Block class constructor argument
 */
interface BlockConstructorOptions {
  /**
   * Block's id. Should be passed for existed block, and omitted for a new one.
   */
  id?: string;

  /**
   * Initial Block data
   */
  data: BlockToolData;

  /**
   * Tool object
   */
  tool: BlockTool;

  /**
   * Editor's API methods
   */
  api: ApiModules;

  /**
   * This flag indicates that the Block should be constructed in the read-only mode.
   */
  readOnly: boolean;

  /**
   * Tunes data for current Block
   */
  tunesData: {[name: string]: BlockTuneData};

  /**
   * This callback for Add block button
   */
  addBlockButtonClick?: AddBlockButtonClickInterface;

  /**
   * This callback for Block focus event
   */
  onFocusBlock?: OnFocusBlockInterface;
}

/**
 * @class Block
 * @classdesc This class describes editor`s block, including block`s HTMLElement, data and tool
 *
 * @property {BlockTool} tool — current block tool (Paragraph, for example)
 * @property {object} CSS — block`s css classes
 *
 */

/**
 * Available Block Tool API methods
 */
export enum BlockToolAPI {
  /**
   * @todo remove method in 3.0.0
   * @deprecated — use 'rendered' hook instead
   */
  APPEND_CALLBACK = 'appendCallback',
  RENDERED = 'rendered',
  MOVED = 'moved',
  UPDATED = 'updated',
  REMOVED = 'removed',
  ON_PASTE = 'onPaste',
}

/**
 * Names of events supported by Block class
 */
type BlockEvents = 'didMutated';

/**
 * @classdesc Abstract Block class that contains Block information, Tool name and Tool class instance
 *
 * @property {BlockTool} tool - Tool instance
 * @property {HTMLElement} holder - Div element that wraps block content with Tool's content. Has `ce-block` CSS class
 * @property {HTMLElement} pluginsContent - HTML content that returns by Tool's render function
 */
export default class Block extends EventsDispatcher<BlockEvents> {
  /**
   * CSS classes for the Block
   *
   * @returns {{wrapper: string, content: string}}
   */
  public static get CSS(): { [name: string]: string } {
    return {
      wrapper: 'ce-block',
      wrapperStretched: 'ce-block--stretched',
      content: 'ce-block__content',
      focused: 'ce-block--focused',
      selected: 'ce-block--selected',
      dropTarget: 'ce-block--drop-target',
      addBlockWrapper: 'add-block-btn-wrapper',
      addBlockBtn: 'add-block-btn',
      addBlockBtnClickSquare: 'add-block-btn-click-square',
      addBlockLine: 'add-block-btn-line',
      addBlockText: 'add-block-btn-text',
    };
  }

  /**
   * Block unique identifier
   */
  public id: string;

  /**
   * Block Tool`s name
   */
  public readonly name: string;

  /**
   * Instance of the Tool Block represents
   */
  public readonly tool: BlockTool;

  /**
   * User Tool configuration
   */
  public readonly settings: ToolConfig;

  /**
   * Wrapper for Block`s content
   */
  public readonly holder: HTMLDivElement;

  /**
   * Tunes used by Tool
   */
  public readonly tunes: ToolsCollection<BlockTune>;

  /**
   * Tool's user configuration
   */
  public readonly config: ToolConfig;

  /**
   * Cached inputs
   *
   * @type {HTMLElement[]}
   */
  private cachedInputs: HTMLElement[] = [];

  /**
   * Tool class instance
   */
  private readonly toolInstance: IBlockTool;

  /**
   * User provided Block Tunes instances
   */
  private readonly tunesInstances: Map<string, IBlockTune> = new Map();

  /**
   * Editor provided Block Tunes instances
   */
  private readonly defaultTunesInstances: Map<string, IBlockTune> = new Map();

  /**
   * If there is saved data for Tune which is not available at the moment,
   * we will store it here and provide back on save so data is not lost
   */
  private unavailableTunesData: { [name: string]: BlockTuneData } = {};

  /**
   * Editor`s API module
   */
  private readonly api: ApiModules;

  /**
   * Focused input index
   *
   * @type {number}
   */
  private inputIndex = 0;

  /**
   * Mutation observer to handle DOM mutations
   *
   * @type {MutationObserver}
   */
  private mutationObserver: MutationObserver;

  /**
   * Debounce Timer
   *
   * @type {number}
   */
  private readonly modificationDebounceTimer = 450;

  /**
   * Is fired when DOM mutation has been happened
   */
  private didMutated = _.debounce((mutationsOrInputEvent: MutationRecord[] | InputEvent = []): void => {
    const shouldFireUpdate = mutationsOrInputEvent instanceof InputEvent ||
      !mutationsOrInputEvent.some(({
        addedNodes = [],
        removedNodes,
      }) => {
        return [...Array.from(addedNodes), ...Array.from(removedNodes)]
          .some(node => $.isElement(node) && (node as HTMLElement).dataset.mutationFree === 'true');
      });

    /**
     * In case some mutation free elements are added or removed, do not trigger didMutated event
     */
    if (!shouldFireUpdate) {
      return;
    }

    /**
     * Drop cache
     */
    this.cachedInputs = [];

    /**
     * Update current input
     */
    this.updateCurrentInput();

    this.call(BlockToolAPI.UPDATED);

    this.emit('didMutated', this);
  }, this.modificationDebounceTimer);

  /**
   * Current block API interface
   */
  private readonly blockAPI: BlockAPIInterface;

  /**
   * Callbak for Add block button
   * @private
   */
  private addBlockButtonClick: AddBlockButtonClickInterface;

  /**
   * Callbak for Add block button
   * @private
   */
  private onFocusBlock: OnFocusBlockInterface;

  /**
   * @param {object} options - block constructor options
   * @param {string} [options.id] - block's id. Will be generated if omitted.
   * @param {BlockToolData} options.data - Tool's initial data
   * @param {BlockToolConstructable} options.tool — block's tool
   * @param options.api - Editor API module for pass it to the Block Tunes
   * @param {boolean} options.readOnly - Read-Only flag
   * @param {function} options.addBlockButtonClick - Callback for add button
   * @param {function} options.onFocusBlock - Callback for block focus
   */
  constructor({
    id = _.generateBlockId(),
    data,
    tool,
    api,
    readOnly,
    tunesData,
    addBlockButtonClick = null,
    onFocusBlock = null,
  }: BlockConstructorOptions) {
    super();

    this.name = tool.name;
    this.id = id;
    this.settings = tool.settings;
    this.config = tool.settings.config || {};
    this.api = api;
    this.blockAPI = new BlockAPI(this);
    this.addBlockButtonClick = addBlockButtonClick;
    // this.onFocusBlock = onFocusBlock;
    const onFocusBlockFunc = (n, unfocusCallback?) => {
      // rrr this.api.methods.blocks.callUnfocusCallback();

      // console.log('onFocusBlockFunc n=', n);

      // if (n) {
      // rrr this.api.methods.blocks.setCurrentBlockIndex(n);
      // }
// 11
      if (unfocusCallback) {
        // rrr this.api.methods.blocks.setUnfocusCallback(unfocusCallback);
      }
      // const holder = this.api.methods.blocks.getBlockByIndex(n);

      // if (holder)
      //   console.log(holder.holder);
    }

    if (onFocusBlock) {

      // console.log('check focus: exist');
    } else {
      onFocusBlock = onFocusBlockFunc
      // console.log('check focus: NO exist');
    }

    // rrr this.onFocusBlock = onFocusBlock;

    // this.onFocusBlock = onFocusBlock ?? onFocusBlockFunc;

    // console.log('block constructor addblockbtn', addBlockButtonClick);
    // console.log('block constructor on focus block', onFocusBlock);

    this.mutationObserver = new MutationObserver(this.didMutated);

    this.tool = tool;
    this.toolInstance = tool.create(data, this.blockAPI, readOnly);

    /**
     * @type {BlockTune[]}
     */
    this.tunes = tool.tunes;

    this.composeTunes(tunesData);

    this.holder = this.compose();
  }

  /**
   * Find and return all editable elements (contenteditables and native inputs) in the Tool HTML
   *
   * @returns {HTMLElement[]}
   */
  public get inputs(): HTMLElement[] {
    /**
     * Return from cache if existed
     */
    if (this.cachedInputs.length !== 0) {
      return this.cachedInputs;
    }

    const inputs = $.findAllInputs(this.holder);

    /**
     * If inputs amount was changed we need to check if input index is bigger then inputs array length
     */
    if (this.inputIndex > inputs.length - 1) {
      this.inputIndex = inputs.length - 1;
    }

    /**
     * Cache inputs
     */
    this.cachedInputs = inputs;

    return inputs;
  }

  /**
   * Return current Tool`s input
   *
   * @returns {HTMLElement}
   */
  public get currentInput(): HTMLElement | Node {
    return this.inputs[this.inputIndex];
  }

  /**
   * Set input index to the passed element
   *
   * @param {HTMLElement | Node} element - HTML Element to set as current input
   */
  public set currentInput(element: HTMLElement | Node) {
    const index = this.inputs.findIndex((input) => input === element || input.contains(element));

    if (index !== -1) {
      this.inputIndex = index;
    }
  }

  /**
   * Return first Tool`s input
   *
   * @returns {HTMLElement}
   */
  public get firstInput(): HTMLElement {
    return this.inputs[0];
  }

  /**
   * Return first Tool`s input
   *
   * @returns {HTMLElement}
   */
  public get lastInput(): HTMLElement {
    const inputs = this.inputs;

    return inputs[inputs.length - 1];
  }

  /**
   * Return next Tool`s input or undefined if it doesn't exist
   *
   * @returns {HTMLElement}
   */
  public get nextInput(): HTMLElement {
    return this.inputs[this.inputIndex + 1];
  }

  /**
   * Return previous Tool`s input or undefined if it doesn't exist
   *
   * @returns {HTMLElement}
   */
  public get previousInput(): HTMLElement {
    return this.inputs[this.inputIndex - 1];
  }

  /**
   * Get Block's JSON data
   *
   * @returns {object}
   */
  public get data(): Promise<BlockToolData> {
    return this.save().then((savedObject) => {
      if (savedObject && !_.isEmpty(savedObject.data)) {
        return savedObject.data;
      } else {
        return {};
      }
    });
  }

  /**
   * Returns tool's sanitizer config
   *
   * @returns {object}
   */
  public get sanitize(): SanitizerConfig {
    return this.tool.sanitizeConfig;
  }

  /**
   * is block mergeable
   * We plugin have merge function then we call it mergable
   *
   * @returns {boolean}
   */
  public get mergeable(): boolean {
    return _.isFunction(this.toolInstance.merge);
  }

  /**
   * Check block for emptiness
   *
   * @returns {boolean}
   */
  public get isEmpty(): boolean {
    const emptyText = $.isEmpty(this.pluginsContent);
    const emptyMedia = !this.hasMedia;

    return emptyText && emptyMedia;
  }

  /**
   * Check if block has a media content such as images, iframes and other
   *
   * @returns {boolean}
   */
  public get hasMedia(): boolean {
    /**
     * This tags represents media-content
     *
     * @type {string[]}
     */
    const mediaTags = [
      'img',
      'iframe',
      'video',
      'audio',
      'source',
      'input',
      'textarea',
      'twitterwidget',
    ];

    return !!this.holder.querySelector(mediaTags.join(','));
  }

  /**
   * Set focused state
   *
   * @param {boolean} state - 'true' to select, 'false' to remove selection
   */
  public set focused(state: boolean) {
    this.holder.classList.toggle(Block.CSS.focused, state);
  }

  /**
   * Get Block's focused state
   */
  public get focused(): boolean {
    return this.holder.classList.contains(Block.CSS.focused);
  }

  /**
   * Set selected state
   * We don't need to mark Block as Selected when it is empty
   *
   * @param {boolean} state - 'true' to select, 'false' to remove selection
   */
  public set selected(state: boolean) {
    if (state) {
      this.holder.classList.add(Block.CSS.selected);

      SelectionUtils.addFakeCursor(this.holder);
    } else {
      this.holder.classList.remove(Block.CSS.selected);

      SelectionUtils.removeFakeCursor(this.holder);
    }
  }

  /**
   * Returns True if it is Selected
   *
   * @returns {boolean}
   */
  public get selected(): boolean {
    return this.holder.classList.contains(Block.CSS.selected);
  }

  /**
   * Set stretched state
   *
   * @param {boolean} state - 'true' to enable, 'false' to disable stretched statte
   */
  public set stretched(state: boolean) {
    this.holder.classList.toggle(Block.CSS.wrapperStretched, state);
  }

  /**
   * Return Block's stretched state
   *
   * @returns {boolean}
   */
  public get stretched(): boolean {
    return this.holder.classList.contains(Block.CSS.wrapperStretched);
  }

  /**
   * Toggle drop target state
   *
   * @param {boolean} state - 'true' if block is drop target, false otherwise
   */
  public set dropTarget(state) {
    this.holder.classList.toggle(Block.CSS.dropTarget, state);
  }

  /**
   * Returns Plugins content
   *
   * @returns {HTMLElement}
   */
  public get pluginsContent(): HTMLElement {
    const blockContentNodes = this.holder.querySelector(`.${Block.CSS.content}`);

    if (blockContentNodes && blockContentNodes.childNodes.length) {
      /**
       * Editors Block content can contain different Nodes from extensions
       * We use DOM isExtensionNode to ignore such Nodes and return first Block that does not match filtering list
       */
      for (let child = blockContentNodes.childNodes.length - 1; child >= 0; child--) {
        const contentNode = blockContentNodes.childNodes[child];

        if (!$.isExtensionNode(contentNode)) {
          return contentNode as HTMLElement;
        }
      }
    }

    return null;
  }

  /**
   * Calls Tool's method
   *
   * Method checks tool property {MethodName}. Fires method with passes params If it is instance of Function
   *
   * @param {string} methodName - method to call
   * @param {object} params - method argument
   */
  public call(methodName: string, params?: object): void {
    /**
     * call Tool's method with the instance context
     */
    if (_.isFunction(this.toolInstance[methodName])) {
      if (methodName === BlockToolAPI.APPEND_CALLBACK) {
        _.log(
          '`appendCallback` hook is deprecated and will be removed in the next major release. ' +
          'Use `rendered` hook instead',
          'warn'
        );
      }

      try {
        // eslint-disable-next-line no-useless-call
        this.toolInstance[methodName].call(this.toolInstance, params);
      } catch (e) {
        _.log(`Error during '${methodName}' call: ${e.message}`, 'error');
      }
    }
  }

  /**
   * Call plugins merge method
   *
   * @param {BlockToolData} data - data to merge
   */
  public async mergeWith(data: BlockToolData): Promise<void> {
    await this.toolInstance.merge(data);
  }

  /**
   * Extracts data from Block
   * Groups Tool's save processing time
   *
   * @returns {object}
   */
  public async save(): Promise<void | SavedData> {
    const extractedBlock = await this.toolInstance.save(this.pluginsContent as HTMLElement);
    const tunesData: { [name: string]: BlockTuneData } = this.unavailableTunesData;

    [
      ...this.tunesInstances.entries(),
      ...this.defaultTunesInstances.entries(),
    ]
      .forEach(([name, tune]) => {
        if (_.isFunction(tune.save)) {
          try {
            tunesData[name] = tune.save();
          } catch (e) {
            _.log(`Tune ${tune.constructor.name} save method throws an Error %o`, 'warn', e);
          }
        }
      });

    /**
     * Measuring execution time
     */
    const measuringStart = window.performance.now();
    let measuringEnd;

    return Promise.resolve(extractedBlock)
      .then((finishedExtraction) => {
        /** measure promise execution */
        measuringEnd = window.performance.now();

        return {
          id: this.id,
          tool: this.name,
          data: finishedExtraction,
          tunes: tunesData,
          time: measuringEnd - measuringStart,
        };
      })
      .catch((error) => {
        _.log(`Saving proccess for ${this.name} tool failed due to the ${error}`, 'log', 'red');
      });
  }

  /**
   * Uses Tool's validation method to check the correctness of output data
   * Tool's validation method is optional
   *
   * @description Method returns true|false whether data passed the validation or not
   *
   * @param {BlockToolData} data - data to validate
   * @returns {Promise<boolean>} valid
   */
  public async validate(data: BlockToolData): Promise<boolean> {
    let isValid = true;

    if (this.toolInstance.validate instanceof Function) {
      isValid = await this.toolInstance.validate(data);
    }

    return isValid;
  }

  /**
   * Enumerates initialized tunes and returns fragment that can be appended to the toolbars area
   *
   * @returns {DocumentFragment[]}
   */
  public renderTunes(): [DocumentFragment, DocumentFragment] {
    const tunesElement = document.createDocumentFragment();
    const defaultTunesElement = document.createDocumentFragment();

    this.tunesInstances.forEach((tune) => {
      $.append(tunesElement, tune.render());
    });
    this.defaultTunesInstances.forEach((tune) => {
      $.append(defaultTunesElement, tune.render());
    });

    return [tunesElement, defaultTunesElement];
  }

  /**
   * Update current input index with selection anchor node
   */
  public updateCurrentInput(): void {
    /**
     * If activeElement is native input, anchorNode points to its parent.
     * So if it is native input use it instead of anchorNode
     *
     * If anchorNode is undefined, also use activeElement
     */
    this.currentInput = $.isNativeInput(document.activeElement) || !SelectionUtils.anchorNode
      ? document.activeElement
      : SelectionUtils.anchorNode;
  }

  /**
   * Is fired when Block will be selected as current
   */
  public willSelect(): void {
    /**
     * Observe DOM mutations to update Block inputs
     */
    this.mutationObserver.observe(
      this.holder.firstElementChild,
      {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      }
    );

    /**
     * Mutation observer doesn't track changes in "<input>" and "<textarea>"
     * so we need to track focus events to update current input and clear cache.
     */
    this.addInputEvents();
  }

  /**
   * Is fired when Block will be unselected
   */
  public willUnselect(): void {
    this.mutationObserver.disconnect();
    this.removeInputEvents();
  }

  /**
   * Allows to say Editor that Block was changed. Used to manually trigger Editor's 'onChange' callback
   * Can be useful for block changes invisible for editor core.
   */
  public dispatchChange(): void {
    this.didMutated();
  }

  /**
   * Call Tool instance destroy method
   */
  public destroy(): void {
    super.destroy();

    if (_.isFunction(this.toolInstance.destroy)) {
      this.toolInstance.destroy();
    }
  }

  /**
   * Call Tool instance renderSettings method
   */
  public renderSettings(): HTMLElement | undefined {
    if (_.isFunction(this.toolInstance.renderSettings)) {
      return this.toolInstance.renderSettings();
    }
  }

  /**
   * Tool could specify several entries to be displayed at the Toolbox (for example, "Heading 1", "Heading 2", "Heading 3")
   * This method returns the entry that is related to the Block (depended on the Block data)
   */
  public async getActiveToolboxEntry(): Promise<ToolboxConfigEntry | undefined> {
    const toolboxSettings = this.tool.toolbox;

    /**
     * If Tool specifies just the single entry, treat it like an active
     */
    if (toolboxSettings.length === 1) {
      return Promise.resolve(this.tool.toolbox[0]);
    }

    /**
     * If we have several entries with their own data overrides,
     * find those who matches some current data property
     *
     * Example:
     *  Tools' toolbox: [
     *    {title: "Heading 1", data: {level: 1} },
     *    {title: "Heading 2", data: {level: 2} }
     *  ]
     *
     *  the Block data: {
     *    text: "Heading text",
     *    level: 2
     *  }
     *
     *  that means that for the current block, the second toolbox item (matched by "{level: 2}") is active
     */
    const blockData = await this.data;
    const toolboxItems = toolboxSettings;

    return toolboxItems.find((item) => {
      return Object.entries(item.data)
        .some(([propName, propValue]) => {
          return blockData[propName] && _.equals(blockData[propName], propValue);
        });
    });
  }

  /**
   * Make default Block wrappers and put Tool`s content there
   *
   * @returns {HTMLDivElement}
   */
  private compose(): HTMLDivElement {
    const wrapper = $.make('div', Block.CSS.wrapper) as HTMLDivElement,
        contentNode = $.make('div', Block.CSS.content),
        pluginsContent = this.toolInstance.render();

    contentNode.appendChild(pluginsContent);

    /**
     * Block Tunes might wrap Block's content node to provide any UI changes
     *
     * <tune2wrapper>
     *   <tune1wrapper>
     *     <blockContent />
     *   </tune1wrapper>
     * </tune2wrapper>
     */
    let wrappedContentNode: HTMLElement = contentNode;

    [...this.tunesInstances.values(), ...this.defaultTunesInstances.values()]
      .forEach((tune) => {
        if (_.isFunction(tune.wrap)) {
          try {
            wrappedContentNode = tune.wrap(wrappedContentNode);
          } catch (e) {
            _.log(`Tune ${tune.constructor.name} wrap method throws an Error %o`, 'warn', e);
          }
        }
      });

    wrapper.appendChild(wrappedContentNode);

    // console.log('this.addBlockButtonClick', this.config.addBlockButtonClick);
    // console.log('this.config', this.config);
    // console.log('this.blockAPI', this);

    if (this.addBlockButtonClick) {
      const addBtn = this.getAddBtn()
      wrapper.appendChild(addBtn);
    }

    return wrapper;
  }

  private getAddBtn(): HTMLDivElement {
    const wrapper = $.make('div', Block.CSS.addBlockWrapper) as HTMLDivElement,
          btn = $.make('span', Block.CSS.addBlockBtn),
          text = $.make('span', Block.CSS.addBlockText),
          btnClickSquare = $.make('span', Block.CSS.addBlockBtnClickSquare),
          line = $.make('span', Block.CSS.addBlockLine);

    btnClickSquare.onclick = () => {
      // this.api.methods.blocks.insert();
      const currentBlockIndex = this.api.methods.blocks.getCurrentBlockIndex();
      // console.log('btnClickSquare.onclick', currentBlockIndex);
      this.addBlockButtonClick(currentBlockIndex);
    };
    text.innerHTML = 'Add block';
    btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M9.28571 5.71429H5.71429V9.28571C5.71429 9.67857 5.39286 10 5 10C4.60714 10 4.28571 9.67857 4.28571 9.28571V5.71429H0.714286C0.321429 5.71429 0 5.39286 0 5C0 4.60714 0.321429 4.28571 0.714286 4.28571H4.28571V0.714286C4.28571 0.321429 4.60714 0 5 0C5.39286 0 5.71429 0.321429 5.71429 0.714286V4.28571H9.28571C9.67857 4.28571 10 4.60714 10 5C10 5.39286 9.67857 5.71429 9.28571 5.71429Z" fill="#9293AD"/>' +
      '</svg>';
    btn.appendChild(text);

    btnClickSquare.appendChild(btn);
    wrapper.appendChild(btnClickSquare);
    wrapper.appendChild(line);

    return wrapper;
  }

  /**
   * Instantiate Block Tunes
   *
   * @param tunesData - current Block tunes data
   * @private
   */
  private composeTunes(tunesData: { [name: string]: BlockTuneData }): void {
    Array.from(this.tunes.values()).forEach((tune) => {
      const collection = tune.isInternal ? this.defaultTunesInstances : this.tunesInstances;

      collection.set(tune.name, tune.create(tunesData[tune.name], this.blockAPI));
    });

    /**
     * Check if there is some data for not available tunes
     */
    Object.entries(tunesData).forEach(([name, data]) => {
      if (!this.tunesInstances.has(name)) {
        this.unavailableTunesData[name] = data;
      }
    });
  }

  /**
   * Is fired when text input or contentEditable is focused
   */
  private handleFocus = (): void => {
    /**
     * Drop cache
     */
    this.cachedInputs = [];
    // console.log('handleFocus');
    /**
     * Update current input
     */
    this.updateCurrentInput();

    const currentBlockIndex = this.api.methods.blocks.getCurrentBlockIndex();
    const currentBlock = this.api.methods.blocks.getBlockByIndex(currentBlockIndex);

    let index = null;

    if (currentBlock) {
      const blockRedactorContainer = currentBlock.holder.closest('.codex-editor__redactor');

      // console.log('currentBlock.holder', currentBlock.holder);

      // console.log('blockRedactorContainer', blockRedactorContainer);

      if (blockRedactorContainer) {
        const parentBlock = blockRedactorContainer.closest('.ce-block');

        // console.log('parentBlock', parentBlock);

        if (parentBlock) {
          const parentBlockContainer = parentBlock.closest('.codex-editor__redactor');

          // console.log('parentBlockContainer', parentBlockContainer);

          if (parentBlockContainer) {
            index = Array
              .from(parentBlockContainer.children)
              .findIndex((n) => {
                // console.log('findIndex', n, parentBlock);
                return n === parentBlock
              });
          }
        }
      }
    }

    if (this.onFocusBlock && isNumber(index) && index > -1) {
      // console.log('set onFocusBlock', );
      const unFocusCallback = () => {
        const n = this.api.methods.blocks.getCurrentBlockIndex();
        // console.log('unFocusCallback call current=', n);
        const holder = this.api.methods.blocks.getBlockByIndex(n);

        // 11
        // this.api.methods.blocks.unSelectBLockByIndex(n);
        this.api.methods.toolbar.close();

        if (holder) {
          // console.log(holder);
          // console.log('unFocusCallback holder', holder.holder);
          // holder.selected = false;
        }
      }


      // rrr this.onFocusBlock(index, unFocusCallback);
      // this.onFocusBlock(index, null);
    } else {
      // 11
      // rrr this.onFocusBlock(null, null);
      // console.log('handleFocus not exist', currentBlockIndex, index);
    }
  }

  /**
   * Adds focus event listeners to all inputs and contentEditables
   */
  private addInputEvents(): void {
    this.inputs.forEach(input => {
      input.addEventListener('focus', this.handleFocus);

      /**
       * If input is native input add oninput listener to observe changes
       */
      if ($.isNativeInput(input)) {
        input.addEventListener('input', this.didMutated);
      }
    });
  }

  /**
   * removes focus event listeners from all inputs and contentEditables
   */
  private removeInputEvents(): void {
    this.inputs.forEach(input => {
      input.removeEventListener('focus', this.handleFocus);

      if ($.isNativeInput(input)) {
        input.removeEventListener('input', this.didMutated);
      }
    });
  }
}
