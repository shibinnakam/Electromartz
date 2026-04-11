const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
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
        console.log("Webhook received body length:", event.body.length);
        
        const signature = event.headers["x-razorpay-signature"] || event.headers["X-Razorpay-Signature"];
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

        // 1. Verify Signature
        if (!signature || !secret) {
            console.error("Missing signature or webhook secret");
            return { statusCode: 400, body: JSON.stringify({ message: "Invalid Request" }) };
        }

        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(event.body)
            .digest("hex");

        if (expectedSignature !== signature) {
            console.error("Signature verification failed");
            return { statusCode: 400, body: JSON.stringify({ message: "Invalid Signature" }) };
        }

        const body = JSON.parse(event.body);
        const eventType = body.event;
        const payload = body.payload;

        console.log(`Processing event: ${eventType}`);

        // 2. Extract Razorpay Order ID and Set Target Status
        let razorpayOrderId;
        let targetStatus;
        let razorpayPaymentId;

        if (eventType === "order.paid") {
            razorpayOrderId = payload.order.entity.id;
            targetStatus = "Paid";
            razorpayPaymentId = payload.payment.entity.id;
        } else if (eventType === "payment.failed") {
            razorpayOrderId = payload.payment.entity.order_id;
            targetStatus = "Failed";
            razorpayPaymentId = payload.payment.entity.id;
        }

        if (razorpayOrderId) {
            // 3. Find Internal Order ID using GSI
            const queryRes = await ddbDocClient.send(new QueryCommand({
                TableName: process.env.ORDERS_TABLE,
                IndexName: "RazorpayOrderIdIndex",
                KeyConditionExpression: "razorpayOrderId = :id",
                ExpressionAttributeValues: { ":id": razorpayOrderId }
            }));

            if (queryRes.Items && queryRes.Items.length > 0) {
                const internalOrderId = queryRes.Items[0].orderId;
                console.log(`Updating order ${internalOrderId} to status ${targetStatus}`);

                // 4. Update Status in DynamoDB
                await ddbDocClient.send(new UpdateCommand({
                    TableName: process.env.ORDERS_TABLE,
                    Key: { orderId: internalOrderId },
                    UpdateExpression: "set #status = :s, razorpayPaymentId = :p",
                    ExpressionAttributeNames: { "#status": "status" },
                    ExpressionAttributeValues: { 
                        ":s": targetStatus, 
                        ":p": razorpayPaymentId || "N/A" 
                    }
                }));
                console.log("Order updated successfully via webhook");
            } else {
                console.warn(`No order found matching Razorpay Order ID: ${razorpayOrderId}`);
            }
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: "Webhook processed" })
        };

    } catch (err) {
        console.error("Webhook Error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error" })
        };
    }
};
