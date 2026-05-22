import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch'

const dynamo = new DynamoDBClient({ region: 'us-east-1' })
const cloudwatch = new CloudWatchClient({ region: 'us-east-1' })

export const handler = async (event) => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body)
    
    await dynamo.send(new PutItemCommand({
      TableName: 'ActivityLog',
      Item: {
        logId: { S: Date.now().toString() },
        message: { S: body.Message },
        timestamp: { S: new Date().toISOString() }
      }
    }))

    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: 'MiniJira',
      MetricData: [{
        MetricName: 'TasksAssigned',
        Value: 1,
        Unit: 'Count'
      }]
    }))
  }
}