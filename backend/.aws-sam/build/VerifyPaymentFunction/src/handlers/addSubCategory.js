const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        const categoryName = decodeURIComponent(event.pathParameters.name);
        const body = JSON.parse(event.body);
        const { subCategoryName, image } = body;

        if (!subCategoryName || !/^[A-Za-z\s]+$/.test(subCategoryName)) {
            return {
                statusCode: 400,
                headers: { 
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "OPTIONS,GET,POST"
                },
                body: JSON.stringify({ message: "Invalid sub-category name. Only letters and spaces are allowed." })
            };
        }

        // Get the parent category
        const { Item } = await ddbDocClient.send(new GetCommand({
            TableName: process.env.CATEGORIES_TABLE,
            Key: { name: categoryName }
        }));

        if (!Item) {
            return {
                statusCode: 404,
                headers: { 
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "OPTIONS,GET,POST"
                },
                body: JSON.stringify({ message: "Category not found." })
            };
        }

        const subCategories = Item.subCategories || [];

        // Check for duplicates
        if (subCategories.some(sub => sub.name.toLowerCase() === subCategoryName.trim().toLowerCase())) {
            return {
                statusCode: 409,
                headers: { 
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "OPTIONS,GET,POST"
                },
                body: JSON.stringify({ message: "Sub-category already exists." })
            };
        }

        // Add new sub-category
        const newSubCategory = {
            name: subCategoryName.trim(),
            image: image || "",
            createdAt: new Date().toISOString()
        };

        await ddbDocClient.send(new UpdateCommand({
            TableName: process.env.CATEGORIES_TABLE,
            Key: { name: categoryName },
            UpdateExpression: "set subCategories = list_append(if_not_exists(subCategories, :empty_list), :new_sub)",
            ExpressionAttributeValues: {
                ":new_sub": [newSubCategory],
                ":empty_list": []
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
            body: JSON.stringify(newSubCategory)
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
