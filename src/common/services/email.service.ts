import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromEmail: string;
  private readonly replyTo: string;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail =
      this.configService.get<string>('FROM_EMAIL') ??
      '"Saveful" <saveful@jogaadindia.com>';

    this.replyTo =
      this.configService.get<string>('REPLY_TO') ??
      '"Saveful" <saveful@jogaadindia.com>';

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT') ?? 587,
      secure: false, // STARTTLS
      requireTLS: true,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    this.transporter.verify((error) => {
      if (error) {
        this.logger.error('❌ SMTP verification failed', error);
      } else {
        this.logger.log('✅ SMTP server is ready to send emails');
      }
    });
  }

  async sendOTPEmail(
    email: string,
    otpCode: string,
    expiryMinutes: number = 10,
  ): Promise<void> {
    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- 🔒 LOCK LIGHT MODE -->
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">

<title>Your Saveful verification code</title>

<style>
  :root {
    color-scheme: light;
    supported-color-schemes: light;
  }

  body {
    margin: 0;
    padding: 0;
    background-color: #f6f3fb !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: #2b1e44 !important;
  }

  table, td {
    border-collapse: collapse;
    background-color: #f6f3fb !important;
  }

  img {
    display: block;
    border: 0;
  }

  .container {
    max-width: 600px;
    background-color: #ffffff !important;
    border-radius: 16px;
    overflow: hidden;
  }

  .content {
    padding: 32px 28px;
    text-align: center;
    background-color: #ffffff !important;
  }

  h1 {
    font-size: 22px;
    margin: 0 0 12px;
    font-weight: 700;
    color: #2b1e44 !important;
  }

  p {
    font-size: 15px;
    line-height: 1.6;
    margin: 0 0 16px;
    color: #3d3558 !important;
  }

  .otp-box {
    background-color: #f3efff !important;
    border-radius: 12px;
    padding: 20px 0;
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 6px;
    color: #2b1e44 !important;
    width: 100%;
    max-width: 320px;
    margin: 28px auto 16px;
  }

  .hint {
    font-size: 13px;
    color: #7a7391 !important;
  }

  .divider {
    height: 1px;
    background-color: #eeeaf7 !important;
    margin: 28px 0;
  }

  .logo {
    margin: 24px auto 0;
    width: 110px;
  }

  .logo-light {
    display: block;
  }

  .logo-dark {
    display: none;
  }

  .footer {
    padding: 22px;
    font-size: 13px;
    color: #7a7391 !important;
    background-color: #ffffff !important;
    text-align: center;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .logo-light {
      display: none !important;
    }
    .logo-dark {
      display: block !important;
    }
  }

  @media (max-width: 480px) {
    .content {
      padding: 26px 18px;
    }
    h1 {
      font-size: 20px;
    }
    p {
      font-size: 14px;
    }
    .otp-box {
      font-size: 26px;
      letter-spacing: 4px;
    }
  }
</style>
</head>

<body bgcolor="#f6f3fb" style="background-color:#f6f3fb;">
<table width="100%" bgcolor="#f6f3fb" style="background-color:#f6f3fb;" role="presentation">
<tr>
<td align="center" bgcolor="#f6f3fb" style="background-color:#f6f3fb; padding:16px;">

<table
  class="container"
  width="100%"
  bgcolor="#ffffff"
  style="background-color:#ffffff;"
  role="presentation"
>

<tr>
<td class="content" bgcolor="#ffffff" style="background-color:#ffffff;">

<h1>Verify your email</h1>

<p>
Welcome to Saveful.<br/>
Use the verification code below to complete your sign-up.
</p>

<div class="otp-box">
${otpCode}
</div>

<p class="hint">
This code expires in ${expiryMinutes} minutes.
</p>

<div class="divider"></div>

<p style="margin-bottom:0;">
If you didn’t request this, you can safely ignore this email.
</p>

<!-- Light mode logo -->
<img
  src="https://d3fg04h02j12vm.cloudfront.net/logo%403x.png"
  alt="Saveful logo"
  width="110"
  class="logo logo-light"
/>
<!-- Dark mode logo -->
<img
  src="https://d3fg04h02j12vm.cloudfront.net/Saveful-logo-white-Rev.webp"
  alt="Saveful logo"
  width="110"
  class="logo logo-dark"
/>

</td>
</tr>

<tr>
<td class="footer" bgcolor="#ffffff" style="background-color:#ffffff;">
© Saveful
</td>
</tr>

</table>

</td>
</tr>
</table>
</body>
</html>`;

    await this.transporter.sendMail({
      from: this.fromEmail,
      replyTo: this.replyTo,
      to: email,
      subject: 'Your Saveful Verification Code',
      html: htmlTemplate,
    });
  }

  async sendWelcomeEmail(email: string, userName: string): Promise<void> {
    console.log('📧 [EmailService] Attempting to send welcome email...');
    console.log('📧 [EmailService] To:', email);
    console.log('📧 [EmailService] Name:', userName);

    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Saveful</title>

<style>
  body {
    margin: 0;
    padding: 0;
    background-color: #f6f3fb;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: #2b1e44;
  }
  table {
    border-collapse: collapse;
  }
  img {
    display: block;
    border: 0;
  }

  .wrapper {
    width: 100%;
    padding: 20px 12px;
  }

  .container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 18px;
    overflow: hidden;
  }

  .content {
    padding: 36px 32px 32px;
  }

  h1 {
    font-size: 24px;
    line-height: 1.3;
    margin: 0 0 14px;
    font-weight: 700;
    color: #241a3d;
  }

  .intro {
    font-size: 16px;
    line-height: 1.7;
    margin-bottom: 22px;
    color: #3d3558;
  }

  .card {
    background-color: #faf8ff;
    border-radius: 14px;
    padding: 20px 18px;
    margin: 22px 0;
  }

  .feature-row {
    font-size: 15px;
    line-height: 1.6;
    padding: 8px 0;
    color: #3d3558;
  }

  .cta {
    text-align: center;
    margin: 30px 0 26px;
  }

  .cta a {
    background-color: #7b5cff;
    color: #ffffff;
    text-decoration: none;
    padding: 16px 28px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 15px;
    display: inline-block;
  }

  .soft {
    font-size: 15px;
    line-height: 1.6;
    color: #4a4366;
    margin-bottom: 14px;
  }

  .signoff {
    margin-top: 28px;
    font-size: 15px;
    color: #3d3558;
  }

  .logo {
    margin: 26px auto 0;
    width: 110px;
  }

  .logo-light {
    display: block;
  }

  .logo-dark {
    display: none;
  }

  .footer {
    padding: 22px;
    font-size: 13px;
    color: #7a7391;
    text-align: center;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .logo-light {
      display: none !important;
    }
    .logo-dark {
      display: block !important;
    }
  }

  /* Mobile tuning */
  @media (max-width: 480px) {
    .content {
      padding: 28px 20px;
    }
    h1 {
      font-size: 21px;
    }
    .intro {
      font-size: 15px;
    }
    .cta a {
      padding: 14px 22px;
    }
  }
</style>
</head>

<body>
  <table class="wrapper" width="100%" role="presentation">
    <tr>
      <td align="center">

        <table class="container" width="100%" role="presentation">

          <!-- Header image -->
          <tr>
            <td>
              <img 
                src="https://d3fg04h02j12vm.cloudfront.net/header.jpeg"
                alt="Welcome to Saveful"
                width="600"
                style="width:100%; max-width:600px;"
              />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content">

              <h1>Welcome to Saveful</h1>

              <p class="intro">
                Here's the good news.  
                You can save money on groceries without changing how you cook.
              </p>

              <p class="soft">
                Saveful helps you use the food you already have - in your fridge,
                freezer, and pantry - so you buy less, waste less, and still eat well.
              </p>

              <!-- Feature card -->
              <div class="card">
                <div class="feature-row">• No strict recipes</div>
                <div class="feature-row">• No budgeting</div>
                <div class="feature-row">• No pressure</div>
              </div>

              <p class="soft">
                If you've got <strong>60 seconds</strong>, that's all you need to get started.
              </p>

              <div class="cta">
                <a href="https://saveful.com">
                  Open Saveful and add what's in your fridge
                </a>
              </div>

              <p class="soft">
                Saveful helps you save money, save food, and save time -
                using what you already have.
              </p>

              <p class="signoff">
                With Saveful, you've got this.<br>
                - The Saveful Team
              </p>

              <!-- Light mode logo -->
              <img
                src="https://d3fg04h02j12vm.cloudfront.net/logo%403x.png"
                alt="Saveful logo"
                class="logo logo-light"
              />
              <!-- Dark mode logo -->
              <img
                src="https://d3fg04h02j12vm.cloudfront.net/Saveful-logo-white-Rev.webp"
                alt="Saveful logo"
                class="logo logo-dark"
              />

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer">
              You're receiving this email because you signed up for Saveful.<br>
              © Saveful
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

    const mailOptions = {
      from: this.fromEmail,
      replyTo: this.replyTo,
      to: email,
      subject: 'Welcome to Saveful',
      html: htmlTemplate,
    };

    console.log('📧 [EmailService] Welcome email prepared, sending...');

    // Retry logic for transient failures
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        console.log('[EmailService] Welcome email sent successfully!');
        console.log('[EmailService] Message ID:', info.messageId);
        return; 
      } catch (error: any) {
        lastError = error;
        console.error(`[EmailService] Failed to send welcome email (attempt ${attempt}/${maxRetries})`);
        console.error('[EmailService] Error:', error.message);
        
        if (error.responseCode >= 500 || attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    console.error('[EmailService] All welcome email retry attempts failed:', lastError);
    throw lastError;
  }
}

