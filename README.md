# ELECTROMARTZ | High-End Electronic Gadgets

A professional, industry-standard e-commerce application built with a modern frontend and a scalable AWS serverless backend.

## 🚀 Features

- **Premium UI/UX**: Modern, responsive design with glassmorphism and smooth animations.
- **Serverless Architecture**: Scalable backend using AWS Lambda, API Gateway, and DynamoDB.
- **Secure Authentication**: User sign-up, login, and profile management via Amazon Cognito.
- **Dynamic Storefront**: Categorized product browsing with real-time cart management.
- **Wishlist & History**: Personalized user features including wishlist, recently viewed items, and order history.
- **Invoice Generation**: Auto-generated PDF invoices for every order using jsPDF.
- **Admin Dashboard**: Dedicated portal for managing products, categories, and orders.

## 📁 Project Structure

```text
ecommerce/
├── frontend/          # Vanilla JS, HTML5, CSS3
│   ├── assets/       # Product images and branding
│   ├── index.html    # Main entry point
│   ├── admin.html    # Admin portal
│   ├── app.js        # Core frontend logic
│   └── styles.css    # Premium styling
└── backend/           # AWS SAM (Serverless Application Model)
    ├── src/          # Lambda handler functions
    ├── template.yaml  # Infrastructure as Code (SAM)
    └── samconfig.toml # Deployment configuration
```

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+), jsPDF.
- **Backend**: AWS SAM, Node.js, AWS Lambda.
- **Auth/DB**: Amazon Cognito, Amazon DynamoDB.

## 📦 Deployment

### Frontend
Deploy the `frontend/` directory to **Netlify**, **Vercel**, or **AWS Amplify**.

### Backend
1. Navigate to the `backend/` directory.
2. Run `sam build`.
3. Run `sam deploy --guided`.

---
*Created by [shibinnakam](https://github.com/shibinnakam)*
