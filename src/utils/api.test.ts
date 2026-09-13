import { describe, it, expect } from 'vitest';
import { getAIHeaders } from './api';
import { AppSettings } from '../types';

describe('getAIHeaders', () => {
  it('should return default OpenAI headers when provider is openai', () => {
    const settings: AppSettings = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      openaiKey: 'test-openai-key'
    };

    const headers = getAIHeaders(settings);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer test-openai-key');
    expect(headers['x-ai-provider']).toBe('openai');
    expect(headers['x-ai-model']).toBe('gpt-4o-mini');
  });

  it('should return Anthropic key when provider is anthropic', () => {
    const settings: AppSettings = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      anthropicKey: 'test-anthropic-key'
    };

    const headers = getAIHeaders(settings);
    expect(headers['Authorization']).toBe('Bearer test-anthropic-key');
    expect(headers['x-ai-provider']).toBe('anthropic');
  });

  it('should return Google Gemini key when provider is google', () => {
    const settings: AppSettings = {
      provider: 'google',
      model: 'gemini-1.5-pro',
      geminiKey: 'test-gemini-key'
    };

    const headers = getAIHeaders(settings);
    expect(headers['Authorization']).toBe('Bearer test-gemini-key');
    expect(headers['x-ai-provider']).toBe('google');
  });

  it('should fallback to legacy apiKey if specific key is absent', () => {
    const settings: AppSettings = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'legacy-api-key'
    };

    const headers = getAIHeaders(settings);
    expect(headers['Authorization']).toBe('Bearer legacy-api-key');
  });

  it('should include optional job API headers when provided', () => {
    const settings: AppSettings = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      openaiKey: 'key',
      joobleApiKey: 'jooble-123',
      rapidApiKey: 'rapid-456',
      jobApiProvider: 'jooble'
    };

    const headers = getAIHeaders(settings);
    expect(headers['x-jooble-api-key']).toBe('jooble-123');
    expect(headers['x-rapidapi-key']).toBe('rapid-456');
    expect(headers['x-job-api-provider']).toBe('jooble');
  });
});
