import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Allow GET verification even if other service keys are not configured.
  if (req.method === 'GET') {
    console.log('Webhook verification request', { query: req.query });
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === process.env.META_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  }

  // For POST, ensure required service keys exist before processing.
  if (req.method === 'POST') {
    if (!process.env.ANTHROPIC_API_KEY || !process.env.RESEND_API_KEY) {
      console.error('Missing ANTHROPIC_API_KEY or RESEND_API_KEY for POST processing');
      return res.status(500).json({ error: 'Missing required service API keys.' });
    }

    try {
      const leadData = req.body;
      const rawLeadDetails = JSON.stringify(leadData, null, 2);

      const msg = await anthropic.messages.create({
        model: 'claude-3-5-sonnet',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Analyze this raw Meta lead data: "${rawLeadDetails}". Rate them as High/Med/Low priority and draft a short internal briefing for our sales team.`
        }],
      });

      const aiAnalysis = msg.content[0].text;

      await resend.emails.send({
        from: 'system@yourcompany.com',
        to: 'sales@yourcompany.com',
        subject: '🚨 New Meta Lead - AI Briefing Attached',
        html: `<pre>${aiAnalysis}</pre>`,
      });

      return res.sendStatus(200);
    } catch (error) {
      console.error('Workflow failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end('Method Not Allowed');
}
