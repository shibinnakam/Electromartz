const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const crypto = require("crypto");

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
        const body = JSON.parse(event.body);
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = body;

        // Verify Signature
        const generated_signature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (generated_signature !== razorpay_signature) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ message: "Invalid payment signature" })
            };
        }

        // Update Order Status in DynamoDB
        await ddbDocClient.send(new UpdateCommand({
            TableName: process.env.ORDERS_TABLE,
            Key: { orderId: orderId },
            UpdateExpression: "set #status = :s, razorpayPaymentId = :p",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":s": "Paid", ":p": razorpay_payment_id }
        }));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: "Payment verified and order updated" })
        };
    } catch (err) {
        console.error("Payment Verification Error:", err);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: "Internal Server Error", error: err.message })
        };
    }
};
