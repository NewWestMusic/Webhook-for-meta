import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';

const app = express();
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

// Meta webhooks require a verification endpoint
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && token === process.env.META_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receives the live lead data from Meta
app.post('/webhook', async (req, res) => {
  const leadData = req.body; // Meta sends lead_id here

  try {
    // 1. (Optional) Fetch full lead details using Meta's Graph API with the lead_id
    const rawLeadDetails = "Name: Jane Doe, Custom Question Answer: I need help scaling our ad spend.";

    // 2. Send the raw details to Claude for analysis
    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet",
      max_tokens: 1000,
      messages: [{ 
        role: "user", 
        content: `Analyze this raw Meta lead data: "${rawLeadDetails}". Rate them as High/Med/Low priority and draft a short internal briefing for our sales team.` 
      }],
    });

    const aiAnalysis = msg.content[0].text;

    // 3. Fire the email directly to your team
    await resend.emails.send({
      from: 'system@yourcompany.com',
      to: 'sales@yourcompany.com',
      subject: '🚨 New Meta Lead - AI Briefing Attached',
      html: `<pre>${aiAnalysis}</pre>`
    });

    res.sendStatus(200);
  } catch (error) {
    console.error("Workflow failed:", error);
    res.sendStatus(500);
  }
});

app.listen(3000, () => console.log('Listening for Meta Leads...'));
