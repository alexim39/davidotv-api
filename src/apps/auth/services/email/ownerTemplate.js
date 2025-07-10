export const ownerEmailTemplate = (user) => {  
  const year = new Date().getFullYear();
  const formattedName = user.name ? user.name.charAt(0).toUpperCase() + user.name.slice(1).toLowerCase() : '';

  return `  
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New User Signup Notification</title>
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
        .user-card {
            background: rgba(143, 0, 69, 0.03);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 25px;
            border-left: 4px solid #8f0045;
        }
        .user-card h3 {
            margin-top: 0;
            color: #8f0045;
        }
        .detail-item {
            display: flex;
            margin-bottom: 12px;
        }
        .detail-label {
            font-weight: 600;
            color: #4a5568;
            min-width: 100px;
        }
        .detail-value {
            color: #1a202c;
            font-weight: 500;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #8f0045 0%, #c2185b 100%);
            color: white !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
            font-size: 15px;
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
            .detail-item {
                flex-direction: column;
            }
            .detail-label {
                margin-bottom: 4px;
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
            <img src="https://davidotv.com/logo.png" alt="DavidoTV Logo" class="logo">
        </div>
        
        <div class="content">
            <h1>New User Signup Notification</h1>
            
            <div class="alert-badge">ACTION REQUIRED</div>
            
            <p>A new user has signed up for DavidoTV. Here are the details:</p>
            
            <div class="user-card">
                <h3>User Information</h3>
                
                <div class="detail-item">
                    <div class="detail-label">Name:</div>
                    <div class="detail-value">${formattedName}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Email:</div>
                    <div class="detail-value">${user.email || 'Not provided'}</div>
                </div>
                
                
                <div class="detail-item">
                    <div class="detail-label">Signup Date:</div>
                    <div class="detail-value">${new Date().toLocaleDateString('en-US', {  
                        year: 'numeric',  
                        month: 'long',  
                        day: 'numeric'  
                    })}</div>
                </div>
            </div>
            
            <p style="font-weight: 500;">This user has been automatically added to our system. You may want to review their profile or send a welcome communication.</p>
            
            <div style="text-align: center;">
                <a href="https://admin.davidotv.com" class="cta-button">View User in Admin Dashboard</a>
            </div>
            
            <p style="font-size: 14px; color: #718096;">
                <strong>Note:</strong> This is an automated notification. No action is required unless you wish to engage with this new user.
            </p>
        </div>
        
        <div class="footer">
            <div class="divider"></div>
            
            <p>© ${year} DavidoTV Admin. All rights reserved.</p>
            <p style="color: #cbd5e0; font-style: italic;">"The premier fan destination for all things Davido"</p>
            
            <p style="font-size: 12px; margin-top: 20px; color: #718096;">
                You're receiving this email because you're an administrator of DavidoTV.<br>
                <a href="https://admin.davidotv.com/notifications" style="color: #a0aec0; text-decoration: none;">Manage Notifications</a>
            </p>
        </div>
    </div>
</body>
</html>
  `;  
};