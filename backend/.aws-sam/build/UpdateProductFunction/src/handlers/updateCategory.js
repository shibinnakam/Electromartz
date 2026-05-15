const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        const oldName = event.pathParameters.id;
        const { newName } = JSON.parse(event.body);

        if (!newName) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "New category name is required" })
            };
        }

        if (oldName === newName) {
            return {
                statusCode: 200,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "Names are identical" })
            };
        }

        // 1. Create new category
        await ddbDocClient.send(new PutCommand({
            TableName: process.env.CATEGORIES_TABLE,
            Item: { name: newName }
        }));

        // 2. Update products that use the old category
        const productsRes = await ddbDocClient.send(new ScanCommand({
            TableName: process.env.PRODUCTS_TABLE,
            FilterExpression: "category = :old",
            ExpressionAttributeValues: { ":old": oldName }
        }));

        for (const product of productsRes.Items) {
            await ddbDocClient.send(new UpdateCommand({
                TableName: process.env.PRODUCTS_TABLE,
                Key: { id: product.id },
                UpdateExpression: "SET category = :new",
                ExpressionAttributeValues: { ":new": newName }
            }));
        }

        // 3. Delete old category
        await ddbDocClient.send(new DeleteCommand({
            TableName: process.env.CATEGORIES_TABLE,
            Key: { name: oldName }
        }));

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Category renamed and products updated successfully" })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: error.message })
        };
    }
};
