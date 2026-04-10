const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.WISHLIST_TABLE;

exports.handler = async (event) => {
    const method = event.httpMethod;
    const userId = event.requestContext.authorizer.claims.sub;

    try {
        if (method === 'GET') {
            const data = await ddbDocClient.send(new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: "userId = :u",
                ExpressionAttributeValues: { ":u": userId }
            }));
            return {
                statusCode: 200,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify(data.Items)
            };
        }

        if (method === 'POST') {
            const { productId } = JSON.parse(event.body);
            
            // Check if exists (toggle logic)
            const existing = await ddbDocClient.send(new GetCommand({
                TableName: tableName,
                Key: { userId, productId }
            }));

            if (existing.Item) {
                await ddbDocClient.send(new DeleteCommand({
                    TableName: tableName,
                    Key: { userId, productId }
                }));
                return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ action: 'removed' }) };
            } else {
                await ddbDocClient.send(new PutCommand({
                    TableName: tableName,
                    Item: { userId, productId, createdAt: new Date().toISOString() }
                }));
                return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ action: 'added' }) };
            }
        }

        return { statusCode: 405, body: "Method not allowed" };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify(err) };
    }
};
