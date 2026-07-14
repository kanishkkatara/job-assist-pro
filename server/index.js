require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// Apply rate limiting (e.g. 100 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', apiLimiter);

const corsOptions = {
  origin: (origin, callback) => {
    const allowedExtensionId = process.env.ALLOWED_EXTENSION_ID;
    
    // In production, block requests without an origin
    if (!origin && process.env.NODE_ENV === 'production') {
      return callback(new Error('Not allowed by CORS'));
    }
    
    if (!origin && process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else if (allowedExtensionId && origin === `chrome-extension://${allowedExtensionId}`) {
      callback(null, true);
    } else if (origin && (origin === 'http://localhost:3000' || origin === 'http://localhost:5173')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// Limit JSON payloads to 500kb to prevent memory exhaustion
app.use(express.json({ limit: '500kb' }));

const PORT = process.env.PORT || 3000;

const { streamText, streamObject, generateObject } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const { z } = require('zod');

app.post('/api/parse-resume', async (req, res) => {
  try {
    const { text } = req.body;
    const apiKey = process.env.OPENAI_API_KEY || req.headers.authorization?.split(' ')[1];
    if (!apiKey) return res.status(401).json({ error: 'No API key provided' });
    
    if (!text || text.length < 50) {
      return res.status(400).json({ error: 'Text too short or missing' });
    }

    const openai = createOpenAI({ apiKey });
    
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      abortSignal: req.socket,
      schema: z.object({
        summary: z.string().describe('A powerful 2-3 sentence professional summary based on the resume'),
        experience: z.array(z.object({
          title: z.string(),
          company: z.string(),
          date: z.string(),
          location: z.string().optional(),
          bullets: z.array(z.string()).describe('The key achievements/responsibilities')
        }))
      }),
      messages: [
        { role: 'system', content: 'Parse this raw PDF resume text into structured data. Fix any weird formatting or line breaks. Extract all work experience and write a summary.' },
        { role: 'user', content: text }
      ],
      temperature: 0.1,
    });
    
    res.json(result.object);
  } catch (error) {
    console.error('Parse Resume Error:', error.message);
    const status = error.name === 'AbortError' ? 499 : 500;
    res.status(status).json({ error: error.message });
  }
});

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
      abortSignal: req.socket,
    });
    
    result.pipeTextStreamToResponse(res);
  } catch (error) {
    console.error('Proxy Error:', error.message);
    const status = error.name === 'AbortError' ? 499 : 500;
    res.status(status).json({ error: error.message });
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
    } else if (schemaId === 'ats-review') {
      schema = z.object({
        score: z.number().describe('A semantic match score from 0 to 100'),
        strengths: z.array(z.string()).describe('List of key strengths and matches'),
        weaknesses: z.array(z.string()).describe('List of gaps or missing skills'),
        suggestions: z.array(z.object({
          originalContent: z.string().describe('A snippet from the user\'s resume that should be improved'),
          suggestedRewrite: z.string().describe('A rewritten version of the snippet tailored to the JD'),
          reason: z.string().describe('Why this rewrite is better')
        })).describe('Specific, actionable rewrite suggestions for bullet points')
      });
    } else if (schemaId === 'status-update') {
      schema = z.object({
        matchedJobId: z.string().nullable().describe('The ID of the job this email refers to. Null if cannot be determined reliably.'),
        newStatus: z.enum(['Discovered', 'Applied', 'Interviewing', 'Offered', 'Rejected']).describe('The new status based on the email content'),
        draftReply: z.string().describe('A professional, concise draft reply to the email')
      });
    } else if (schemaId === 'discovery') {
      schema = z.object({
        jobs: z.array(z.object({
          title: z.string().describe('The job title'),
          company: z.string().describe('The company name'),
          matchScore: z.number().describe('Match score from 0 to 100'),
          reason: z.string().describe('1 sentence why this is a good match'),
          url: z.string().describe('A fictional or real URL to apply')
        })).min(3).max(7).describe('Top 5 job recommendations based on the profile')
      });
    } else if (schemaId === 'analytics') {
      schema = z.object({
        fillerWords: z.number().describe('Estimated count of filler words (um, uh, like)'),
        pacing: z.string().describe('Feedback on pacing: too fast, too slow, or perfect'),
        confidenceScore: z.number().describe('Confidence score from 0 to 100 based on word choice'),
        strengths: z.array(z.string()).describe('Top 2-3 strengths from the interview'),
        improvements: z.array(z.string()).describe('Top 2-3 areas for improvement')
      });
    } else if (schemaId === 'company-intel') {
      schema = z.object({
        mission: z.string().describe('The core mission or thesis of the company'),
        recentNews: z.array(z.string()).describe('2-3 recent headlines or milestones for the company'),
        culture: z.string().describe('A summary of their engineering/company culture'),
        techStack: z.array(z.string()).describe('Guessed or known technologies they use'),
        redFlags: z.array(z.string()).describe('Potential red flags or common criticisms if any')
      });
    } else {
      return res.status(400).json({ error: 'Invalid schemaId' });
    }

    const result = streamObject({
      model: openai(model || 'gpt-4o-mini'),
      schema,
      messages,
      temperature: 0.7,
      abortSignal: req.socket,
    });
    
    result.pipeTextStreamToResponse(res);
  } catch (error) {
    console.error('Proxy Object Error:', error.message);
    const status = error.name === 'AbortError' ? 499 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`JobAssist Proxy Server running on http://localhost:${PORT}`);
});
