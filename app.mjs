/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */
import { LexRuntimeV2Client, RecognizeTextCommand } from "@aws-sdk/client-lex-runtime-v2";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { KendraClient, QueryCommand   } from "@aws-sdk/client-kendra"; 


const REGION = "us-east-1";
const ENDPOINT = "https://0ihrp3n8nl.execute-api.us-east-1.amazonaws.com/test";
const client = new LexRuntimeV2Client({ region: REGION });
const mgmtAPIClient = new ApiGatewayManagementApiClient({ endpoint: ENDPOINT });

const kendraClient = new KendraClient({ region: REGION });

export const lambdaHandler = async (event, context) => {
    
     let sessionId;
     let body;
     let statusCode;

     console.log("request received: ", JSON.stringify(event));
     
     let connectionId = event.requestContext.connectionId;
     
     console.log("connectionId is: " , connectionId)
     
     try {

         if (event.requestContext.eventType == 'MESSAGE') {

             console.log("Socket event of type MESSAGE");

             let message = event.body;

             console.log("chat message received ", message);

             if (event.requestContext.connectionId !== undefined) {
                 sessionId = event.requestContext.connectionId;
                 if (sessionId.includes("=")) {
                     sessionId = sessionId.replace("=", "1");
                 }
             }
             else {
                 sessionId = "19380299d8425437";
             }

             console.log("sessionId is : ", sessionId);

             const lexParams = {
                 botName: "airlinebot",
                 botAlias: "TestBotAlias",
                 botId: "V8S0EH1BSK",
                 botAliasId: "TSTALIASID",
                 sessionId: sessionId,
                 localeId: "en_US",
                 text: message,
                 userId: "chatbot", // For example, 'chatbot-demo'.
             };


             const command = new RecognizeTextCommand(lexParams);
             const botResponse = await client.send(command);

             console.log("Success. Bot response is: ", botResponse);
             let botReplyMessage;
             if (botResponse.messages !== undefined) {
                 var msg = botResponse.messages[0];

                 console.log("Message from bot is: ", msg);
                 botReplyMessage = msg.content;

             }
             else {
                console.log("need to call Kendra");
                //botReplyMessage = "No answer found in lex! Need to call kendra!"
                
                const paramsk = {
                    IndexId: "354ea2a5-2714-4d10-9757-24c051f3841c",
                    QueryText: message
                };
            
                const command = new QueryCommand (paramsk);
                const kendraResponse = await kendraClient.send(command);
                
                console.log("data from kendra " + JSON.stringify(kendraResponse, null, 2));
                
                if(kendraResponse.TotalNumberOfResults > 0){
                    //console.log("text is: ", response.ResultItems[0].DocumentExcerpt.Text);
                    console.log("document uri is: ", kendraResponse.ResultItems[0].DocumentURI );
                    console.log("message is: " , kendraResponse.ResultItems[0].DocumentExcerpt.Text);
                    botReplyMessage = kendraResponse.ResultItems[0].DocumentExcerpt.Text;
                } else {
                    botReplyMessage = 'Can not find an answer to that!';
                }
                 
             }

             body = botReplyMessage;
             statusCode = 200;
         }
         else {
             // It is a CONNECT event! 
             statusCode = 200;
             body = 'chat initated!';
         }

     }
     catch (err) {
         console.log("Error processing the message ", err);
         body = "Sorry, an error occured! Please try again later";
         statusCode = 403;
     }

     // send a message back 
     let res;
     try {
         console.log('going to send a message back');
         
         const socketParams = {
                 ConnectionId: connectionId,
                 Data: Buffer.from(JSON.stringify(body))
             };
         
         const command1 = new PostToConnectionCommand(socketParams);
         res = await mgmtAPIClient.send(command1);
        

         console.log("data from postToConnection", JSON.stringify(res));

     }
     catch (error) {
         console.log("error while sending msg back", error);
     }

     let response = {
         isBase64Encoded: false,
         statusCode: statusCode,
         body: body
     };

     console.log("response to chat ", response);

     return response;
};