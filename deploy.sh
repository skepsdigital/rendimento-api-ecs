#!/bin/bash

# Build and deploy script for ECS
set -e

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REPOSITORY=${ECR_REPOSITORY:-rendimento-proxy}
ECS_CLUSTER=${ECS_CLUSTER:-rendimento-cluster}
ECS_SERVICE=${ECS_SERVICE:-rendimento-proxy-service}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Starting deployment process..."

# Build Docker image
echo "Building Docker image..."
docker build -t $ECR_REPOSITORY:latest .

# Tag for ECR
ECR_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY
docker tag $ECR_REPOSITORY:latest $ECR_URI:latest

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

# Push to ECR
echo "Pushing image to ECR..."
docker push $ECR_URI:latest

# Update task definition with new image URI
echo "Updating task definition..."
sed "s|YOUR_ECR_URI|$ECR_URI|g; s|YOUR_ACCOUNT_ID|$AWS_ACCOUNT_ID|g" ecs-task-definition.json > ecs-task-definition-updated.json

# Register new task definition
TASK_DEFINITION_ARN=$(aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition-updated.json \
  --query 'taskDefinition.taskDefinitionArn' --output text)

echo "New task definition registered: $TASK_DEFINITION_ARN"

# Update service
echo "Updating ECS service..."
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service $ECS_SERVICE \
  --task-definition $TASK_DEFINITION_ARN

echo "Deployment completed successfully!"

# Cleanup
rm -f ecs-task-definition-updated.json
