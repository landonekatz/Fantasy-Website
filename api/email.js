import nodemailer from 'nodemailer';

// Create a transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, slug, joinCode, origin } = req.body;

  if (!email || !slug || !joinCode || !origin) {
    return res.status(400).json({ error: 'Missing email, slug, joinCode, or origin parameters' });
  }

  const inviteLink = `${origin}/${slug}?join=${joinCode}`;

  try {
    const info = await transporter.sendMail({
      from: `"The Fantasy Vault" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to The Fantasy Vault!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #111; color: #fff; padding: 20px; border-radius: 8px;">
          <h2 style="color: #ffd700; text-align: center;">Welcome to The Fantasy Vault</h2>
          <p>Your league archive has been successfully generated.</p>
          <div style="background-color: #222; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Invite Link:</strong> <a href="${inviteLink}" style="color: #ffd700; font-weight: bold;">${inviteLink}</a></p>
            <p style="margin: 10px 0 0 0;"><strong>Member Join Code:</strong> <span style="color: #ffd700; font-size: 1.2em; font-weight: bold;">${joinCode}</span></p>
          </div>
          <p>Share this link and code with your league mates so they can claim their profiles and access the private vault!</p>
          <p style="color: #888; font-size: 0.8em; text-align: center; margin-top: 30px;">The Fantasy Vault</p>
        </div>
      `,
    });

    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Failed to send email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
}
