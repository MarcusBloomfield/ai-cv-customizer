import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.BACKEND_PORT || 3001;

// --- OpenAI Client Setup ---
// Ensure your OPENAI_API_KEY is set in your .env file in the backend directory
if (!process.env.OPENAI_API_KEY) {
  console.error('FATAL ERROR: OPENAI_API_KEY is not defined in the .env file.');
  process.exit(1); // Exit if API key is not found
}
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON bodies

// --- Routes ---
app.post('/api/customize', async (req: Request, res: Response) => {
  console.log('Backend: /api/customize POST request received');
  try {
    const { currentResume, jobDescription } = req.body;

    console.log('Backend: Received currentResume length:', currentResume?.length);
    console.log('Backend: Received jobDescription length:', jobDescription?.length);

    if (!currentResume || !jobDescription) {
      console.warn('Backend: Missing currentResume or jobDescription in request body');
      return res.status(400).json({ error: 'Missing currentResume or jobDescription' });
    }

    console.log('Backend: Constructing prompts for OpenAI...');
    const resumeSystemPrompt = `You are an expert resume writer and career coach. 
    Your task is to take the provided 'Original Resume' and the 'Job Description' and generate a complete, ready-to-use 'Tailored Resume'.
    The 'Tailored Resume' should:
    1. Be a full resume document, not just a summary of changes or suggestions.
    2. Incorporate all relevant sections from the 'Original Resume' (e.g., Contact Info, Summary, Skills, Experience, Education, Portfolio, Certifications, Additional Information).
    3. Rewrite and rephrase content from the 'Original Resume' to strongly align with the keywords, requirements, and responsibilities listed in the 'Job Description'.
    4. Emphasize skills and experiences from the 'Original Resume' that are most pertinent to the target job.
    5. Maintain a professional tone and use action verbs effectively.
    6. Ensure the output is well-formatted and easy to read. Use clear placeholders like [Your Name], [Your Email], [Company Name], [University Name], etc., for any PII or specific details that should be customized by the user if not fully provided or if inferred.
    7. Do not invent new experiences or skills not present in the original resume; focus on re-angling and emphasizing existing information.
    8. Pay special attention to the **Header / Contact Information** section:
        a. The resume must start with a clear, professional, and well-formatted header.
        b. The applicant's full name should be the most prominent part of the header (e.g., larger, bold, or centered at the top).
        c. Immediately following or neatly arranged with the name, include a comprehensive contact information block.
        d. This block should strive to include: Phone Number, Email Address, LinkedIn Profile URL, GitHub Profile URL (especially for technical roles), and a personal Portfolio/Website URL if available or mentioned in the original resume.
        e. Format contact details for maximum readability. For example, each item on a new line, or logically grouped (e.g., Phone | Email | LinkedIn).
        f. If the 'Original Resume' lacks any of these standard professional contact details (e.g., no LinkedIn URL, no phone number), explicitly use clear placeholders like '[Your Phone Number]', '[Your LinkedIn Profile URL]', '[Your Portfolio URL]'. Ensure all critical contact points have either real data or a placeholder.
        g. Ensure this header section is clearly separated from the subsequent resume sections (like Summary or Experience), perhaps with a visual separator like a horizontal line if appropriate for a text-based resume format, or ample spacing.`;
    const resumeUserPrompt = `Original Resume:\n"""\n${currentResume}\n"""\n\nJob Description:\n"""\n${jobDescription}\n"""\n\nGenerate the Tailored Resume based on the above, paying close attention to crafting an excellent header section:`;

    const coverLetterSystemPrompt = `You are an expert career advisor specializing in crafting compelling cover letters. 
    Your task is to write a personalized cover letter based on the provided resume and job description. 
    The cover letter should express genuine interest in the role and company, highlight key qualifications from the resume that match the job description, and have a strong call to action. 
    Address it generically if no specific hiring manager name is available. Ensure the output is a complete cover letter.`;
    const coverLetterUserPrompt = `Applicant's Resume:\n"""\n${currentResume}\n"""\n\nJob Description:\n"""\n${jobDescription}\n"""\n\nCover Letter:`;

    console.log('Backend: Sending request to OpenAI API for tailored resume...');
    const resumeCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: resumeSystemPrompt },
        { role: "user", content: resumeUserPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });
    const tailoredResume = resumeCompletion.choices[0]?.message?.content?.trim() || "Error: Could not generate tailored resume.";
    console.log('Backend: Received tailored resume from OpenAI. Length:', tailoredResume.length);

    console.log('Backend: Sending request to OpenAI API for cover letter...');
    const coverLetterCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: coverLetterSystemPrompt },
        { role: "user", content: coverLetterUserPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });
    const coverLetter = coverLetterCompletion.choices[0]?.message?.content?.trim() || "Error: Could not generate cover letter.";
    console.log('Backend: Received cover letter from OpenAI. Length:', coverLetter.length);

    console.log('Backend: Successfully processed request with OpenAI, sending response.');
    return res.json({ tailoredResume, coverLetter });

  } catch (error) {
    console.error('Backend: Error in /api/customize:', error);
    let errorMessage = 'Internal Server Error';
    let statusCode = 500;

    if (error instanceof OpenAI.APIError) {
      console.error('Backend: OpenAI API Error Status:', error.status);
      console.error('Backend: OpenAI API Error Message:', error.message);
      console.error('Backend: OpenAI API Error Code:', error.code);
      console.error('Backend: OpenAI API Error Type:', error.type);
      errorMessage = `AI Service Error: ${error.message}`;
      statusCode = error.status || 500;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return res.status(statusCode).json({ error: 'Failed to process request', details: errorMessage });
  }
});

// Basic Error Handler Middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Backend Unhandled Error:", err.stack);
  res.status(500).send('Something broke on the server!');
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Backend server is running at http://localhost:${port}`);
}); 