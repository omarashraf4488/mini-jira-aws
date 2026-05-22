import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const s3 = new S3Client({ region: 'us-east-1' })

export const handler = async (event) => {
  const sourceBucket = event.Records[0].s3.bucket.name
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '))
  const destBucket = 'mini-jira-images-resized'

  const response = await s3.send(new GetObjectCommand({ Bucket: sourceBucket, Key: key }))
  const chunks = []
  for await (const chunk of response.Body) chunks.push(chunk)
  const buffer = Buffer.concat(chunks)
  
  const resized = await sharp(buffer).resize(300, 300, { fit: 'inside' }).toBuffer()
  
  await s3.send(new PutObjectCommand({
    Bucket: destBucket,
    Key: key,
    Body: resized,
    ContentType: 'image/jpeg'
  }))

  return { statusCode: 200 }
}