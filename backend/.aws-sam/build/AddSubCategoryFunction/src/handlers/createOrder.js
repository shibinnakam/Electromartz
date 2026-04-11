const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const Razorpay = require("razorpay");

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
    "Content-Type": "application/json"
};

exports.handler = async (event) => {
    try {
        console.log("Starting order creation...");

        // Diagnostic Check: Verify Environment Variables
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.error("CRITICAL: Razorpay keys are missing from environment variables!");
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    message: "Server configuration error: Razorpay keys are missing. Please check Lambda environment variables.",
                    details: "Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET"
                })
            };
        }

        const body = JSON.parse(event.body);
        const { items, totalAmount, shippingDetails } = body;
        
        // Security: Get userId from Cognito claims with safety check
        const authorizer = event.requestContext?.authorizer;
        if (!authorizer || !authorizer.claims) {
            console.error("Authorization Error: No claims found in request context");
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ message: "Unauthorized: Missing user authentication claims" })
            };
        }

        const userId = authorizer.claims.sub;
        const userEmail = authorizer.claims.email;

        if (!items || items.length === 0) {
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: "Cart is empty" }) };
        }

        console.log("Creating Razorpay order for amount:", totalAmount);
        let razorpayOrder;
        try {
            razorpayOrder = await razorpay.orders.create({
                amount: Math.round(totalAmount * 100), // Amount in paise
                currency: "INR",
                receipt: `receipt_${Date.now()}`
            });
        } catch (rzpErr) {
            console.error("Razorpay SDK Error:", rzpErr);
            return { 
                statusCode: 500, 
                headers: corsHeaders, 
                body: JSON.stringify({ message: "Razorpay order creation failed", error: rzpErr.message }) 
            };
        }

        const order = {
            orderId: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId,
            userEmail,
            items,
            totalAmount,
            shippingDetails,
            razorpayOrderId: razorpayOrder.id,
            status: "Pending", // Status will be updated to "Paid" via verifyPayment
            createdAt: new Date().toISOString()
        };

        console.log("Saving order to DynamoDB...");
        await ddbDocClient.send(new PutCommand({
            TableName: process.env.ORDERS_TABLE,
            Item: order
        }));

        return {
            statusCode: 201,
            headers: corsHeaders,
            body: JSON.stringify({
                ...order,
                razorpayKey: process.env.RAZORPAY_KEY_ID
            })
        };
    } catch (err) {
        console.error("General Order Creation Error:", err);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: "Internal Server Error", error: err.message })
        };
    }
};
