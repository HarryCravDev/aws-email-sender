import { HandlerEvent } from "../types/HandlerEvent";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  GetCommand,
  DynamoDBDocumentClient,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({
  region: process.env.REGION,
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

export async function validateEmailHasNotSentRecently(
  event: HandlerEvent
): Promise<boolean> {
  // * Look in DB using email
  const dbInput: GetCommandInput = {
    TableName: process.env.FORM_MESSAGE_DB_TABLE,
    Key: {
      email: event.email,
    },
  };

  const command = new GetCommand(dbInput);
  const result = await docClient.send(command);

  // * If email does not exist, add it to DB
  if (!result.Item) {
    const putInput: PutCommandInput = {
      TableName: process.env.FORM_MESSAGE_DB_TABLE,
      Item: {
        email: event.email,
        numberOfMessagesSent: 1,
        lastSent: new Date().toISOString(),
      },
    };

    const putCommand = new PutCommand(putInput);

    await docClient.send(putCommand);
  }
  // * If email exists, check if last sent was in the last 24 hours
  else {
    const lastSent = new Date(result.Item.lastSent);
    const now = new Date();
    const diff = now.getTime() - lastSent.getTime();
    const hours = diff / (1000 * 60 * 60);
    const updateLessThan25HoursInput: UpdateCommandInput = {
      TableName: process.env.FORM_MESSAGE_DB_TABLE,
      Key: {
        email: event.email,
      },
      UpdateExpression:
        "SET numberOfMessagesSent = numberOfMessagesSent + :val, lastSent = :now",
      ExpressionAttributeValues: {
        ":val": 1,
        ":now": now.toISOString(),
      },
    };
    const updateInput: UpdateCommandInput = {
      TableName: process.env.FORM_MESSAGE_DB_TABLE,
      Key: {
        email: event.email,
      },
      UpdateExpression:
        "SET numberOfMessagesSent = numberOfMessagesSent + :val",
      ExpressionAttributeValues: {
        ":val": 1,
      },
    };

    // TODO: Check if number of times sent is greater than 3, trigger a notification to inform someone contacting so many times.

    // * If email exists and last sent was less than 24 hours ago, return error
    if (hours < 24) {
      const updateCommand = new UpdateCommand(updateInput);
      await docClient.send(updateCommand);
      return false;
    }
    // * If email exists and last sent was more than 24 hours ago, update the record
    else {
      // * If email exists and last sent was more than 24 hours ago, update the record
      const updateCommand = new UpdateCommand(updateLessThan25HoursInput);

      await docClient.send(updateCommand);
    }
  }
  return true;
}
