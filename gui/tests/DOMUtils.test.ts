import { DOMUtils } from '../src/utils/DOMUtils';

describe('DOMUtils', () => {
  beforeEach(() => {
    // Reset DOM before each test
    document.body.innerHTML = `
      <div id="test-element">Test Content</div>
      <input id="test-input" type="text" value="test value">
      <button id="test-button" disabled>Test Button</button>
      <select id="test-select">
        <option value="option1">Option 1</option>
        <option value="option2">Option 2</option>
      </select>
      <div id="show-element" class="visible">Visible</div>
      <div id="hide-element" class="hidden">Hidden</div>
    `;
  });

  describe('Element Retrieval', () => {
    it('should get element by id', () => {
      const element = DOMUtils.getElementById('test-element');
      expect(element).toBeTruthy();
      expect(element?.textContent).toBe('Test Content');
    });

    it('should return null for non-existent element', () => {
      const element = DOMUtils.getElementById('non-existent');
      expect(element).toBeNull();
    });

    it('should get required element by id', () => {
      const element = DOMUtils.getRequiredElement('test-element');
      expect(element).toBeTruthy();
      expect(element.textContent).toBe('Test Content');
    });

    it('should throw error for non-existent required element', () => {
      expect(() => {
        DOMUtils.getRequiredElement('non-existent');
      }).toThrow('Required element not found: non-existent');
    });

    it('should get required element with type casting', () => {
      const input = DOMUtils.getRequiredElement<HTMLInputElement>('test-input');
      expect(input).toBeTruthy();
      expect(input.value).toBe('test value');
      expect(input.tagName).toBe('INPUT');
    });
  });

  describe('Text Content Operations', () => {
    it('should set text content', () => {
      DOMUtils.setTextContent('test-element', 'New Content');
      const element = document.getElementById('test-element');
      expect(element?.textContent).toBe('New Content');
    });

    it('should handle non-existent element gracefully when setting text', () => {
      expect(() => {
        DOMUtils.setTextContent('non-existent', 'content');
      }).not.toThrow();
    });
  });

  describe('HTML Content Operations', () => {
    it('should set inner HTML', () => {
      DOMUtils.setInnerHTML('test-element', '<span>HTML Content</span>');
      const element = document.getElementById('test-element');
      expect(element?.innerHTML).toBe('<span>HTML Content</span>');
    });

    it('should handle non-existent element gracefully when setting HTML', () => {
      expect(() => {
        DOMUtils.setInnerHTML('non-existent', '<span>content</span>');
      }).not.toThrow();
    });
  });

  describe('Value Operations', () => {
    it('should set input value', () => {
      DOMUtils.setValue('test-input', 'new value');
      const input = document.getElementById('test-input') as HTMLInputElement;
      expect(input.value).toBe('new value');
    });

    it('should get input value', () => {
      const value = DOMUtils.getValue('test-input');
      expect(value).toBe('test value');
    });

    it('should return empty string for non-existent element value', () => {
      const value = DOMUtils.getValue('non-existent');
      expect(value).toBe('');
    });
  });

  describe('Disabled State Operations', () => {
    it('should set disabled state', () => {
      DOMUtils.setDisabled('test-button', false);
      const button = document.getElementById('test-button') as HTMLButtonElement;
      expect(button.disabled).toBe(false);

      DOMUtils.setDisabled('test-button', true);
      expect(button.disabled).toBe(true);
    });

    it('should handle non-existent elements gracefully', () => {
      expect(() => {
        DOMUtils.setDisabled('non-existent', true);
      }).not.toThrow();
    });
  });

  describe('Visibility Operations', () => {
    it('should toggle element visibility with classes', () => {
      // Show hidden element
      DOMUtils.toggleElement('hide-element', true);
      const hiddenElement = document.getElementById('hide-element');
      expect(hiddenElement?.classList.contains('hidden')).toBe(false);

      // Hide visible element
      DOMUtils.toggleElement('show-element', false);
      const visibleElement = document.getElementById('show-element');
      expect(visibleElement?.classList.contains('hidden')).toBe(true);
    });

    it('should show only specified element', () => {
      document.body.innerHTML += '<div id="extra1">Extra 1</div><div id="extra2">Extra 2</div>';
      
      DOMUtils.showOnly('test-element', ['extra1', 'extra2']);
      
      const testElement = document.getElementById('test-element');
      const extra1 = document.getElementById('extra1');
      const extra2 = document.getElementById('extra2');
      
      expect(testElement?.classList.contains('hidden')).toBe(false);
      expect(extra1?.classList.contains('hidden')).toBe(true);
      expect(extra2?.classList.contains('hidden')).toBe(true);
    });

    it('should handle non-existent elements in showOnly', () => {
      expect(() => {
        DOMUtils.showOnly('test-element', ['non-existent']);
      }).not.toThrow();
    });
  });

  describe('Event Handling', () => {
    it('should add event listener', async () => {
      const mockHandler = jest.fn();
      
      // Create a button element with unique ID
      const uniqueId = 'test-button-' + Date.now();
      const button = document.createElement('button');
      button.id = uniqueId;
      document.body.appendChild(button);
      
      DOMUtils.addEventListener(uniqueId, 'click', mockHandler);
      
      // Click the button using the event API
      const clickEvent = new Event('click', { bubbles: true });
      button.dispatchEvent(clickEvent);
      
      expect(mockHandler).toHaveBeenCalledTimes(1);
      
      // Clean up
      document.body.removeChild(button);
    });

    it('should handle non-existent element for event listener', () => {
      const mockHandler = jest.fn();
      
      expect(() => {
        DOMUtils.addEventListener('non-existent', 'click', mockHandler);
      }).not.toThrow();
    });
  });
});
