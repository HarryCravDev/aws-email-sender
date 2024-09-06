import {
  SNSClient,
  PublishCommand,
  PublishCommandInput,
} from "@aws-sdk/client-sns";
import { HandlerEvent } from "./types/HandlerEvent";
import { validateEmailHasNotSentRecently } from "./services/Email";

const snsClient = new SNSClient({
  region: process.env.REGION,
});

const topicArn = process.env.SNS_ARN;

export const handler = async (event: HandlerEvent) => {
  console.log("Event received:", event);
  const { subject, message } = event;

    try {
        const result = await validateEmailHasNotSentRecently(event);
    
        if(!result) {
            return {
                success: false,
                message: "Email has already been sent in the last 24 hours.",
            };
        };
    } catch (error) {
        console.log("Error validating email:", error);
        return {
            success: false,
            message: "Failed to validate email.",
            error: true
        };
    }

  try {
    const emailMessage = `From ${event.email}: ${message}`;

    const snsInput: PublishCommandInput = {
      Message: emailMessage,
      Subject: subject ? subject : "No subject",
      TopicArn: topicArn,
    };

    const command = new PublishCommand(snsInput);
    await snsClient.send(command);
    return {
      success: true,
      message: "Message sent.",
    };
  } catch (error) {
    console.error("Error publishing to SNS:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send message." }),
    };
  }
};
