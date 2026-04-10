const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const groups = event.requestContext.authorizer.claims['cognito:groups'] || "";
        const isAdmin = groups.includes('Admins');

        let result;
        if (isAdmin) {
             result = await ddbDocClient.send(new ScanCommand({
                TableName: process.env.ORDERS_TABLE
            }));
        } else {
            result = await ddbDocClient.send(new QueryCommand({
                TableName: process.env.ORDERS_TABLE,
                IndexName: "UserIdIndex",
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: {
                    ":uid": userId
                }
            }));
        }

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(result.Items)
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
