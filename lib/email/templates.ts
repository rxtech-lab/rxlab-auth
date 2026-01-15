const appName = process.env.NEXT_PUBLIC_APP_NAME || "RxLab Auth";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export function getVerificationEmailHtml(token: string): string {
  const verifyUrl = `${appUrl}/verify-email?token=${token}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${appName}</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="margin-top: 0;">Verify your email address</h2>
    <p>Thanks for signing up! Please click the button below to verify your email address.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Verify Email
      </a>
    </div>
    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="color: #667eea; font-size: 14px; word-break: break-all;">${verifyUrl}</p>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
  </div>
</body>
</html>
  `.trim();
}

export function getVerificationEmailText(token: string): string {
  const verifyUrl = `${appUrl}/verify-email?token=${token}`;

  return `
Verify your email address

Thanks for signing up for ${appName}! Please verify your email by clicking the link below:

${verifyUrl}

This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
  `.trim();
}

export function getPasswordResetEmailHtml(token: string): string {
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${appName}</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="margin-top: 0;">Reset your password</h2>
    <p>We received a request to reset your password. Click the button below to choose a new password.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Reset Password
      </a>
    </div>
    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="color: #667eea; font-size: 14px; word-break: break-all;">${resetUrl}</p>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
  </div>
</body>
</html>
  `.trim();
}

export function getPasswordResetEmailText(token: string): string {
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  return `
Reset your password

We received a request to reset your ${appName} password. Click the link below to choose a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
  `.trim();
}
