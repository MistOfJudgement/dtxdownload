import { SelectionManager } from '../src/managers/SelectionManager';
import { eventBus } from '../src/utils/EventBus';

// Mock dependencies
jest.mock('../src/utils/EventBus');

describe('SelectionManager', () => {
  let selectionManager: SelectionManager;
  const mockEventBus = eventBus as jest.Mocked<typeof eventBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    selectionManager = new SelectionManager();
  });

  describe('Basic Selection Operations', () => {
    it('should start with empty selection', () => {
      expect(selectionManager.getCount()).toBe(0);
      expect(selectionManager.getSelectedArray()).toEqual([]);
      expect(selectionManager.isSelected('any-id')).toBe(false);
    });

    it('should select a single item', () => {
      selectionManager.select('item1');

      expect(selectionManager.isSelected('item1')).toBe(true);
      expect(selectionManager.getCount()).toBe(1);
      expect(selectionManager.getSelectedArray()).toEqual(['item1']);
      expect(mockEventBus.emit).toHaveBeenCalledWith('selection-changed', expect.any(Set));
    });

    it('should deselect an item', () => {
      selectionManager.select('item1');
      selectionManager.deselect('item1');

      expect(selectionManager.isSelected('item1')).toBe(false);
      expect(selectionManager.getCount()).toBe(0);
      expect(selectionManager.getSelectedArray()).toEqual([]);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(2); // select + deselect
    });

    it('should toggle selection', () => {
      // Toggle on
      selectionManager.toggle('item1');
      expect(selectionManager.isSelected('item1')).toBe(true);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);

      // Toggle off
      selectionManager.toggle('item1');
      expect(selectionManager.isSelected('item1')).toBe(false);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(2);
    });

    it('should handle duplicate selections gracefully', () => {
      selectionManager.select('item1');
      selectionManager.select('item1'); // Duplicate

      expect(selectionManager.getCount()).toBe(1);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(2); // Both calls should emit
    });

    it('should handle deselecting non-existent items gracefully', () => {
      selectionManager.deselect('non-existent');

      expect(selectionManager.getCount()).toBe(0);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple Selection Operations', () => {
    it('should select multiple items', () => {
      const items = ['item1', 'item2', 'item3'];
      selectionManager.selectMultiple(items);

      expect(selectionManager.getCount()).toBe(3);
      items.forEach(item => {
        expect(selectionManager.isSelected(item)).toBe(true);
      });
      expect(mockEventBus.emit).toHaveBeenCalledWith('selection-changed', expect.any(Set));
    });

    it('should deselect multiple items', () => {
      const items = ['item1', 'item2', 'item3'];
      selectionManager.selectMultiple(items);
      
      // Deselect individual items since there's no deselectMultiple
      selectionManager.deselect('item1');
      selectionManager.deselect('item3');

      expect(selectionManager.getCount()).toBe(1);
      expect(selectionManager.isSelected('item1')).toBe(false);
      expect(selectionManager.isSelected('item2')).toBe(true);
      expect(selectionManager.isSelected('item3')).toBe(false);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(3); // select + 2 deselects
    });

    it('should set selection to specific items', () => {
      selectionManager.selectMultiple(['item1', 'item2', 'item3']);
      selectionManager.setSelection(['item2', 'item4']);

      expect(selectionManager.getCount()).toBe(2);
      expect(selectionManager.isSelected('item1')).toBe(false);
      expect(selectionManager.isSelected('item2')).toBe(true);
      expect(selectionManager.isSelected('item3')).toBe(false);
      expect(selectionManager.isSelected('item4')).toBe(true);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(2); // select + setSelection
    });

    it('should handle empty arrays', () => {
      selectionManager.selectMultiple([]);
      expect(selectionManager.getCount()).toBe(0);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);

      selectionManager.select('item1');
      selectionManager.setSelection([]);
      expect(selectionManager.getCount()).toBe(0);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(3);
    });

    it('should handle duplicates in multiple selection', () => {
      selectionManager.selectMultiple(['item1', 'item1', 'item2']);

      expect(selectionManager.getCount()).toBe(2);
      expect(selectionManager.isSelected('item1')).toBe(true);
      expect(selectionManager.isSelected('item2')).toBe(true);
    });
  });

  describe('Clear Operations', () => {
    it('should clear all selections', () => {
      selectionManager.selectMultiple(['item1', 'item2', 'item3']);
      selectionManager.clear();

      expect(selectionManager.getCount()).toBe(0);
      expect(selectionManager.getSelectedArray()).toEqual([]);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(2); // select + clear
    });

    it('should handle clearing empty selection', () => {
      selectionManager.clear();

      expect(selectionManager.getCount()).toBe(0);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Selection State Analysis', () => {
    it('should return "none" when no items are selected', () => {
      const state = selectionManager.getSelectionState(['item1', 'item2', 'item3']);
      expect(state).toBe('none');
    });

    it('should return "all" when all items are selected', () => {
      const items = ['item1', 'item2', 'item3'];
      selectionManager.selectMultiple(items);
      
      const state = selectionManager.getSelectionState(items);
      expect(state).toBe('all');
    });

    it('should return "some" when some items are selected', () => {
      selectionManager.selectMultiple(['item1', 'item3']);
      
      const state = selectionManager.getSelectionState(['item1', 'item2', 'item3']);
      expect(state).toBe('some');
    });

    it('should handle empty item list', () => {
      const state = selectionManager.getSelectionState([]);
      expect(state).toBe('none');
    });

    it('should only consider provided items for state calculation', () => {
      selectionManager.selectMultiple(['item1', 'item2', 'item4']); // item4 not in test list
      
      const state = selectionManager.getSelectionState(['item1', 'item2', 'item3']);
      expect(state).toBe('some'); // item3 not selected, item4 ignored
    });
  });

  describe('Event Emission', () => {
    it('should emit selection-changed events with current selection', () => {
      selectionManager.select('item1');
      
      expect(mockEventBus.emit).toHaveBeenCalledWith('selection-changed', expect.any(Set));
      
      const emittedSet = (mockEventBus.emit as jest.Mock).mock.calls[0][1];
      expect(emittedSet.has('item1')).toBe(true);
      expect(emittedSet.size).toBe(1);
    });

    it('should emit events for all operations', () => {
      selectionManager.select('item1');
      selectionManager.toggle('item2');
      selectionManager.selectMultiple(['item3', 'item4']);
      selectionManager.deselect('item1');
      selectionManager.clear();

      expect(mockEventBus.emit).toHaveBeenCalledTimes(5);
      
      // All calls should be to 'selection-changed'
      (mockEventBus.emit as jest.Mock).mock.calls.forEach(call => {
        expect(call[0]).toBe('selection-changed');
        expect(call[1]).toBeInstanceOf(Set);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined/null ids gracefully', () => {
      expect(() => {
        selectionManager.select(undefined as any);
        selectionManager.select(null as any);
        selectionManager.toggle('');
      }).not.toThrow();
    });

    it('should maintain selection integrity across operations', () => {
      // Complex sequence of operations
      selectionManager.selectMultiple(['a', 'b', 'c']);
      selectionManager.deselect('b');
      selectionManager.toggle('d');
      selectionManager.toggle('a'); // Should deselect
      selectionManager.selectMultiple(['e', 'f']);

      const expected = new Set(['c', 'd', 'e', 'f']);
      const actual = new Set(selectionManager.getSelectedArray());
      
      expect(actual).toEqual(expected);
      expect(selectionManager.getCount()).toBe(4);
    });
  });
});
