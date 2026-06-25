import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Web Audio API
const mockAnalyserNode = {
  fftSize: 0,
  smoothingTimeConstant: 0,
  frequencyBinCount: 256,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockSourceNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

let audioContextCreated = false;

const mockAudioContext = {
  state: 'running' as string,
  resume: vi.fn(),
  createAnalyser: vi.fn(() => mockAnalyserNode),
  createMediaElementSource: vi.fn(() => mockSourceNode),
  destination: {},
};

// Mock AudioContext as a class
class MockAudioContext {
  constructor() {
    audioContextCreated = true;
  }
  state = mockAudioContext.state;
  resume = mockAudioContext.resume;
  createAnalyser = mockAudioContext.createAnalyser;
  createMediaElementSource = mockAudioContext.createMediaElementSource;
  destination = mockAudioContext.destination;
}

vi.stubGlobal('AudioContext', MockAudioContext);

describe('audioAnalyserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audioContextCreated = false;
    mockAudioContext.state = 'running';
    // Reset module state by re-importing
    vi.resetModules();
  });

  describe('init', () => {
    it('creates AudioContext on first call', async () => {
      const { audioAnalyserService } = await import('./audioAnalyser.ts');
      const audioEl = document.createElement('audio');

      audioAnalyserService.init(audioEl);

      expect(audioContextCreated).toBe(true);
    });

    it('creates source node from audio element', async () => {
      const { audioAnalyserService } = await import('./audioAnalyser.ts');
      const audioEl = document.createElement('audio');

      audioAnalyserService.init(audioEl);

      expect(mockAudioContext.createMediaElementSource).toHaveBeenCalledWith(audioEl);
    });

    it('creates analyser node with correct settings', async () => {
      const { audioAnalyserService } = await import('./audioAnalyser.ts');
      const audioEl = document.createElement('audio');

      audioAnalyserService.init(audioEl);

      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
      expect(mockAnalyserNode.fftSize).toBe(512);
      expect(mockAnalyserNode.smoothingTimeConstant).toBe(0.8);
    });

    it('connects source → analyser → destination', async () => {
      const { audioAnalyserService } = await import('./audioAnalyser.ts');
      const audioEl = document.createElement('audio');

      audioAnalyserService.init(audioEl);

      expect(mockSourceNode.connect).toHaveBeenCalledWith(mockAnalyserNode);
      expect(mockAnalyserNode.connect).toHaveBeenCalledWith(mockAudioContext.destination);
    });

    it('resumes AudioContext if suspended', async () => {
      mockAudioContext.state = 'suspended';
      const { audioAnalyserService } = await import('./audioAnalyser.ts');
      const audioEl = document.createElement('audio');

      audioAnalyserService.init(audioEl);

      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('skips re-initialization with same element', async () => {
      const { audioAnalyserService } = await import('./audioAnalyser.ts');
      const audioEl = document.createElement('audio');

      audioAnalyserService.init(audioEl);
      vi.clearAllMocks();

      audioAnalyserService.init(audioEl);

      // Should not create new source or analyser
      expect(mockAudioContext.createMediaElementSource).not.toHaveBeenCalled();
      expect(mockAudioContext.createAnalyser).not.toHaveBeenCalled();
    });

    it('disconnects old source when element changes', async () => {
      const { audioAnalyserService } = await import('./audioAnalyser.ts');
      const audioEl1 = document.createElement('audio');
      const audioEl2 = document.createElement('audio');

      audioAnalyserService.init(audioEl1);
      audioAnalyserService.init(audioEl2);

      expect(mockSourceNode.disconnect).toHaveBeenCalled();
    });
  });

  describe('getAnalyser', () => {
    it('returns null before init', async () => {
      const { audioAnalyserService } = await import('./audioAnalyser.ts');

      expect(audioAnalyserService.getAnalyser()).toBeNull();
    });

    it('returns analyser node after init', async () => {
      const { audioAnalyserService } = await import('./audioAnalyser.ts');
      const audioEl = document.createElement('audio');

      audioAnalyserService.init(audioEl);

      expect(audioAnalyserService.getAnalyser()).toBe(mockAnalyserNode);
    });
  });

  describe('isReady', () => {
    it('returns false before init', async () => {
      const { audioAnalyserService } = await import('./audioAnalyser.ts');

      expect(audioAnalyserService.isReady()).toBe(false);
    });

    it('returns true after init', async () => {
      const { audioAnalyserService } = await import('./audioAnalyser.ts');
      const audioEl = document.createElement('audio');

      audioAnalyserService.init(audioEl);

      expect(audioAnalyserService.isReady()).toBe(true);
    });
  });
});
