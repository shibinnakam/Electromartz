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
        const body = JSON.parse(event.body);
        const { items, totalAmount, shippingDetails } = body;
        
        // Security: Get userId from Cognito claims
        const userId = event.requestContext.authorizer.claims.sub;
        const userEmail = event.requestContext.authorizer.claims.email;

        if (!items || items.length === 0) {
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: "Cart is empty" }) };
        }

        // Create Razorpay Order
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(totalAmount * 100), // Amount in paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        });

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
        console.error("Order Creation Error:", err);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: "Internal Server Error", error: err.message })
        };
    }
};
