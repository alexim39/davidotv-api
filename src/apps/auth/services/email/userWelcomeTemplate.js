export const userWelcomeEmailTemplate = (user) => {
  const year = new Date().getFullYear();
  const formattedName = user.name ? user.name.charAt(0).toUpperCase() + user.name.slice(1).toLowerCase() : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to DavidoTV</title>
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
            padding: 30px 20px;
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
            height: 36px;
            width: auto;
        }
        .content {
            padding: 40px;
        }
        h1 {
            color: #1a202c;
            margin-top: 0;
            font-size: 28px;
            font-weight: 700;
            line-height: 1.3;
            background: linear-gradient(90deg, #8f0045 0%, #c2185b 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 20px;
        }
        h2 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #1a202c;
        }
        p {
            margin-bottom: 24px;
            font-size: 16px;
            color: #4a5568;
        }
        .features {
            margin: 30px 0;
        }
        .feature-item {
            display: flex;
            align-items: flex-start;
            margin-bottom: 16px;
            padding: 16px;
            background: rgba(143, 0, 69, 0.03);
            border-radius: 8px;
            transition: all 0.2s ease;
        }
        .feature-item:hover {
            background: rgba(143, 0, 69, 0.08);
            transform: translateX(2px);
        }
        .feature-icon {
            color: #8f0045;
            margin-right: 12px;
            font-weight: bold;
            flex-shrink: 0;
            width: 24px;
            height: 24px;
            background: rgba(143, 0, 69, 0.1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #8f0045 0%, #c2185b 100%);
            color: white !important;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            margin: 24px 0;
            text-align: center;
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(143, 0, 69, 0.2);
            transition: all 0.3s ease;
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(143, 0, 69, 0.3);
        }
        .footer {
            background-color: #1a202c;
            color: #a0aec0;
            padding: 30px 20px;
            text-align: center;
            font-size: 14px;
        }
        .social-icons {
            margin: 20px 0;
            display: flex;
            justify-content: center;
            gap: 16px;
        }
        .social-icon {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(255,255,255,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }
        .social-icon:hover {
            background: rgba(255,255,255,0.2);
            transform: scale(1.1);
        }
        .social-icon img {
            width: 18px;
            height: 18px;
        }
        .divider {
            height: 1px;
            background: rgba(255,255,255,0.1);
            margin: 20px 0;
        }
        @media only screen and (max-width: 600px) {
            .content {
                padding: 30px 20px;
            }
            h1 {
                font-size: 24px;
            }
            .cta-button {
                padding: 14px 28px;
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://davidotv.com/logo-white.png" alt="DavidoTV Logo" class="logo">
        </div>
        
        <div class="content">
            <h1>Welcome to DavidoTV, ${formattedName}!</h1>
            
            <p>We're thrilled to welcome you to the ultimate destination for all things Davido. Get ready to dive into exclusive content, connect with fellow fans, and experience music like never before.</p>
            
            <div class="features">
                <h2>Your DavidoTV experience includes:</h2>
                
                <div class="feature-item">
                    <span class="feature-icon">🎵</span>
                    <span><strong>Exclusive releases:</strong> Be the first to access new music videos and performances</span>
                </div>
                
                <div class="feature-item">
                    <span class="feature-icon">🎬</span>
                    <span><strong>Behind-the-scenes:</strong> Never-before-seen footage and studio sessions</span>
                </div>
                
                <div class="feature-item">
                    <span class="feature-icon">🔥</span>
                    <span><strong>Real-time updates:</strong> Stay informed with the latest news and announcements</span>
                </div>
                
                <div class="feature-item">
                    <span class="feature-icon">💬</span>
                    <span><strong>Vibrant community:</strong> Connect with fans worldwide in our exclusive forums</span>
                </div>
                
                <div class="feature-item">
                    <span class="feature-icon">🎤</span>
                    <span><strong>Live experiences:</strong> Special access to virtual concerts and fan events</span>
                </div>
            </div>
            
            <p>Complete your profile to unlock personalized recommendations tailored just for you.</p>
            
            <div style="text-align: center;">
                <a href="https://davidotv.com/" class="cta-button">Start Your Journey</a>
            </div>
            
            <p>Need help? Visit our <a href="https://davidotv.com/faq" style="color: #8f0045; font-weight: 500; text-decoration: none;">FAQ</a> or simply sent an email to contact@davidotv.com</p>
            
            <p>See you inside!<br>
            <strong>The DavidoTV Team</strong></p>
        </div>
        
        <div class="footer">
            <div class="social-icons">
                <a href="https://facebook.com/davidotv" class="social-icon">
                    <img src="https://davidotv.com/icons/facebook-white.png" alt="Facebook">
                </a>
                <a href="https://twitter.com/davidotv" class="social-icon">
                    <img src="https://davidotv.com/icons/twitter-white.png" alt="Twitter">
                </a>
                <a href="https://instagram.com/davidotv" class="social-icon">
                    <img src="https://davidotv.com/icons/instagram-white.png" alt="Instagram">
                </a>
                <a href="https://youtube.com/davidotv" class="social-icon">
                    <img src="https://davidotv.com/icons/youtube-white.png" alt="YouTube">
                </a>
            </div>
            
            <div class="divider"></div>
            
            <p>© ${year} DavidoTV. All rights reserved.</p>
            <p style="color: #cbd5e0; font-style: italic;">"Built by fans, for fans — celebrating the music and legacy of Davido"</p>
            
            <p style="font-size: 12px; margin-top: 20px; color: #718096;">
                You're receiving this email because you signed up for DavidoTV.<br>
                <a href="#" style="color: #a0aec0; text-decoration: none;">Unsubscribe</a> | 
                <a href="#" style="color: #a0aec0; text-decoration: none;">Manage Preferences</a> | 
                <a href="#" style="color: #a0aec0; text-decoration: none;">Privacy Policy</a>
            </p>
        </div>
    </div>
</body>
</html>
`;
}