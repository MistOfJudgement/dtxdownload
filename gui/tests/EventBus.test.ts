import { EventBus } from '../src/utils/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('on() and emit()', () => {
    it('should register and trigger event listeners', () => {
      const mockListener = jest.fn();
      const testData = { test: 'data' };

      eventBus.on('test-event', mockListener);
      eventBus.emit('test-event', testData);

      expect(mockListener).toHaveBeenCalledWith(testData);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners for the same event', () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      eventBus.on('test-event', mockListener1);
      eventBus.on('test-event', mockListener2);
      eventBus.emit('test-event', 'data');

      expect(mockListener1).toHaveBeenCalledWith('data');
      expect(mockListener2).toHaveBeenCalledWith('data');
    });

    it('should handle events with no listeners gracefully', () => {
      expect(() => {
        eventBus.emit('non-existent-event', 'data');
      }).not.toThrow();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Test error');
      });
      const normalListener = jest.fn();

      eventBus.on('test-event', errorListener);
      eventBus.on('test-event', normalListener);

      expect(() => {
        eventBus.emit('test-event', 'data');
      }).not.toThrow();

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('off()', () => {
    it('should remove specific listener', () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      eventBus.on('test-event', mockListener1);
      eventBus.on('test-event', mockListener2);
      eventBus.off('test-event', mockListener1);
      eventBus.emit('test-event', 'data');

      expect(mockListener1).not.toHaveBeenCalled();
      expect(mockListener2).toHaveBeenCalledWith('data');
    });

    it('should remove all listeners when no specific listener provided', () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      eventBus.on('test-event', mockListener1);
      eventBus.on('test-event', mockListener2);
      eventBus.off('test-event');
      eventBus.emit('test-event', 'data');

      expect(mockListener1).not.toHaveBeenCalled();
      expect(mockListener2).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent listeners gracefully', () => {
      const mockListener = jest.fn();

      expect(() => {
        eventBus.off('non-existent-event', mockListener);
      }).not.toThrow();
    });
  });

  describe('global eventBus instance', () => {
    it('should export a global instance', () => {
      const { eventBus: globalEventBus } = require('../src/utils/EventBus');
      expect(globalEventBus).toBeInstanceOf(EventBus);
    });
  });
});
