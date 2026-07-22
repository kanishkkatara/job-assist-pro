import { AppSettings } from '../types';

export function getAIHeaders(settings: AppSettings) {
  const provider = settings.provider || 'openai';
  const key = provider === 'anthropic' ? settings.anthropicKey : provider === 'google' ? settings.geminiKey : (settings.openaiKey || settings.apiKey);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`,
    'x-ai-provider': provider,
    'x-ai-model': settings.model || 'gpt-4o-mini'
  };

  if (settings.joobleApiKey) {
    headers['x-jooble-api-key'] = settings.joobleApiKey;
  }
  if (settings.rapidApiKey) {
    headers['x-rapidapi-key'] = settings.rapidApiKey;
  }
  if (settings.jobApiProvider) {
    headers['x-job-api-provider'] = settings.jobApiProvider;
  }

  return headers;
}
