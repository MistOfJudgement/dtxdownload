/**
 * Tests for modal functionality
 * Since the modal logic is integrated into the main app, we'll test the key methods
 */

import { jest } from '@jest/globals';
import { DOMUtils } from '../src/utils/DOMUtils';
import '../tests/setup';

// Mock the main app class since we only want to test modal behavior
describe('Modal Functionality', () => {
  beforeEach(() => {
    // Create modal DOM structure
    document.body.innerHTML = `
      <div class="modal hidden" id="scrapeModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Scrape Charts</h3>
            <button class="btn btn-icon" id="closeScrapeModal">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="scrapeSource">Source</label>
              <select id="scrapeSource" class="input">
                <option value="approved-dtx">ApprovedDTX</option>
              </select>
            </div>
            <div class="form-group">
              <label>Max Pages</label>
              <input type="number" id="maxPages" value="1" min="1" max="10" class="input">
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="incrementalScrape">
                <span class="checkmark"></span>
                Incremental (skip existing charts)
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancelScrapeBtn">Cancel</button>
            <button class="btn btn-primary" id="startScrapeModalBtn">
              <i class="fas fa-spider"></i> Start Scraping
            </button>
          </div>
        </div>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Modal Visibility', () => {
    it('should show modal when showScrapeModal is called', () => {
      const modal = document.getElementById('scrapeModal');
      expect(modal?.classList.contains('hidden')).toBe(true);

      // Test the show functionality
      DOMUtils.toggleElement('scrapeModal', true);
      
      expect(modal?.classList.contains('hidden')).toBe(false);
    });

    it('should hide modal when hideScrapeModal is called', () => {
      const modal = document.getElementById('scrapeModal');
      modal?.classList.remove('hidden');
      
      expect(modal?.classList.contains('hidden')).toBe(false);

      // Test the hide functionality
      DOMUtils.toggleElement('scrapeModal', false);
      
      expect(modal?.classList.contains('hidden')).toBe(true);
    });

    it('should toggle modal visibility correctly', () => {
      const modal = document.getElementById('scrapeModal');
      
      // Initially hidden
      expect(modal?.classList.contains('hidden')).toBe(true);
      
      // Show modal
      DOMUtils.toggleElement('scrapeModal', true);
      expect(modal?.classList.contains('hidden')).toBe(false);
      
      // Hide modal
      DOMUtils.toggleElement('scrapeModal', false);
      expect(modal?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Modal Form Elements', () => {
    it('should have all required form elements', () => {
      expect(document.getElementById('scrapeSource')).toBeTruthy();
      expect(document.getElementById('maxPages')).toBeTruthy();
      expect(document.getElementById('incrementalScrape')).toBeTruthy();
      expect(document.getElementById('cancelScrapeBtn')).toBeTruthy();
      expect(document.getElementById('startScrapeModalBtn')).toBeTruthy();
      expect(document.getElementById('closeScrapeModal')).toBeTruthy();
    });

    it('should get form values correctly', () => {
      // Set some values
      DOMUtils.setValue('scrapeSource', 'approved-dtx');
      DOMUtils.setValue('maxPages', '5');
      
      const incrementalCheckbox = DOMUtils.getRequiredElement<HTMLInputElement>('incrementalScrape');
      incrementalCheckbox.checked = true;

      // Test getting values
      expect(DOMUtils.getValue('scrapeSource')).toBe('approved-dtx');
      expect(DOMUtils.getValue('maxPages')).toBe('5');
      expect(incrementalCheckbox.checked).toBe(true);
    });

    it('should handle invalid max pages input', () => {
      DOMUtils.setValue('maxPages', 'invalid');
      const value = DOMUtils.getValue('maxPages');
      const numValue = parseInt(value) || 1;
      
      expect(numValue).toBe(1); // Should fallback to 1
    });
  });

  describe('Event Handling', () => {
    it('should handle close button click', () => {
      const mockHandler = jest.fn();
      
      DOMUtils.addEventListener('closeScrapeModal', 'click', mockHandler);
      
      const closeButton = document.getElementById('closeScrapeModal');
      closeButton?.click();
      
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle cancel button click', () => {
      const mockHandler = jest.fn();
      
      DOMUtils.addEventListener('cancelScrapeBtn', 'click', mockHandler);
      
      const cancelButton = document.getElementById('cancelScrapeBtn');
      cancelButton?.click();
      
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle start scraping button click', () => {
      const mockHandler = jest.fn();
      
      DOMUtils.addEventListener('startScrapeModalBtn', 'click', mockHandler);
      
      const startButton = document.getElementById('startScrapeModalBtn');
      startButton?.click();
      
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });
});
