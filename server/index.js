require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

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
    } else if (origin && origin.startsWith('chrome-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Apply rate limiting (e.g. 100 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', apiLimiter);

// Limit JSON payloads to 500kb to prevent memory exhaustion
app.use(express.json({ limit: '500kb' }));

const PORT = process.env.PORT || 3000;

const { streamText, streamObject, generateObject, generateText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const { z } = require('zod');
const pdfParse = require('pdf-parse');

app.post('/api/extract-text', async (req, res) => {
  try {
    const { base64 } = req.body;
    if (!base64) return res.status(400).json({ error: 'No base64 data provided' });
    
    const buffer = Buffer.from(base64.split(',')[1] || base64, 'base64');
    const parsed = await pdfParse(buffer);
    res.json({ text: parsed.text });
  } catch (error) {
    console.error('Extract Text Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

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
      schema: z.object({
        summary: z.string().describe('A powerful 2-3 sentence professional summary based on the resume'),
        skills: z.array(z.string()).describe('All technical and professional skills extracted from the resume'),
        personalInfo: z.object({
          fullName: z.string().describe('Full name of the candidate'),
          email: z.string().describe('Email address, or empty string if not found'),
          phone: z.string().describe('Phone number, or empty string if not found'),
          location: z.string().describe('City/Country location, or empty string if not found'),
          linkedin: z.string().describe('LinkedIn URL, or empty string if not found'),
          github: z.string().describe('GitHub URL, or empty string if not found'),
          website: z.string().describe('Personal website URL, or empty string if not found'),
          yearsExperience: z.string().describe('Total years of professional experience as a number string'),
        }),
        experience: z.array(z.object({
          title: z.string().describe('Job title'),
          company: z.string().describe('Company name'),
          startDate: z.string().describe('Start date e.g. "Jan 2022"'),
          endDate: z.string().describe('End date e.g. "Mar 2024" or "Present"'),
          description: z.string().describe('A single paragraph summarizing key achievements and responsibilities at this role'),
        })).describe('All work experiences in reverse chronological order'),
        education: z.array(z.object({
          degree: z.string().describe('Degree name'),
          institution: z.string().describe('University or school name'),
          year: z.string().describe('Year or date range e.g. "2017 – 2021"'),
          gpa: z.string().describe('GPA if mentioned, otherwise empty string'),
        })),
      }),
      system: 'You are a professional resume parser. Parse the raw PDF resume text into structured data. Fix any weird formatting or line breaks from PDF extraction. Extract every piece of information faithfully. Do not invent data — if a field is not present, return an empty string.',
      messages: [
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
    let systemMessage = messages.find(m => m.role === 'system')?.content;
    let filteredMessages = messages.filter(m => m.role !== 'system');
    
    if (filteredMessages.length === 0 && systemMessage) {
      filteredMessages = [{ role: 'user', content: systemMessage }];
      systemMessage = undefined;
    }

    const result = streamText({
      model: openai(model || 'gpt-4o-mini'),
      system: systemMessage,
      messages: filteredMessages,
      temperature: 0.7
    });
    
    result.pipeTextStreamToResponse(res);
  } catch (error) {
    console.error('Proxy Error:', error.message);
    const status = error.name === 'AbortError' ? 499 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, model } = req.body;
    const apiKey = process.env.OPENAI_API_KEY || req.headers.authorization?.split(' ')[1];
    if (!apiKey) return res.status(401).json({ error: 'No API key provided' });

    const openai = createOpenAI({ apiKey });
    const { text } = await generateText({
      model: openai(model || 'gpt-4o-mini'),
      prompt,
      temperature: 0.7
    });
    
    res.json({ text });
  } catch (error) {
    console.error('Generate Error:', error.message);
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

    let systemMessage = messages.find(m => m.role === 'system')?.content;
    let filteredMessages = messages.filter(m => m.role !== 'system');
    
    if (filteredMessages.length === 0 && systemMessage) {
      filteredMessages = [{ role: 'user', content: systemMessage }];
      systemMessage = undefined;
    }

    const result = streamObject({
      model: openai(model || 'gpt-4o-mini'),
      schema,
      system: systemMessage,
      messages: filteredMessages,
      temperature: 0.7
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
