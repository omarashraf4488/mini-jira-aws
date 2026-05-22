# Mini Jira on AWS

A lightweight team task-management web application built on AWS.

## Live URL
http://mini-jira-alb-749364034.us-east-1.elb.amazonaws.com

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

## AWS Services Used
VPC, EC2, ALB, Auto Scaling, CloudFront, DynamoDB, S3, Lambda, SNS, SQS, EventBridge, Cognito, CloudWatch, IAM

## Team
- Omar Ashraf