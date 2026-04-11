const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { name, image } = body;

        if (!name || !/^[A-Za-z\s]+$/.test(name)) {
            return {
                statusCode: 400,
                headers: { 
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "OPTIONS,GET,POST"
                },
                body: JSON.stringify({ message: "Invalid category name. Only letters and spaces are allowed." })
            };
        }

        const category = {
            name: name.trim(),
            image: image || "",
            subCategories: [],
            createdAt: new Date().toISOString()
        };

        await ddbDocClient.send(new PutCommand({
            TableName: process.env.CATEGORIES_TABLE,
            Item: category,
            ConditionExpression: "attribute_not_exists(#n)",
            ExpressionAttributeNames: {
                "#n": "name"
            }
        }));

        return {
            statusCode: 201,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name })
        };
    } catch (err) {
        console.error(err);
        if (err.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { 
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "OPTIONS,GET,POST"
                },
                body: JSON.stringify({ message: "Category already exists." })
            };
        }
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
