const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        const productId = event.pathParameters.id;
        const body = JSON.parse(event.body);
        const { name, price, category, image } = body;

        if (!productId) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "Product ID is required" })
            };
        }

        const product = {
            id: productId,
            name,
            price: Number(price),
            category,
            image,
            updatedAt: new Date().toISOString()
        };

        await ddbDocClient.send(new PutCommand({
            TableName: process.env.PRODUCTS_TABLE,
            Item: product
        }));

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(product)
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            headers: { 
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
            },
            body: JSON.stringify({ message: "Internal Server Error" })
        };
    }
};
