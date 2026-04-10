const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.RATINGS_TABLE;

exports.handler = async (event) => {
    const method = event.httpMethod;

    try {
        if (method === 'GET') {
            const productId = event.queryStringParameters?.productId;
            if (!productId) return { statusCode: 400, body: "Missing productId" };

            const data = await ddbDocClient.send(new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: "productId = :p",
                ExpressionAttributeValues: { ":p": productId }
            }));

            const ratings = data.Items || [];
            const avg = ratings.length > 0 ? ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length : 0;

            return {
                statusCode: 200,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ average: avg, total: ratings.length, ratings })
            };
        }

        if (method === 'POST') {
            const userId = event.requestContext.authorizer.claims.sub;
            const { productId, rating } = JSON.parse(event.body);

            if (rating < 1 || rating > 5) return { statusCode: 400, body: "Invalid rating" };

            await ddbDocClient.send(new PutCommand({
                TableName: tableName,
                Item: { productId, userId, rating, updatedAt: new Date().toISOString() }
            }));

            return {
                statusCode: 200,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: 'Rating saved' })
            };
        }

        return { statusCode: 405, body: "Method not allowed" };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify(err) };
    }
};
