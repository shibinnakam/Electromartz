const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { name, brand, price, originalPrice, inStock, category, image, images, description, highlights, specifications } = body;

        const product = {
            id: body.id || Date.now().toString(),
            name,
            brand: brand || null,
            price: Number(price),
            originalPrice: originalPrice ? Number(originalPrice) : null,
            inStock: inStock !== undefined ? inStock : true,
            category,
            image: image || (images && images.length > 0 ? images[0] : null), // For backwards compatibility
            images: images || [],
            description,
            highlights: highlights || [],
            specifications: specifications || [],
            createdAt: new Date().toISOString()
        };

        await ddbDocClient.send(new PutCommand({
            TableName: process.env.PRODUCTS_TABLE,
            Item: product
        }));

        return {
            statusCode: 201,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
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
                "Access-Control-Allow-Methods": "OPTIONS,GET,POST"
            },
            body: JSON.stringify({ message: "Internal Server Error" })
        };
    }
};
