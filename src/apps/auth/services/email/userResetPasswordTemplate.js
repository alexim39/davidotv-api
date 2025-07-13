export const userPasswordResetLinkEmailTemplate = (user) => {
  const year = new Date().getFullYear();
  const formattedName = user.name ? user.name.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ') 
  : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset | DavidoTV</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        body {
            font-family: 'Inter', Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #fafafa;
            color: #2d3748;
            line-height: 1.5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0,0,0,0.05);
            border: 1px solid rgba(0,0,0,0.05);
        }
        .header {
            background: linear-gradient(135deg, #8f0045 0%, #6a0033 100%);
            padding: 25px 20px;
            text-align: center;
            position: relative;
        }
        .header::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #ff9a9e 0%, #fad0c4 100%);
        }
        .logo {
            height: 32px;
            width: auto;
        }
        .content {
            padding: 30px;
        }
        h1 {
            color: #1a202c;
            margin-top: 0;
            font-size: 22px;
            font-weight: 700;
            background: linear-gradient(90deg, #8f0045 0%, #c2185b 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 20px;
        }
        .alert-badge {
            display: inline-block;
            background: #fff0f3;
            color: #8f0045;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 20px;
            border: 1px solid rgba(143, 0, 69, 0.2);
        }
        p {
            margin-bottom: 20px;
            font-size: 15px;
            color: #4a5568;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #8f0045 0%, #c2185b 100%);
            color: white !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 8px;
            font-weight: 600;
            margin: 25px 0;
            text-align: center;
            font-size: 15px;
            box-shadow: 0 4px 12px rgba(143, 0, 69, 0.2);
            transition: all 0.3s ease;
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(143, 0, 69, 0.3);
        }
        .info-box {
            background: rgba(143, 0, 69, 0.03);
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            border-left: 4px solid #8f0045;
            font-size: 14px;
        }
        .footer {
            background-color: #1a202c;
            color: #a0aec0;
            padding: 25px 20px;
            text-align: center;
            font-size: 13px;
        }
        .divider {
            height: 1px;
            background: rgba(255,255,255,0.1);
            margin: 20px 0;
        }
        @media only screen and (max-width: 600px) {
            .content {
                padding: 25px 20px;
            }
            .cta-button {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://davidotv.com/img/logo2.PNG" alt="DavidoTV Logo" class="logo">
        </div>
        
        <div class="content">
            <h1>Reset Your Password</h1>
            
            <div class="alert-badge">SECURE REQUEST</div>
            
            <p>Hi <strong>${formattedName}</strong>,</p>
            
            <p>We received a request to reset your DavidoTV account password. Click the button below to set a new password:</p>
            
            <div style="text-align: center;">
                <a href="https://davidotv.com/auth/reset-password?token=${user.resetToken}" class="cta-button">Reset Password</a>
            </div>
            
            <div class="info-box">
                <strong>Important:</strong> This link will expire in one hour. If you didn't request this change, please ignore this email or contact support if you have concerns.
            </div>
            
            <p>For security reasons, we recommend:</p>
            <ul style="padding-left: 20px; color: #4a5568;">
                <li>Creating a strong, unique password</li>
                <li>Not sharing your password with anyone</li>
                <li>Updating your password regularly</li>
            </ul>
            
            <p>If you have any trouble resetting your password, contact our support team on contact@davidotv.com</p>
            
            <p>Stay tuned for more exclusive Davido content!<br>
            <strong>The DavidoTV Team</strong></p>
        </div>
        
        <div class="footer">
            <div class="divider"></div>
            
            <p>© ${year} DavidoTV. All rights reserved.</p>
            <p style="color: #cbd5e0; font-style: italic;">"The premier fan destination for all things Davido"</p>
            
            <p style="font-size: 12px; margin-top: 20px; color: #718096;">
                This is an automated message. Please do not reply directly to this email.<br>
                <a href="https://davidotv.com/help" style="color: #a0aec0; text-decoration: none;">Help Center</a> | 
                <a href="https://davidotv.com/privacy" style="color: #a0aec0; text-decoration: none;">Privacy Policy</a>
            </p>
        </div>
    </div>
</body>
</html>
  `;
};