/**
 * AuraCalc - Modern Smart Calculator Engine
 * Clean, safe mathematical evaluation with state management,
 * Web Audio feedback, history persistence, and keyboard shortcuts.
 */

class AuraCalculator {
  constructor() {
    // State variables
    this.currentInput = '0';
    this.expression = '';
    this.memory = parseFloat(localStorage.getItem('auracalc_memory') || '0');
    this.history = JSON.parse(localStorage.getItem('auracalc_history') || '[]');
    this.angleMode = localStorage.getItem('auracalc_angle') || 'DEG'; // 'DEG' or 'RAD'
    this.soundEnabled = localStorage.getItem('auracalc_sound') !== 'false';
    this.isScientific = localStorage.getItem('auracalc_mode') === 'scientific';
    this.theme = localStorage.getItem('auracalc_theme') || 'dark';
    this.shouldResetInput = false;

    // Web Audio Context for synthesized sound feedback
    this.audioCtx = null;

    // DOM Elements
    this.cacheDOMElements();

    // Initialize
    this.initTheme();
    this.initMode();
    this.initAngleMode();
    this.initSound();
    this.updateMemoryIndicator();
    this.renderDisplay();
    this.renderHistory();
    this.bindEvents();
  }

  cacheDOMElements() {
    this.appContainer = document.querySelector('.calculator-app');
    this.mainDisplay = document.getElementById('main-display');
    this.secondaryDisplay = document.getElementById('secondary-display');
    this.displaySection = document.getElementById('display-section');
    this.copyHint = document.getElementById('copy-hint');
    this.modeBadge = document.getElementById('mode-badge');
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.modeToggleBtn = document.getElementById('mode-toggle-btn');
    this.soundToggleBtn = document.getElementById('sound-toggle-btn');
    this.historyToggleBtn = document.getElementById('history-toggle-btn');
    this.closeHistoryBtn = document.getElementById('close-history-btn');
    this.clearHistoryBtn = document.getElementById('clear-history-btn');
    this.historyDrawer = document.getElementById('history-drawer');
    this.historyList = document.getElementById('history-list');
    this.memIndicator = document.getElementById('mem-indicator');
    this.angleIndicator = document.getElementById('angle-indicator');
    this.degRadBtn = document.getElementById('deg-rad-btn');
    this.keypad = document.getElementById('keypad');
  }

  /* -------------------------------------------------------------
   * Audio Synthesis Feedback (No external audio files required!)
   * ------------------------------------------------------------- */
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playBeep(type = 'digit') {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      let freq = 600;
      let duration = 0.035;

      switch (type) {
        case 'operator':
          freq = 440;
          duration = 0.04;
          break;
        case 'action':
          freq = 320;
          duration = 0.05;
          break;
        case 'equals':
          freq = 780;
          duration = 0.08;
          break;
        case 'scientific':
          freq = 880;
          duration = 0.035;
          break;
        case 'digit':
        default:
          freq = 560;
          duration = 0.03;
          break;
      }

      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Audio context may be restricted by autoplay policy before gesture
    }
  }

  /* -------------------------------------------------------------
   * Initialization & Preferences
   * ------------------------------------------------------------- */
  initTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('auracalc_theme', this.theme);
    this.playBeep('action');
  }

  initMode() {
    if (this.isScientific) {
      this.appContainer.classList.add('scientific-expanded');
      this.modeBadge.textContent = 'Scientific';
      this.modeToggleBtn.classList.add('active');
    } else {
      this.appContainer.classList.remove('scientific-expanded');
      this.modeBadge.textContent = 'Standard';
      this.modeToggleBtn.classList.remove('active');
    }
  }

  toggleScientificMode() {
    this.isScientific = !this.isScientific;
    localStorage.setItem('auracalc_mode', this.isScientific ? 'scientific' : 'standard');
    this.initMode();
    this.playBeep('scientific');
  }

  initSound() {
    this.soundToggleBtn.classList.toggle('active', this.soundEnabled);
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('auracalc_sound', this.soundEnabled);
    this.initSound();
    if (this.soundEnabled) this.playBeep('action');
  }

  initAngleMode() {
    this.angleIndicator.textContent = this.angleMode;
    if (this.degRadBtn) {
      this.degRadBtn.textContent = this.angleMode === 'DEG' ? 'RAD' : 'DEG';
    }
  }

  toggleAngleMode() {
    this.angleMode = this.angleMode === 'DEG' ? 'RAD' : 'DEG';
    localStorage.setItem('auracalc_angle', this.angleMode);
    this.initAngleMode();
    this.playBeep('scientific');
  }

  updateMemoryIndicator() {
    if (this.memory !== 0) {
      this.memIndicator.classList.add('active');
    } else {
      this.memIndicator.classList.remove('active');
    }
  }

  /* -------------------------------------------------------------
   * Display Formatting & Rendering
   * ------------------------------------------------------------- */
  renderDisplay() {
    this.mainDisplay.textContent = this.formatDisplayNumber(this.currentInput);
    this.secondaryDisplay.textContent = this.expression;

    // Adjust font size dynamically to fit content
    const len = this.mainDisplay.textContent.length;
    this.mainDisplay.classList.remove('shrink-md', 'shrink-sm', 'shrink-xs');
    if (len > 14) {
      this.mainDisplay.classList.add('shrink-xs');
    } else if (len > 10) {
      this.mainDisplay.classList.add('shrink-sm');
    } else if (len > 7) {
      this.mainDisplay.classList.add('shrink-md');
    }
  }

  formatDisplayNumber(str) {
    if (!str) return '0';
    if (str === 'Error' || str === 'Infinity' || str === '-Infinity' || str === 'NaN') {
      return str;
    }
    // If it contains operators or expression brackets, show as is
    if (/[\+\-\*\/×÷\(\)\^]/.test(str)) {
      return str.replace(/\*/g, '×').replace(/\//g, '÷');
    }

    // Number formatting with thousands commas
    const parts = str.split('.');
    let integerPart = parts[0];
    const decimalPart = parts.length > 1 ? '.' + parts[1] : '';

    // Handle negative sign
    let isNeg = false;
    if (integerPart.startsWith('-')) {
      isNeg = true;
      integerPart = integerPart.substring(1);
    }

    if (integerPart.length > 0 && !isNaN(integerPart)) {
      integerPart = Number(integerPart).toLocaleString('en-US');
    }

    return (isNeg ? '-' : '') + integerPart + decimalPart;
  }

  formatPrecision(num) {
    if (isNaN(num)) return 'Error';
    if (!isFinite(num)) return num > 0 ? 'Infinity' : '-Infinity';

    // Solve floating point issues like 0.1 + 0.2
    const fixed = parseFloat(num.toPrecision(12));
    // If integer or simple decimal
    if (Math.abs(fixed) < 1e14 && Math.abs(fixed) > 1e-6 || fixed === 0) {
      return fixed.toString();
    }
    return num.toExponential(6).replace(/\+?0*([0-9]+)$/, '$1');
  }

  /* -------------------------------------------------------------
   * Core Calculation Actions
   * ------------------------------------------------------------- */
  inputDigit(digit) {
    this.playBeep('digit');

    if (this.currentInput === '0' || this.shouldResetInput || this.currentInput === 'Error') {
      this.currentInput = digit;
      this.shouldResetInput = false;
    } else {
      if (this.currentInput.replace(/[^\d]/g, '').length < 16) {
        this.currentInput += digit;
      }
    }
    this.renderDisplay();
  }

  inputDecimal() {
    this.playBeep('digit');
    if (this.shouldResetInput || this.currentInput === 'Error') {
      this.currentInput = '0.';
      this.shouldResetInput = false;
    } else if (!this.currentInput.includes('.')) {
      this.currentInput += '.';
    }
    this.renderDisplay();
  }

  inputOperator(op) {
    this.playBeep('operator');
    if (this.currentInput === 'Error') return;

    if (this.expression && !this.shouldResetInput) {
      this.expression += ` ${this.currentInput} ${this.getOpSymbol(op)}`;
    } else {
      this.expression = `${this.currentInput} ${this.getOpSymbol(op)}`;
    }

    this.shouldResetInput = true;
    this.renderDisplay();
  }

  getOpSymbol(op) {
    switch (op) {
      case '*': return '×';
      case '/': return '÷';
      case '-': return '−';
      case '+': return '+';
      default: return op;
    }
  }

  inputBracket(bracket) {
    this.playBeep('operator');
    if (this.shouldResetInput) {
      this.currentInput = bracket;
      this.shouldResetInput = false;
    } else if (this.currentInput === '0') {
      this.currentInput = bracket;
    } else {
      this.currentInput += bracket;
    }
    this.renderDisplay();
  }

  clear() {
    this.playBeep('action');
    this.currentInput = '0';
    this.expression = '';
    this.shouldResetInput = false;
    this.renderDisplay();
  }

  backspace() {
    this.playBeep('action');
    if (this.shouldResetInput || this.currentInput === 'Error') {
      this.currentInput = '0';
      this.shouldResetInput = false;
    } else if (this.currentInput.length > 1) {
      this.currentInput = this.currentInput.slice(0, -1);
      if (this.currentInput === '-' || this.currentInput === '') {
        this.currentInput = '0';
      }
    } else {
      this.currentInput = '0';
    }
    this.renderDisplay();
  }

  negate() {
    this.playBeep('operator');
    if (this.currentInput === '0' || this.currentInput === 'Error') return;
    if (this.currentInput.startsWith('-')) {
      this.currentInput = this.currentInput.substring(1);
    } else {
      this.currentInput = '-' + this.currentInput;
    }
    this.renderDisplay();
  }

  percent() {
    this.playBeep('operator');
    const val = parseFloat(this.currentInput);
    if (!isNaN(val)) {
      this.currentInput = this.formatPrecision(val / 100);
      this.shouldResetInput = true;
      this.renderDisplay();
    }
  }

  sqrt() {
    this.playBeep('scientific');
    const val = parseFloat(this.currentInput);
    if (val < 0) {
      this.currentInput = 'Error';
    } else {
      this.expression = `√(${this.currentInput})`;
      this.currentInput = this.formatPrecision(Math.sqrt(val));
    }
    this.shouldResetInput = true;
    this.renderDisplay();
  }

  sqr() {
    this.playBeep('scientific');
    const val = parseFloat(this.currentInput);
    this.expression = `sqr(${this.currentInput})`;
    this.currentInput = this.formatPrecision(Math.pow(val, 2));
    this.shouldResetInput = true;
    this.renderDisplay();
  }

  power() {
    this.inputOperator('^');
  }

  factorial() {
    this.playBeep('scientific');
    const n = parseInt(this.currentInput, 10);
    if (isNaN(n) || n < 0 || n > 170 || !Number.isInteger(parseFloat(this.currentInput))) {
      this.currentInput = 'Error';
    } else {
      let res = 1;
      for (let i = 2; i <= n; i++) res *= i;
      this.expression = `${n}!`;
      this.currentInput = this.formatPrecision(res);
    }
    this.shouldResetInput = true;
    this.renderDisplay();
  }

  trig(funcName) {
    this.playBeep('scientific');
    let val = parseFloat(this.currentInput);
    if (isNaN(val)) return;

    const originalVal = val;
    if (this.angleMode === 'DEG') {
      val = (val * Math.PI) / 180;
    }

    let result;
    switch (funcName) {
      case 'sin':
        result = Math.sin(val);
        break;
      case 'cos':
        result = Math.cos(val);
        break;
      case 'tan':
        if (this.angleMode === 'DEG' && (originalVal % 180 === 90 || originalVal % 180 === -90)) {
          result = NaN;
        } else {
          result = Math.tan(val);
        }
        break;
      default:
        return;
    }

    this.expression = `${funcName}(${this.currentInput})`;
    this.currentInput = isNaN(result) ? 'Error' : this.formatPrecision(result);
    this.shouldResetInput = true;
    this.renderDisplay();
  }

  logarithm(type) {
    this.playBeep('scientific');
    const val = parseFloat(this.currentInput);
    if (val <= 0 || isNaN(val)) {
      this.currentInput = 'Error';
    } else {
      const res = type === 'ln' ? Math.log(val) : Math.log10(val);
      this.expression = `${type}(${this.currentInput})`;
      this.currentInput = this.formatPrecision(res);
    }
    this.shouldResetInput = true;
    this.renderDisplay();
  }

  insertConstant(constant) {
    this.playBeep('scientific');
    const val = constant === 'pi' ? Math.PI : Math.E;
    this.currentInput = this.formatPrecision(val);
    this.shouldResetInput = true;
    this.renderDisplay();
  }

  /* -------------------------------------------------------------
   * Safe Evaluation Engine
   * ------------------------------------------------------------- */
  calculate() {
    this.playBeep('equals');
    if (this.currentInput === 'Error') return;

    let fullExpr = '';
    if (this.expression && !this.expression.includes('=')) {
      fullExpr = `${this.expression} ${this.currentInput}`;
    } else {
      fullExpr = this.currentInput;
    }

    try {
      const result = this.evaluateMathExpression(fullExpr);
      const formattedResult = this.formatPrecision(result);

      // Record History
      this.addHistory(fullExpr, formattedResult);

      this.expression = `${fullExpr} =`;
      this.currentInput = formattedResult;
      this.shouldResetInput = true;
    } catch {
      this.currentInput = 'Error';
      this.shouldResetInput = true;
    }

    this.renderDisplay();
  }

  evaluateMathExpression(rawExpr) {
    // Sanitize and normalize characters
    let expr = rawExpr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/\^/g, '**');

    // Reject dangerous syntax or unallowed identifiers
    if (/[^0-9\+\-\*\/\.\(\)\s\*\*%]/.test(expr)) {
      throw new Error('Invalid syntax');
    }

    // Check for division by zero
    if (/\/(\s*)0(?!\.)/.test(expr)) {
      throw new Error('Division by zero');
    }

    // Safely evaluate standard math expressions via Function sandbox
    // only containing pure numerical and arithmetic syntax
    const evalResult = new Function(`'use strict'; return (${expr})`)();

    if (evalResult === undefined || evalResult === null || isNaN(evalResult)) {
      throw new Error('Calculation error');
    }

    return evalResult;
  }

  /* -------------------------------------------------------------
   * Memory Storage Operations
   * ------------------------------------------------------------- */
  handleMemory(action) {
    this.playBeep('action');
    const currentVal = parseFloat(this.currentInput) || 0;

    switch (action) {
      case 'mc':
        this.memory = 0;
        break;
      case 'mr':
        this.currentInput = this.formatPrecision(this.memory);
        this.shouldResetInput = true;
        break;
      case 'm-plus':
        this.memory += currentVal;
        this.shouldResetInput = true;
        break;
      case 'm-minus':
        this.memory -= currentVal;
        this.shouldResetInput = true;
        break;
      case 'ms':
        this.memory = currentVal;
        this.shouldResetInput = true;
        break;
    }

    localStorage.setItem('auracalc_memory', this.memory.toString());
    this.updateMemoryIndicator();
    this.renderDisplay();
  }

  /* -------------------------------------------------------------
   * History Management
   * ------------------------------------------------------------- */
  addHistory(expr, result) {
    if (result === 'Error') return;
    const historyItem = {
      id: Date.now(),
      expression: expr,
      result: result,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.history.unshift(historyItem);
    if (this.history.length > 30) {
      this.history.pop();
    }

    localStorage.setItem('auracalc_history', JSON.stringify(this.history));
    this.renderHistory();
  }

  renderHistory() {
    if (!this.historyList) return;
    if (this.history.length === 0) {
      this.historyList.innerHTML = `<div class="history-empty">No calculations yet</div>`;
      return;
    }

    this.historyList.innerHTML = this.history
      .map(
        item => `
      <div class="history-item" data-result="${item.result}">
        <div class="hist-time">${item.time}</div>
        <div class="hist-expr">${item.expression} =</div>
        <div class="hist-result">${this.formatDisplayNumber(item.result)}</div>
      </div>
    `
      )
      .join('');
  }

  clearHistory() {
    this.history = [];
    localStorage.removeItem('auracalc_history');
    this.renderHistory();
    this.playBeep('action');
  }

  /* -------------------------------------------------------------
   * Clipboard Copy
   * ------------------------------------------------------------- */
  copyResultToClipboard() {
    const textToCopy = this.currentInput;
    if (textToCopy && textToCopy !== 'Error') {
      navigator.clipboard.writeText(textToCopy).then(() => {
        this.copyHint.classList.add('show');
        setTimeout(() => {
          this.copyHint.classList.remove('show');
        }, 1500);
      });
    }
  }

  /* -------------------------------------------------------------
   * Event Listeners & Keyboard Binding
   * ------------------------------------------------------------- */
  bindEvents() {
    // Header Buttons
    this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    this.modeToggleBtn.addEventListener('click', () => this.toggleScientificMode());
    this.soundToggleBtn.addEventListener('click', () => this.toggleSound());

    // History Toggle
    this.historyToggleBtn.addEventListener('click', () => {
      this.historyDrawer.classList.add('open');
      this.playBeep('action');
    });
    this.closeHistoryBtn.addEventListener('click', () => {
      this.historyDrawer.classList.remove('open');
      this.playBeep('action');
    });
    this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());

    // History Item Click to recall
    this.historyList.addEventListener('click', (e) => {
      const item = e.target.closest('.history-item');
      if (item && item.dataset.result) {
        this.currentInput = item.dataset.result;
        this.shouldResetInput = true;
        this.renderDisplay();
        this.historyDrawer.classList.remove('open');
        this.playBeep('digit');
      }
    });

    // Display Copy
    this.displaySection.addEventListener('click', () => this.copyResultToClipboard());

    // Deg / Rad button
    if (this.degRadBtn) {
      this.degRadBtn.addEventListener('click', () => this.toggleAngleMode());
    }

    // Keypad Click Event Delegation
    this.keypad.addEventListener('click', (e) => {
      const keyBtn = e.target.closest('.key');
      if (!keyBtn) return;

      const digit = keyBtn.getAttribute('data-key');
      const action = keyBtn.getAttribute('data-action');
      const op = keyBtn.getAttribute('data-op');

      if (digit && !action && !op) {
        this.inputDigit(digit);
      } else if (action) {
        switch (action) {
          case 'decimal':
            this.inputDecimal();
            break;
          case 'operator':
            this.inputOperator(op);
            break;
          case 'calculate':
            this.calculate();
            break;
          case 'clear':
            this.clear();
            break;
          case 'backspace':
            this.backspace();
            break;
          case 'negate':
            this.negate();
            break;
          case 'percent':
            this.percent();
            break;
          case 'sqrt':
            this.sqrt();
            break;
          case 'sqr':
            this.sqr();
            break;
          case 'power':
            this.power();
            break;
          case 'factorial':
            this.factorial();
            break;
          case 'sin':
          case 'cos':
          case 'tan':
            this.trig(action);
            break;
          case 'ln':
          case 'log':
            this.logarithm(action);
            break;
          case 'pi':
          case 'e':
            this.insertConstant(action);
            break;
          case 'bracket':
            this.inputBracket(digit);
            break;
        }
      }
    });

    // Memory Bar Event Delegation
    const memoryBar = document.querySelector('.memory-bar');
    if (memoryBar) {
      memoryBar.addEventListener('click', (e) => {
        const memBtn = e.target.closest('.mem-btn');
        if (memBtn && memBtn.dataset.action) {
          this.handleMemory(memBtn.dataset.action);
        }
      });
    }

    // Keyboard support
    window.addEventListener('keydown', (e) => {
      // Don't intercept if user is in an input field (none here, but good practice)
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const key = e.key;

      // Highlight visual button
      this.flashKeyVisual(key);

      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        this.inputDigit(key);
      } else if (key === '.') {
        e.preventDefault();
        this.inputDecimal();
      } else if (['+', '-', '*', '/'].includes(key)) {
        e.preventDefault();
        this.inputOperator(key);
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        this.calculate();
      } else if (key === 'Backspace') {
        e.preventDefault();
        this.backspace();
      } else if (key === 'Escape' || key.toLowerCase() === 'c') {
        e.preventDefault();
        this.clear();
      } else if (key === '(' || key === ')') {
        e.preventDefault();
        this.inputBracket(key);
      } else if (key === '%') {
        e.preventDefault();
        this.percent();
      }
    });
  }

  flashKeyVisual(key) {
    let selector = `.key[data-key="${key}"]`;
    if (key === 'Enter') selector = '.key[data-action="calculate"]';
    if (key === 'Escape' || key.toLowerCase() === 'c') selector = '.key[data-action="clear"]';
    if (key === '=') selector = '.key[data-action="calculate"]';

    const btn = document.querySelector(selector);
    if (btn) {
      btn.classList.add('key-pressed');
      setTimeout(() => btn.classList.remove('key-pressed'), 120);
    }
  }
}

// Instantiate on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  window.calculator = new AuraCalculator();
});

