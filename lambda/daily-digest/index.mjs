import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'

const dynamo = new DynamoDBClient({ region: 'us-east-1' })
const sns = new SNSClient({ region: 'us-east-1' })
const SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:717094201142:mini-jira-task-assigned'

export const handler = async () => {
  const today = new Date().toISOString().split('T')[0]
  const result = await dynamo.send(new ScanCommand({
    TableName: 'Tasks',
    FilterExpression: '#deadline = :today AND #status <> :done',
    ExpressionAttributeNames: { '#deadline': 'deadline', '#status': 'status' },
    ExpressionAttributeValues: { ':today': { S: today }, ':done': { S: 'Done' } }
  }))

  const tasks = result.Items || []
  if (tasks.length > 0) {
    const message = tasks.map(t => `- ${t.title?.S} assigned to ${t.assignee?.S}`).join('\n')
    await sns.send(new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: `Mini Jira Daily Digest - ${today}`,
      Message: `Tasks due today:\n\n${message}`
    }))
  }
  return { statusCode: 200 }
}