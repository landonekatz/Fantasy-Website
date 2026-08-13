import { Resend } from 'resend';

// Use environment variables for the API key in production
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, slug } = req.body;

  if (!email || !slug) {
    return res.status(400).json({ error: 'Missing email or slug parameters' });
  }

  const leagueUrl = `https://thefantasyvault.com/${slug}`;

  try {
    const data = await resend.emails.send({
      from: 'The Fantasy Vault <onboarding@resend.dev>', // resend.dev allows sending to verified email, but requires a domain for prod
      to: [email],
      subject: 'Welcome to The Fantasy Vault!',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your League is Ready!</h2>
          <p>The Python scraper has finished building the historical archives for your fantasy football league.</p>
          
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Your League URL:</strong></p>
            <a href="${leagueUrl}" style="color: #0284c7; text-decoration: none; font-weight: bold; font-size: 18px;">${leagueUrl}</a>
          </div>
          
          <p>Share this link with your league mates so they can claim their manager profiles and view the record books!</p>
          <br/>
          <p>Cheers,<br/>The Fantasy Vault Team</p>
        </div>
      `,
    });

    res.status(200).json(data);
  } catch (error) {
    console.error('Failed to send email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
}
