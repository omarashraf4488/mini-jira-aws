# Mini Jira on AWS

A lightweight team task-management web application built on AWS.

## Live URL
http://mini-jira-alb-749364034.us-east-1.elb.amazonaws.com

## Demo Video
https://youtu.be/nOh8hZrlVe0

## Architecture
- **Frontend**: React.js served via Express on EC2
- **Backend**: Node.js/Express REST API on EC2 (Auto Scaling Group across 2 AZs)
- **Database**: DynamoDB (Tasks, Projects, Comments, Teams, Users, ActivityLog)
- **Auth**: AWS Cognito with role-based access (Manager/Employee)
- **Storage**: S3 (original images + resized thumbnails)
- **Events**: SNS + SQS for task assignment notifications
- **Scheduler**: EventBridge daily digest at 9 AM
- **Monitoring**: CloudWatch metrics and dashboard
- **CDN**: CloudFront (pending AWS account verification)
- **Load Balancer**: Application Load Balancer across 2 AZs
- **Networking**: VPC with public/private subnets, NAT Gateway

## Demo Users
- **Manager**: omar@test.com / Test1234!
- **Frontend Employee**: sara@test.com / Test1234!
- **Backend Employee**: saif@test.com  / Test1234!

## AWS Services Used
VPC, EC2, ALB, Auto Scaling, CloudFront, DynamoDB, S3, Lambda, SNS, SQS, EventBridge, Cognito, CloudWatch, IAM
## AWS Infrastructure Details
- **CloudWatch Dashboard:** mini-jira-dashboard (4 widgets: CPU, DynamoDB writes, ALB requests, DynamoDB reads)
- **CloudWatch Alarm:** mini-jira-high-cpu (triggers when CPU > 80%)
- **EventBridge Rule:** Daily digest at 9 AM cron(0 9 * * ? *)
- **SQS Queue:** mini-jira-task-queue
- **SNS Topic:** mini-jira-task-assigned (email + SQS fan-out)
- **DynamoDB Tables:** Tasks, Projects, Comments, Teams, Users, ActivityLog
- **GSIs:** teamId-index and assigneeId-index on Tasks table
- **S3 Buckets:** mini-jira-images-originals, mini-jira-images-resized
## DynamoDB Schema

### Tables and Keys

| Table | Partition Key | Sort Key | GSIs |
|-------|--------------|----------|------|
| Tasks | taskId (String) | - | teamId-index, assigneeId-index |
| Projects | projectId (String) | - | - |
| Comments | commentId (String) | - | taskId-index |
| Teams | teamId (String) | - | - |
| Users | userId (String) | - | - |
| ActivityLog | logId (String) | - | - |

### Task Item Structure
- taskId, title, description, status, priority, deadline
- assignee (email), teamId, imageUrl, imageKey
- createdAt, auditLog (array of status changes)

### Status Flow
To Do → In Progress → In Review → Done
## Team
- Omar Ashraf
