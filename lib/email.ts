// Email Service
// STATUS-BASED ONLY - No per-note emails, no reminders

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const FROM_EMAIL = process.env.SMTP_FROM || 'ScopeLock <noreply@scopelock.com>';

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: EmailParams) {
  if (!process.env.SMTP_HOST) {
    console.warn('SMTP not configured, email not sent:', { to, subject });
    return;
  }

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * 1) Version uploaded → client review link
 */
export async function sendVersionUploadedEmail(
  clientEmail: string,
  clientName: string,
  token: string,
  versionNumber: number
) {
  const reviewUrl = `${APP_URL}/review/${token}`;

  await sendEmail({
    to: clientEmail,
    subject: `Video Version ${versionNumber} Ready for Review`,
    html: `
      <h2>Hi ${clientName},</h2>
      <p>Your video version ${versionNumber} is ready for review.</p>
      <p><a href="${reviewUrl}">Click here to review and add notes</a></p>
      <p>This link will take you directly to your project - no login required.</p>
    `,
  });
}

/**
 * 2) Revision submitted → editor notification
 */
export async function sendRevisionSubmittedEmail(
  editorEmail: string,
  clientName: string,
  roundNumber: number,
  noteCount: number
) {
  await sendEmail({
    to: editorEmail,
    subject: `New Revision Notes from ${clientName}`,
    html: `
      <h2>Revision Round ${roundNumber} Submitted</h2>
      <p><strong>${clientName}</strong> has submitted ${noteCount} note(s) for revision.</p>
      <p>Review the notes in your dashboard to begin working on the changes.</p>
    `,
  });
}

/**
 * 3) Final revision used → client warning
 */
export async function sendFinalRevisionUsedEmail(
  clientEmail: string,
  clientName: string,
  token: string,
  revisionCap: number
) {
  const reviewUrl = `${APP_URL}/review/${token}`;

  await sendEmail({
    to: clientEmail,
    subject: 'Included Revisions Complete',
    html: `
      <h2>Hi ${clientName},</h2>
      <p><strong>Your package includes ${revisionCap} revision round(s), which are now complete.</strong></p>
      <p>You can still approve the project or request additional changes (which may require an add-on).</p>
      <p><a href="${reviewUrl}">View your project</a></p>
    `,
  });
}

/**
 * 4) Updated version uploaded → client approval request
 */
export async function sendApprovalRequestEmail(
  clientEmail: string,
  clientName: string,
  token: string,
  versionNumber: number
) {
  const reviewUrl = `${APP_URL}/review/${token}`;

  await sendEmail({
    to: clientEmail,
    subject: `Updated Version ${versionNumber} - Ready for Approval`,
    html: `
      <h2>Hi ${clientName},</h2>
      <p>Your updated video (version ${versionNumber}) is ready for review.</p>
      <p><a href="${reviewUrl}">Review and approve your video</a></p>
      <p>If everything looks good, you can approve the project to mark it complete.</p>
    `,
  });
}

/**
 * 5) Approved → editor confirmation
 */
export async function sendProjectApprovedEmail(
  editorEmail: string,
  clientName: string,
  projectId: string
) {
  await sendEmail({
    to: editorEmail,
    subject: `Project Approved - ${clientName}`,
    html: `
      <h2>Project Approved!</h2>
      <p><strong>${clientName}</strong> has approved their project.</p>
      <p>The project is now locked and no further changes can be made.</p>
      <p>Project ID: ${projectId}</p>
    `,
  });
}
