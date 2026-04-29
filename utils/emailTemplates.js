const brandColor = '#4a3728'; // text-brown
const brandColorLight = '#f5f0eb'; // cream-highlight
const brandAccent = '#8a9a5b'; // sage

const baseEmailStyles = `
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f9f9f9;
      margin: 0;
      padding: 0;
    }
    .container {
      max-w-xl: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .header {
      background-color: ${brandColorLight};
      padding: 30px;
      text-align: center;
      border-bottom: 3px solid ${brandAccent};
    }
    .header h1 {
      margin: 0;
      color: ${brandColor};
      font-family: Georgia, serif;
      font-size: 28px;
      letter-spacing: 1px;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: ${brandColor};
      font-family: Georgia, serif;
      margin-top: 0;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background-color: ${brandAccent};
      color: #ffffff;
      text-decoration: none;
      font-weight: bold;
      border-radius: 4px;
      margin-top: 20px;
    }
    .footer {
      background-color: ${brandColor};
      color: #ffffff;
      text-align: center;
      padding: 20px;
      font-size: 12px;
    }
    .footer p {
      margin: 5px 0;
      color: rgba(255,255,255,0.7);
    }
    .order-details {
      background-color: ${brandColorLight};
      padding: 20px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .order-details p {
      margin: 5px 0;
    }
  </style>
`;

exports.welcomeEmailTemplate = (name) => `
  <!DOCTYPE html>
  <html>
  <head>
    ${baseEmailStyles}
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>BAKERY & CO.</h1>
      </div>
      <div class="content">
        <h2>Welcome to Bakery & Co., ${name}! 🥐</h2>
        <p>We are absolutely thrilled to have you join our family of pastry lovers and bread enthusiasts.</p>
        <p>At Bakery & Co., we believe in the magic of freshly baked goods, made with love and the finest ingredients. Your account is now active, and you're ready to start exploring our daily fresh batches.</p>
        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/products" class="btn">Explore Fresh Bakes</a>
      </div>
      <div class="footer">
        <p>Bakery & Co. &copy; ${new Date().getFullYear()}</p>
        <p>Artisanal Breads & Pastries</p>
      </div>
    </div>
  </body>
  </html>
`;

exports.passwordResetTemplate = (resetUrl) => `
  <!DOCTYPE html>
  <html>
  <head>
    ${baseEmailStyles}
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>BAKERY & CO.</h1>
      </div>
      <div class="content">
        <h2>Password Reset Request 🔐</h2>
        <p>We received a request to reset the password for your Bakery & Co. account.</p>
        <p>If you didn't make this request, you can safely ignore this email. Otherwise, click the button below to set a new password:</p>
        <a href="${resetUrl}" class="btn">Reset My Password</a>
        <p style="margin-top: 30px; font-size: 12px; color: #777;">Or copy and paste this link into your browser:<br/>${resetUrl}</p>
      </div>
      <div class="footer">
        <p>Bakery & Co. &copy; ${new Date().getFullYear()}</p>
      </div>
    </div>
  </body>
  </html>
`;

exports.orderConfirmationTemplate = (user, order) => `
  <!DOCTYPE html>
  <html>
  <head>
    ${baseEmailStyles}
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>BAKERY & CO.</h1>
      </div>
      <div class="content">
        <h2>Order Confirmed! 🥖</h2>
        <p>Thank you for your order, <strong>${user.name}</strong>!</p>
        <p>We've received your order and our bakers are getting ready to prepare your delicious treats.</p>
        
        <div class="order-details">
          <p><strong>Order ID:</strong> #${order.trackingId}</p>
          <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
          <p><strong>Total Amount:</strong> ৳${Number(order.finalPrice).toFixed(2)}</p>
        </div>
        
        <p>You can track the status of your order directly from your account dashboard.</p>
        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/customer?tab=orders" class="btn">Track My Order</a>
      </div>
      <div class="footer">
        <p>Bakery & Co. &copy; ${new Date().getFullYear()}</p>
        <p>If you have any questions, reply to this email.</p>
      </div>
    </div>
  </body>
  </html>
`;

exports.orderStatusUpdateTemplate = (user, order) => {
  let statusMessage = "Your order status has been updated.";
  let emoji = "📦";

  if (order.status === 'Processing') {
    statusMessage = "Our bakers have started preparing your order!";
    emoji = "👨‍🍳";
  } else if (order.status === 'Shipped') {
    statusMessage = "Great news! Your order is out for delivery and on its way to you.";
    emoji = "🚚";
  } else if (order.status === 'Delivered') {
    statusMessage = "Your order has been delivered! We hope you enjoy your freshly baked treats.";
    emoji = "✨";
  } else if (order.status === 'Cancelled') {
    statusMessage = "Your order has been cancelled. If you didn't request this or have questions, please contact us.";
    emoji = "❌";
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const year = new Date().getFullYear();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseEmailStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>BAKERY & CO.</h1>
        </div>
        <div class="content">
          <h2>Order Update ${emoji}</h2>
          <p>Hi <strong>${user.name}</strong>,</p>
          <p>${statusMessage}</p>

          <div class="order-details">
            <p><strong>Order ID:</strong> #${order.trackingId}</p>
            <p><strong>New Status:</strong> <span style="color: #8a9a5b; font-weight: bold;">${order.status}</span></p>
          </div>

          <a href="${clientUrl}/customer?tab=orders" class="btn">View Order Details</a>
        </div>
        <div class="footer">
          <p>Bakery & Co. &copy; ${year}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
