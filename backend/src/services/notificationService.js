const { Resend } = require('resend');
const logger = require('../utils/logger');

let resend;

function getClient() {
    if (!resend) {
        resend = new Resend(process.env.EMAIL_API_KEY);
    }
    return resend;
}

/**
 * Send a budget exceeded alert email.
 * @param {string} toEmail - Recipient email
 * @param {object} data - { currentCost, dailyLimit, timestamp }
 */
async function sendBudgetExceededEmail(toEmail, { currentCost, dailyLimit, timestamp }) {
    const client = getClient();

    const emailFrom = process.env.EMAIL_FROM || 'API Sentinel <alerts@apisentinel.dev>';

    try {
        const result = await client.emails.send({
            from: emailFrom,
            to: [toEmail],
            subject: '🚨 API Limit Reached — Account Paused',
            html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #0f172a; color: #e2e8f0; border-radius: 12px;">
          <h1 style="color: #f87171; margin-bottom: 8px;">⚠️ Budget Limit Exceeded</h1>
          <p style="color: #94a3b8; font-size: 14px;">Your API Sentinel account has been automatically paused.</p>
          
          <div style="background: #1e293b; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #94a3b8;">Current Usage</td>
                <td style="padding: 8px 0; color: #f87171; font-weight: bold; text-align: right;">$${currentCost.toFixed(4)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #94a3b8;">Daily Limit</td>
                <td style="padding: 8px 0; color: #22c55e; font-weight: bold; text-align: right;">$${dailyLimit.toFixed(4)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #94a3b8;">Triggered At</td>
                <td style="padding: 8px 0; color: #e2e8f0; text-align: right;">${new Date(timestamp).toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <p style="color: #94a3b8; font-size: 13px;">
            Your account has been paused to prevent further spending. 
            Log in to your dashboard to review usage and reactivate your account.
          </p>

          <a href="${process.env.APP_BASE_URL || '#'}" 
             style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Go to Dashboard
          </a>

          <p style="color: #475569; font-size: 11px; margin-top: 32px;">
            — API Sentinel • Financial protection for AI applications
          </p>
        </div>
      `,
        });

        logger.info('Budget exceeded email sent', { toEmail, resultId: result?.data?.id });
    } catch (err) {
        logger.error('Failed to send email', { toEmail, error: err.message });
        throw err;
    }
}

module.exports = { sendBudgetExceededEmail };
