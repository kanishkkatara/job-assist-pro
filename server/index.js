require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    // Only allow specific extension or localhost
    const allowedExtensionId = process.env.ALLOWED_EXTENSION_ID;
    
    if (!origin) {
      // Allow non-browser requests (e.g. curl, server-to-server) during dev
      callback(null, true);
    } else if (allowedExtensionId && origin === `chrome-extension://${allowedExtensionId}`) {
      callback(null, true);
    } else if (origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

const PORT = process.env.PORT || 3000;

const { streamText, streamObject } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const { z } = require('zod');

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model } = req.body;
    const apiKey = process.env.OPENAI_API_KEY || req.headers.authorization?.split(' ')[1];
    if (!apiKey) return res.status(401).json({ error: 'No API key provided' });

    const openai = createOpenAI({ apiKey });
    const result = streamText({
      model: openai(model || 'gpt-4o-mini'),
      messages,
      temperature: 0.7,
    });
    
    result.pipeTextStreamToResponse(res);
  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/object', async (req, res) => {
  try {
    const { messages, model, schemaId } = req.body;
    const apiKey = process.env.OPENAI_API_KEY || req.headers.authorization?.split(' ')[1];
    if (!apiKey) return res.status(401).json({ error: 'No API key provided' });

    const openai = createOpenAI({ apiKey });
    
    // Choose schema based on schemaId from client
    let schema;
    if (schemaId === 'mock-questions') {
      schema = z.object({
        questions: z.array(z.string()).length(5).describe('An array of exactly 5 behavioral interview questions requiring STAR format')
      });
    } else if (schemaId === 'star-critique') {
      schema = z.object({
        situation: z.string().describe('Critique of how the candidate presented the Situation'),
        task: z.string().describe('Critique of the Task portion'),
        action: z.string().describe('Critique of the Action portion'),
        result: z.string().describe('Critique of the Result portion'),
        critique: z.string().describe('1-2 sentences on what was good and what was weak overall'),
        betterVersion: z.string().describe('A polished, professional 1st-person rewrite of their answer')
      });
    } else {
      return res.status(400).json({ error: 'Invalid schemaId' });
    }

    const result = streamObject({
      model: openai(model || 'gpt-4o-mini'),
      schema,
      messages,
      temperature: 0.7,
    });
    
    result.pipeTextStreamToResponse(res);
  } catch (error) {
    console.error('Proxy Object Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`JobAssist Proxy Server running on http://localhost:${PORT}`);
});
