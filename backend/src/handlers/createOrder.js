const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
    "Content-Type": "application/json"
};

exports.handler = async (event) => {
    try {
        console.log("Starting order creation...");

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

        const order = {
            orderId: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId,
            userEmail,
            items,
            totalAmount,
            shippingDetails,
            status: "Ordered", 
            createdAt: new Date().toISOString(),
            ttl: Math.floor(Date.now() / 1000) + (60 * 24 * 60 * 60) // Expire in 60 days
        };

        console.log("Saving order to DynamoDB...");
        await ddbDocClient.send(new PutCommand({
            TableName: process.env.ORDERS_TABLE,
            Item: order
        }));

        return {
            statusCode: 201,
            headers: corsHeaders,
            body: JSON.stringify(order)
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
